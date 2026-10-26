#!/usr/bin/env node
/**
 * Congela o manifesto das capturas T018 usadas como baseline visual.
 *
 *   node docs/work/reports/assets/T019F/make-baseline.mjs
 *   node docs/work/reports/assets/T019F/make-baseline.mjs --check
 *
 * O baseline é somente leitura sobre docs/work/reports/assets/T018; o único
 * arquivo escrito é docs/work/reports/assets/T019F/baseline.json.
 */
import { readFile, readdir } from 'node:fs/promises';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BASELINE_PATH,
  HARNESS_DIR,
  REPO_ROOT,
  T018_DIR
} from './lib/config.mjs';
import { readJson, relativeTo, sha256File, timestamp, writeJson } from './lib/io.mjs';

function parseArgs(argv) {
  return new Set(argv.filter((arg) => arg.startsWith('--')).map((arg) => arg.slice(2)));
}

async function pngDimensions(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, 24, 0);
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') throw new Error(`PNG inválido: ${filePath}`);
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } finally {
    await handle.close();
  }
}

function metricsOf(measurement) {
  const cards = Array.isArray(measurement.cartas) ? measurement.cartas : [];
  const widths = cards.map((card) => card.rect?.w).filter((width) => typeof width === 'number');
  return {
    seatCount: measurement.assentoCount ?? null,
    seatSides: measurement.assentoLados ?? null,
    overlaps: (measurement.overlaps || []).length,
    seatsOutsideTable: (measurement.assentosForaDaMesa || []).length,
    cards: cards.length,
    cardsMinWidth: widths.length ? Math.round(Math.min(...widths) * 10) / 10 : null,
    reactions: measurement.reacoes ?? null,
    ariaCurrent: measurement.ariaCurrent ?? null,
    fonts: measurement.fontes ?? null,
    scroll: {
      docW: measurement.scroll?.docW ?? null,
      docH: measurement.scroll?.docH ?? null,
      innerW: measurement.viewport?.w ?? null,
      innerH: measurement.viewport?.h ?? null,
      tableVertical: measurement.telaRolagemVertical ?? null
    },
    smallTargets: (measurement.alvosMenores || []).length,
    forbiddenText: (measurement.textoProibido || []).length
  };
}

async function build() {
  const measurementsPath = resolve(T018_DIR, 'measurements.json');
  const measurements = await readJson(measurementsPath);
  if (!Array.isArray(measurements) || measurements.length !== 105) {
    throw new Error(`measurements.json do T018 deveria ter 105 entradas; tem ${measurements?.length}`);
  }

  const files = (await readdir(T018_DIR)).filter((file) => file.endsWith('.png')).sort();
  if (files.length !== 105) {
    throw new Error(`T018 deveria ter 105 PNGs; tem ${files.length}`);
  }

  const byKey = new Map();
  for (const measurement of measurements) {
    const viewport = `${measurement.viewport.w}x${measurement.viewport.h}`;
    byKey.set(`${measurement.rota}@${viewport}`, measurement);
  }

  const entries = [];
  for (const file of files) {
    const match = file.match(/^(\d+)x(\d+)-(.+)\.png$/);
    if (!match) throw new Error(`Nome de captura fora do padrão: ${file}`);
    const width = Number(match[1]);
    const height = Number(match[2]);
    const route = match[3];
    const filePath = resolve(T018_DIR, file);
    const dimensions = await pngDimensions(filePath);
    if (dimensions.width !== width || dimensions.height !== height) {
      throw new Error(`Dimensão do PNG ${file} não bate com o nome: ${dimensions.width}x${dimensions.height}`);
    }
    const reference = byKey.get(`${route}@${width}x${height}`);
    if (!reference) throw new Error(`Medição T018 ausente para ${route} @ ${width}x${height}`);
    entries.push({
      route,
      viewport: { width, height },
      file: relativeTo(REPO_ROOT, filePath),
      width,
      height,
      bytes: (await readFile(filePath)).byteLength,
      sha256: await sha256File(filePath),
      metrics: metricsOf(reference)
    });
  }

  const manifest = {
    schema: 't019f-baseline/1',
    generatedAt: new Date().toISOString(),
    source: relativeTo(REPO_ROOT, T018_DIR),
    sourceReport: 'docs/work/reports/T018.md',
    sourceMeasurements: relativeTo(REPO_ROOT, measurementsPath),
    sourceMeasurementsSha256: await sha256File(measurementsPath),
    count: entries.length,
    viewports: [...new Set(entries.map((entry) => `${entry.viewport.width}x${entry.viewport.height}`))].sort(),
    entries
  };
  await writeJson(BASELINE_PATH, manifest);
  return manifest;
}

async function check() {
  let manifest;
  try {
    manifest = await readJson(BASELINE_PATH);
  } catch (error) {
    console.error('[t019f] baseline.json ausente; rode sem --check primeiro.');
    return 1;
  }
  const problems = [];
  if (manifest.count !== 105) problems.push(`count ${manifest.count} != 105`);
  if ((manifest.entries || []).length !== 105) {
    problems.push(`entries ${(manifest.entries || []).length} != 105`);
  }
  for (const entry of manifest.entries || []) {
    const filePath = resolve(REPO_ROOT, entry.file);
    let hash;
    try {
      hash = await sha256File(filePath);
    } catch (error) {
      problems.push(`ausente: ${entry.file}`);
      continue;
    }
    if (hash !== entry.sha256) problems.push(`hash alterado: ${entry.file}`);
  }
  const currentMeasurements = await sha256File(resolve(T018_DIR, 'measurements.json'));
  if (currentMeasurements !== manifest.sourceMeasurementsSha256) {
    problems.push('measurements.json do T018 alterado');
  }
  if (problems.length) {
    console.error(`[t019f] baseline divergente (${problems.length}):`);
    for (const problem of problems.slice(0, 30)) console.error(`  - ${problem}`);
    return 1;
  }
  console.log(`[t019f] baseline íntegro: ${manifest.count} capturas, ${manifest.viewports.join(', ')}.`);
  return 0;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.has('check')) return check();
  const manifest = await build();
  console.log(
    `[t019f] baseline gerado: ${manifest.count} capturas em ${relativeTo(HARNESS_DIR, BASELINE_PATH)}; ` +
      `viewports ${manifest.viewports.join(', ')}; ${timestamp()}`
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('[t019f] erro no baseline:', error.stack || error);
    process.exitCode = 2;
  });
