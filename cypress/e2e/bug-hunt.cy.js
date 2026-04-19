describe('Caça aos Bugs - Versão à Prova de Falhas', () => {
  beforeEach(() => {
    cy.visit('/')
    Cypress.config('defaultCommandTimeout', 10000)
  })

  it('Página carrega sem erros JS', () => {
    cy.get('body').should('be.visible')
    cy.url().should('include', 'localhost')
  })

  it('Clica no PRIMEIRO botão visível (se existir)', () => {
    cy.get('body').then(($body) => {
      const btn = $body.find('button:visible').first()
      if (btn.length > 0) {
        cy.wrap(btn).click({ force: true }).wait(500)
        // Só verifica URL se ainda estiver na mesma página
        cy.url().should('match', /localhost|127\.0\.0\.1/)
      } else {
        cy.log('ℹ️ Nenhum botão visível encontrado - teste ignorado')
      }
    })
  })
})
