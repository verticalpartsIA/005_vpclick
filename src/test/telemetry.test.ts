import { describe, it, expect, vi } from 'vitest';

// Sem VITE_SENTRY_DSN a telemetria é no-op: não baixa o SDK e não lança erro.
describe('telemetry sem DSN', () => {
  it('initTelemetry e reportTelemetryEvent não fazem nada nem lançam', async () => {
    const { initTelemetry, reportTelemetryEvent } = await import('../lib/telemetry');
    expect(() => initTelemetry()).not.toThrow();
    expect(() => reportTelemetryEvent('signed_out_event', 'x')).not.toThrow();
  });

  it('logAuthEvent continua gravando local mesmo com telemetria desligada', async () => {
    localStorage.clear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { logAuthEvent, readAuthEvents } = await import('../lib/authEvents');
    logAuthEvent('sso_entry_ok');
    expect(readAuthEvents().at(-1)?.type).toBe('sso_entry_ok');
  });
});
