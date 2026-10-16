// Evidência independente do orquestrador. Executar da raiz após pnpm build.
// Imprime observações, sem credenciais. Não modifica código de produção.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = new URL('../../../../../', import.meta.url);
const { createTrettaServer } = await import(new URL('apps/server/dist/server.js', root));
const { createClassicDeck, createSeededRandom, projectForPlayer } = await import(new URL('packages/rules/dist/index.js', root));
const { io } = createRequire(new URL('apps/server/package.json', root))('socket.io-client');
let nextIntent = 0;
const intent = () => `validation_${++nextIntent}`;
const req = (socket, event, payload = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timeout: ${event}`)), 4000);
  socket.emit(event, { intentId: intent(), ...payload }, ack => { clearTimeout(timer); resolve(ack); });
});
const ok = ack => { assert.equal(ack.ok, true, ack.error?.message); return ack; };
class Clock {
  time = 1700000000000;
  next = 0;
  timers = new Map();
  archived = new Map();
  now() { return this.time; }
  setTimer(delay, callback) {
    const id = ++this.next;
    const timer = { at: this.time + delay, callback };
    this.timers.set(id, timer); this.archived.set(id, timer); return id;
  }
  clearTimer(id) { this.timers.delete(id); }
  advance(ms) {
    const end = this.time + ms;
    for (;;) {
      const next = [...this.timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at; this.timers.delete(next[0]); next[1].callback();
    }
    this.time = end;
  }
}
function deck() {
  const hands = [
    ['red-1-1','red-2-1','red-3-1','red-4-1','red-5-1','red-6-1','red-7-1'],
    ['blue-1-1','blue-2-1','blue-3-1','blue-4-1','blue-5-1','blue-6-1','blue-7-1'],
  ];
  const first = [];
  for (let i = 0; i < 7; i++) for (const hand of hands) first.push(hand[i]);
  first.push('red-9-1', ...Array.from({ length: 9 }, (_, i) => `green-${i + 1}-1`));
  const used = new Set(first);
  return [...first, ...createClassicDeck().map(c => c.id).filter(id => !used.has(id))];
}
async function scenario(name, body) {
  const clock = new Clock();
  const server = createTrettaServer({ clock, testHooks: true, randomFactory: () => createSeededRandom(7) });
  const port = await server.listen(0);
  const sockets = [];
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, { forceNew: true, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await new Promise(resolve => socket.once('connect', resolve));
    return socket;
  };
  try { console.log(JSON.stringify({ scenario: name, ...await body({ server, clock, connect }) })); }
  finally { for (const socket of sockets) socket.disconnect(); await server.close(); }
}
const create = (socket, payload = {}) => req(socket, 'client:createRoom', { nickname: 'Ana', avatar: 'raposa', ...payload }).then(ok);
const join = (socket, roomCode, payload = {}) => req(socket, 'client:joinRoom', { roomCode, nickname: 'Bia', avatar: 'lobo', ...payload }).then(ok);
async function playing(context) {
  const a = await context.connect(); const ca = await create(a);
  const b = await context.connect(); const cb = await join(b, ca.roomCode);
  ok(await req(a, 'test:setNextDeck', { roomCode: ca.roomCode, deck: deck() }));
  ok(await req(a, 'client:setReady', { ready: true })); ok(await req(b, 'client:setReady', { ready: true }));
  ok(await req(a, 'client:startRound'));
  const room = context.server.rooms.debugRoom(ca.roomCode);
  return { a, b, ca, cb, room };
}
await scenario('placar após vitória humana e saída', async context => {
  const { a, b, ca, cb, room } = await playing(context);
  for (let guard = 0; guard < 40 && room.status === 'playing'; guard++) {
    const id = room.round.state.seats[room.round.state.currentIndex].id;
    const payload = { roundId: room.round.id };
    if (id === ca.playerId) {
      const view = projectForPlayer(room.round.state, id);
      ok(await req(a, 'client:command', { ...payload, command: { type: 'play', cardId: view.playableCardIds[0], ...(view.hand.length === 2 ? { announceLastCard: true } : {}) } }));
    } else {
      assert.equal(id, cb.playerId);
      ok(await req(b, 'client:command', { ...payload, command: { type: 'draw' } }));
      ok(await req(b, 'client:command', { ...payload, command: { type: 'pass' } }));
    }
  }
  assert.equal(room.status, 'finished'); assert.equal(room.lastRound.substitute, false);
  const before = [...room.participants.values()].reduce((sum, p) => sum + p.score, 0);
  const expectedVersion = room.version + 1;
  const nextSnapshot = new Promise(resolve => {
    const onState = message => {
      if (message.room.version < expectedVersion) return;
      b.off('server:state', onState); resolve(message);
    };
    b.on('server:state', onState);
  });
  ok(await req(a, 'client:leaveRoom'));
  const last = await nextSnapshot;
  const after = last.room.participants.reduce((sum, p) => sum + p.score, 0);
  return { winsBefore: before, winsAfter: after, roomStillExists: !!context.server.rooms.debugRoom(ca.roomCode), winnerStillListed: last.room.participants.some(p => p.id === ca.playerId) };
});
await scenario('replay de criação e de saída após outra sala', async ({ server, connect }) => {
  const a = await connect(); const creationId = intent(); const ca = await create(a, { intentId: creationId });
  const b = await connect(); await join(b, ca.roomCode);
  const leaveId = intent(); const first = ok(await req(a, 'client:leaveRoom', { intentId: leaveId }));
  const replay = await req(a, 'client:leaveRoom', { intentId: leaveId });
  const secondRoom = await create(a);
  const old = await create(a, { intentId: creationId });
  return { leaveFirstOK: first.ok, leaveReplayOK: replay.ok, leaveReplayError: replay.error?.code, originalCreationAck: JSON.stringify(old) === JSON.stringify(ca), boundToNewRoom: server.rooms.participantOf(a.id)?.roomCode === secondRoom.roomCode, subscribedToOldRoom: server.io.sockets.sockets.get(a.id).rooms.has(ca.roomCode) };
});
await scenario('replay de entrada após remoção', async ({ server, connect }) => {
  const a = await connect(); const ca = await create(a);
  const b = await connect(); const joinId = intent(); const cb = await join(b, ca.roomCode, { intentId: joinId });
  ok(await req(a, 'client:removeParticipant', { targetId: cb.playerId }));
  const before = server.io.sockets.sockets.get(b.id).rooms.has(ca.roomCode);
  const newRoom = await create(b);
  const replay = await join(b, ca.roomCode, { intentId: joinId });
  const c = await connect(); await join(c, ca.roomCode, { nickname: 'Cai' });
  ok(await req(a, 'client:setReady', { ready: true })); ok(await req(c, 'client:setReady', { ready: true }));
  let oldEvents = 0;
  b.on('server:events', message => { if (message.roomCode === ca.roomCode) oldEvents += message.events.length; });
  ok(await req(a, 'client:startRound'));
  const oldRoom = server.rooms.debugRoom(ca.roomCode);
  const acting = oldRoom.round.state.seats[oldRoom.round.state.currentIndex].id === ca.playerId ? a : c;
  ok(await req(acting, 'client:command', { roundId: oldRoom.round.id, command: { type: 'draw' } }));
  await new Promise(resolve => setTimeout(resolve, 30));
  return { subscribedImmediatelyAfterRemoval: before, originalJoinAck: JSON.stringify(replay) === JSON.stringify(cb), authorizedOnlyInNewRoom: server.rooms.participantOf(b.id)?.roomCode === newRoom.roomCode, subscribedToRevokedRoom: server.io.sockets.sockets.get(b.id).rooms.has(ca.roomCode), eventsReceivedFromRevokedRoom: oldEvents };
});
await scenario('expiração com socket vivo', async ({ server, clock, connect }) => {
  const a = await connect(); const creationId = intent(); const ca = await create(a, { intentId: creationId });
  ok(await req(a, 'client:leaveRoom'));
  clock.advance(900000);
  const cached = server.rooms.socketIntents.get(a.id);
  const observations = { roomExpired: !server.rooms.debugRoom(ca.roomCode), socketAlive: a.connected, cachedIntents: cached?.size ?? 0, cachedRoomReferences: [...(cached?.values() ?? [])].filter(e => e.response.room !== undefined).length, timersRemaining: clock.timers.size };
  await create(a, { intentId: creationId });
  return { ...observations, subscribedToExpiredCodeAfterReplay: server.io.sockets.sockets.get(a.id).rooms.has(ca.roomCode) };
});
await scenario('callback de bot cancelado após retorno e nova saída', async context => {
  const { a, b, ca, cb, room } = await playing(context);
  // A (vermelhas) sai; caso B esteja na vez, compra e passa para A.
  ok(await req(a, 'client:leaveRoom'));
  if (room.round.state.seats[room.round.state.currentIndex].id !== ca.playerId) {
    ok(await req(b, 'client:command', { roundId: room.round.id, command: { type: 'draw' } }));
    ok(await req(b, 'client:command', { roundId: room.round.id, command: { type: 'pass' } }));
  }
  assert.equal(room.round.state.seats[room.round.state.currentIndex].id, ca.playerId);
  const oldHandle = room.botTimer; assert.notEqual(oldHandle, null);
  const staleCallback = context.clock.archived.get(oldHandle).callback;
  await join(a, ca.roomCode, { nickname: 'Ana', avatar: 'raposa', credential: ca.credential });
  assert.equal(context.clock.timers.has(oldHandle), false);
  ok(await req(a, 'client:leaveRoom'));
  const newHandle = room.botTimer; assert.notEqual(newHandle, oldHandle);
  const version = room.version; const hand = room.round.state.seats.find(s => s.id === ca.playerId).hand.length;
  // Simula callback já entregue à fila antes do cancelamento. Relógio não avançou.
  staleCallback();
  return { canceledHandleDifferentFromCurrent: oldHandle !== newHandle, versionBefore: version, versionAfter: room.version, handBefore: hand, handAfter: room.round.state.seats.find(s => s.id === ca.playerId).hand.length, validCurrentTimerStillScheduled: context.clock.timers.has(newHandle), otherHumanStillConnected: !!context.server.rooms.participantOf(b.id), staleCallbackRanBeforeDelay: context.clock.time === 1700000000000 };
});
