// Executar isolado de build, tipos, suíte e E2E. Cria/remove só seu arquivo temporário.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=new URL('../../../../../',import.meta.url);
// Mantém audio-cancel.test.tsx e audio-result.txt como reprodução histórica;
// esta variante só acrescenta o snapshot r1 exigido pela validação de contexto.
const source=readFileSync(new URL("audio-cancel-adjustments.test.tsx",import.meta.url),'utf8');
const target=new URL("apps/web/test/orchestrator-effects-audio.test.tsx",root);
assert.equal(existsSync(target),false,'Recusa sobrescrever arquivo existente.');
writeFileSync(target,source);
try {
 const r=spawnSync('rtk',["proxy", "pnpm", "--filter", "@tretta/web", "exec", "vitest", "run", "test/orchestrator-effects-audio.test.tsx"],{cwd:fileURLToPath(root),encoding:'utf8'});
 if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
 writeFileSync(new URL("audio-adjustments-result.txt",import.meta.url),`${r.stdout??''}${r.stderr??''}`);
 if(r.error)throw r.error;process.exitCode=r.status??1;
} finally {
 assert.equal(readFileSync(target,'utf8'),source,'Arquivo temporário mudou; preservar para investigar.');
 unlinkSync(target);
}
