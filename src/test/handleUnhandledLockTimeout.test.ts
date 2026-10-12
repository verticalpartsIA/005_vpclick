import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleUnhandledLockTimeout } from '../lib/supabase';
import { LockOperationTimeoutError } from '../lib/lockTimeout';
import { subscribeRecoveryNotice, dismissRecoveryNotice } from '../lib/recoveryNotice';

// Regressão de um relato ao vivo (2026-10, console do usuário): o teto de
// 25s em withLockTimeout funciona (força a liberação da trava e não deixa o
// app travar pra sempre), mas a Promise que ele rejeita é interna ao
// supabase-js — ninguém no App espera por ela, então vira um "Uncaught (in
// promise)" global e a tela fica muda (nenhum toast, nenhum retry). Este
// handler pega especificamente esse erro no nível de window e recarrega a
// página, a única recuperação confiável quando a trava de autenticação da
// aba já está confirmada quebrada.

describe('handleUnhandledLockTimeout', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses the console error and warns the user, WITHOUT reloading, for a LockOperationTimeoutError', () => {
    dismissRecoveryNotice();
    const seen: unknown[] = [];
    const off = subscribeRecoveryNotice((n) => seen.push(n));
    const preventDefault = vi.fn();
    const event = { reason: new LockOperationTimeoutError('lock:vp-click-user-auth', 25_000), preventDefault };

    handleUnhandledLockTimeout(event);

    off();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignores unrelated unhandled rejections — does not reload for a normal error', () => {
    const preventDefault = vi.fn();
    const event = { reason: new Error('falha de rede qualquer'), preventDefault };

    handleUnhandledLockTimeout(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignores a rejection whose reason is not an Error at all (e.g. a rejected string/object)', () => {
    const preventDefault = vi.fn();
    const event = { reason: 'alguma string rejeitada', preventDefault };

    handleUnhandledLockTimeout(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
