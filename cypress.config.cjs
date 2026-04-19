const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {},
    baseUrl: 'https://vpclick.vpsistema.com',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: true,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 15000,
    pageLoadTimeout: 30000,
    retries: { runMode: 2, openMode: 0 },
    env: {
      // Populated via CYPRESS_* env vars in CI (GitHub Actions)
      // Locally: set in cypress.env.json (gitignored)
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      COLLAB_EMAIL: '',
      COLLAB_PASSWORD: '',
    },
  },
});
