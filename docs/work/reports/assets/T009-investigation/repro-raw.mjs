/**
 * T009 — reprodução local do fluxo de reentrada (diagnóstico, não é código de produto).
 *
 * Roda um servidor Tretta real (dist) no processo, com os defaults de
 * pingInterval/pingTimeout do Engine.IO (25s/20s), e clientes socket.io brutos
 * que replicam a disciplina de reentrada do cliente web
 * (apps/web/app/providers.tsx rejoinInternal: 4 tentativas, 400 ms entre elas,
 * novo intentId por tentativa).
 *
 * Cenários:
 *   A. Fechamento gracioso do socket antigo (close frame/FIN): controle do E2E.
 *   B. Queda abrupta sem FIN (proxy TCP que "engole" os bytes): janela real de
 *      reconhecimento tardio do servidor.
 *   C. Duas abas vivas com a mesma credencial: proteção do produto.
 *   D. Reentrada concorrente: corrida entre dois clientes novos.
 *   E. Credencial inválida e sala inexistente: falhas definitivas.
 *   F. Queda do formulário: "Entrar" sem credencial cria identidade nova.
 *
 * Uso: node repro-raw.mjs <caminho-do-repo>
 * Saída: JSON sanitizado em stdout (aliases, códigos e tempos relativos; sem mãos).
 */
import net from 'node:net';
import crypto from 'node:crypto';
import { io } from 'socket.io-client';

const repo = process.argv[2];
if (!repo) throw new Error('informe o caminho do repositório');
const { createTrettaServer } = await import(`${repo}/apps/server/dist/server.js`);

const startedAt = Date.now();
const timeline = [];
const log = (kind, detail = {}) => timeline.push({ ms: Date.now() - startedAt, kind, ...detail });

const aliases = new Map();
let aliasSeq = 0;
const alias = (socketId) => {
  if (!aliases.has(socketId)) aliases.set(socketId, `s${++aliasSeq}`);
  return aliases.get(socketId);
};

const server = createTrettaServer({ webOrigin: 'http://localhost:3099' });
const store = server.rooms;
const serverPort = await server.listen(0);

// Instrumentação somente leitura: registra decisões do servidor com tempo.
const origHandleDisconnect = store.handleDisconnect.bind(store);
store.handleDisconnect = (socketId) => {
  log('server.handleDisconnect', { socket: alias(socketId) });
  return origHandleDisconnect(socketId);
};
const origJoinRoom = store.joinRoom.bind(store);
store.joinRoom = (params) => {
  const result = origJoinRoom(params);
  log('server.joinRoom', {
    socket: alias(params.socketId),
    room: params.roomCode,
    credential: params.credential !== undefined,
    ok: result.ok,
    code: result.ok ? null : result.error.code,
    rejoined: result.ok ? result.rejoined : null,
    player: result.ok ? result.participant.id : null,
  });
  return result;
};

// ---------- proxy TCP com "blackhole" (sem FIN/RST) ----------
function createProxy(targetPort) {
  const pairs = new Map();
  let nextId = 0;
  const serverTcp = net.createServer((client) => {
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
  });
  return new Promise((resolve) => {
    serverTcp.listen(0, '127.0.0.1', () => {
      resolve({
        port: serverTcp.address().port,
        connections: () => [...pairs.keys()],
        blackhole(id) {
          const pair = pairs.get(id);
          if (!pair) throw new Error(`conexão ${id} ausente`);
          pair.client.pause();
          pair.upstream.pause();
        },
        close: () => serverTcp.close(),
      });
    });
  });
}

// ---------- clientes ----------
async function connect(url) {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return socket;
}

function ack(socket, event, payload, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: { code: 'NO_ACK_TIMEOUT', message: 'sem ack' } }), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

const newIntent = () => `intent_${crypto.randomUUID()}`;

const joinPayload = (roomCode, identity) => ({
  intentId: newIntent(),
  roomCode,
  nickname: identity.nickname,
  avatar: identity.avatar,
  credential: identity.credential,
});

