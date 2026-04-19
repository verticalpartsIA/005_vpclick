// ─────────────────────────────────────────────────────────────────────────────
// 01-smoke.cy.ts — Smoke test: o app carrega e responde corretamente
// ─────────────────────────────────────────────────────────────────────────────

describe('Smoke — app disponivel em producao', () => {
  it('responde HTTP 200', () => {
    cy.request('/').its('status').should('eq', 200);
  });

  it('carrega o HTML raiz com o root div', () => {
    cy.visit('/');
    cy.get('#root', { timeout: 15000 }).should('exist');
  });

  it('exibe tela de login ou redireciona para SSO (nao 404)', () => {
    cy.visit('/');
    // O app ou mostra login local ou redireciona para SSO externo.
    // Em qualquer caso, nao deve mostrar pagina em branco ou erro.
    cy.get('body').should('not.be.empty');
    cy.title().should('not.eq', '');
  });

  it('usuario autenticado ve a aplicacao', () => {
    const email    = Cypress.env('ADMIN_EMAIL');
    const password = Cypress.env('ADMIN_PASSWORD');

    if (!email || !password) {
      cy.log('ADMIN_EMAIL/ADMIN_PASSWORD nao configurados — pulando');
      return;
    }

    cy.visitAsUser(email, password);
    cy.waitForApp();

    // Deve aparecer algum elemento de navegacao ou workspace
    cy.get('body').should('not.contain', '404');
    cy.get('body').should('not.contain', 'Erro interno');
  });
});
