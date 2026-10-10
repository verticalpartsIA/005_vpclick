import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBackgroundTabRecovery } from '../lib/backgroundTabRecovery';
import { supabase } from '../lib/supabase';

// Regressão do relato real (2026-10): usuário se afasta da aba, volta, clica
// numa tarefa e nada acontece — a trava interna do supabase-js (ver
// lockTimeout.ts) fica presa depois de a aba passar tempo em segundo plano, e
// só um F5 manual resolvia. startBackgroundTabRecovery detecta a volta da
// aba e se recupera sozinha, sem esperar o usuário tentar usar a tela.
//
// Segunda rodada do mesmo relato: o usuário continuou vendo o travamento
// mesmo com o fix de visibilitychange já no ar — porque ele alternava com
// OUTRA JANELA (não trocava de aba), e o Chrome não necessariamente marca a
// aba como "hidden" só por perder o foco da janela. Os testes de
// blur/focus abaixo cobrem exatamente esse caso.

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function blurWindow() {
  window.dispatchEvent(new Event('blur'));
}

function focusWindow() {
  window.dispatchEvent(new Event('focus'));
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
    sessionStorage.clear(); // evita que o guard de cooldown vaze de um teste pro outro
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
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000); // acima do limiar de 60s
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  // Achado de review (Codex, PR #260): getSession() não REJEITA quando a
  // sessão está quebrada (ex.: refresh token inválido depois de muito tempo
  // ausente) — ela RESOLVE normalmente com `error` preenchido dentro da
  // resposta (mesmo formato que App.tsx.checkSession já trata). Tratar
  // qualquer resolução como "saudável" sem olhar esse campo deixava esse
  // caso passar batido: a trava nem travou, mas a sessão em si está morta.
  it('reloads the page when getSession() RESOLVES with an error field (broken session, not a rejection)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid Refresh Token' },
    } as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  // REGRESSÃO (mesmo dia, PR #260): o fix acima não distinguia um erro
  // genuíno de sessão quebrada de `isAcquireTimeout`/LockManager — que é só
  // duas abas/dispositivos disputando a mesma trava ao mesmo tempo, e que
  // App.tsx.checkSession() já trata como transitório (não desloga, não
  // recarrega, só pede pra tentar de novo). Sem essa distinção, qualquer
  // disputa normal de trava (comum com o site aberto em celular + computador
  // juntos) recarregava a página — e como o reload refaz a mesma disputa,
  // podia se repetir, parecendo "o site fica se reinicializando sozinho".
  it('does NOT reload on a transient LockManager/isAcquireTimeout error — that is normal multi-tab contention, not a broken session', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: { isAcquireTimeout: true, message: 'Acquiring an exclusive Navigator LockManager lock "lock:vp-click-user-auth" timed out' },
    } as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does NOT reload on a LockManager error identified only by message (no isAcquireTimeout flag)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: { message: 'LockManager lock request timed out' },
    } as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  // Teto de segurança: mesmo que alguma causa futura ainda não prevista force
  // reload repetidas vezes, nunca pode passar de 1 a cada 5min — trava dura
  // contra qualquer loop, independente da causa.
  it('never fires two automatic reloads within the cooldown window, regardless of cause', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockRejectedValue(new Error('lock travado'));
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // Volta a ficar ausente tempo suficiente de novo, mas o total decorrido
    // (~140s) ainda está bem dentro do cooldown de 5min desde o reload acima.
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(reloadSpy).toHaveBeenCalledTimes(1); // continua 1 — o segundo foi suprimido pelo cooldown
  });

  it('reloads the page if the session check hangs (the stuck-lock case)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockReturnValue(new Promise(() => {})); // nunca resolve — trava presa
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');

    expect(reloadSpy).not.toHaveBeenCalled(); // ainda dentro do teto de recuperação
    await vi.advanceTimersByTimeAsync(20_000);
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

  it('recovers on window blur/focus alone, without any visibilitychange event (the window-not-tab case)', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();

    blurWindow();
    await vi.advanceTimersByTimeAsync(70_000);
    focusWindow();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reloads on window focus alone if the session check hangs', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockReturnValue(new Promise(() => {}));
    stop = startBackgroundTabRecovery();

    blurWindow();
    await vi.advanceTimersByTimeAsync(70_000);
    focusWindow();

    expect(reloadSpy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not double-check when both visibilitychange and focus fire for the same return', async () => {
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({} as any);
    stop = startBackgroundTabRecovery();

    setVisibility('hidden');
    blurWindow();
    await vi.advanceTimersByTimeAsync(70_000);
    setVisibility('visible');
    focusWindow(); // dispara logo em seguida, como o navegador normalmente faz
    await vi.advanceTimersByTimeAsync(0);

    expect(getSessionSpy).toHaveBeenCalledTimes(1);
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
