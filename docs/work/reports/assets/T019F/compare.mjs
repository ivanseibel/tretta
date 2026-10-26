#!/usr/bin/env node
/**
 * Comparador visual T018 → execução atual.
 *
 *   node docs/work/reports/assets/T019F/compare.mjs --run=docs/work/reports/assets/T019F/runs/<id>
 *
 * A comparação é de revisão, não de igualdade pixel a pixel: a implementação
 * usa outra stack. O comparador mede diferença, SSIM por blocos, bounding box,
 * captura em branco e diferenças estruturais; a decisão continua humana.
 */
import { resolve } from 'node:path';
import {
  BASELINE_PATH,
  HARNESS_DIR,
  REPO_ROOT,
  STATES
} from './lib/config.mjs';
import { launchBrowser, createContext } from './lib/browser.mjs';
import { startStaticServer } from './lib/server.mjs';
import {
  assertInsideHarness,
  ensureDir,
  escapeHtml,
  readJson,
  relativeTo,
  slugify,
  timestamp,
  writeJson
} from './lib/io.mjs';
import { writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return args;
}

function numberArg(value, fallback) {
  if (value === undefined || value === null || value === true || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolArg(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true) return true;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

const stateConfig = (id) => STATES[id] || null;

function referenceFor(baseline, route, viewport) {
  if (!route) return null;
  return baseline.entries.find(
    (entry) =>
      entry.route === route &&
      entry.viewport.width === viewport.width &&
      entry.viewport.height === viewport.height
  ) || null;
}

function structuralDiffs(referenceEntry, measurement) {
  if (!referenceEntry || !measurement) return [];
  const current = measurement;
  const metrics = referenceEntry.metrics || {};
  const cards = current.cards || [];
  const widths = cards.map((card) => card.w).filter((width) => typeof width === 'number');
  const currentValues = {
    seatCount: current.seatCount ?? null,
    cards: cards.length,
    cardsMinWidth: widths.length ? Math.round(Math.min(...widths) * 10) / 10 : null,
    reactions: current.reactions?.count ?? null
  };
  const referenceValues = {
    seatCount: metrics.seatCount ?? null,
    cards: metrics.cards ?? null,
    cardsMinWidth: metrics.cardsMinWidth ?? null,
    reactions: metrics.reactions ?? null
  };
  const diffs = [];
  for (const key of Object.keys(referenceValues)) {
    if (referenceValues[key] === null || currentValues[key] === null) continue;
    // Telas sem mão (home, espera) podem ter cartas decorativas; só comparar
    // contagem de cartas quando o baseline realmente tinha mão.
    if (key === 'cards' && referenceValues.cards === 0) continue;
    if (referenceValues[key] !== currentValues[key]) {
      diffs.push({ metric: key, reference: referenceValues[key], current: currentValues[key] });
    }
  }
  return diffs;
}

/**
 * Executado no navegador. Recebe URLs same-origin servidas pelo harness.
 */
async function comparePixels({ referenceUrl, currentUrl, threshold }) {
  const loadImage = (url) => new Promise((resolveImage, rejectImage) => {
    const image = new Image();
    image.onload = () => resolveImage(image);
    image.onerror = () => rejectImage(new Error(`Falha ao carregar ${url}`));
    image.src = url;
  });

  const [reference, current] = await Promise.all([loadImage(referenceUrl), loadImage(currentUrl)]);
  const width = reference.naturalWidth;
  const height = reference.naturalHeight;
  const sizeMismatch = width !== current.naturalWidth || height !== current.naturalHeight;
  if (sizeMismatch) {
    return {
      width,
      height,
      currentWidth: current.naturalWidth,
      currentHeight: current.naturalHeight,
      sizeMismatch: true,
      status: 'fail',
      reason: 'dimensões diferentes entre baseline e captura'
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(reference, 0, 0);
  const referenceData = context.getImageData(0, 0, width, height).data;
  context.clearRect(0, 0, width, height);
  context.drawImage(current, 0, 0);
  const currentData = context.getImageData(0, 0, width, height).data;

  const grayReference = new Float32Array(width * height);
  const grayCurrent = new Float32Array(width * height);
  const histogram = new Uint32Array(256);
  let totalDiff = 0;
  let changed = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let currentMin = 255;
  let currentMax = 0;
  let currentSum = 0;
  let currentSumSquares = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r1 = referenceData[index];
      const g1 = referenceData[index + 1];
      const b1 = referenceData[index + 2];
      const r2 = currentData[index];
      const g2 = currentData[index + 1];
      const b2 = currentData[index + 2];
      const diff = Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
      totalDiff += diff;
      histogram[diff] += 1;
      if (diff > threshold) {
        changed += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
      const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      grayReference[y * width + x] = gray1;
      grayCurrent[y * width + x] = gray2;
      currentMin = Math.min(currentMin, gray2);
      currentMax = Math.max(currentMax, gray2);
      currentSum += gray2;
      currentSumSquares += gray2 * gray2;
    }
  }

  const pixels = width * height;
  const currentMean = currentSum / pixels;
  const currentVariance = currentSumSquares / pixels - currentMean * currentMean;
  const currentBlank = currentVariance < 4 || currentMax - currentMin < 3;

  let cumulative = 0;
  let p95 = 255;
  for (let value = 0; value < 256; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= pixels * 0.95) {
      p95 = value;
      break;
    }
  }

  const block = 8;
  let ssimTotal = 0;
  let ssimBlocks = 0;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  for (let blockY = 0; blockY < height; blockY += block) {
    for (let blockX = 0; blockX < width; blockX += block) {
      const endX = Math.min(blockX + block, width);
      const endY = Math.min(blockY + block, height);
      const count = (endX - blockX) * (endY - blockY);
      let sumA = 0;
      let sumB = 0;
      let sumAA = 0;
      let sumBB = 0;
      let sumAB = 0;
      for (let y = blockY; y < endY; y += 1) {
        for (let x = blockX; x < endX; x += 1) {
          const a = grayReference[y * width + x];
          const b = grayCurrent[y * width + x];
          sumA += a;
          sumB += b;
          sumAA += a * a;
          sumBB += b * b;
          sumAB += a * b;
        }
      }
      const meanA = sumA / count;
      const meanB = sumB / count;
      const varA = Math.max(0, sumAA / count - meanA * meanA);
      const varB = Math.max(0, sumBB / count - meanB * meanB);
      const cov = sumAB / count - meanA * meanB;
      ssimTotal += ((2 * meanA * meanB + c1) * (2 * cov + c2)) /
        ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2));
      ssimBlocks += 1;
    }
  }
  const ssim = ssimTotal / Math.max(1, ssimBlocks);

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;
  const diffContext = diffCanvas.getContext('2d');
  const diffImage = diffContext.createImageData(width, height);
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const referenceGray = grayReference[index];
    const currentGray = grayCurrent[index];
    const difference = Math.max(
      Math.abs(referenceData[offset] - currentData[offset]),
      Math.abs(referenceData[offset + 1] - currentData[offset + 1]),
      Math.abs(referenceData[offset + 2] - currentData[offset + 2])
    );
    if (difference > threshold) {
      diffImage.data[offset] = 255;
      diffImage.data[offset + 1] = 50 + Math.round(120 * (1 - Math.min(1, difference / 255)));
      diffImage.data[offset + 2] = 40;
      diffImage.data[offset + 3] = 255;
    } else {
      const gray = Math.round((0.35 * referenceGray + 0.35 * currentGray));
      diffImage.data[offset] = gray;
      diffImage.data[offset + 1] = gray;
      diffImage.data[offset + 2] = gray;
      diffImage.data[offset + 3] = 255;
    }
  }
  diffContext.putImageData(diffImage, 0, 0);

  return {
    width,
    height,
    currentWidth: width,
    currentHeight: height,
    sizeMismatch: false,
    changedPixels: changed,
    changedPct: Math.round((changed / pixels) * 10000) / 100,
    meanAbsDiff: Math.round((totalDiff / pixels) * 100) / 100,
    p95Diff: p95,
    ssim: Math.round(ssim * 10000) / 10000,
    currentBlank,
    currentLumaStdDev: Math.round(Math.sqrt(Math.max(0, currentVariance)) * 100) / 100,
    bbox: changed ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    diffDataUrl: diffCanvas.toDataURL('image/png')
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = textArg(args.run);
  if (!runDir) throw new Error('--run=<diretório da execução> é obrigatório.');
  const absoluteRun = resolve(runDir);
  const outDir = assertInsideHarness(
    textArg(args.out) ? resolve(textArg(args.out)) : resolve(absoluteRun, 'compare')
  );
  await ensureDir(resolve(outDir, 'diff'));

  const baselinePath = textArg(args.baseline) ? resolve(textArg(args.baseline)) : BASELINE_PATH;
  const baseline = await readJson(baselinePath);
  const measurements = await readJson(resolve(absoluteRun, 'measurements.json'));
  const threshold = numberArg(textArg(args.threshold), 16);
  const thresholdChanged = numberArg(textArg(args['threshold-changed']), 12);
  const thresholdSsim = numberArg(textArg(args.ssim), 0.9);
  const writeDiffs = boolArg(args['no-diffs'], false) === false;
  const requireAll = boolArg(args['require-all'], false);

  const pairs = [];
  for (const item of measurements) {
    if (!item.measurement || !item.screenshot) continue;
    const config = stateConfig(item.state);
    const route = item.measurement.meta.baseline || config?.baseline || null;
    const viewport = { width: item.viewportPx.width, height: item.viewportPx.height };
    const reference = referenceFor(baseline, route, viewport);
    pairs.push({ item, route, viewport, reference });
  }

  const server = await startStaticServer(REPO_ROOT);
  const browser = await launchBrowser({ headed: false });
  const context = await createContext(browser, { width: 1280, height: 800, dpr: 1, mobile: false });
  const page = await context.newPage();
  await page.goto(`${server.url}/docs/work/reports/assets/T019F/lib/blank.html`, { waitUntil: 'domcontentloaded' });

  const results = [];
  try {
    for (const pair of pairs) {
      const { item, route, viewport, reference } = pair;
      if (!reference) {
        results.push({
          state: item.state,
          viewport: item.viewport,
          route,
          status: 'no-reference',
          reason: route ? 'captura T018 ausente para esta rota/viewport' : 'estado sem baseline T018',
          structural: []
        });
        continue;
      }
      const currentRepoPath = relativeTo(REPO_ROOT, resolve(absoluteRun, item.screenshot));
      let pixel;
      try {
        pixel = await page.evaluate(comparePixels, {
          referenceUrl: `${server.url}/${encodeURI(reference.file)}`,
          currentUrl: `${server.url}/${encodeURI(currentRepoPath)}`,
          threshold
        });
      } catch (error) {
        results.push({
          state: item.state,
          viewport: item.viewport,
          route,
          reference: reference.file,
          status: 'error',
          reason: error.message,
          structural: []
        });
        continue;
      }

      const structural = structuralDiffs(reference, item.measurement);
      let status = 'ok';
      let reason = null;
      if (pixel.sizeMismatch) {
        status = 'fail';
        reason = `dimensões ${pixel.currentWidth}x${pixel.currentHeight} != baseline ${pixel.width}x${pixel.height}`;
      } else if (pixel.currentBlank) {
        status = 'fail';
        reason = 'captura atual em branco/ilegível';
      } else if (pixel.changedPct > thresholdChanged || pixel.ssim < thresholdSsim) {
        status = 'review';
        reason = `diff ${pixel.changedPct}% (limite ${thresholdChanged}%) e SSIM ${pixel.ssim} (limite ${thresholdSsim})`;
      }

      let diffFile = null;
      if (writeDiffs && pixel.diffDataUrl) {
        const diffName = `${slugify(item.state)}-${item.viewport}.png`;
        const diffPath = resolve(outDir, 'diff', diffName);
        await writeFile(diffPath, Buffer.from(pixel.diffDataUrl.split(',')[1], 'base64'));
        diffFile = relativeTo(outDir, diffPath);
      }

      results.push({
        state: item.state,
        viewport: item.viewport,
        route,
        reference: reference.file,
        current: item.screenshot,
        referenceSha256: reference.sha256,
        status,
        reason,
        diff: diffFile,
        metrics: {
          width: pixel.width,
          height: pixel.height,
          changedPct: pixel.changedPct,
          meanAbsDiff: pixel.meanAbsDiff,
          p95Diff: pixel.p95Diff,
          ssim: pixel.ssim,
          currentBlank: pixel.currentBlank,
          currentLumaStdDev: pixel.currentLumaStdDev,
          bbox: pixel.bbox
        },
        structural
      });
      console.log(`[t019f] ${status.toUpperCase()} ${item.state} @ ${item.viewport} — diff ${pixel.changedPct}%, SSIM ${pixel.ssim}`);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }

  const counts = results.reduce(
    (accumulator, result) => {
      accumulator[result.status] = (accumulator[result.status] || 0) + 1;
      return accumulator;
    },
    { ok: 0, review: 0, fail: 0, 'no-reference': 0, error: 0 }
  );

  const summary = {
    schema: 't019f-visual-diff/1',
    generatedAt: new Date().toISOString(),
    runDir: relativeTo(HARNESS_DIR, absoluteRun),
    outDir: relativeTo(HARNESS_DIR, outDir),
    baseline: relativeTo(HARNESS_DIR, baselinePath),
    baselineCount: baseline.count,
    thresholds: { pixel: threshold, changedPct: thresholdChanged, ssim: thresholdSsim },
    counts,
    total: results.length,
    note: 'status review exige inspeção humana; fail bloqueia a matriz. Ausência de baseline não é regressão visual.',
    results
  };
  await writeJson(resolve(outDir, 'visual-diff.json'), summary);
  await writeFile(resolve(outDir, 'index.html'), galleryHtml(summary, outDir, absoluteRun), 'utf8');

  console.log(
    `[t019f] comparação: ${counts.ok} ok, ${counts.review} review, ${counts.fail} fail, ` +
      `${counts['no-reference']} sem baseline, ${counts.error} erro(s); saída ${relativeTo(HARNESS_DIR, outDir)}`
  );

  if (counts.fail > 0 || counts.error > 0) return 1;
  if (requireAll && counts['no-reference'] > 0) return 3;
  return 0;
}

function textArg(value) {
  if (value === undefined || value === true) return null;
  return String(value);
}

function galleryHtml(summary, outDir, absoluteRun) {
  const cards = summary.results
    .map((result) => {
      const statusClass = result.status === 'fail' || result.status === 'error' ? 'fail' : result.status === 'review' ? 'review' : 'ok';
      const reference = result.reference ? relativeTo(outDir, resolve(REPO_ROOT, result.reference)) : null;
      const currentResolved = result.current ? relativeTo(outDir, resolve(absoluteRun, result.current)) : null;
      const structural = result.structural && result.structural.length
        ? `<ul>${result.structural.map((diff) => `<li>${escapeHtml(diff.metric)}: ${escapeHtml(String(diff.reference))} → ${escapeHtml(String(diff.current))}</li>`).join('')}</ul>`
        : '<p class="muted">sem diferença estrutural medida</p>';
      return `
        <article class="card ${statusClass}">
          <header><h2>${escapeHtml(result.state)} <span>${escapeHtml(result.viewport)}</span></h2><span class="badge">${escapeHtml(result.status)}</span></header>
          <p class="muted">${escapeHtml(result.reason || 'dentro dos limites de revisão')}</p>
          <div class="images">
            ${reference ? `<figure><figcaption>T018</figcaption><a href="${escapeHtml(reference)}"><img src="${escapeHtml(reference)}" loading="lazy" alt="Baseline T018 ${escapeHtml(result.state)}"></a></figure>` : '<figure class="empty">sem baseline</figure>'}
            ${currentResolved ? `<figure><figcaption>atual</figcaption><a href="${escapeHtml(currentResolved)}"><img src="${escapeHtml(currentResolved)}" loading="lazy" alt="Captura atual ${escapeHtml(result.state)}"></a></figure>` : '<figure class="empty">sem captura</figure>'}
            ${result.diff ? `<figure><figcaption>diff</figcaption><a href="${escapeHtml(result.diff)}"><img src="${escapeHtml(result.diff)}" loading="lazy" alt="Diff ${escapeHtml(result.state)}"></a></figure>` : ''}
          </div>
          <dl>
            ${result.metrics ? `<dt>diff</dt><dd>${result.metrics.changedPct}%</dd><dt>SSIM</dt><dd>${result.metrics.ssim}</dd><dt>mean abs</dt><dd>${result.metrics.meanAbsDiff}</dd><dt>bbox</dt><dd>${result.metrics.bbox ? `${result.metrics.bbox.x},${result.metrics.bbox.y} ${result.metrics.bbox.width}×${result.metrics.bbox.height}` : '—'}</dd>` : ''}
          </dl>
          ${structural}
        </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>T019F — comparação visual</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 24px; background: #0e1512; color: #f3ead8; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .muted { color: #b8aa94; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; margin-top: 20px; }
  .card { border: 1px solid #33443b; border-radius: 12px; padding: 14px; background: #131d18; }
  .card.fail { border-color: #c4322a; }
  .card.review { border-color: #d7ab63; }
  .card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .card h2 { margin: 0; font-size: 15px; }
  .card h2 span { color: #d7ab63; font-weight: 400; }
  .badge { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #d7ab63; }
  .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
  figure { margin: 0; }
  figure img { width: 100%; height: auto; display: block; border-radius: 6px; background: #000; }
  figcaption { font-size: 11px; color: #b8aa94; margin-bottom: 4px; }
  .empty { display: grid; place-items: center; min-height: 90px; border: 1px dashed #33443b; border-radius: 6px; font-size: 12px; color: #b8aa94; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: 12px; margin: 8px 0; }
  dt { color: #b8aa94; }
  dd { margin: 0; }
  ul { font-size: 12px; color: #d7ab63; padding-left: 18px; }
  a { color: #f2c766; }
</style>
</head>
<body>
  <h1>T019F — comparação visual T018 → atual</h1>
  <p class="muted">${escapeHtml(summary.runDir)} · ${summary.counts.ok} ok · ${summary.counts.review} review · ${summary.counts.fail} fail · ${summary.counts['no-reference']} sem baseline · ${summary.counts.error} erro(s)</p>
  <p class="muted">Review não é aceite automático: confira cada card. O baseline T018 está em <code>docs/work/reports/assets/T018</code>.</p>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('[t019f] erro na comparação:', error.stack || error);
    process.exitCode = 2;
  });
