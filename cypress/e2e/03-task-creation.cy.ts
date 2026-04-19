// ─────────────────────────────────────────────────────────────────────────────
// 03-task-creation.cy.ts
// BUG-01 (Diego, ADMIN): ao clicar "criar tarefa" sem selecionar
// Espaco/Pasta/Lista, o botao ficava silenciosamente desabilitado.
// Fix: botao sempre habilitado (se tiver titulo), validacao via toast.error
// + bloco amber visual + auto-select de espaco/pasta quando unico.
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-01 — Criacao de tarefa com feedback correto', () => {
  const adminEmail    = () => Cypress.env('ADMIN_EMAIL');
  const adminPassword = () => Cypress.env('ADMIN_PASSWORD');

  beforeEach(() => {
    if (!adminEmail()) return;
    cy.visitAsUser(adminEmail(), adminPassword());
    cy.waitForApp();
  });

  it('botao de criar tarefa NAO esta silenciosamente desabilitado com titulo preenchido', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    // Abre modal de criar tarefa
    cy.contains('button', /nova tarefa|criar tarefa|\+/i, { timeout: 10000 }).click();

    // Digita titulo
    const titleInput = cy.get(
      'input[placeholder*="nome"], input[placeholder*="tarefa"], input[placeholder*="titulo"]',
      { timeout: 8000 }
    ).first();
    titleInput.type('Tarefa de teste E2E');

    // Com titulo preenchido, o botao principal de submit NAO deve estar disabled
    cy.contains('button', /criar|salvar|confirmar/i)
      .last()
      .should('not.be.disabled');
  });

  it('exibe toast de erro ao tentar criar sem selecionar lista', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.contains('button', /nova tarefa|criar tarefa|\+/i, { timeout: 10000 }).click();

    // Digita titulo mas NAO seleciona espaco/pasta/lista
    cy.get(
      'input[placeholder*="nome"], input[placeholder*="tarefa"], input[placeholder*="titulo"]',
      { timeout: 8000 }
    ).first().type('Tarefa sem lista');

    // Clica em criar
    cy.contains('button', /criar|salvar|confirmar/i).last().click();

    // Deve aparecer toast de erro (nao silencio)
    cy.get('[data-sonner-toast], [role="alert"], .toast, [data-testid="toast"]', { timeout: 8000 })
      .should('exist')
      .and('contain.text', /selecione|espaco|pasta|lista|informe/i);
  });

  it('exibe indicador visual ambar quando lista nao esta selecionada', () => {
    if (!adminEmail()) return cy.log('Credenciais nao configuradas — pulando');

    cy.contains('button', /nova tarefa|criar tarefa|\+/i, { timeout: 10000 }).click();

    // Sem selecionar espaco/lista, deve haver indicacao visual de campo obrigatorio
    // (classe bg-amber-50 ou border-amber-200 ou texto de instrucao)
    cy.get('[class*="amber"], [class*="warning"]', { timeout: 8000 })
      .should('exist');
  });
});
