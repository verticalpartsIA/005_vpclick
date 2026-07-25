// Rastro de acesso cross-sistema: envia eventos "enter"/"exit" para a edge
// function pública do portal (vpsistema), que consolida uma timeline de
// quando cada colaborador entra e sai de cada sistema satélite.
//
// Fire-and-forget por design: nunca deve travar nem quebrar a UI do VPClick
// se o endpoint estiver fora do ar, a env var não estiver configurada, ou o
// navegador bloquear a chamada. Todos os erros são engolidos silenciosamente.
const TRACK_URL = 'https://ubdkoqxfwcraftesgmbw.supabase.co/functions/v1/track-activity';
const APP_KEY = 'vpclick';
const SESSION_STORAGE_KEY = 'vp_track_session_id';

function getTrackKey(): string {
  try {
    return (import.meta as any).env?.VITE_TRACK_ACTIVITY_KEY || '';
  } catch {
    return '';
  }
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // sessionStorage indisponível (modo privado etc.) — usa um id efêmero,
    // válido só para esta chamada.
    return crypto.randomUUID();
  }
}

function buildPayload(eventType: 'enter' | 'exit', userEmail: string, userName: string) {
  return {
    app: APP_KEY,
    event_type: eventType,
    user_email: userEmail,
    user_name: userName,
    session_id: getOrCreateSessionId(),
    track_key: getTrackKey(),
  };
}

// Chamar uma única vez, assim que a identidade do usuário (e-mail) estiver
// disponível — não em loop, não a cada render.
export function trackEnter(userEmail: string, userName: string): void {
  try {
    if (!getTrackKey() || !userEmail) return;
    const payload = buildPayload('enter', userEmail, userName);
    // Fire-and-forget: não bloqueia o render, erro de rede é ignorado.
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // silencioso — não deve afetar a UI
    });
  } catch {
    // silencioso
  }
}

// Chamado no pagehide da aba. Usa sendBeacon (ao invés de fetch) porque
// precisa completar mesmo com a página sendo descartada; sendBeacon não
// aceita headers customizados, por isso o track_key vai no corpo do POST.
export function trackExit(userEmail: string, userName: string): void {
  try {
    if (!getTrackKey() || !userEmail) return;
    const payload = buildPayload('exit', userEmail, userName);
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const sent = navigator.sendBeacon?.(TRACK_URL, blob);
    if (!sent) {
      // Fallback para navegadores sem sendBeacon (raro) — best effort.
      fetch(TRACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // silencioso
  }
}
