/**
 * T009 — reprodução no navegador real do sintoma de reentrada.
 *
 * Topologia isolada (não toca a aplicação do usuário):
 *   - servidor Tretta real (apps/server/dist) na porta 3150, defaults de keepalive;
 *   - web app Next dev, cópia isolada do working tree, na porta 3099,
 *     apontando NEXT_PUBLIC_SERVER_URL para o proxy;
 *   - proxy TCP 3160 -> 3150 com "blackhole" seletivo: para de repassar bytes
 *     das conexões existentes sem enviar FIN/RST (queda abrupta / suspensão).
 *
 * Roteiro:
 *   1. Ana (desktop) cria a sala; Bia (Pixel 7) entra; rodada começa.
 *   2. blackhole nas conexões existentes (o socket ativo da Bia fica
 *      "meio aberto" no servidor; novas conexões, do reload, passam).
 *   3. Bia recarrega a página: o app tenta a reentrada 4x em ~1,2 s e desiste.
 *      Captura: mensagem exibida, formulário, credencial preservada no storage.
 *   4. O servidor reconhece a queda quando o ping timeout expira (~45 s).
 *   5. Bia recarrega de novo após o reconhecimento: recupera identidade e mão.
 *
 * Saída: JSON sanitizado (tempos, códigos, digests; sem mãos/credenciais).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';
import { chromium, devices } from '@playwright/test';

const repo = process.argv[2];
const base = process.argv[3];
if (!repo || !base) throw new Error('uso: node repro-browser.mjs <repo> <base>');

const SERVER_PORT = 3150;
const PROXY_PORT = 3160;
const WEB_PORT = 3099;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const startedAt = Date.now();
const timeline = [];
const log = (kind, detail = {}) => timeline.push({ ms: Date.now() - startedAt, kind, ...detail });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // ainda subindo
    }
    if (Date.now() > deadline) return false;
    await sleep(250);
  }
}

// ---------- proxy com blackhole seletivo ----------
function createProxy(targetPort) {
  const pairs = new Map();
  let nextId = 0;
  const tcp = net.createServer((client) => {
    const upstream = net.connect({ host: '127.0.0.1', port: targetPort });
    const id = ++nextId;
    const pair = { id, client, upstream };
    pairs.set(id, pair);
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('close', () => pairs.delete(id));
    upstream.on('close', () => pairs.delete(id));
    log('proxy.connection', { id });
  });
  return new Promise((resolve) => {
    tcp.listen(PROXY_PORT, '127.0.0.1', () => {
      resolve({
        connections: () => [...pairs.keys()],
        blackhole(id) {
          const pair = pairs.get(id);
          if (!pair) throw new Error(`conexão ${id} ausente`);
          pair.client.pause();
          pair.upstream.pause();
          log('proxy.blackhole', { id });
        },
        close: () => tcp.close(),
      });
    });
  });
}

const handIds = (page) =>
  page
    .getByTestId('my-hand')
    .locator('[data-testid^="card-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));

const digestOf = (ids) => crypto.createHash('sha256').update([...ids].sort().join('|')).digest('hex');

const snapshotOf = (page) =>
  page.evaluate(() => ({
    error: document.querySelector('[data-testid="error-banner"]')?.textContent?.trim() ?? null,
    joinForm: document.querySelector('[data-testid="join-name-input"]') !== null,
    connecting: document.querySelector('[data-testid="connecting"]') !== null,
    hand: document.querySelector('[data-testid="my-hand"]') !== null,
    pausePanel: document.querySelector('[data-testid="pause-panel"]') !== null,
  }));

// Preenche um input controlado aguardando a hidratação do React: se o input for
// preenchido antes da hidratação, o React restaura o estado vazio e o botão de
// envio continua desabilitado. Repetimos o fill até o botão habilitar.
async function fillUntilEnabled(page, inputTestId, value, buttonTestId) {
  const input = page.getByTestId(inputTestId);
  const button = page.getByTestId(buttonTestId);
  for (let round = 0; round < 20; round++) {
    await input.fill(value);
    await sleep(250);
    if (await button.isEnabled()) return;
  }
  throw new Error(`botão ${buttonTestId} não habilitou após preencher ${inputTestId}`);
}

async function waitForBiaState(page, predicate, timeoutMs, stepMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = await snapshotOf(page);
    if (predicate(last)) return last;
    if (Date.now() > deadline) return last;
    await sleep(stepMs);
  }
}

const results = { symptom: {}, recovery: {}, host: {}, storage: {}, proxy: {} };
let serverProcess = null;
let webProcess = null;
let proxy = null;
let browser = null;
let contextA = null;
let contextB = null;
let roomCode = null;

try {
  // ---------- servidor ----------
  serverProcess = spawn(process.execPath, [`${repo}/apps/server/dist/index.js`], {
    env: { ...process.env, TRE_TTA_PORT: String(SERVER_PORT), TRE_TTA_WEB_ORIGIN: WEB_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!(await waitHttp(`http://127.0.0.1:${SERVER_PORT}/healthz`, 15_000))) throw new Error('servidor não subiu');
  log('server.ready');

  proxy = await createProxy(SERVER_PORT);

  // ---------- web (cópia isolada) ----------
  const webDir = `${base}/tretta/apps/web`;
  // --webpack: o Turbopack recusa node_modules simbólico para fora da raiz do
  // projeto nesta cópia isolada; o comportamento do app é o mesmo.
  webProcess = spawn(`${webDir}/node_modules/.bin/next`, ['dev', '--webpack', '-p', String(WEB_PORT)], {
    cwd: webDir,
    env: { ...process.env, NEXT_PUBLIC_SERVER_URL: `http://127.0.0.1:${PROXY_PORT}`, NEXT_PUBLIC_TEST_HOOKS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!(await waitHttp(`${WEB_URL}/`, 90_000))) throw new Error('web não subiu');
  log('web.ready');

  // ---------- navegador ----------
  browser = await chromium.launch();
  contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contextB = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageErrors = [];
  for (const page of [pageA, pageB]) page.on('pageerror', (error) => pageErrors.push(String(error)));

  // Ana cria a sala.
  await pageA.goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' });
  await fillUntilEnabled(pageA, 'nickname-input', 'Ana', 'create-room-button');
  await pageA.getByTestId('create-room-button').click();
  const invite = pageA.getByTestId('invite-link');
  await invite.waitFor({ state: 'visible', timeout: 20_000 });
  const href = (await invite.textContent()) ?? '';
  roomCode = href.split('/sala/').at(-1)?.trim() ?? '';

  // Bia entra.
  await pageB.goto(href, { waitUntil: 'domcontentloaded' });
  await fillUntilEnabled(pageB, 'join-name-input', 'Bia', 'join-room-button');
  await pageB.getByTestId('join-room-button').click();
  await pageB.getByTestId('ready-toggle').waitFor({ state: 'visible', timeout: 20_000 });

  // Preparação e início (sem ganchos de teste: baralho aleatório).
  await pageA.getByTestId('ready-toggle').click();
  await pageB.getByTestId('ready-toggle').click();
  await pageA.getByTestId('start-round-button').waitFor({ state: 'visible', timeout: 10_000 });
  await pageA.getByTestId('start-round-button').click();
  await pageA.getByTestId('my-hand').waitFor({ state: 'visible', timeout: 20_000 });
  await pageB.getByTestId('my-hand').waitFor({ state: 'visible', timeout: 20_000 });
  log('round.started');

  const handBefore = await handIds(pageB);
  results.symptom.handCountBefore = handBefore.length;
  results.symptom.handDigestBefore = digestOf(handBefore);

  const connections = proxy.connections();
  results.proxy.connectionsBeforeCut = connections.length;
  if (connections.length < 2) throw new Error(`esperava ao menos 2 conexões no proxy, vi ${connections.length}`);

  // ---------- blackhole em todas as conexões existentes ----------
  // O next dev (StrictMode) pode manter conexões extras por aba; pausar TODAS as
  // pré-corte garante que o socket ativo da Bia fique meio aberto no servidor.
  // Conexões novas (pós-corte, ex.: o reload da Bia) atravessam normalmente.
  const t0 = Date.now();
  for (const id of connections) proxy.blackhole(id);
  log('cut', { connections });

  // ---------- Bia recarrega ----------
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  const afterCut = await waitForBiaState(pageB, (state) => state.error !== null, 10_000);
  results.symptom.msToError = Date.now() - t0;
  results.symptom.errorText = afterCut.error;
  results.symptom.joinFormVisible = afterCut.joinForm;
  results.symptom.connectingVisible = afterCut.connecting;
  log('bia.error-visible', { ms: Date.now() - t0, error: afterCut.error });

  results.storage = await pageB.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith('tretta.identity.'));
    const raw = key === undefined ? null : localStorage.getItem(key);
    return { identityKeyPresent: key !== undefined, credentialLength: raw === null ? 0 : (JSON.parse(raw).credential ?? '').length };
  });
  await pageB.screenshot({ path: `${base}/bia-error-after-reload.png` });

  // ---------- Espera o servidor reconhecer as quedas (ping timeout) ----------
  // Janela = pingInterval 25 s + pingTimeout 20 s; 48 s cobre o pior caso com
  // margem. Registra, sem exigir, se as páginas mostram a pausa da rodada.
  const recognitionTargetMs = 48_000;
  await sleep(Math.max(0, recognitionTargetMs - (Date.now() - t0)));
  const pauseA = await snapshotOf(pageA);
  const pauseB = await snapshotOf(pageB);
  results.host.pausePanelVisibleAnywhere = pauseA.pausePanel || pauseB.pausePanel;
  results.host.msToPauseObserved = Date.now() - t0;
  log('server.recognition-window-observed', { ms: Date.now() - t0, pauseA: pauseA.pausePanel, pauseB: pauseB.pausePanel });

  // O sintoma persiste sem retry automático: o banner continua visível.
  const stillStuck = await snapshotOf(pageB);
  results.symptom.stillStuckAfterRecognition = stillStuck.error !== null;
  log('bia.still-stuck', { error: stillStuck.error });

  // ---------- Bia recarrega de novo: recuperação ----------
  const tRetry = Date.now();
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  const recovered = await waitForBiaState(pageB, (state) => state.hand, 20_000);
  results.recovery.msToHandAfterRetry = Date.now() - tRetry;
  results.recovery.handVisible = recovered.hand;
  results.recovery.errorVisible = recovered.error;
  if (recovered.hand) {
    const handAfter = await handIds(pageB);
    results.recovery.handCountAfter = handAfter.length;
    results.recovery.sameHandDigest = digestOf(handAfter) === results.symptom.handDigestBefore;
  }
  log('bia.recovered', { msToRetry: results.recovery.msToHandAfterRetry, hand: recovered.hand });

  // Ana volta a jogar (pausa some).
  const resumed = await waitForBiaState(pageA, (state) => !state.pausePanel, 20_000, 500);
  results.host.pauseClearedAfterRecovery = !resumed.pausePanel;
  log('ana.resumed', { cleared: !resumed.pausePanel });

  results.pageErrors = pageErrors;
  // Sem screenshot final: a mesa recuperada exibe a mão privada; a recuperação
  // fica comprovada pelo JSON (mão visível + digest idêntico).
} finally {
  if (contextA) await contextA.close().catch(() => {});
  if (contextB) await contextB.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (webProcess) webProcess.kill('SIGTERM');
  if (serverProcess) serverProcess.kill('SIGTERM');
  if (proxy) proxy.close();
}

const output = {
  node: process.version,
  roomCodeMasked: roomCode === null ? null : `${roomCode.slice(0, 2)}…`,
  results,
  timeline,
};
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.exit(0);