/** Mesma disciplina do rejoinInternal do cliente web. */
async function applikeRejoin(socket, roomCode, identity, attempts = 4, gapMs = 400) {
  const tries = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const sentAt = Date.now();
    const response = await ack(socket, 'client:joinRoom', joinPayload(roomCode, identity));
    tries.push({
      attempt: attempt + 1,
      code: response.ok ? 'OK' : response.error.code,
      waitMs: Date.now() - sentAt,
    });
    if (response.ok) return { result: 'ok', response, tries };
    if (response.error.code === 'ALREADY_CONNECTED' && attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, gapMs));
      continue;
    }
    if (response.error.code === 'ALREADY_CONNECTED') return { result: 'already', response, tries };
    return { result: response.error.code, response, tries };
  }
  return { result: 'exhausted', tries };
}

async function waitUntil(check, timeoutMs, stepMs = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

const handLengthOf = (state) => state?.self?.view?.hand?.length ?? null;

async function setupRound(hostSocket, guestIdentity, guestSocket, label) {
  const created = await ack(hostSocket, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  if (!created.ok) throw new Error(`create falhou: ${created.error.code}`);
  const roomCode = created.roomCode;
  let guestPlayerId = null;
  if (guestSocket !== null && guestIdentity !== null) {
    const joined = await ack(guestSocket, 'client:joinRoom', {
      intentId: newIntent(),
      roomCode,
      nickname: guestIdentity.nickname,
      avatar: guestIdentity.avatar,
    });
    if (!joined.ok) throw new Error(`join falhou: ${joined.error.code}`);
    guestPlayerId = joined.playerId;
  }
  log('setup', { label, room: roomCode, hostPlayer: created.playerId, guestPlayer: guestPlayerId });
  await ack(hostSocket, 'client:setReady', { intentId: newIntent(), ready: true });
  if (guestSocket !== null) await ack(guestSocket, 'client:setReady', { intentId: newIntent(), ready: true });
  const started = await ack(hostSocket, 'client:startRound', { intentId: newIntent() });
  if (!started.ok) throw new Error(`startRound falhou: ${started.error.code}`);
  return { roomCode, hostPlayerId: created.playerId, guestPlayerId };
}

const results = {};

// ===== Cenário A — fechamento gracioso (controle do E2E) =====
{
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const phone = await connect(`http://127.0.0.1:${serverPort}`);
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const joined = await ack(phone, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };
  await ack(host, 'client:setReady', { intentId: newIntent(), ready: true });
  await ack(phone, 'client:setReady', { intentId: newIntent(), ready: true });
  await ack(host, 'client:startRound', { intentId: newIntent() });
  const roomCode = created.roomCode;
  log('A.setup', { room: roomCode });

  const t0 = Date.now();
  phone.disconnect(); // close frame + FIN, como um reload que fecha limpo
  const recognizedAt = await waitUntil(() => store.debugRoom(roomCode)?.participants.get(joined.playerId)?.connected === false, 3000, 20);
  results.A = { recognized: recognizedAt, recognizedMs: Date.now() - t0 };

  const next = await connect(`http://127.0.0.1:${serverPort}`);
  const rejoin = await applikeRejoin(next, roomCode, identity);
  results.A.rejoin = { result: rejoin.result, tries: rejoin.tries, totalMs: Date.now() - t0 };
  results.A.samePlayer = rejoin.response.ok ? rejoin.response.playerId === joined.playerId : false;
  log('A.done', results.A);
  host.disconnect();
  next.disconnect();
}

// ===== Cenário B — queda abrupta sem FIN (half-open) =====
{
  const proxy = await createProxy(serverPort);
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const phone = await connect(`http://127.0.0.1:${proxy.port}`);
  let latest = null;
  let t0 = null;
  const hostStates = [];
  host.on('server:state', (message) => {
    latest = message;
    if (t0 !== null) hostStates.push({ ms: Date.now() - t0, status: message.room.status, version: message.room.version });
  });
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const joined = await ack(phone, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };
  await ack(host, 'client:setReady', { intentId: newIntent(), ready: true });
  await ack(phone, 'client:setReady', { intentId: newIntent(), ready: true });
  await ack(host, 'client:startRound', { intentId: newIntent() });
  const roomCode = created.roomCode;
  const room = () => store.debugRoom(roomCode);

  await waitUntil(() => latest !== null && latest.room.roundId !== null, 2000, 20);
  const handBefore = handLengthOf(latest);
  const statusBefore = latest.room.status;
  log('B.setup', { room: roomCode, connections: proxy.connections(), handBefore, statusBefore });

  const phoneConn = proxy.connections().at(-1);
  t0 = Date.now();
  proxy.blackhole(phoneConn); // silêncio total, sem FIN/RST
  log('B.blackhole', { connection: phoneConn });

  // Nova "página" conecta direto e replica a disciplina do rejoinInternal.
  const reloadPage = await connect(`http://127.0.0.1:${serverPort}`);
  const burst = await applikeRejoin(reloadPage, roomCode, identity);
  const burstMs = Date.now() - t0;
  log('B.burst', { result: burst.result, tries: burst.tries, burstMs });

  // Continua tentando como um usuário que espera e tenta de novo; observa o
  // reconhecimento da desconexão antiga pelo servidor a cada ciclo.
  let firstSuccess = null;
  let recognizedMs = null;
  const polled = [];
  while (Date.now() - t0 < 70_000) {
    if (recognizedMs === null && room()?.participants.get(joined.playerId)?.connected === false) {
      recognizedMs = Date.now() - t0;
    }
    const response = await ack(reloadPage, 'client:joinRoom', joinPayload(roomCode, identity));
    const attempt = { ms: Date.now() - t0, code: response.ok ? 'OK' : response.error.code };
    polled.push(attempt);
    if (response.ok) {
      firstSuccess = { ...attempt, response };
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (recognizedMs === null && room()?.participants.get(joined.playerId)?.connected === false) {
    recognizedMs = Date.now() - t0;
  }
  const pausedFirst = hostStates.find((entry) => entry.status === 'paused') ?? null;
  const playingAgain = hostStates.find((entry) => entry.status === 'playing' && entry.ms > (pausedFirst?.ms ?? 0)) ?? null;

  results.B = {
    burst,
    burstMs,
    refusedAttemptsInBurst: burst.tries.filter((t) => t.code === 'ALREADY_CONNECTED').length,
    polledAttempts: polled.length,
    firstSuccessMs: firstSuccess?.ms ?? null,
    serverRecognizedMs: recognizedMs,
    roundPausedFirstObservedAtMs: pausedFirst?.ms ?? null,
    roundPlayingAgainAtMs: playingAgain?.ms ?? null,
    samePlayer: firstSuccess ? firstSuccess.response.playerId === joined.playerId : false,
    rejoinedFlag: firstSuccess ? firstSuccess.response.rejoined : null,
    handAfter: handLengthOf(latest),
    statusAfter: latest?.room.status ?? null,
  };
  log('B.done', results.B);

  host.disconnect();
  reloadPage.disconnect();
  phone.disconnect();
  await proxy.close();
}

// ===== Cenário C — duas abas vivas com a mesma credencial =====
{
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const tab1 = await connect(`http://127.0.0.1:${serverPort}`);
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const joined = await ack(tab1, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };

  let tab1States = 0;
  tab1.on('server:state', () => {
    tab1States += 1;
  });

  const tab2 = await connect(`http://127.0.0.1:${serverPort}`);
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    const response = await ack(tab2, 'client:joinRoom', joinPayload(created.roomCode, identity));
    attempts.push(response.ok ? 'OK' : response.error.code);
    await new Promise((r) => setTimeout(r, 400));
  }
  const statesBefore = tab1States;
  await ack(host, 'client:setReady', { intentId: newIntent(), ready: true }); // bump de versão
  await waitUntil(() => tab1States > statesBefore, 2000, 20);
  const owner = store.debugRoom(created.roomCode)?.participants.get(joined.playerId)?.socketId;
  results.C = {
    attempts,
    tab1StillReceivesState: tab1States > statesBefore,
    ownerIsTab1: owner === tab1.id,
  };

  tab1.disconnect();
  await waitUntil(() => store.debugRoom(created.roomCode)?.participants.get(joined.playerId)?.connected === false, 3000, 20);
  const afterClose = await ack(tab2, 'client:joinRoom', joinPayload(created.roomCode, identity));
  results.C.afterGracefulClose = { ok: afterClose.ok, code: afterClose.ok ? 'OK' : afterClose.error.code, rejoined: afterClose.ok ? afterClose.rejoined : null };
  log('C.done', results.C);
  host.disconnect();
  tab2.disconnect();
}

// ===== Cenário D — reentrada concorrente =====
{
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const phone = await connect(`http://127.0.0.1:${serverPort}`);
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const joined = await ack(phone, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };
  phone.disconnect();
  await waitUntil(() => store.debugRoom(created.roomCode)?.participants.get(joined.playerId)?.connected === false, 3000, 20);

  const n1 = await connect(`http://127.0.0.1:${serverPort}`);
  const n2 = await connect(`http://127.0.0.1:${serverPort}`);
  const [r1, r2] = await Promise.all([
    ack(n1, 'client:joinRoom', joinPayload(created.roomCode, identity)),
    ack(n2, 'client:joinRoom', joinPayload(created.roomCode, identity)),
  ]);
  const room = store.debugRoom(created.roomCode);
  results.D = {
    results: [r1.ok ? 'OK' : r1.error.code, r2.ok ? 'OK' : r2.error.code],
    participants: room?.participants.size ?? null,
    owner: room?.participants.get(joined.playerId)?.socketId ?? null,
    ownerIsWinner:
      (r1.ok ? n1.id : null) === (room?.participants.get(joined.playerId)?.socketId ?? null) ||
      (r2.ok ? n2.id : null) === (room?.participants.get(joined.playerId)?.socketId ?? null),
  };
  log('D.done', results.D);
  host.disconnect();
  n1.disconnect();
  n2.disconnect();
}

// ===== Cenário E — falhas definitivas =====
{
  const client = await connect(`http://127.0.0.1:${serverPort}`);
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const bad = await ack(client, 'client:joinRoom', {
    intentId: newIntent(),
    roomCode: created.roomCode,
    nickname: 'Bia',
    avatar: 'tucano',
    credential: 'credencial-invalida-com-tamanho',
  });
  const gone = await ack(client, 'client:joinRoom', {
    intentId: newIntent(),
    roomCode: 'ZZZZZZ',
    nickname: 'Bia',
    avatar: 'tucano',
    credential: 'credencial-invalida-com-tamanho',
  });
  results.E = { invalidCredential: bad.ok ? 'OK' : bad.error.code, missingRoom: gone.ok ? 'OK' : gone.error.code };
  log('E.done', results.E);
  client.disconnect();
  host.disconnect();
}

// ===== Cenário F — "Entrar" depois da recusa criaria identidade nova =====
{
  const proxy = await createProxy(serverPort);
  const host = await connect(`http://127.0.0.1:${serverPort}`);
  const phone = await connect(`http://127.0.0.1:${proxy.port}`);
  const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
  const joined = await ack(phone, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };
  proxy.blackhole(proxy.connections().at(-1));

  const fresh = await connect(`http://127.0.0.1:${serverPort}`);
  const refused = await applikeRejoin(fresh, created.roomCode, identity);
  // Equivale a clicar "Entrar" no formulário exibido depois da recusa (sem credencial).
  const asNew = await ack(fresh, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
  const room = store.debugRoom(created.roomCode);
  results.F = {
    refusal: refused.result,
    joinWithoutCredentialAccepted: asNew.ok,
    newPlayerDiffersFromOriginal: asNew.ok ? asNew.playerId !== joined.playerId : null,
    participants: room?.participants.size ?? null,
  };
  log('F.done', results.F);
  host.disconnect();
  fresh.disconnect();
  phone.disconnect();
  await proxy.close();
}

await server.close();

const output = {
  node: process.version,
  serverDefaultsKnown: { pingIntervalMs: 25_000, pingTimeoutMs: 20_000, engineIo: 'documentado; janela de reconhecimento entre 20s e 45s após a última troca' },
  results,
  timeline,
};
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.exit(0);
