describe('Validação Básica - E2E', () => {
  
  it('Página inicial carrega com sucesso', () => {
    cy.visit('/')
    cy.url().should('include', 'localhost')
    cy.get('body').should('be.visible')
    cy.title().should('not.be.empty')
  })

  it('Elementos básicos existem na página', () => {
    cy.visit('/')
    // Verifica se existe pelo menos um elemento HTML básico
    cy.get('html').should('exist')
    cy.get('head').should('exist')
    cy.get('body').should('exist')
  })

})
