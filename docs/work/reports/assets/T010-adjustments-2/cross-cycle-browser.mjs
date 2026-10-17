/**
 * T010 (ajustes 2 — resultado incerto entre ciclos) — retomada no navegador
 * real, servidor real, sem alterar código de produção do servidor.
 *
 * Topologia isolada (não toca a aplicação do usuário):
 *  - servidor real (apps/server/dist) na 3150, heartbeat padrão (sem ajustes);
 *  - web em MODO PRODUÇÃO (next build + next start) na cópia isolada, na 3099,
 *    com NEXT_PUBLIC_SERVER_URL fixado no build para o proxy — em produção cada
 *    página mantém exatamente uma conexão (sem churn do StrictMode no dev);
 *  - proxy TCP 3160 -> 3150 com dois controles:
 *      * "blackhole" seletivo (cenário A): para de repassar bytes SEM FIN/RST,
 *        deixando o socket antigo "meio aberto" no servidor (queda abrupta
 *        real; reconhecimento só no ping timeout ~45 s);
 *      * descarte controlado do PRIMEIRO ack de join aceito (cenário B): um
 *        filtro de frames WebSocket derruba o frame `43<id>[{...rejoined...}]`
 *        na próxima conexão nova, sem tocar nos demais frames. O servidor já
 *        aceitou o join; o cliente perde a confirmação local (timeout de 6 s) e
 *        precisa retomar pela MESMA intenção (replay do dedupe do servidor).
 *
 * Cenário A (reedição da prova principal após a correção do ciclo):
 *  1. Ana (desktop) cria a sala; Bia (Pixel 7) entra; rodada começa.
 *  2. Blackhole SOMENTE na conexão da Bia; Bia recarrega.
 *  3. A página mostra "Retomando sua sessão…" — nunca o formulário — e a
 *     credencial guardada fica intacta.
 *  4. Com o ping timeout (~45 s), o servidor reconhece a queda e o ciclo
 *     conclui sozinho, sem novo reload: mesma mão, sem esgotar o prazo.
 *
 * Cenário B (regressão do achado 3: resultado incerto do join):
 *  1. Com a rodada em andamento, o proxy é armado para descartar o primeiro
 *     ack de join aceito da próxima conexão.
 *  2. Ana recarrega (queda limpa): o servidor reconhece na hora e ACEITA o
 *     primeiro join da retomada; o ack é descartado pelo proxy.
 *  3. Durante a janela incerta (estado retido + banner de retomada), os envios
 *     ficam bloqueados (chat desabilitado mesmo com rascunho).
 *  4. Sem ack, o cliente reenvia a MESMA intenção; o dedupe do servidor
 *     devolve a resposta memorizada (sucesso) e a retomada conclui dentro do
 *     prazo, sem reload extra, sem duplicar participante e sem formulário.
 *
 * Cenário C (achado do caso entre ciclos):
 *  1. O proxy é armado para descartar TODO ack de join aceito da conexão de
 *     retomada por 70 s (maior que o prazo de 60 s do ciclo).
 *  2. Ana recarrega: o servidor aceita o join, mas o cliente nunca vê o ack e
 *     esgota o prazo ("Tentar novamente", credencial intacta).
 *  3. Com a rede entregando acks de novo, "Tentar novamente" inicia outro
 *     ciclo explícito: a MESMA intenção é reenviada (um único intentId em toda
 *     a conexão — impressão digital única no proxy) e o dedupe devolve o
 *     sucesso memorizado.
 *  4. Retomada conclui sem reload extra, sem duplicar participante e com a
 *     mesma mão.
 *
 * Saída: JSON sanitizado (tempos, flags, digests, impressão digital não
 * reversível da credencial; sem mãos/credenciais) + capturas sem cartas.
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';
import { chromium, devices } from '@playwright/test';

const repo = process.argv[2];
const webDir = process.argv[3];
const outDir = process.argv[4];
if (!repo || !webDir || !outDir) {
  throw new Error('uso: node cross-cycle-browser.mjs <repo> <webDir> <outDir> [--scenario=c|all]');
}
const scenarioArg = (process.argv.slice(5).find((arg) => arg.startsWith('--scenario=')) ?? '--scenario=c').split('=')[1];
if (!['a', 'b', 'c', 'all'].includes(scenarioArg)) throw new Error(`cenário inválido: ${scenarioArg}`);
const runA = scenarioArg === 'a' || scenarioArg === 'all';
const runB = scenarioArg === 'b' || scenarioArg === 'all';
const runC = scenarioArg === 'c' || scenarioArg === 'all';

const SERVER_PORT = 3150;
const PROXY_PORT = 3160;
const WEB_PORT = 3099;
const WEB_URL = `http://localhost:${WEB_PORT}`;

const startedAt = Date.now();
const timeline = [];
const log = (kind, detail = {}) => timeline.push({ ms: Date.now() - startedAt, kind, ...detail });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// ---------- proxy: blackhole seletivo + filtro de frames ----------
/**
 * Descartador de acks de join: interpreta apenas o suficiente do protocolo
 * WebSocket (frames de servidor -> cliente não são mascarados) para achar o
 * primeiro frame de texto que começa com `43` (pacote de ACK do socket.io) e
 * contém `"rejoined"` — isto é, a resposta de sucesso de `client:joinRoom`.
 * Descarta ESSE frame e volta ao repasse cru. Nada do conteúdo é registrado.
 *
 * O stream do upstream começa com a resposta HTTP `101 Switching Protocols`
 * do upgrade: esse cabeçalho passa cru e a leitura de frames só começa depois
 * do CRLFCRLF (sem isso o parser dessincroniza e corrompe o WebSocket).
 */
