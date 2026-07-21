import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const toastMessage = vi.fn();
vi.mock("sonner", () => ({
  toast: { message: (...args: any[]) => toastMessage(...args) },
}));

import { startVersionCheck } from "../lib/versionCheck";

describe("startVersionCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("__APP_BUILD_TIME__", "2026-07-21T10:00:00.000Z");
    vi.useFakeTimers();
    toastMessage.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("notifies once a newer build is published on the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ buildTime: "2026-07-21T12:30:00.000Z", commit: "abc123" }),
      }),
    );

    const stop = startVersionCheck();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(toastMessage).toHaveBeenCalledTimes(1);
    expect(toastMessage.mock.calls[0][0]).toContain("21/07/2026");
    expect(toastMessage.mock.calls[0][0]).toContain("12:30");

    // Um novo ciclo não deve duplicar o aviso.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(toastMessage).toHaveBeenCalledTimes(1);

    stop();
  });

  it("does not notify while the deployed version matches the running one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ buildTime: "2026-07-21T10:00:00.000Z", commit: "abc123" }),
      }),
    );

    const stop = startVersionCheck();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(toastMessage).not.toHaveBeenCalled();
    stop();
  });

  it("checks again when the tab becomes visible", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ buildTime: "2026-07-21T10:00:00.000Z", commit: "a" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ buildTime: "2026-07-21T18:00:00.000Z", commit: "b" }) });
    vi.stubGlobal("fetch", fetchMock);

    const stop = startVersionCheck();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(toastMessage).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(toastMessage).toHaveBeenCalledTimes(1));

    stop();
  });
});
