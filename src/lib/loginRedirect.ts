// Quando a LoginScreen manda a pessoa ao portal sozinha. Em produção só quem
// chegou "do nada" (URL colada, sem sessão anterior) é redirecionado. Se a
// sessão CAIU com a página aberta, ou o SSO falhou, não redirecionamos: o
// vai-e-vem portal→app→portal derrubava o que a pessoa fazia e escondia o
// motivo. Ela decide, pelo botão.
export function shouldAutoRedirectToPortal(opts: {
  entradaSomentePeloPortal: boolean;
  ssoError?: string | null;
  sessionExpired?: boolean;
}): boolean {
  return opts.entradaSomentePeloPortal && !opts.ssoError && !opts.sessionExpired;
}
