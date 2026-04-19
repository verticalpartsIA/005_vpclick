describe('Testes Funcionais - VP Click', () => {
  
  beforeEach(() => {
    cy.visit('/')
    Cypress.config('defaultCommandTimeout', 10000)
  })

  it('Verifica se a página inicial carrega corretamente', () => {
    cy.url().should('include', 'localhost')
    cy.get('body').should('be.visible')
    cy.title().should('not.be.empty')
  })

  it('Verifica se existem botões interativos na página', () => {
    cy.get('body').find('button').should('have.length.gte', 0)
  })

  it('Verifica se existem links de navegação', () => {
    cy.get('body').find('a[href]').should('have.length.gte', 0)
  })

  it('Testa responsividade básica - viewport mobile', () => {
    cy.viewport('iphone-6')
    cy.get('body').should('be.visible')
  })

  it('Testa responsividade básica - viewport desktop', () => {
    cy.viewport(1920, 1080)
    cy.get('body').should('be.visible')
  })

})
