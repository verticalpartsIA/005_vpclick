import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBackgroundTabRecovery } from '../lib/backgroundTabRecovery';
import { supabase } from '../lib/supabase';

// Regressão do relato real (2026-10): usuário se afasta da aba, volta, clica
// numa tarefa e nada acontece — a trava interna do supabase-js (ver
// lockTimeout.ts) fica presa depois de a aba passar tempo em segundo plano, e
// só um F5 manual resolvia. startBackgroundTabRecovery detecta a volta da
// aba e se recupera sozinha, sem esperar o usuário tentar usar a tela.

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('startBackgroundTabRecovery', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let getSessionSpy: ReturnType<typeof vi.spyOn>;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
    });
  });

  afterEach(() => {
    stop?.();
    getSessionSpy?.mockRestore();
    vi.useRealTimers();
  });

  it('does nothing if the tab was hidden only briefly', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(5_000); // bem menos que o limiar de 60s
    setVisibility('visible');

    expect(getSessionSpy).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('checks the session (without reloading) when hidden long enough and the session responds fine', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000); // acima do limiar de 60s
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reloads the page if the session check hangs (the stuck-lock case)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockReturnValue(new Promise(() => {})); // nunca resolve — trava presa
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');

    expect(reloadSpy).not.toHaveBeenCalled(); // ainda dentro do teto de recuperação
    await vi.advanceTimersByTimeAsync(8_000);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('reloads the page if the session check rejects', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockRejectedValue(new Error('lock travado'));
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('stops listening after the returned cleanup function runs', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    const cleanup = startBackgroundTabRecovery();
    cleanup();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(getSessionSpy).not.toHaveBeenCalled();
  });
});
