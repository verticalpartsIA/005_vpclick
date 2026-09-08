// Relato real de usuário (2026-09-08): tela travava durante uso ativo (não só
// aba em segundo plano), sem nenhuma request de rede aparecendo, só resolvia
// com F5. Achado ao investigar o código-fonte do processLock (@supabase/auth-js
// lib/locks.js): ele só põe timeout na ESPERA pela operação anterior liberar o
// lock — a operação que já está DE POSSE do lock roda como `await fn()` sem
// nenhum teto. Se essa operação travar num jeito que não é um fetch normal
// (ex.: uma race interna da própria lib, um estado inconsistente do token), o
// timeout do fetch (ver supabase.ts) nunca chega a entrar em cena — o lock
// fica preso pra sempre e toda chamada seguinte na aba (criar tarefa, abrir
// uma tela, etc.) fica na fila esperando um lock que nunca será liberado, sem
// erro nenhum na tela.
//
// withLockTimeout adiciona um teto na PRÓPRIA operação protegida pelo lock
// (não só na fila de espera por ela, que a lib já cobre): se `fn()` não
// resolver nem rejeitar a tempo, o lock é forçado a liberar — a operação
// original, órfã, é ignorada se terminar depois — e quem chamou recebe um
// erro de verdade em vez de travar pra sempre.

export class LockOperationTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Lock "${name}" não liberou em ${timeoutMs}ms — forçando liberação pra não travar o app.`);
    this.name = 'LockOperationTimeoutError';
  }
}

type LockFn<R> = () => Promise<R>;
type Lock = <R>(name: string, acquireTimeout: number, fn: LockFn<R>) => Promise<R>;

export function withLockTimeout(baseLock: Lock, timeoutMs: number): Lock {
  return <R>(name: string, acquireTimeout: number, fn: LockFn<R>): Promise<R> => {
    return baseLock<R>(name, acquireTimeout, () => {
      return new Promise<R>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          console.warn(`lockTimeout: lock "${name}" travado além do esperado, liberando à força.`);
          reject(new LockOperationTimeoutError(name, timeoutMs));
        }, timeoutMs);
        fn().then(
          (result) => {
            if (settled) return; // já liberamos à força; ignora resolução tardia da operação órfã
            settled = true;
            clearTimeout(timer);
            resolve(result);
          },
          (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        );
      });
    });
  };
}
