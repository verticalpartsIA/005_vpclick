import { describe, it, expect, beforeEach } from 'vitest';
import { shouldAutoRedirectToPortal } from '../lib/loginRedirect';
import { logAuthEvent, readAuthEvents } from '../lib/authEvents';

describe('shouldAutoRedirectToPortal', () => {
  it('redireciona em produção quem chegou sem sessão anterior', () => {
    expect(shouldAutoRedirectToPortal({ entradaSomentePeloPortal: true })).toBe(true);
  });
  it('não redireciona quando a sessão expirou com a página aberta', () => {
    expect(shouldAutoRedirectToPortal({ entradaSomentePeloPortal: true, sessionExpired: true })).toBe(false);
  });
  it('não redireciona quando o SSO falhou nesta visita', () => {
    expect(shouldAutoRedirectToPortal({ entradaSomentePeloPortal: true, ssoError: 'x' })).toBe(false);
  });
  it('nunca redireciona fora de produção', () => {
    expect(shouldAutoRedirectToPortal({ entradaSomentePeloPortal: false })).toBe(false);
  });
});

describe('logAuthEvent', () => {
  beforeEach(() => localStorage.clear());
  it('guarda eventos em ordem e limita a 50', () => {
    for (let i = 0; i < 60; i++) logAuthEvent('signed_out_event', `n${i}`);
    const list = readAuthEvents();
    expect(list).toHaveLength(50);
    expect(list[0].detail).toBe('n10');
    expect(list.at(-1)?.detail).toBe('n59');
  });
  it('não lança com JSON corrompido', () => {
    localStorage.setItem('vp-auth-events', '{oops');
    expect(() => logAuthEvent('sso_entry_ok')).not.toThrow();
  });
});
