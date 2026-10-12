// Registro local de eventos de autenticação/SSO, para medir quantas vezes a
// pessoa é mandada de volta ao portal e por quê (hipótese: queda de sessão →
// redirecionamento ao vpsistema → novo SSO, percebido como "reinício").
// Guarda os últimos eventos em localStorage (anel de 50) e escreve no console.
// Para ler no navegador do usuário: readAuthEvents() ou a chave 'vp-auth-events'.
// Nunca grava token nem e-mail; nunca lança erro.
export type AuthEventType =
  | 'sso_entry_ok'
  | 'sso_entry_fail'
  | 'signed_out_event'
  | 'redirect_to_portal'
  | 'session_expired_screen';

export interface AuthEvent {
  at: string;
  type: AuthEventType;
  detail?: string;
}

const KEY = 'vp-auth-events';
const MAX_EVENTS = 50;

export function logAuthEvent(type: AuthEventType, detail?: string): void {
  try {
    console.info(`[auth-event] ${type}${detail ? ` — ${detail}` : ''}`);
    const list: AuthEvent[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push({ at: new Date().toISOString(), type, detail });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_EVENTS)));
  } catch {
    // localStorage indisponível ou JSON corrompido — medição é opcional.
  }
}

export function readAuthEvents(): AuthEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
