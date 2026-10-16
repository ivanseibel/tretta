// Executa a evidência com a configuração real da web, preservando a suíte.
// Cria somente um teste temporário próprio e o remove em finally; recusa sobrescrita.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = new URL('../../../../../', import.meta.url);
const target = new URL('apps/web/test/orchestrator-chat-authorization.test.tsx', root);
const source = readFileSync(new URL('authorization.test.tsx', import.meta.url), 'utf8');
assert.equal(existsSync(target), false, 'O runner recusa sobrescrever teste existente.');
writeFileSync(target, source);
try {
  const result = spawnSync('rtk', ['proxy', 'pnpm', '--filter', '@tretta/web', 'exec', 'vitest', 'run', 'test/orchestrator-chat-authorization.test.tsx'], {
    cwd: fileURLToPath(root), encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  writeFileSync(new URL('authorization-result.txt', import.meta.url), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  assert.equal(readFileSync(target, 'utf8'), source, 'Teste temporário mudou; preservar e investigar.');
  unlinkSync(target);
}
