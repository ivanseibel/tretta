import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { HARNESS_DIR } from './config.mjs';

export function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function assertInsideHarness(target) {
  const absolute = resolve(target);
  if (absolute !== HARNESS_DIR && !absolute.startsWith(`${HARNESS_DIR}${sep}`)) {
    throw new Error(`Saída fora de docs/work/reports/assets/T019F: ${absolute}`);
  }
  return absolute;
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function relativeTo(from, to) {
  return relative(from, to).split(sep).join('/');
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sha256File(path) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', rejectHash);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

export function summarizeChecks(checks) {
  const totals = { pass: 0, fail: 0, review: 0, skip: 0 };
  for (const check of checks) totals[check.status] = (totals[check.status] || 0) + 1;
  return totals;
}

export async function writeRunHtml(runDir, summary, measurements) {
  const rows = measurements
    .map((item) => {
      const totals = item.totals || summarizeChecks(item.checks || []);
      const screenshot = item.screenshot ? relativeTo(runDir, resolve(runDir, item.screenshot)) : null;
      const failures = (item.checks || []).filter((check) => check.status === 'fail');
      return `
        <tr class="${failures.length ? 'fail' : totals.review ? 'review' : 'pass'}">
          <td>${escapeHtml(item.state)}</td>
          <td>${escapeHtml(item.viewport)}</td>
          <td class="num">${totals.pass}</td>
          <td class="num">${totals.fail}</td>
          <td class="num">${totals.review}</td>
          <td>${screenshot ? `<a href="${escapeHtml(screenshot)}">captura</a>` : '—'}</td>
          <td class="detail">${failures.length ? failures.map((check) => `<strong>${escapeHtml(check.id)}</strong>: ${escapeHtml(check.detail || '')}`).join('<br>') : 'ok'}</td>
        </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>T019F — execução ${escapeHtml(summary.runId)}</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 24px; background: #0e1512; color: #f3ead8; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { color: #cbbaa7; margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 18px; font-size: 13px; }
  th, td { border-bottom: 1px solid #33443b; padding: 8px; text-align: left; vertical-align: top; }
  th { color: #d7ab63; font-weight: 600; }
  tr.fail td { background: #351b18; }
  tr.review td { background: #2c2615; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .detail { max-width: 620px; }
  a { color: #f2c766; }
  code { color: #f2c766; }
</style>
</head>
<body>
  <h1>T019F — execução ${escapeHtml(summary.runId)}</h1>
  <p><strong>${escapeHtml(summary.mode)}</strong> · ${escapeHtml(summary.url || '')}</p>
  <p>${escapeHtml(String(summary.totals.pass))} pass · ${escapeHtml(String(summary.totals.fail))} fail · ${escapeHtml(String(summary.totals.review))} review · ${escapeHtml(String(summary.totals.skip))} skip</p>
  <p>Gerado em ${escapeHtml(summary.finishedAt || '')}. Baseline T018: <code>docs/work/reports/assets/T018</code>.</p>
  <table>
    <thead><tr><th>Estado</th><th>Viewport</th><th>Pass</th><th>Fail</th><th>Review</th><th>Captura</th><th>Falhas</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  await writeFile(resolve(runDir, 'index.html'), html, 'utf8');
}
