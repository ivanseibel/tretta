// Executar isolado de build, tipos, suíte e E2E. Cria/remove só seu arquivo temporário.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=new URL('../../../../../',import.meta.url);
const source=readFileSync(new URL("client-lifecycle.test.tsx",import.meta.url),'utf8');
const target=new URL("apps/web/test/orchestrator-effects-lifecycle.test.tsx",root);
assert.equal(existsSync(target),false,'Recusa sobrescrever arquivo existente.');
writeFileSync(target,source);
try {
 const r=spawnSync('rtk',["proxy", "pnpm", "--filter", "@tretta/web", "exec", "vitest", "run", "test/orchestrator-effects-lifecycle.test.tsx"],{cwd:fileURLToPath(root),encoding:'utf8'});
 if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
 writeFileSync(new URL("client-result.txt",import.meta.url),`${r.stdout??''}${r.stderr??''}`);
 if(r.error)throw r.error;process.exitCode=r.status??1;
} finally {
 assert.equal(readFileSync(target,'utf8'),source,'Arquivo temporário mudou; preservar para investigar.');
 unlinkSync(target);
}
