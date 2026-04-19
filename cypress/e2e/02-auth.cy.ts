// ─────────────────────────────────────────────────────────────────────────────
// 02-auth.cy.ts — Autenticacao: SSO bypass e validacao de roles
// ─────────────────────────────────────────────────────────────────────────────

describe('Auth — login via Supabase API (bypass SSO)', () => {
  const adminEmail    = () => Cypress.env('ADMIN_EMAIL');
  const adminPassword = () => Cypress.env('ADMIN_PASSWORD');
  const collabEmail   = () => Cypress.env('COLLAB_EMAIL');
  const collabPassword = () => Cypress.env('COLLAB_PASSWORD');

  it('obtém token Supabase para o ADMIN', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.request({
      method: 'POST',
      url: `${Cypress.env('SUPABASE_URL')}/auth/v1/token?grant_type=password`,
      headers: {
        apikey: Cypress.env('SUPABASE_ANON_KEY'),
        'Content-Type': 'application/json',
      },
      body: { email: adminEmail(), password: adminPassword() },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      expect(resp.body).to.have.property('access_token');
      expect(resp.body).to.have.property('user');
    });
  });

  it('ADMIN vê a aplicacao completa apos login', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.visitAsUser(adminEmail(), adminPassword());
    cy.waitForApp();

    // Admin deve ter acesso ao painel e ao workspace VERTICALPARTS
    cy.contains(/verticalparts|workspace|espacos/i, { timeout: 15000 }).should('exist');
  });

  it('COLABORADOR vê a aplicacao (sem painel admin)', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.visitAsUser(collabEmail(), collabPassword());
    cy.waitForApp();

    // Colaborador nao deve ver link/botao de admin panel
    cy.contains(/painel admin|admin panel|gerenciar usuarios/i).should('not.exist');
  });

  it('sessao persiste apos reload da pagina', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.visitAsUser(adminEmail(), adminPassword());
    cy.waitForApp();

    cy.reload();
    cy.waitForApp();

    // Apos reload, ainda deve estar autenticado (nao voltou pro login)
    cy.url().should('not.include', 'login');
  });
});
