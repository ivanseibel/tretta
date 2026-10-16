// Executar isolado de build, tipos, suíte completa e E2E.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=new URL('../../../../../',import.meta.url);
const target=new URL('apps/web/test/orchestrator-taunt-context.test.tsx',root);
const source=readFileSync(new URL('client-context.test.tsx',import.meta.url),'utf8');
assert.equal(existsSync(target),false,'Recusa sobrescrever teste existente.');
writeFileSync(target,source);
try {
  const r=spawnSync('rtk',['proxy','pnpm','--filter','@tretta/web','exec','vitest','run','test/orchestrator-taunt-context.test.tsx'],{cwd:fileURLToPath(root),encoding:'utf8'});
  if(r.stdout)process.stdout.write(r.stdout);
  if(r.stderr)process.stderr.write(r.stderr);
  writeFileSync(new URL('client-context-result.txt',import.meta.url),`${r.stdout??''}${r.stderr??''}`);
  if(r.error)throw r.error;
  process.exitCode=r.status??1;
} finally {
  assert.equal(readFileSync(target,'utf8'),source,'Arquivo temporário mudou; preservar para investigar.');
  unlinkSync(target);
}
