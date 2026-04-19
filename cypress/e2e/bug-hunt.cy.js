describe('Caça aos Bugs - E2E', () => {
  beforeEach(() => {
    cy.visit('/')
    // Aumentar timeout para apps mais lentas
    Cypress.config('defaultCommandTimeout', 10000)
  })

  it('Verifica se a página carrega', () => {
    cy.get('body').should('be.visible')
    cy.url().should('include', 'localhost')
  })

  it('Tenta clicar em botões SEM causar navegação (Caça aos bugs seguro)', () => {
    // Pega apenas botões (não links <a>) para evitar navegação
    cy.get('body').find('button, [role="button"]').each(($el) => {
      // Verifica se o elemento ainda está visível antes de clicar
      if ($el.is(':visible')) {
        cy.wrap($el)
          .click({ force: true })
          .wait(300) // Espera curta para observar efeitos
      }
    })
    // Garante que ainda estamos na mesma página
    cy.url().should('include', 'localhost')
  })
})
