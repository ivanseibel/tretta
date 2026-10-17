/**
 * T010 (ajustes pós-validação) — restauração dos artefatos históricos
 * sobrescritos pela execução anterior do E2E (achado do orquestrador).
 *
 * Regras do contrato:
 *  - somente os 88 caminhos listados e comprovados em
 *    `assets/T010-validation/historical-artifacts.json`;
 *  - cada caminho só é restaurado quando o conteúdo ATUAL na árvore confere
 *    com `workingSha256` (prova de que foi a regeneração do E2E que
 *    sobrescreveu) e o blob do HEAD confere com `headSha256`/`publishedSha256`;
 *  - a versão regenerada (nova) é preservada ANTES, em
 *    `assets/T010-adjustments/regenerated/<path>`, com índice e hash;
 *  - nada de `reset`/`checkout`/`clean` abrangente: restauração por blob do
 *    HEAD (`git cat-file blob`), arquivo a arquivo;
 *  - divergências (hash atual diferente do registrado, blob divergente,
 *    arquivo ausente) NÃO são tocadas e são reportadas.
 *
 * Uso: node historical-restore.mjs <repo>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = process.argv[2];
if (!REPO) throw new Error('uso: node historical-restore.mjs <repo>');
const REGISTRY = path.join(REPO, 'docs/work/reports/assets/T010-validation/historical-artifacts.json');
const PRESERVE_DIR = path.join(REPO, 'docs/work/reports/assets/T010-adjustments/regenerated');
const REPORT_PATH = path.join(REPO, 'docs/work/reports/assets/T010-adjustments/historical-restore-report.json');
const INDEX_PATH = path.join(PRESERVE_DIR, 'regenerated-index.json');

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const files = registry.files ?? registry;
const report = {
  restored: [],
  divergences: [],
  missing: [],
  pendingStatusAfter: [],
};

for (const entry of files) {
  const abs = path.join(REPO, entry.path);
  if (!fs.existsSync(abs)) {
    report.missing.push(entry.path);
    continue;
  }
  const current = fs.readFileSync(abs);
  const currentSha = sha256(current);
  if (currentSha !== entry.workingSha256) {
    report.divergences.push({
      path: entry.path,
      reason: 'conteúdo atual não confere com workingSha256 registrado (nada tocado)',
      currentSha,
      workingSha256: entry.workingSha256,
    });
    continue;
  }
  const blob = execFileSync('git', ['-C', REPO, 'cat-file', 'blob', `HEAD:${entry.path}`], {
    maxBuffer: 256 * 1024 * 1024,
  });
  const blobSha = sha256(blob);
  if (blobSha !== entry.headSha256) {
    report.divergences.push({
      path: entry.path,
      reason: 'blob do HEAD não confere com headSha256 (nada tocado)',
      blobSha,
      headSha256: entry.headSha256,
    });
    continue;
  }
  const preservedAbs = path.join(PRESERVE_DIR, entry.path);
  fs.mkdirSync(path.dirname(preservedAbs), { recursive: true });
  fs.writeFileSync(preservedAbs, current);
  fs.writeFileSync(abs, blob);
  const restoredSha = sha256(fs.readFileSync(abs));
  if (restoredSha !== entry.headSha256) {
    report.divergences.push({ path: entry.path, reason: 'restauração não conferiu sha256', restoredSha });
    continue;
  }
  report.restored.push({
    path: entry.path,
    bytes: blob.length,
    headSha256: entry.headSha256,
    publishedSha256: entry.publishedSha256,
    regeneratedSha256: entry.workingSha256,
    preservedAt: path.posix.join('regenerated', entry.path),
  });
}

fs.writeFileSync(
  INDEX_PATH,
  JSON.stringify({ count: report.restored.length, files: report.restored }, null, 2),
);

// Prova final: nenhum dos caminhos restaurados pode aparecer como modificado.
const pathspec = files.map((entry) => entry.path);
const status = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '--', ...pathspec], {
  encoding: 'utf8',
});
report.pendingStatusAfter = status.split('\n').filter((line) => line.trim() !== '');

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
process.stdout.write(
  JSON.stringify(
    {
      total: files.length,
      restored: report.restored.length,
      divergences: report.divergences.length,
      missing: report.missing.length,
      pendingStatusAfter: report.pendingStatusAfter.length,
    },
    null,
    2,
  ) + '\n',
);
if (report.divergences.length > 0) {
  process.stdout.write(JSON.stringify({ divergences: report.divergences }, null, 2) + '\n');
}
