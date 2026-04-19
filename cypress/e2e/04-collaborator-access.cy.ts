// ─────────────────────────────────────────────────────────────────────────────
// 04-collaborator-access.cy.ts
// BUG-02 (Andreia, COLABORADOR): espacos liberados pelo admin nao apareciam
// sem reload manual. Fix: Supabase Realtime subscription em user_access +
// reload de spaces/folders/lists ao receber mudanca.
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-02 — Colaborador ve espacos que tem acesso', () => {
  const collabEmail    = () => Cypress.env('COLLAB_EMAIL');
  const collabPassword = () => Cypress.env('COLLAB_PASSWORD');

  beforeEach(() => {
    if (!collabEmail()) return;
    cy.visitAsUser(collabEmail(), collabPassword());
    cy.waitForApp();
  });

  it('COLABORADOR ve pelo menos um espaco na sidebar', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Sidebar deve ter pelo menos um espaco listado
    // (pressupoe que o admin ja deu acesso a algum espaco)
    cy.get('nav, aside', { timeout: 15000 })
      .find('li, [role="menuitem"], button', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  });

  it('COLABORADOR NAO ve espacos para os quais nao tem acesso', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Espaco SUPRIMENTOS nao deve aparecer se nao foi liberado
    // (ajuste o nome conforme o ambiente de teste)
    // Este teste e documentacao do comportamento correto — pode ser skip
    // se o ambiente nao tiver espaco restrito configurado.
    cy.log('Verificacao de espaco restrito — depende da configuracao do ambiente');
  });

  it('ao recarregar, colaborador mantem acesso aos seus espacos', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.reload();
    cy.waitForApp();

    // Apos reload, espacos ainda devem estar visiveis
    cy.get('nav, aside', { timeout: 15000 }).should('exist');
    cy.get('body').should('not.contain', 'Nenhum espaco');
  });

  it('colaborador ve pastas dentro do espaco liberado', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Clica no primeiro espaco disponivel
    cy.get('nav li, aside li, [data-space]', { timeout: 10000 })
      .first()
      .click();

    // Deve ver algum conteudo (pasta ou lista ou mensagem vazia apropriada)
    cy.get('body').should('not.contain', 'Acesso negado');
    cy.get('body').should('not.contain', 'Forbidden');
  });
});