function attachJoinAckDrop(pair) {
  const { client, upstream } = pair;
  let buffer = Buffer.alloc(0);
  let headerSkipped = false;
  let dropped = false;
  const onData = (chunk) => {
    if (dropped) {
      client.write(chunk);
      return;
    }
    buffer = Buffer.concat([buffer, chunk]);
    if (!headerSkipped) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return; // aguarda o fim do cabeçalho do upgrade
      client.write(buffer.subarray(0, headerEnd + 4));
      buffer = buffer.subarray(headerEnd + 4);
      headerSkipped = true;
      log('proxy.ws-upgraded', { id: pair.id });
    }
    const forwards = [];
    let offset = 0;
    for (;;) {
      if (buffer.length - offset < 2) break;
      const b0 = buffer[offset];
      const b1 = buffer[offset + 1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let header = 2;
      if (len === 126) {
        if (buffer.length - offset < 4) break;
        len = buffer.readUInt16BE(offset + 2);
        header = 4;
      } else if (len === 127) {
        if (buffer.length - offset < 10) break;
        len = Number(buffer.readBigUInt64BE(offset + 2));
        header = 10;
      }
      const maskBytes = masked ? 4 : 0;
      const frameEnd = offset + header + maskBytes + len;
      if (buffer.length < frameEnd) break;
      const payloadStart = offset + header + maskBytes;
      const payload = buffer.subarray(payloadStart, frameEnd);
      const isText = opcode === 1;
      const isAck = isText && len >= 2 && payload[0] === 0x34 && payload[1] === 0x33;
      const looksJoinAck = isAck && len >= 3 && payload.includes('"rejoined"');
      if (isAck) log('proxy.socketio-ack', { id: pair.id, bytes: len, rejoined: looksJoinAck });
      if (looksJoinAck && !dropped) {
        dropped = true;
        log('proxy.join-ack-dropped', { id: pair.id, bytes: len });
      } else {
        forwards.push(buffer.subarray(offset, frameEnd));
      }
      offset = frameEnd;
    }
    buffer = buffer.subarray(offset);
    if (forwards.length > 0) client.write(Buffer.concat(forwards));
    if (dropped) {
      upstream.off('data', onData);
      if (buffer.length > 0) {
        client.write(buffer);
        buffer = Buffer.alloc(0);
      }
      upstream.pipe(client);
    }
  };
  upstream.on('data', onData);
}

/**
 * Filtro do cenário C sobre a conexão de retomada:
 *  - servidor -> cliente: descarta TODO ack de join aceito (`43…"rejoined"…`)
 *    enquanto a janela estiver aberta; o primeiro que passa é registrado e o
 *    filtro vira repasse cru;
 *  - cliente -> servidor: sem tocar nos bytes, registra a impressão digital de
 *    cada `intentId` distinto de `client:joinRoom` na conexão — prova de que o
 *    cliente nunca mintou id novo entre os ciclos.
 */
