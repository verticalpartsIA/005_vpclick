describe('Caça aos Bugs - Avançado', () => {
  beforeEach(() => {
    cy.visit('/')
    Cypress.config('defaultCommandTimeout', 10000)
  })

  it('Verifica se a página carrega sem erros', () => {
    cy.get('body').should('be.visible')
  })

  it('Clica nos 3 primeiros botões visíveis', () => {
    cy.get('button:visible').first().click({ force: true }).wait(500)
    cy.get('button:visible').eq(1).click({ force: true }).wait(500)
    cy.get('button:visible').eq(2).click({ force: true }).wait(500)
    cy.url().should('include', 'localhost')
  })
})
