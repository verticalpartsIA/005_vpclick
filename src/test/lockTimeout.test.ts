import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withLockTimeout, LockOperationTimeoutError } from '../lib/lockTimeout';

// Regressão do relato real de usuário (2026-09-08): tela travava sem
// nenhuma request de rede, só resolvia com F5 — processLock (a lib de
// autenticação do Supabase) não põe teto na operação que já detém o lock,
// só na fila de espera por ela. Se essa operação nunca resolver nem
// rejeitar, o app trava pra sempre. withLockTimeout deve forçar a
// liberação depois do timeout configurado.

// Fake do processLock real (@supabase/auth-js lib/locks.js): serializa
// chamadas com o mesmo `name`, uma de cada vez, aguardando a anterior
// terminar antes de rodar `fn()` — comportamento mínimo suficiente pra
// testar que withLockTimeout de fato libera a fila mesmo quando uma
// operação trava.
function makeFakeProcessLock() {
  const queues: Record<string, Promise<any>> = {};
  return async <R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
    const previous = queues[name] ?? Promise.resolve();
    const run = previous.catch(() => {}).then(fn);
    queues[name] = run.catch(() => {});
    return run;
  };
}

describe('withLockTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves normally when the operation finishes before the timeout', async () => {
    const baseLock = makeFakeProcessLock();
    const lock = withLockTimeout(baseLock, 5000);

    const result = await lock('auth', 1000, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('propagates a normal rejection from the operation without waiting for the timeout', async () => {
    const baseLock = makeFakeProcessLock();
    const lock = withLockTimeout(baseLock, 5000);

    await expect(lock('auth', 1000, async () => { throw new Error('falhou de verdade'); })).rejects.toThrow('falhou de verdade');
  });

  it('force-releases the lock when the operation never settles, so the caller gets an error instead of hanging forever', async () => {
    const baseLock = makeFakeProcessLock();
    const lock = withLockTimeout(baseLock, 5000);

    // Operação que nunca resolve nem rejeita — exatamente o cenário real
    // relatado (um `fn()` travado dentro do lock, sem fetch nenhum rodando).
    const stuckPromise = lock('auth', 1000, () => new Promise<void>(() => {}));

    const assertion = expect(stuckPromise).rejects.toBeInstanceOf(LockOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('unblocks a QUEUED second call even while the first one stays stuck forever (the actual freeze the user hit)', async () => {
    const baseLock = makeFakeProcessLock();
    const lock = withLockTimeout(baseLock, 5000);

    // Primeira operação trava pra sempre (ex.: getSession() preso).
    const first = lock('auth', 1000, () => new Promise<void>(() => {}));
    first.catch(() => {}); // não deixa o unhandled rejection vazar pro teste

    // Segunda chamada, na fila atrás da primeira — sem o fix, ficaria presa
    // pra sempre esperando a primeira "liberar" o lock, mesmo travada.
    const second = lock('auth', 1000, async () => 'segunda operação rodou');

    await vi.advanceTimersByTimeAsync(5000);
    await expect(second).resolves.toBe('segunda operação rodou');
  });

  it('ignores a late resolution from the orphaned operation after the timeout already fired', async () => {
    const baseLock = makeFakeProcessLock();
    const lock = withLockTimeout(baseLock, 5000);

    let resolveOrphan: (v: string) => void;
    const orphan = new Promise<string>((resolve) => { resolveOrphan = resolve; });

    const stuckPromise = lock('auth', 1000, () => orphan);
    const assertion = expect(stuckPromise).rejects.toBeInstanceOf(LockOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    // A operação órfã finalmente termina — não deve gerar unhandled
    // rejection nem afetar mais nada, já que quem chamou já recebeu o erro.
    expect(() => resolveOrphan('tarde demais')).not.toThrow();
  });
});
