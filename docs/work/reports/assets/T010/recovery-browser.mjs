/**
 * T010 — retomada automática no navegador real (janela de reconhecimento tardio).
 *
 * Topologia isolada (não toca a aplicação do usuário):
 *  - servidor real (apps/server/dist) na 3150, heartbeat padrão (sem ajustes);
 *  - web em MODO PRODUÇÃO (next build + next start) na cópia isolada, na 3099,
 *    com NEXT_PUBLIC_SERVER_URL fixado no build para o proxy — em produção cada
 *    página mantém exatamente uma conexão (sem o churn do StrictMode no dev);
 *  - proxy TCP 3160 -> 3150 com "blackhole" seletivo: para de repassar bytes
 *    SEM FIN/RST, deixando o socket antigo "meio aberto" no servidor (queda
 *    abrupta real; reconhecimento só no ping timeout ~45 s).
 *
 * Roteiro (o sintoma de T009: queda + reload durante a janela tardia):
 *  1. Ana (desktop) cria a sala; Bia (Pixel 7) entra; rodada começa.
 *  2. Blackhole SOMENTE na conexão da Bia; novas conexões seguem passando.
 *  3. Bia recarrega: a página mostra "Retomando sua sessão…" com espera
 *     limitada — nunca o formulário de entrada nem o erro antigo de
 *     "já está conectada" — e a credencial guardada fica intacta.
 *  4. Com o ping timeout (~45 s), o servidor reconhece a queda e o ciclo de
 *     retomada conclui sozinho, sem novo reload: mesma mão, mesma identidade.
 *  5. Ana vê a rodada pausar e voltar, sem perder a mesa.
 *
 * Saída: JSON sanitizado (tempos, flags, digests, impressão digital não
 * reversível da credencial; sem mãos/credenciais) + captura da tela de espera
 * (sem cartas na tela) em bia-recovering.png.
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';
import { chromium, devices } from '@playwright/test';

const repo = process.argv[2];
const webDir = process.argv[3];
const outDir = process.argv[4];
if (!repo || !webDir || !outDir) throw new Error('uso: node recovery-browser.mjs <repo> <webDir> <outDir>');

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

const snapshot = (page) =>
  page.evaluate(() => ({
    error: document.querySelector('[data-testid="error-banner"]')?.textContent?.trim() ?? null,
    joinForm: document.querySelector('[data-testid="join-name-input"]') !== null,
    connecting: document.querySelector('[data-testid="connecting"]') !== null,
    recovering: document.querySelector('[data-testid="recovering"]') !== null,
    hand: document.querySelector('[data-testid="my-hand"]') !== null,
    pausePanel: document.querySelector('[data-testid="pause-panel"]') !== null,
  }));

// Impressão digital não reversível da credencial guardada: comprimento + checksum
// simples. O artefato nunca contém a credencial em si.
const credentialFingerprint = (page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith('tretta.identity.'));
    const raw = key === undefined ? null : localStorage.getItem(key);
    if (raw === null) return { present: false, length: 0, checksum: null };
    const parsed = JSON.parse(raw);
    const credential = typeof parsed.credential === 'string' ? parsed.credential : '';
    let checksum = 0;
    for (const ch of credential) checksum = (checksum * 31 + ch.charCodeAt(0)) >>> 0;
    return { present: true, length: credential.length, checksum };
  });

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

const results = {
  mode: 'producao',
  heartbeat: 'padrao (sem TRE_TTA_* de ping)',
  bia: {},
  host: {},
  proxy: {},
  storage: {},
};
let serverProcess = null;
let webProcess = null;
let proxy = null;
let browser = null;
let contextA = null;
let contextB = null;
let roomCode = null;

try {
  // ---------- build de produção da cópia isolada ----------
  const buildStart = Date.now();
  const build = spawnSync(`${webDir}/node_modules/.bin/next`, ['build'], {
    cwd: webDir,
    env: {
      ...process.env,
      NEXT_PUBLIC_SERVER_URL: `http://127.0.0.1:${PROXY_PORT}`,
      NEXT_PUBLIC_TEST_HOOKS: '0',
    },
    encoding: 'utf8',
    timeout: 300_000,
  });
  if (build.status !== 0) {
    process.stderr.write(build.stdout ?? '');
    process.stderr.write(build.stderr ?? '');
    throw new Error(`next build falhou (status ${build.status})`);
  }
  log('web.build', { ms: Date.now() - buildStart });
  if (build.stdout?.includes('Compiled successfully') === false) {
    process.stderr.write(build.stdout ?? '');
  }

  // ---------- servidor ----------
  serverProcess = spawn(process.execPath, [`${repo}/apps/server/dist/index.js`], {
    env: { ...process.env, TRE_TTA_PORT: String(SERVER_PORT), TRE_TTA_WEB_ORIGIN: WEB_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!(await waitHttp(`http://127.0.0.1:${SERVER_PORT}/healthz`, 15_000))) throw new Error('servidor não subiu');
  log('server.ready');

  proxy = await createProxy(SERVER_PORT);

  // ---------- web de produção ----------
  webProcess = spawn(`${webDir}/node_modules/.bin/next`, ['start', '-p', String(WEB_PORT)], {
    cwd: webDir,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!(await waitHttp(`${WEB_URL}/`, 60_000))) throw new Error('web não subiu');
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
  results.bia.handCountBefore = handBefore.length;
  results.bia.handDigestBefore = digestOf(handBefore);
  results.storage.before = await credentialFingerprint(pageB);

  // Em produção, uma conexão por página: a primeira é a da Ana, a segunda a da Bia.
  const connections = proxy.connections();
  results.proxy.connectionsBeforeCut = connections;
  if (connections.length !== 2) throw new Error(`esperava 2 conexões (uma por página), vi ${connections.length}`);
  const biaConnection = connections[1];

  // ---------- blackhole SOMENTE na conexão da Bia ----------
  const t0 = Date.now();
  proxy.blackhole(biaConnection);
  log('cut', { connection: biaConnection });

  // ---------- Bia recarrega (ação do usuário diante do sintoma) ----------
  const tReload = Date.now();
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  await pageB.getByTestId('recovering').waitFor({ state: 'visible', timeout: 15_000 });
  results.bia.recoveringVisibleMsAfterReload = Date.now() - tReload;
  log('bia.recovering-visible', { ms: Date.now() - tReload });

  // Amostras da espera: nunca o formulário de entrada nem o erro antigo.
  let joinFormEverSeen = false;
  let errorEverSeen = null;
  let recoveringStayed = true;
  const sampleAt = async (ms) => {
    await sleep(ms);
    const state = await snapshot(pageB);
    joinFormEverSeen = joinFormEverSeen || state.joinForm;
    errorEverSeen = errorEverSeen ?? state.error;
    return state;
  };
  const wait1 = await sampleAt(1_000);
  await pageB.screenshot({ path: `${outDir}/bia-recovering.png` });
  const wait2 = await sampleAt(12_000);
  recoveringStayed = wait1.recovering && wait2.recovering;
  results.bia.recoveringStillAtPlus1s = wait1.recovering;
  results.bia.recoveringStillAtPlus13s = wait2.recovering;
  results.bia.joinFormDuringWait = joinFormEverSeen || wait1.joinForm || wait2.joinForm;
  results.bia.errorDuringWait = errorEverSeen ?? wait1.error ?? wait2.error;
  results.bia.connectingDuringWait = wait1.connecting || wait2.connecting;
  log('bia.wait-sampled', { recoveringStayed, joinForm: results.bia.joinFormDuringWait });

  // ---------- espera a recuperação automática (sem novo reload) ----------
  let biaRecoveredAt = null;
  let anaPauseAt = null;
  let anaPauseClearedAt = null;
  let lastBia = null;
  let lastAna = null;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    lastBia = await snapshot(pageB);
    lastAna = await snapshot(pageA);
    joinFormEverSeen = joinFormEverSeen || lastBia.joinForm;
    errorEverSeen = errorEverSeen ?? lastBia.error;
    if (biaRecoveredAt === null && lastBia.hand) {
      biaRecoveredAt = Date.now();
      log('bia.recovered', { msAfterReload: biaRecoveredAt - tReload, msAfterCut: biaRecoveredAt - t0 });
    }
    if (anaPauseAt === null && lastAna.pausePanel) {
      anaPauseAt = Date.now();
      log('ana.pause-visible', { msAfterCut: anaPauseAt - t0 });
    }
    if (anaPauseAt !== null && anaPauseClearedAt === null && !lastAna.pausePanel) {
      anaPauseClearedAt = Date.now();
      log('ana.pause-cleared', { msAfterCut: anaPauseClearedAt - t0 });
    }
    if (biaRecoveredAt !== null && anaPauseClearedAt !== null) break;
    await sleep(500);
  }

  results.bia.recoveredHandVisible = lastBia?.hand ?? false;
  results.bia.msToRecoveryAfterReload = biaRecoveredAt === null ? null : biaRecoveredAt - tReload;
  results.bia.msToRecoveryAfterCut = biaRecoveredAt === null ? null : biaRecoveredAt - t0;
  results.bia.joinFormEverSeen = joinFormEverSeen;
  results.bia.errorEverSeen = errorEverSeen;
  results.host.pausePanelAppeared = anaPauseAt !== null;
  results.host.msToPauseAfterCut = anaPauseAt === null ? null : anaPauseAt - t0;
  results.host.pauseClearedAfterRecovery = anaPauseClearedAt !== null;
  results.host.msToPauseClearedAfterCut = anaPauseClearedAt === null ? null : anaPauseClearedAt - t0;
  results.host.handVisibleAtEnd = lastAna?.hand ?? false;

  if (biaRecoveredAt === null) throw new Error('Bia não recuperou dentro de 120 s');
  if (results.bia.msToRecoveryAfterCut < 20_000) {
    throw new Error(`reconhecimento tardio não foi exercitado (recuperou em ${results.bia.msToRecoveryAfterCut} ms)`);
  }

  const handAfter = await handIds(pageB);
  results.bia.handCountAfter = handAfter.length;
  results.bia.sameHandDigest = digestOf(handAfter) === results.bia.handDigestBefore;

  results.storage.after = await credentialFingerprint(pageB);
  results.storage.credentialUnchanged =
    results.storage.before.present &&
    results.storage.after.present &&
    results.storage.before.checksum === results.storage.after.checksum &&
    results.storage.before.length === results.storage.after.length;

  const finalBia = await snapshot(pageB);
  results.bia.final = {
    hand: finalBia.hand,
    joinForm: finalBia.joinForm,
    error: finalBia.error,
    recovering: finalBia.recovering,
  };

  // Teste de aceitação: a retomada precisa concluir sozinha, sem formulário, sem
  // erro, com a mesma mão e a credencial intacta.
  results.acceptance = {
    automatic: biaRecoveredAt !== null,
    noJoinForm: !joinFormEverSeen,
    noError: errorEverSeen === null,
    recoveringShownWhileWaiting: recoveringStayed,
    sameHand: results.bia.sameHandDigest === true,
    credentialPreserved: results.storage.credentialUnchanged === true,
  };
  results.pageErrors = pageErrors;
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
