/**
 * T009 — cenário G: perda de transporte sem reload ("voltar ao jogo").
 *
 * O cliente socket.io real reconecta automaticamente (como o app), e o
 * handler 'connect' do app dispara o rejoin com credencial. Mede a recusa
 * contra o reconhecimento tardio do socket antigo e observa se há QUALQUER
 * tentativa automática depois da recusa.
 */
import net from 'node:net';
import crypto from 'node:crypto';
import { io } from 'socket.io-client';

const repo = process.argv[2];
const { createTrettaServer } = await import(`${repo}/apps/server/dist/server.js`);

const startedAt = Date.now();
const timeline = [];
const log = (kind, detail = {}) => timeline.push({ ms: Date.now() - startedAt, kind, ...detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = createTrettaServer({ webOrigin: 'http://localhost:3099' });
const store = server.rooms;
const serverPort = await server.listen(0);

const origHandleDisconnect = store.handleDisconnect.bind(store);
store.handleDisconnect = (socketId) => {
  log('server.handleDisconnect', { socket: socketId.slice(0, 4) + '…' });
  return origHandleDisconnect(socketId);
};

function createProxy(targetPort) {
  const pairs = new Map();
  let nextId = 0;
  const tcp = net.createServer((client) => {
    const upstream = net.connect({ host: '127.0.0.1', port: targetPort });
    const id = ++nextId;
    pairs.set(id, { client, upstream });
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.pipe(upstream);
    upstream.pipe(client);
  });
  return new Promise((resolve) => {
    tcp.listen(0, '127.0.0.1', () => {
      resolve({
        port: tcp.address().port,
        last: () => nextId,
        blackhole(id) {
          const pair = pairs.get(id);
          pair.client.pause();
          pair.upstream.pause();
          log('proxy.blackhole', { id });
        },
      });
    });
  });
}

const connect = (url, opts = {}) =>
  new Promise((resolve) => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, ...opts });
    socket.once('connect', () => resolve(socket));
  });

const ack = (socket, event, payload) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: { code: 'NO_ACK_TIMEOUT' } }), 6000);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });

const newIntent = () => `intent_${crypto.randomUUID()}`;

const proxy = await createProxy(serverPort);
const host = await connect(`http://127.0.0.1:${serverPort}`);
const phone = await connect(`http://127.0.0.1:${proxy.port}`);

const created = await ack(host, 'client:createRoom', { intentId: newIntent(), nickname: 'Ana', avatar: 'raposa' });
const joined = await ack(phone, 'client:joinRoom', { intentId: newIntent(), roomCode: created.roomCode, nickname: 'Bia', avatar: 'tucano' });
const identity = { nickname: 'Bia', avatar: 'tucano', credential: joined.credential };
await ack(host, 'client:setReady', { intentId: newIntent(), ready: true });
await ack(phone, 'client:setReady', { intentId: newIntent(), ready: true });
await ack(host, 'client:startRound', { intentId: newIntent() });

// Instrumenta decisões do cliente como o app: rejoin no 'connect' após queda.
const rejoinAttempts = [];
phone.on('disconnect', (reason) => log('phone.disconnect', { reason }));
let rejoinFinished = null;
phone.on('connect', () => {
  log('phone.connect', { socket: phone.id.slice(0, 4) + '…' });
  void (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await ack(phone, 'client:joinRoom', {
        intentId: newIntent(),
        roomCode: created.roomCode,
        nickname: identity.nickname,
        avatar: identity.avatar,
        credential: identity.credential,
      });
      rejoinAttempts.push({ ms: Date.now() - t0, attempt: attempt + 1, code: response.ok ? 'OK' : response.error.code });
      if (response.ok) {
        rejoinFinished = { result: 'ok', ms: Date.now() - t0 };
        return;
      }
      if (response.error.code !== 'ALREADY_CONNECTED' || attempt === 3) {
        rejoinFinished = { result: response.error.code, ms: Date.now() - t0 };
        return;
      }
      await sleep(400);
    }
  })();
});

const t0 = Date.now();
proxy.blackhole(proxy.last());
await sleep(1200); // como uma suspensão breve antes de voltar ao jogo
phone.io.engine.close(); // o cliente detecta a queda e reconecta (como o app)

// Espera o resultado do rejoin automático e o reconhecimento do servidor.
const deadline = Date.now() + 70_000;
let recognizedMs = null;
while (Date.now() < deadline) {
  if (recognizedMs === null && store.debugRoom(created.roomCode)?.participants.get(joined.playerId)?.connected === false) {
    recognizedMs = Date.now() - t0;
  }
  if (rejoinFinished !== null && recognizedMs !== null) break;
  await sleep(100);
}
await sleep(2000); // observa se algo tenta de novo sozinho depois da recusa

const state = store.debugRoom(created.roomCode);
const output = {
  node: process.version,
  scenario: 'G — perda de transporte sem reload (reconexão automática)',
  result: {
    rejoinAttempts,
    rejoinFinished,
    serverRecognizedOldSocketMs: recognizedMs,
    autoRetryAfterRefusal: rejoinAttempts.filter((entry) => entry.ms > (rejoinFinished?.ms ?? 0) + 500).length,
    roomStatusAfter: state?.status ?? null,
    phoneStillBound: state?.participants.get(joined.playerId)?.socketId !== null,
    machineIsConnected: store.debugRoom(created.roomCode)?.participants.get(joined.playerId)?.connected ?? null,
  },
  timeline,
};
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
host.disconnect();
phone.disconnect();
await server.close();
process.exit(0);