function attachCrossCycle(pair, windowMs, record) {
  const { client, upstream } = pair;
  record.dropUntil = Date.now() + windowMs;
  let buffer = Buffer.alloc(0);
  let clientBuffer = Buffer.alloc(0);
  let headerSkipped = false;
  let finished = false;
  const frameAt = (buf, offset) => {
    if (buf.length - offset < 2) return null;
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let header = 2;
    if (len === 126) {
      if (buf.length - offset < 4) return null;
      len = buf.readUInt16BE(offset + 2);
      header = 4;
    } else if (len === 127) {
      if (buf.length - offset < 10) return null;
      len = Number(buf.readBigUInt64BE(offset + 2));
      header = 10;
    }
    const maskBytes = masked ? 4 : 0;
    const frameEnd = offset + header + maskBytes + len;
    if (buf.length < frameEnd) return null;
    return {
      opcode,
      masked,
      maskOffset: offset + header,
      frameEnd,
      payload: buf.subarray(offset + header + maskBytes, frameEnd),
    };
  };
  const onData = (chunk) => {
    if (finished) {
      client.write(chunk);
      return;
    }
    buffer = Buffer.concat([buffer, chunk]);
    if (!headerSkipped) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return; // aguarda o fim do cabeçalho do upgrade
      client.write(buffer.subarray(0, headerEnd + 4));
      buffer = buffer.subarray(headerEnd + 4);
      headerSkipped = true;
      log('proxy.ws-upgraded', { id: pair.id });
    }
    const forwards = [];
    let offset = 0;
    for (;;) {
      const frame = frameAt(buffer, offset);
      if (frame === null) break;
      const isAck =
        frame.opcode === 1 && frame.payload.length >= 2 && frame.payload[0] === 0x34 && frame.payload[1] === 0x33;
      const looksJoinAck = isAck && frame.payload.includes('"rejoined"');
      if (looksJoinAck && Date.now() < record.dropUntil) {
        record.droppedAcks += 1;
        log('proxy.join-ack-dropped', {
          id: pair.id,
          bytes: frame.payload.length,
          droppedAcks: record.droppedAcks,
          windowLeftMs: record.dropUntil - Date.now(),
        });
      } else {
        if (looksJoinAck && !record.ackPassedAfterWindow) {
          record.ackPassedAfterWindow = true;
          log('proxy.join-ack-passed-after-window', { id: pair.id, droppedAcks: record.droppedAcks });
        }
        forwards.push(buffer.subarray(offset, frame.frameEnd));
      }
      offset = frame.frameEnd;
    }
    buffer = buffer.subarray(offset);
    if (forwards.length > 0) client.write(Buffer.concat(forwards));
    if (record.ackPassedAfterWindow && !finished) {
      finished = true;
      upstream.off('data', onData);
      if (buffer.length > 0) {
        client.write(buffer);
        buffer = Buffer.alloc(0);
      }
      upstream.pipe(client);
    }
  };
  upstream.on('data', onData);
  let clientHeaderSkipped = false;
  const onClientData = (chunk) => {
    clientBuffer = Buffer.concat([clientBuffer, chunk]);
    if (!clientHeaderSkipped) {
      const headerEnd = clientBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return; // aguarda a requisição HTTP do upgrade
      clientBuffer = clientBuffer.subarray(headerEnd + 4);
      clientHeaderSkipped = true;
    }
    let offset = 0;
    for (;;) {
      const frame = frameAt(clientBuffer, offset);
      if (frame === null) break;
      if (frame.opcode === 1) {
        let text = frame.payload;
        if (frame.masked) {
          const copy = Buffer.from(frame.payload);
          for (let i = 0; i < copy.length; i++) copy[i] ^= clientBuffer[frame.maskOffset + (i % 4)];
          text = copy;
        }
        if (text.includes('client:joinRoom')) {
          const match = /"intentId":"([^"]+)"/.exec(text.toString('utf8'));
          if (match !== null) {
            const fingerprint = crypto.createHash('sha256').update(match[1]).digest('hex').slice(0, 16);
            if (!record.joinIntents.includes(fingerprint)) {
              record.joinIntents.push(fingerprint);
              log('proxy.join-intent', { id: pair.id, fingerprint, total: record.joinIntents.length });
            }
          }
        }
      }
      offset = frame.frameEnd;
    }
    clientBuffer = clientBuffer.subarray(offset);
  };
  client.on('data', onClientData);
}

