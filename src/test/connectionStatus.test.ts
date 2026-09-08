import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeSlowConnection, trackRequestForSlowness } from '../lib/connectionStatus';

// Regressão da investigação da trava de ~25s (2026-09-08): toda chamada ao
// Supabase passa por um fetch que, se a rede estiver ruim, pode demorar até o
// teto do lockTimeout — a tela fica muda nesse meio tempo. Aqui só testamos o
// rastreamento de "fetch demorando", que App.tsx usa pra mostrar um toast.

describe('connectionStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not flag a request that settles before the slow threshold', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSlowConnection(listener);
    listener.mockClear(); // ignora a chamada inicial de sincronização

    let resolveFast: (v: string) => void;
    const fast = new Promise<string>((resolve) => { resolveFast = resolve; });
    const tracked = trackRequestForSlowness(fast);

    resolveFast!('ok');
    await tracked;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('flags a request that takes longer than the slow threshold, and clears when it settles', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSlowConnection(listener);
    listener.mockClear();

    let resolveSlow: (v: string) => void;
    const slow = new Promise<string>((resolve) => { resolveSlow = resolve; });
    const tracked = trackRequestForSlowness(slow);

    await vi.advanceTimersByTimeAsync(3_500);
    expect(listener).toHaveBeenCalledWith(true);

    resolveSlow!('ok');
    await tracked;
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('stays flagged as slow while at least one of several concurrent requests is still pending', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSlowConnection(listener);

    let resolveA: (v: string) => void;
    let resolveB: (v: string) => void;
    const a = trackRequestForSlowness(new Promise<string>((r) => { resolveA = r; }));
    const b = trackRequestForSlowness(new Promise<string>((r) => { resolveB = r; }));

    await vi.advanceTimersByTimeAsync(3_500);
    listener.mockClear();

    resolveA!('ok');
    await a;
    // "a" resolveu mas "b" ainda está pendurada — não deve limpar o aviso.
    expect(listener).not.toHaveBeenCalledWith(false);

    resolveB!('ok');
    await b;
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
  });

  it('a newly subscribed listener is synced with the current state immediately', async () => {
    let resolveSlow: (v: string) => void;
    const tracked = trackRequestForSlowness(new Promise<string>((r) => { resolveSlow = r; }));
    await vi.advanceTimersByTimeAsync(3_500);

    const lateListener = vi.fn();
    subscribeSlowConnection(lateListener);
    expect(lateListener).toHaveBeenCalledWith(true);

    resolveSlow!('ok');
    await tracked;
  });
});
