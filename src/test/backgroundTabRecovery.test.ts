import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBackgroundTabRecovery } from '../lib/backgroundTabRecovery';
import { subscribeRecoveryNotice, dismissRecoveryNotice, type RecoveryNotice } from '../lib/recoveryNotice';
import { supabase } from '../lib/supabase';

// Política: a página NUNCA recarrega sozinha (derrubava o que o usuário estava
// digitando). Ao voltar para a aba depois de um tempo, a recuperação checa a
// sessão e, se ela estiver presa ou quebrada, apenas AVISA (recoveryNotice).
// Disputa transitória de lock entre abas não avisa nem recarrega.

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('startBackgroundTabRecovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let getSessionSpy: ReturnType<typeof vi.spyOn>;
  let stop: () => void;
  let unsubscribe: () => void;
  let notice: RecoveryNotice | null;

  beforeEach(() => {
    vi.useFakeTimers();
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
    });
    dismissRecoveryNotice();
    notice = null;
    unsubscribe = subscribeRecoveryNotice((n) => { notice = n; });
  });

  afterEach(() => {
    stop?.();
    unsubscribe?.();
    getSessionSpy?.mockRestore();
    vi.useRealTimers();
  });

  async function awayAndBack(ms = 120_000) {
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(ms);
    setVisibility('visible');
  }

  it('does nothing if the tab was hidden only briefly', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();
    await awayAndBack(5_000);
    expect(getSessionSpy).not.toHaveBeenCalled();
    expect(notice).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('refreshes the data (onResume) after a long absence, and not after a brief one', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    const onResume = vi.fn();
    stop = startBackgroundTabRecovery(onResume);
    await awayAndBack(5_000);
    expect(onResume).not.toHaveBeenCalled();
    await awayAndBack(120_000);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('stays silent when the session responds fine', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();
    await awayAndBack();
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(notice).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('warns (never reloads) when getSession() resolves with a real error', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ error: { message: 'Invalid Refresh Token' } } as any);
    stop = startBackgroundTabRecovery();
    await awayAndBack();
    expect(notice).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does not warn on a transient LockManager/isAcquireTimeout error', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ error: { isAcquireTimeout: true, message: 'x' } } as any);
    stop = startBackgroundTabRecovery();
    await awayAndBack();
    expect(notice).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('warns (never reloads) if the session check hangs (stuck-lock case)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockImplementation(() => new Promise(() => {}) as any);
    stop = startBackgroundTabRecovery();
    await awayAndBack();
    expect(notice).toBeNull(); // ainda dentro do teto de espera
    await vi.advanceTimersByTimeAsync(21_000);
    expect(notice).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('warns (never reloads) if the session check rejects', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockRejectedValue(new Error('boom'));
    stop = startBackgroundTabRecovery();
    await awayAndBack();
    expect(notice).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('also reacts to window blur/focus alone', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockImplementation(() => new Promise(() => {}) as any);
    stop = startBackgroundTabRecovery();
    window.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(21_000);
    expect(notice).not.toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