function createProxy(targetPort) {
  const pairs = new Map();
  let nextId = 0;
  let armNext = false;
  let armCrossMs = null;
  const crossCycle = { id: null, dropUntil: null, droppedAcks: 0, joinIntents: [], ackPassedAfterWindow: false };
  const tcp = net.createServer((client) => {
    const upstream = net.connect({ host: '127.0.0.1', port: targetPort });
    const id = ++nextId;
    const pair = { id, client, upstream };
    pairs.set(id, pair);
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.pipe(upstream);
    if (armNext) {
      armNext = false;
      log('proxy.drop-armed-connection', { id });
      attachJoinAckDrop(pair);
    } else if (armCrossMs !== null) {
      const windowMs = armCrossMs;
      armCrossMs = null;
      crossCycle.id = id;
      log('proxy.ack-window-armed', { id, windowMs });
      attachCrossCycle(pair, windowMs, crossCycle);
    } else {
      upstream.pipe(client);
    }
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
        armDropJoinAckNext() {
          armNext = true;
          log('proxy.arm-drop-next');
        },
        armCrossCycleNext(windowMs) {
          armCrossMs = windowMs;
          log('proxy.arm-cross-cycle-next', { windowMs });
        },
        crossCycleInfo: () => ({ ...crossCycle, joinIntents: [...crossCycle.joinIntents] }),
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
    recoveringBanner: document.querySelector('[data-testid="recovering-banner"]') !== null,
    connectionLost: document.querySelector('[data-testid="connection-lost"]') !== null,
    exhausted: document.querySelector('[data-testid="recovery-exhausted"]') !== null,
    hand: document.querySelector('[data-testid="my-hand"]') !== null,
    pausePanel: document.querySelector('[data-testid="pause-panel"]') !== null,
  }));

/**
 * Sondagem de ações: o input do chat só desabilita com o transporte fora; o
 * vínculo autorizado aparece no placeholder ("Escreva uma mensagem" = liberado;
 * "Recuperando a conexão com a sala…" = ack ainda não confirmado). O envio fica
 * desabilitado com rascunho vazio — por isso a prova real digita um rascunho.
 */
const LINKED_PLACEHOLDER = 'Escreva uma mensagem';
const actionsProbe = (page) =>
  page.evaluate(() => {
    const input = document.querySelector('[data-testid="chat-input"]');
    const send = document.querySelector('[data-testid="chat-send"]');
    if (input === null || send === null) {
      return { present: false, placeholder: null, inputDisabled: null, sendDisabled: null };
    }
    return {
      present: true,
      placeholder: input.placeholder ?? null,
      inputDisabled: input.disabled === true,
      sendDisabled: send.disabled === true,
    };
  });

