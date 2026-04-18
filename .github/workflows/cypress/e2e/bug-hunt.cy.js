describe('Caça aos Bugs - E2E', () => {
  beforeEach(() => {
    // Visita a raiz do site (assumindo que o servidor estará rodando na porta 8080 ou 3000)
    // Vamos deixar genérico por enquanto, o workflow vai subir o servidor
    cy.visit('/')
  })

  it('Verifica se a página carrega', () => {
    cy.get('body').should('be.visible')
  })

  it('Tenta clicar em todos os botões (Caça aos bugs)', () => {
    // Pega todos os botões visíveis
    cy.get('body').find('button, a, [role="button"]').each(($el) => {
      // Clica com force true para ignorar sobreposições
      cy.wrap($el).click({ force: true })
      // Espera meio segundo para ver se o JS quebra ou navega
      cy.wait(500)
    })
  })
})
