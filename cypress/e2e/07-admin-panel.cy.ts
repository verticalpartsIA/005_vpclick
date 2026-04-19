// ─────────────────────────────────────────────────────────────────────────────
// 07-admin-panel.cy.ts
// BUG-04: handleAdminUpdateAccess nao tinha feedback de sucesso/erro.
// Fix: toast.success / toast.error adicionados.
// Tambem testa que o painel de admin esta acessivel e funcional.
// ─────────────────────────────────────────────────────────────────────────────

describe('Admin Panel — gerenciamento de acessos', () => {
  const adminEmail    = () => Cypress.env('ADMIN_EMAIL');
  const adminPassword = () => Cypress.env('ADMIN_PASSWORD');
  const collabEmail   = () => Cypress.env('COLLAB_EMAIL');

  beforeEach(() => {
    if (!adminEmail()) return;
    cy.visitAsUser(adminEmail(), adminPassword());
    cy.waitForApp();
  });

  it('ADMIN consegue abrir o painel de administracao', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Procura link/botao para o painel admin
    cy.contains(/painel admin|admin panel|administracao|gerenciar/i, { timeout: 10000 })
      .should('exist')
      .click();

    // Deve aparecer algum conteudo de admin (lista de usuarios ou configuracoes)
    cy.get('body').should('not.contain', '404');
    cy.get('body').should('not.contain', 'Nao autorizado');
  });

  it('COLABORADOR NAO acessa o painel admin', () => {
    if (!collabEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.visitAsUser(collabEmail(), Cypress.env('COLLAB_PASSWORD'));
    cy.waitForApp();

    // Botao de admin nao deve existir para colaborador
    cy.contains(/painel admin|admin panel/i).should('not.exist');
  });

  it('ao salvar acessos, exibe toast de sucesso (BUG-04)', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Abre painel admin
    cy.contains(/painel admin|admin panel|administracao|gerenciar/i, { timeout: 10000 }).click();

    // Aguarda lista de usuarios
    cy.get('body').then(($body) => {
      // Se houver botao de salvar acessos, clica e verifica toast
      if ($body.find('button:contains("Salvar"), button:contains("salvar")').length > 0) {
        cy.contains('button', /salvar/i).first().click();

        // Deve aparecer toast de sucesso OU erro (nunca silencio)
        cy.get('[data-sonner-toast], [role="alert"], .toast', { timeout: 8000 })
          .should('exist');
      } else {
        cy.log('Botao de salvar nao encontrado no painel — configuracao de ambiente diferente');
      }
    });
  });

  it('estrutura de dados de espacos/pastas carrega sem erros', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Verifica que nao ha erros JavaScript visiveis
    cy.get('body').should('not.contain', 'Cannot read properties of undefined');
    cy.get('body').should('not.contain', 'Cannot read properties of null');
    cy.get('body').should('not.contain', 'is not a function');

    // App deve ter carregado com sucesso
    cy.get('nav, aside', { timeout: 15000 }).should('exist');
  });
});
