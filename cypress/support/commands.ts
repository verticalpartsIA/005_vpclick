/* eslint-disable @typescript-eslint/no-namespace */
// ─────────────────────────────────────────────────────────────────────────────
// Comandos customizados do VP CLICK
// O app usa SSO redirect (LoginScreen.tsx -> vpsistema.com/login).
// Para testar, injetamos a sessao Supabase diretamente no localStorage
// antes do React carregar, simulando um usuario ja autenticado.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /** Login via API Supabase + injeta sessao no localStorage (bypassa SSO) */
      visitAsUser(email: string, password: string, path?: string): Chainable<void>;
      /** Aguarda o app carregar (sidebar/nav visivel) */
      waitForApp(): Chainable<void>;
      /** Navega para um espaco pelo nome exato */
      navigateToSpace(spaceName: string): Chainable<void>;
      /** Cria uma tarefa via UI */
      createTask(title: string): Chainable<void>;
    }
  }
}

// -- visitAsUser --------------------------------------------------------------
Cypress.Commands.add('visitAsUser', (email: string, password: string, path = '/') => {
  const supabaseUrl = Cypress.env('SUPABASE_URL') as string;
  const anonKey    = Cypress.env('SUPABASE_ANON_KEY') as string;

  cy.request({
    method: 'POST',
    url: `${supabaseUrl}/auth/v1/token?grant_type=password`,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: { email, password },
    failOnStatusCode: false,
  }).then((resp) => {
    if (resp.status !== 200) {
      throw new Error(
        `visitAsUser: login falhou para ${email} - status ${resp.status}: ${JSON.stringify(resp.body)}`
      );
    }
    cy.visit(path, {
      onBeforeLoad(win) {
        win.localStorage.setItem('vp-click-user-auth', JSON.stringify(resp.body));
        win.localStorage.setItem('vp_2fa_verified', 'true');
      },
    });
  });
});

// -- waitForApp ---------------------------------------------------------------
Cypress.Commands.add('waitForApp', () => {
  cy.get('nav, [data-testid="sidebar"], aside', { timeout: 25000 }).should('exist');
});

// -- navigateToSpace ----------------------------------------------------------
Cypress.Commands.add('navigateToSpace', (spaceName: string) => {
  cy.contains(spaceName, { timeout: 15000 }).click();
});

// -- createTask ---------------------------------------------------------------
Cypress.Commands.add('createTask', (title: string) => {
  cy.contains('button', /nova tarefa|criar tarefa|\+/i, { timeout: 10000 }).click();
  cy.get(
    'input[placeholder*="nome"], input[placeholder*="tarefa"], input[placeholder*="titulo"]',
    { timeout: 8000 }
  ).first().type(title);
});

export {};
