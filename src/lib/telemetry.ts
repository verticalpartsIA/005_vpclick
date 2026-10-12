// Telemetria opcional (Sentry). Só liga se VITE_SENTRY_DSN estiver definido no
// build; sem ele, tudo aqui é no-op e o SDK nem é baixado (import dinâmico).
//
// Objetivo: medir, com todos os usuários somados, quantas vezes a sessão cai,
// o SSO falha ou a pessoa é mandada ao portal (ver authEvents.ts). Eventos de
// auth são enviados como mensagens de nível info, agrupadas por nome; nunca
// levam token nem e-mail (dataCollection desligado, sem identificação de usuário).
type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
const pending: Array<[string, string | undefined]> = [];

function dsn(): string {
  try {
    return (import.meta as any).env?.VITE_SENTRY_DSN || '';
  } catch {
    return '';
  }
}

export function initTelemetry(): void {
  const key = dsn();
  if (!key) return;
  import('@sentry/react')
    .then((mod) => {
      mod.init({
        dsn: key,
        environment: window.location.hostname,
        release: typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : undefined,
        // No SDK 11 o padrão coleta cookies, cabeçalhos, corpos HTTP e query da
        // URL; aqui nada disso sai (a sessão do Supabase fica em storage/headers).
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        tracesSampleRate: 0,
      });
      sentry = mod;
      pending.splice(0).forEach(([name, detail]) => reportTelemetryEvent(name, detail));
    })
    .catch(() => {
      // Sem rede ou bloqueado por extensão — medição é opcional.
    });
}

export function reportTelemetryEvent(name: string, detail?: string): void {
  if (!dsn()) return;
  if (!sentry) {
    if (pending.length < 20) pending.push([name, detail]);
    return;
  }
  try {
    sentry.captureMessage(`vpclick:${name}`, {
      level: 'info',
      tags: { kind: 'auth' },
      extra: detail ? { detail } : undefined,
      fingerprint: [name],
    });
  } catch {
    // nunca quebra a UI por causa de telemetria
  }
}
