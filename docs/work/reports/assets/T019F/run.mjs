#!/usr/bin/env node
/**
 * Harness standalone T019F.
 *
 * Uso típico:
 *   node docs/work/reports/assets/T019F/run.mjs --mode=prototype --set=smoke
 *   node docs/work/reports/assets/T019F/run.mjs --mode=preview --url=http://127.0.0.1:3100
 *   node docs/work/reports/assets/T019F/run.mjs --mode=app --url=http://127.0.0.1:3100 --set=core
 *
 * O script não importa nada de apps/web nem escreve fora de
 * docs/work/reports/assets/T019F.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DEFAULT_VIEWPORTS,
  FORBIDDEN_COPY,
  FORBIDDEN_DOM,
  HARNESS_DIR,
  LIMITS,
  REPO_ROOT,
  SELECTORS,
  SETS,
  STATES,
  resolveState,
  resolveViewports,
  statesForSet
} from './lib/config.mjs';
import { createContext, keyboardProbe, launchBrowser, settle, screenshot } from './lib/browser.mjs';
import { startStaticServer } from './lib/server.mjs';
import { measurePage } from './lib/measure.mjs';
import { evaluateMeasurement } from './lib/assertions.mjs';
import {
  ScenarioUnavailableError,
  loadScenarioFactory
} from './lib/scenario.mjs';
import {
  assertInsideHarness,
  ensureDir,
  readJson,
  relativeTo,
  slugify,
  summarizeChecks,
  timestamp,
  writeJson,
  writeRunHtml
} from './lib/io.mjs';

const HARNESS_PATH = resolve(HARNESS_DIR, 'run.mjs');
const DEFAULT_SCENARIO = resolve(HARNESS_DIR, 'scenarios/default.mjs');
const PROTOTYPE_ROUTE_BY_STATE = new Map(
  Object.values(STATES)
    .filter((state) => state.t018Route)
    .map((state) => [state.id, state.t018Route])
);

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    if (!raw.startsWith('--')) {
      args._.push(raw);
      continue;
    }
    const withoutPrefix = raw.slice(2);
    const [key, ...rest] = withoutPrefix.split('=');
    const value = rest.length ? rest.join('=') : true;
    if (args[key] === undefined) args[key] = value;
    else if (Array.isArray(args[key])) args[key].push(value);
    else args[key] = [args[key], value];
  }
  return args;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true) return true;
  if (value === false) return false;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function text(value) {
  if (value === undefined || value === true) return null;
  if (Array.isArray(value)) return String(value[value.length - 1]);
  return String(value);
}

function list(value) {
  if (value === undefined) return null;
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function printUsage() {
  console.log(`T019F harness

  node ${HARNESS_PATH} --mode=prototype [--set=smoke|core|full] [--viewports=412x915,360x640,1280x800,640x800]
  node ${HARNESS_PATH} --mode=preview --url=http://127.0.0.1:3100
  node ${HARNESS_PATH} --mode=app --url=http://127.0.0.1:3100 --set=core [--scenario=<arquivo>] [--states-file=<json>]

Opções:
  --state=id1,id2          estados específicos (sobrepõe --set)
  --out=<dir>              saída sob docs/work/reports/assets/T019F (padrão runs/...)
  --headed                 mostra o navegador
  --browser=chromium|chrome
  --full-page              captura página inteira (só telas com rolagem)
  --no-screenshots         não grava PNGs
  --require-complete       falha (exit 3) se algum estado for pulado
  --soft                   sempre exit 0; o resultado fica no summary
  --fail-fast              interrompe no primeiro erro de runtime
  --help                   esta ajuda

Saída: measurement + checks por estado, screenshots, summary.json, index.html.`);
}

function normalizeBaseUrl(value) {
  if (!value) return null;
  return value.replace(/\/+$/, '');
}

function routeUrl(baseUrl, route) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return null;
  return `${base}${route.startsWith('/') ? route : `/${route}`}`;
}

async function loadUrlMap(filePath) {
  if (!filePath) return {};
  const parsed = await readJson(resolve(filePath));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--states-file precisa ser um objeto JSON { "estado": "url" }.');
  }
  return parsed;
}

function stateSelection(args, mode) {
  if (mode === 'preview') return [resolveState('preview')];
  const explicit = list(args.state);
  if (explicit && explicit.length) return explicit.map(resolveState);
  const setName = text(args.set) || (mode === 'prototype' ? 'smoke' : 'core');
  if (setName === 'all') return statesForSet('full');
  if (!SETS[setName]) throw new Error(`--set inválido: ${setName}`);
  return statesForSet(setName);
}

function selectViewports(args, mode) {
  if (mode === 'prototype' && !text(args.viewports)) {
    return resolveViewports(DEFAULT_VIEWPORTS.filter((id) => id !== '640x800').join(','));
  }
  if (mode === 'preview' && !text(args.viewports)) {
    return resolveViewports('412x915,1280x800');
  }
  return resolveViewports(text(args.viewports));
}

function stateForPage(state) {
  return {
    id: state.id,
    kind: state.kind,
    table: !!state.table,
    tableScroll: !!state.tableScroll,
    hand: !!state.hand,
    handCards: state.handCards ?? null,
    ariaCurrent: state.ariaCurrent || null,
    live: state.live || 'optional',
    reactions: state.reactions || null,
    drawer: state.drawer || null,
    overlay: state.overlay || null,
    features: state.features || [],
    mustContain: state.mustContain || [],
    baseline: state.baseline || null
  };
}

function attachRuntime(page) {
  const runtime = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: []
  };
  page.on('console', (message) => {
    if (message.type() === 'error') runtime.consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => runtime.pageErrors.push(String(error.message || error).slice(0, 500)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (/favicon\.ico|\/__nextjs|hot-update|_next\/static\/webpack/.test(url)) return;
    const failure = request.failure()?.errorText || 'falhou';
    // Prefetch/navegação RSC abortado por mudança de fase é esperado no App Router.
    if (/_rsc=/.test(url) && /ERR_ABORTED/.test(failure)) return;
    runtime.failedRequests.push(`${request.method()} ${url.slice(0, 220)} (${failure})`);
  });
  return runtime;
}

async function maybeScreenshot(page, filePath, { enabled, fullPage }) {
  if (!enabled) return false;
  await screenshot(page, filePath, { fullPage });
  return true;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return 0;
  }

  const mode = text(args.mode) || 'prototype';
  if (!['prototype', 'preview', 'app'].includes(mode)) {
    throw new Error(`--mode inválido: ${mode}. Use prototype, preview ou app.`);
  }

  const startedAt = new Date().toISOString();
  const runId = `${mode}-${timestamp()}`;
  const defaultOut = resolve(HARNESS_DIR, 'runs', runId);
  const runDir = assertInsideHarness(text(args.out) ? resolve(text(args.out)) : defaultOut);
  const screenshotsDir = resolve(runDir, 'screenshots');
  const rawDir = resolve(runDir, 'raw');
  await ensureDir(screenshotsDir);
  await ensureDir(rawDir);

  const takeScreenshots = bool(args['no-screenshots'], false) === false;
  const fullPage = bool(args['full-page'], false);
  const requireComplete = bool(args['require-complete'], false);
  const soft = bool(args.soft, false);
  const failFast = bool(args['fail-fast'], false);

  let staticServer = null;
  let baseURL = normalizeBaseUrl(text(args.url));
  if (mode === 'prototype' && !baseURL) {
    // Servir por HTTP evita o bloqueio de fontes/CSS por CORS em file:// e
    // mantém a execução idêntica à do protótipo nas capturas T018.
    staticServer = await startStaticServer(REPO_ROOT);
    baseURL = `${staticServer.url}/docs/work/t018-prototype/index.html`;
  }
  if (mode !== 'prototype' && !baseURL) {
    throw new Error(`--url é obrigatório no modo ${mode}.`);
  }

  const states = stateSelection(args, mode).filter((state) => {
    if (mode !== 'prototype') return true;
    return PROTOTYPE_ROUTE_BY_STATE.has(state.id);
  });
  if (!states.length) throw new Error('Nenhum estado selecionado para este modo.');

  const viewports = selectViewports(args, mode);
  const urlMap = await loadUrlMap(text(args['states-file']));
  if (text(args['state-url'])) {
    if (states.length !== 1) throw new Error('--state-url só pode ser usado com um estado (--state).');
    urlMap[states[0].id] = text(args['state-url']);
  }

  const log = (message) => console.log(`[t019f] ${message}`);
  const scenarioFactory = mode === 'app'
    ? await loadScenarioFactory(text(args.scenario) || (existsSync(DEFAULT_SCENARIO) ? DEFAULT_SCENARIO : null))
    : null;

  log(`modo ${mode}; ${states.length} estado(s) × ${viewports.length} viewport(s); saída ${relativeTo(HARNESS_DIR, runDir)}`);
  const browser = await launchBrowser({
    headed: bool(args.headed, false),
    browser: text(args.browser) || 'chromium'
  });
  const browserVersion = browser.version();

  const measurements = [];
  let fatalError = null;

  try {
    for (const viewport of viewports) {
      const scenario = scenarioFactory
        ? await scenarioFactory({ baseURL, browser, viewport, runDir, urlMap, log })
        : null;

      for (const state of states) {
        const label = `${state.id} @ ${viewport.id}`;
        let context = null;
        let page = null;
        let runtime = null;
        let item = null;

        try {
          context = await createContext(browser, viewport);
          page = await context.newPage();
          page.setDefaultTimeout(20000);
          runtime = attachRuntime(page);

          if (mode === 'prototype') {
            const route = PROTOTYPE_ROUTE_BY_STATE.get(state.id) || state.id;
            const prototypeUrl = `${baseURL.split('#')[0]}#${route}`;
            await page.goto(prototypeUrl, { waitUntil: 'domcontentloaded' });
            await settle(page, { prototype: true });
          } else if (mode === 'preview') {
            await page.goto(routeUrl(baseURL, '/preview'), { waitUntil: 'domcontentloaded' });
            await settle(page);
          } else {
            const prepared = scenario
              ? await scenario.prepare(state, { page, context, baseURL, urlMap, log })
              : null;
            if (prepared && prepared.page) page = prepared.page;
            await settle(page);
          }

          const measurement = await page.evaluate(measurePage, {
            limits: LIMITS,
            selectors: SELECTORS,
            state: stateForPage(state)
          });
          measurement.meta.mode = mode;
          measurement.meta.baseline = state.baseline || null;
          measurement.meta.browser = browserVersion;
          measurement.meta.scenario = text(args.scenario) || (mode === 'app' ? 'scenarios/default.mjs' : null);

          const screenshotName = `${slugify(state.id)}-${viewport.id}.png`;
          const screenshotPath = resolve(screenshotsDir, screenshotName);
          const captured = await maybeScreenshot(page, screenshotPath, { enabled: takeScreenshots, fullPage });

          let keyboard = null;
          if (state.keyboard) {
            keyboard = await keyboardProbe(page, { drawer: !!state.drawer });
          }

          const checks = evaluateMeasurement(measurement, state, viewport, {
            forbiddenCopy: FORBIDDEN_COPY,
            forbiddenDom: FORBIDDEN_DOM,
            runtime,
            keyboard
          });
          const totals = summarizeChecks(checks);
          item = {
            state: state.id,
            label: state.label,
            viewport: viewport.id,
            viewportPx: { width: viewport.width, height: viewport.height, dpr: viewport.dpr },
            mode,
            url: measurement.meta.url,
            screenshot: captured ? relativeTo(runDir, screenshotPath) : null,
            totals,
            checks,
            keyboard,
            runtime,
            measurement
          };
          measurements.push(item);
          await writeJson(resolve(rawDir, `${slugify(state.id)}-${viewport.id}.json`), item);

          const status = totals.fail > 0 ? 'FAIL' : totals.review > 0 ? 'REVIEW' : 'PASS';
          log(`${status} ${label} — ${totals.pass} pass, ${totals.fail} fail, ${totals.review} review, ${totals.skip} skip`);

          if (scenario && typeof scenario.teardownState === 'function') {
            await scenario.teardownState(state).catch(() => {});
          }
        } catch (error) {
          const unavailable = error instanceof ScenarioUnavailableError;
          const message = String(error && error.message ? error.message : error);
          const checks = [
            {
              id: unavailable ? 'scenario.available' : 'runtime.error',
              label: unavailable ? 'Estado requer cenário dedicado' : 'Execução do estado',
              status: unavailable ? 'skip' : 'fail',
              detail: message.slice(0, 1200)
            }
          ];
          item = {
            state: state.id,
            label: state.label,
            viewport: viewport.id,
            viewportPx: { width: viewport.width, height: viewport.height, dpr: viewport.dpr },
            mode,
            url: page ? page.url() : null,
            screenshot: null,
            totals: summarizeChecks(checks),
            checks,
            keyboard: null,
            runtime,
            error: message,
            measurement: null
          };
          measurements.push(item);
          await writeJson(resolve(rawDir, `${slugify(state.id)}-${viewport.id}.json`), item);
          log(`${unavailable ? 'SKIP' : 'ERROR'} ${label} — ${message.split('\n')[0]}`);
          if (!unavailable && failFast) {
            fatalError = error;
            break;
          }
        } finally {
          if (context) await context.close().catch(() => {});
        }

        if (fatalError) break;
      }

      if (scenario && typeof scenario.teardown === 'function') {
        await scenario.teardown().catch(() => {});
      }
      if (fatalError) break;
    }
  } finally {
    await browser.close().catch(() => {});
    if (staticServer) await staticServer.close().catch(() => {});
  }

  const finishedAt = new Date().toISOString();
  const totals = measurements.reduce(
    (accumulator, item) => {
      const itemTotals = item.totals || summarizeChecks(item.checks || []);
      for (const key of ['pass', 'fail', 'review', 'skip']) accumulator[key] += itemTotals[key] || 0;
      return accumulator;
    },
    { pass: 0, fail: 0, review: 0, skip: 0 }
  );
  const skippedStates = measurements.filter((item) => (item.totals?.skip || 0) > 0 && item.checks.some((check) => check.id === 'scenario.available'));
  const failedStates = measurements.filter((item) => (item.totals?.fail || 0) > 0);
  const expectedCells = states.length * viewports.length;
  const completedCells = measurements.filter((item) => item.measurement).length;
  const exitCode = fatalError ? 2 : totals.fail > 0 ? 1 : requireComplete && skippedStates.length > 0 ? 3 : 0;

  const summary = {
    schema: 't019f-run/1',
    runId,
    mode,
    url: baseURL,
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    node: process.version,
    browser: browserVersion,
    viewports: viewports.map((viewport) => viewport.id),
    states: states.map((state) => state.id),
    matrix: {
      expectedCells,
      completedCells,
      failedCells: failedStates.length,
      skippedCells: skippedStates.length
    },
    totals,
    exitCode: soft ? 0 : exitCode,
    rawExitCode: exitCode,
    error: fatalError ? String(fatalError.message || fatalError) : null,
    note: 'Este harness não declara aceite. A revisão visual e a decisão são da T019F/orquestrador.'
  };

  await writeJson(resolve(runDir, 'measurements.json'), measurements);
  await writeJson(resolve(runDir, 'summary.json'), summary);
  await writeJson(resolve(runDir, 'failures.json'), measurements.flatMap((item) =>
    (item.checks || [])
      .filter((check) => check.status === 'fail')
      .map((check) => ({
        state: item.state,
        viewport: item.viewport,
        id: check.id,
        detail: check.detail
      }))
  ));
  await writeRunHtml(runDir, summary, measurements);

  log(
    `resumo: ${totals.pass} pass, ${totals.fail} fail, ${totals.review} review, ${totals.skip} skip; ` +
      `${completedCells}/${expectedCells} células medidas; exit ${summary.exitCode}`
  );
  log(`relatório: ${relativeTo(HARNESS_DIR, resolve(runDir, 'index.html'))}`);

  if (fatalError) {
    console.error(fatalError.stack || fatalError.message);
    return summary.exitCode;
  }
  return summary.exitCode;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('[t019f] erro fatal:', error.stack || error);
    process.exitCode = 2;
  });
