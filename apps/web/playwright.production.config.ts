import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-start.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'off',
  },
  webServer: [
    {
      command: 'pnpm --filter @tretta/server start',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3100/healthz',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: 'production',
        PORT: '3100',
        TRE_TTA_PORT: '',
        TRE_TTA_WEB_ORIGIN: 'http://localhost:3000',
        TRE_TTA_SEED: '',
        TRE_TTA_TEST_HOOKS: '0',
      },
    },
    {
      command: 'pnpm --filter @tretta/web start',
      cwd: repoRoot,
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        NEXT_PUBLIC_SERVER_URL: 'http://127.0.0.1:3100',
        NEXT_PUBLIC_TEST_HOOKS: '0',
      },
    },
  ],
});
