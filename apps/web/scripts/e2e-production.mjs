import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const environment = {
  ...process.env,
  NEXT_PUBLIC_SERVER_URL: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_TEST_HOOKS: '0',
};

function run(args) {
  const result = spawnSync('pnpm', args, {
    cwd: repoRoot,
    env: environment,
    stdio: 'inherit',
    timeout: 300_000,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['build']);
run(['--filter', '@tretta/web', 'exec', 'playwright', 'test', '--config', 'playwright.production.config.ts']);