const rosterCounts = (page) =>
  page.evaluate(() => ({
    opponents: document.querySelectorAll('[data-testid^="opponent-"]').length,
    waiting: document.querySelectorAll('[data-testid^="waiting-participant-"]').length,
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
  scenario: scenarioArg,
  setup: {},
  scenarioA: {},
  scenarioB: {},
  scenarioC: {},
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

  // Em produção, uma conexão por página: a primeira é a da Ana, a segunda a da Bia.
  const connections = proxy.connections();
  results.setup.connectionsBefore = connections;
  if (connections.length !== 2) throw new Error(`esperava 2 conexões (uma por página), vi ${connections.length}`);
  results.setup.roomCodeMasked = roomCode === null ? null : `${roomCode.slice(0, 2)}…`;

  // ================== Cenário A: retomada principal ==================
  if (runA) {
    const a = results.scenarioA;
    const handBefore = await handIds(pageB);
    a.handCountBefore = handBefore.length;
    a.handDigestBefore = digestOf(handBefore);
    results.storage.before = await credentialFingerprint(pageB);

    const biaConnection = connections[1];
    const t0 = Date.now();
    proxy.blackhole(biaConnection);
    log('scenarioA.cut', { connection: biaConnection });

    const tReload = Date.now();
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await pageB.getByTestId('recovering').waitFor({ state: 'visible', timeout: 15_000 });
    a.recoveringVisibleMsAfterReload = Date.now() - tReload;
    log('scenarioA.recovering-visible', { ms: Date.now() - tReload });

    let joinFormEverSeen = false;
    let errorEverSeen = null;
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
    a.recoveringStillAtPlus1s = wait1.recovering;
    a.recoveringStillAtPlus13s = wait2.recovering;
    a.joinFormDuringWait = joinFormEverSeen || wait1.joinForm || wait2.joinForm;
    a.errorDuringWait = errorEverSeen ?? wait1.error ?? wait2.error;
    a.connectingDuringWait = wait1.connecting || wait2.connecting;
    log('scenarioA.wait-sampled', { recoveringStayed: wait1.recovering && wait2.recovering });

    let biaRecoveredAt = null;
    let biaExhaustedAt = null;
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
        log('scenarioA.recovered', { msAfterReload: biaRecoveredAt - tReload, msAfterCut: biaRecoveredAt - t0 });
      }
      if (biaExhaustedAt === null && lastBia.exhausted) {
        biaExhaustedAt = Date.now();
        log('scenarioA.exhausted', { msAfterReload: biaExhaustedAt - tReload });
      }
      if (anaPauseAt === null && lastAna.pausePanel) {
        anaPauseAt = Date.now();
        log('scenarioA.ana-pause-visible', { msAfterCut: anaPauseAt - t0 });
      }
      if (anaPauseAt !== null && anaPauseClearedAt === null && !lastAna.pausePanel) {
        anaPauseClearedAt = Date.now();
        log('scenarioA.ana-pause-cleared', { msAfterCut: anaPauseClearedAt - t0 });
      }
      if ((biaRecoveredAt !== null || biaExhaustedAt !== null) && anaPauseClearedAt !== null) break;
      await sleep(500);
    }

    a.recoveredHandVisible = lastBia?.hand ?? false;
    a.exhaustedPanelSeen = biaExhaustedAt !== null;
    a.msToRecoveryAfterReload = biaRecoveredAt === null ? null : biaRecoveredAt - tReload;
    a.msToRecoveryAfterCut = biaRecoveredAt === null ? null : biaRecoveredAt - t0;
    a.joinFormEverSeen = joinFormEverSeen;
    a.errorEverSeen = errorEverSeen;
    a.anaPausePanelAppeared = anaPauseAt !== null;
    a.msToAnaPauseAfterCut = anaPauseAt === null ? null : anaPauseAt - t0;
    a.anaPauseClearedAfterRecovery = anaPauseClearedAt !== null;
    a.msToAnaPauseClearedAfterCut = anaPauseClearedAt === null ? null : anaPauseClearedAt - t0;
    a.anaHandVisibleAtEnd = lastAna?.hand ?? false;

    const handAfter = await handIds(pageB);
    a.handCountAfter = handAfter.length;
    a.sameHandDigest = digestOf(handAfter) === a.handDigestBefore;

    results.storage.after = await credentialFingerprint(pageB);
    a.credentialPreserved =
      results.storage.before.present &&
      results.storage.after.present &&
      results.storage.before.checksum === results.storage.after.checksum &&
      results.storage.before.length === results.storage.after.length;

    const finalBia = await snapshot(pageB);
    a.final = {
      hand: finalBia.hand,
      joinForm: finalBia.joinForm,
      error: finalBia.error,
      recovering: finalBia.recovering,
      recoveringBanner: finalBia.recoveringBanner,
      exhausted: finalBia.exhausted,
    };
    a.acceptance = {
      automatic: biaRecoveredAt !== null,
      recoveryUnderDeadline: a.msToRecoveryAfterReload !== null && a.msToRecoveryAfterReload <= 60_000,
      noJoinForm: !a.joinFormEverSeen,
      noError: a.errorEverSeen === null,
      recoveringShownWhileWaiting: a.recoveringStillAtPlus1s && a.recoveringStillAtPlus13s,
      sameHand: a.sameHandDigest === true,
      credentialPreserved: a.credentialPreserved === true,
      noExhaustedPanel: !a.exhaustedPanelSeen,
      lateRecognitionExercised: (a.msToRecoveryAfterCut ?? 0) >= 20_000,
      anaPauseResolved: a.anaPauseClearedAfterRecovery === true,
    };
    if (!a.acceptance.automatic) log('scenarioA.not-recovered');
  }

  // ================== Cenário B: ack do join aceito perdido ==================
  if (runB) {
    const b = results.scenarioB;
    const anaHandBefore = await handIds(pageA);
    b.anaHandCountBefore = anaHandBefore.length;
    b.anaHandDigestBefore = digestOf(anaHandBefore);
    b.biaRosterBefore = await rosterCounts(pageB);
    b.anaRosterBefore = await rosterCounts(pageA);
    b.credentialBefore = await credentialFingerprint(pageA);
    b.anaReloads = 1;

    proxy.armDropJoinAckNext();
    const tReload = Date.now();
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    log('scenarioB.ana-reloaded');

    let joinFormEverSeen = false;
    let errorEverSeen = null;
    let recoveringEverSeen = false;
    let connectionLostSeen = false;
    let stateSeenAt = null;
    let bannerSeenAt = null;
    let recoveredAt = null;
    let exhaustedAt = null;
    let windowProbe = null;
    let lastAna = null;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      lastAna = await snapshot(pageA);
      joinFormEverSeen = joinFormEverSeen || lastAna.joinForm;
      errorEverSeen = errorEverSeen ?? lastAna.error;
      recoveringEverSeen = recoveringEverSeen || lastAna.recovering;
      if (!connectionLostSeen && lastAna.connectionLost) {
        connectionLostSeen = true;
        log('scenarioB.connection-lost-seen', { msAfterReload: Date.now() - tReload });
      }
      if (stateSeenAt === null && lastAna.hand) {
        stateSeenAt = Date.now();
        log('scenarioB.state-arrived', { msAfterReload: stateSeenAt - tReload });
      }
      if (bannerSeenAt === null && lastAna.recoveringBanner) {
        bannerSeenAt = Date.now();
        log('scenarioB.recovering-banner', { msAfterReload: bannerSeenAt - tReload });
      }
      // Janela incerta: estado retido + banner, sem confirmação válida ainda.
      // O chat precisa continuar bloqueado mesmo com rascunho preenchido.
      if (windowProbe === null && lastAna.recoveringBanner && lastAna.hand) {
        const input = pageA.getByTestId('chat-input');
        const button = pageA.getByTestId('chat-send');
        for (let attempt = 0; attempt < 5 && windowProbe === null; attempt++) {
          await input.fill('teste de bloqueio');
          await sleep(150);
          const draft = await input.inputValue();
          if (draft !== 'teste de bloqueio') continue;
          windowProbe = {
            msAfterReload: Date.now() - tReload,
            draftKept: true,
            sendDisabled: await button.isDisabled(),
          };
          log('scenarioB.window-probe', windowProbe);
        }
      }
      if (
        recoveredAt === null &&
        lastAna.hand &&
        !lastAna.recovering &&
        !lastAna.recoveringBanner &&
        !lastAna.connectionLost &&
        !lastAna.exhausted
      ) {
        recoveredAt = Date.now();
        log('scenarioB.recovered', { msAfterReload: recoveredAt - tReload });
      }
      if (exhaustedAt === null && lastAna.exhausted) {
        exhaustedAt = Date.now();
        log('scenarioB.exhausted', { msAfterReload: exhaustedAt - tReload });
      }
      if (recoveredAt !== null || exhaustedAt !== null) {
        await sleep(1_000);
        lastAna = await snapshot(pageA);
        break;
      }
      await sleep(120);
    }

    b.recoveringEverSeen = recoveringEverSeen;
    b.connectionLostSeen = connectionLostSeen;
    b.stateVisibleMsAfterReload = stateSeenAt === null ? null : stateSeenAt - tReload;
    b.bannerVisibleMsAfterReload = bannerSeenAt === null ? null : bannerSeenAt - tReload;
    b.windowProbe = windowProbe;
    b.exhaustedPanelSeen = exhaustedAt !== null;
    b.msToRecoveryAfterReload = recoveredAt === null ? null : recoveredAt - tReload;
    b.msToExhaustionAfterReload = exhaustedAt === null ? null : exhaustedAt - tReload;
    b.joinFormEverSeen = joinFormEverSeen;
    b.errorEverSeen = errorEverSeen;
    b.final = {
      hand: lastAna?.hand ?? false,
      joinForm: lastAna?.joinForm ?? null,
      error: lastAna?.error ?? null,
      recovering: lastAna?.recovering ?? null,
      recoveringBanner: lastAna?.recoveringBanner ?? null,
      exhausted: lastAna?.exhausted ?? null,
    };

    if (recoveredAt !== null) {
      const anaHandAfter = await handIds(pageA);
      b.anaHandCountAfter = anaHandAfter.length;
      b.anaHandDigestAfter = digestOf(anaHandAfter);
      b.sameHandDigest = b.anaHandDigestAfter === b.anaHandDigestBefore;
      const sendEnabled = await pageA.getByTestId('chat-send').isEnabled();
      b.chatSendEnabledAfterRecovery = sendEnabled;
      log('scenarioB.chat-after-recovery', { enabled: sendEnabled });
    } else {
      b.sameHandDigest = null;
      b.chatSendEnabledAfterRecovery = null;
    }

    b.biaRosterAfter = await rosterCounts(pageB);
    b.anaRosterAfter = await rosterCounts(pageA);
    b.biaHandDigestAfter = digestOf(await handIds(pageB));
    b.biaHandStable = b.biaHandDigestAfter !== null && b.biaRosterBefore.opponents === 1;
    b.credentialAfter = await credentialFingerprint(pageA);
    b.credentialPreserved =
      b.credentialBefore.present &&
      b.credentialAfter.present &&
      b.credentialBefore.checksum === b.credentialAfter.checksum &&
      b.credentialBefore.length === b.credentialAfter.length;
    b.noDuplicateParticipant =
      b.biaRosterAfter.opponents === 1 &&
      b.biaRosterAfter.waiting === 0 &&
      b.anaRosterAfter.opponents === 1 &&
      b.anaRosterAfter.waiting === 0;

    b.acceptance = {
      recoveredAutomatically: recoveredAt !== null,
      recoveryUnderDeadline: b.msToRecoveryAfterReload !== null && b.msToRecoveryAfterReload <= 60_000,
      neverExhausted: !b.exhaustedPanelSeen,
      noJoinForm: !b.joinFormEverSeen,
      noError: b.errorEverSeen === null,
      actionsBlockedDuringWindow: windowProbe !== null && windowProbe.sendDisabled === true,
      actionsWorkAfterConfirmation: b.chatSendEnabledAfterRecovery === true,
      sameHand: b.sameHandDigest === true,
      credentialPreserved: b.credentialPreserved === true,
      noDuplicateParticipant: b.noDuplicateParticipant === true,
      noExtraReload: b.anaReloads === 1,
    };
  }

  // ================== Cenário C: resultado incerto entre ciclos ==================
  if (runC) {
    const c = results.scenarioC;
    const anaHandBefore = await handIds(pageA);
    c.anaHandCountBefore = anaHandBefore.length;
    c.anaHandDigestBefore = digestOf(anaHandBefore);
    c.anaRosterBefore = await rosterCounts(pageA);
    c.biaRosterBefore = await rosterCounts(pageB);
    c.credentialBefore = await credentialFingerprint(pageA);
    c.anaReloads = 1;

    // Janela de descarte maior que o prazo do 1º ciclo: o servidor aceita o
    // join da retomada, mas NENHUM ack chega ao cliente até depois dos 60 s.
    const ACK_DROP_WINDOW_MS = 70_000;
    c.ackDropWindowMs = ACK_DROP_WINDOW_MS;
    proxy.armCrossCycleNext(ACK_DROP_WINDOW_MS);
    const tReload = Date.now();
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    log('scenarioC.ana-reloaded', { ackDropWindowMs: ACK_DROP_WINDOW_MS });

    // 1º ciclo: sem ack, a UI entra em "prazo esgotado" aos 60 s com a
    // credencial preservada e sem entrar como pessoa nova.
    let exhaustedAt = null;
    let exhaustedSnap = null;
    let errorEverSeen = null;
    const exhaustDeadline = Date.now() + 80_000;
    while (exhaustedAt === null && Date.now() < exhaustDeadline) {
      const snap = await snapshot(pageA);
      errorEverSeen = errorEverSeen ?? snap.error;
      if (snap.exhausted) {
        exhaustedAt = Date.now();
        exhaustedSnap = snap;
      } else {
        await sleep(250);
      }
    }
    if (exhaustedAt === null) throw new Error('cenário C: painel de vencimento não apareceu');
    log('scenarioC.exhausted', { msAfterReload: exhaustedAt - tReload, snap: exhaustedSnap });
    c.exhaustedMsAfterReload = exhaustedAt - tReload;
    c.credentialAtExhausted = await credentialFingerprint(pageA);
    c.actionsAtExhausted = await actionsProbe(pageA);
    await pageA
      .getByTestId('recovery-exhausted')
      .screenshot({ path: `${outDir}/ana-cross-cycle-exhausted.png` });

    // A rede volta a entregar acks: espera o fim da janela antes de retomar.
    const armed = proxy.crossCycleInfo();
    while (Date.now() < (armed.dropUntil ?? 0) + 1_200) await sleep(400);
    log('scenarioC.ack-window-ended', {
      msAfterReload: Date.now() - tReload,
      droppedAcks: armed.droppedAcks,
    });

    // "Tentar novamente": novo ciclo explícito confirma a intenção incerta com
    // o replay exato (mesmo intentId) — o dedupe devolve o sucesso memorizado.
    const tRetry = Date.now();
    await pageA.getByTestId('retry-recovery-button').click();
    log('scenarioC.retry-clicked');
    // Melhor esforço: registrar o banner de retomada (existe no modo sala, ao
    // contrário do testid de tela cheia). A confirmação por replay costuma
    // chegar em dezenas de ms, então a captura pode não pegá-lo; a ausência não
    // invalida a prova (tempos e flags ficam no JSON).
    let retryBannerSeen = false;
    let retryBannerAt = null;
    for (let poll = 0; poll < 40; poll++) {
      const visible = await pageA
        .getByTestId('recovering-banner')
        .isVisible()
        .catch(() => false);
      if (visible) {
        retryBannerSeen = true;
        retryBannerAt = Date.now();
        await pageA
          .getByTestId('recovering-banner')
          .screenshot({ path: `${outDir}/ana-cross-cycle-retry.png`, timeout: 2_000 })
          .catch(() => {});
        break;
      }
      await sleep(60);
    }
    c.retryBannerSeen = retryBannerSeen;
    c.retryBannerMsAfterRetry = retryBannerAt === null ? null : retryBannerAt - tRetry;

    let recoveredAt = null;
    let recoveredSnap = null;
    const recoverDeadline = Date.now() + 30_000;
    while (recoveredAt === null && Date.now() < recoverDeadline) {
      const snap = await snapshot(pageA);
      errorEverSeen = errorEverSeen ?? snap.error;
      if (snap.hand && !snap.recovering && !snap.recoveringBanner && !snap.exhausted && !snap.connectionLost) {
        recoveredAt = Date.now();
        recoveredSnap = snap;
      }
      if (recoveredAt === null) await sleep(100);
    }
    if (recoveredAt === null) throw new Error('cenário C: retomada não concluiu após "Tentar novamente"');
    log('scenarioC.recovered', { msAfterRetry: recoveredAt - tRetry, msAfterReload: recoveredAt - tReload });
    c.msToRecoveryAfterRetry = recoveredAt - tRetry;
    c.msToRecoveryAfterReload = recoveredAt - tReload;

    // Ações reabilitadas: um rascunho habilita o envio (nada é enviado).
    c.actionsAfterRecovery = await actionsProbe(pageA);
    await pageA.getByTestId('chat-input').fill('teste de retomada');
    await sleep(150);
    c.sendEnabledWithDraft = await pageA.getByTestId('chat-send').isEnabled();
    await pageA.getByTestId('chat-input').fill('');

    const anaHandAfter = await handIds(pageA);
    c.anaHandCountAfter = anaHandAfter.length;
    c.anaHandDigestAfter = digestOf(anaHandAfter);
    c.handKept = c.anaHandDigestAfter === c.anaHandDigestBefore;
    c.credentialAfter = await credentialFingerprint(pageA);
    c.credentialKept =
      c.credentialBefore.present &&
      c.credentialAfter.present &&
      c.credentialBefore.checksum === c.credentialAfter.checksum &&
      c.credentialBefore.length === c.credentialAfter.length;
    c.anaRosterAfter = await rosterCounts(pageA);
    c.biaRosterAfter = await rosterCounts(pageB);
    c.noDuplicateParticipant =
      c.anaRosterAfter.opponents === 1 &&
      c.anaRosterAfter.waiting === 0 &&
      c.biaRosterAfter.opponents === 1 &&
      c.biaRosterAfter.waiting === 0;

    const info = proxy.crossCycleInfo();
    c.distinctJoinIntents = info.joinIntents.length;
    c.joinIntentFingerprints = info.joinIntents;
    c.droppedAcks = info.droppedAcks;
    c.ackPassedAfterWindow = info.ackPassedAfterWindow;
    c.final = {
      hand: recoveredSnap?.hand ?? false,
      recovering: recoveredSnap?.recovering ?? null,
      exhausted: recoveredSnap?.exhausted ?? null,
      error: recoveredSnap?.error ?? null,
      joinForm: recoveredSnap?.joinForm ?? null,
    };

    c.acceptance = {
      exhaustedAtDeadline: c.exhaustedMsAfterReload >= 55_000 && c.exhaustedMsAfterReload <= 70_000,
      recoveredAfterRetry: c.msToRecoveryAfterRetry !== null && c.msToRecoveryAfterRetry <= 15_000,
      singleJoinIntentAcrossCycles: c.distinctJoinIntents === 1,
      acksDroppedDuringWindow: c.droppedAcks >= 3,
      ackPassedAfterWindow: c.ackPassedAfterWindow === true,
      sameHand: c.handKept === true,
      credentialPreserved: c.credentialKept === true,
      noDuplicateParticipant: c.noDuplicateParticipant === true,
      actionsBlockedAtExhausted:
        c.actionsAtExhausted.placeholder !== null && c.actionsAtExhausted.placeholder !== LINKED_PLACEHOLDER,
      actionsWorkAfterRecovery:
        c.sendEnabledWithDraft === true && c.actionsAfterRecovery.placeholder === LINKED_PLACEHOLDER,
      noExtraReload: c.anaReloads === 1,
      noError: errorEverSeen === null,
    };
  }

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
