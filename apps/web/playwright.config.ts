import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/production-start.spec.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'off',
  },
  // O servidor de jogo é iniciado pelo fixture `serverProc` (e2e/fixtures.ts), que
  // permite reiniciar o processo real no meio de um teste; aqui sobe apenas o web.
  webServer: [
    {
      // Somente o Next: o servidor de jogo é o processo do fixture, reiniciável.
      command: 'pnpm --filter @tretta/web dev',
      cwd: repoRoot,
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_TEST_HOOKS: '1',
      },
    },
  ],
});
