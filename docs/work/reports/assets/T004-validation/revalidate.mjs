// Revalidação independente: placar público novo e agendamento após entrada no lobby.
// Executar da raiz após build. Servidor efêmero; nenhuma alteração de produção.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const root = new URL('../../../../../', import.meta.url);
const { createTrettaServer } = await import(new URL('apps/server/dist/server.js', root));
const { createClassicDeck, createSeededRandom, projectForPlayer } = await import(new URL('packages/rules/dist/index.js', root));
const { io } = createRequire(new URL('apps/server/package.json', root))('socket.io-client');
let nextIntent = 0;
const req = (socket, event, payload = {}) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timeout: ${event}`)), 4000);
  socket.emit(event, { intentId: `revalidation_${++nextIntent}`, ...payload }, ack => {
    clearTimeout(timeout); assert.equal(ack.ok, true, ack.error?.message); resolve(ack);
  });
});
class Clock {
  time = 1700000000000;
  next = 0;
  timers = new Map();
  now() { return this.time; }
  setTimer(delay, callback) { const id = ++this.next; this.timers.set(id, { at: this.time + delay, callback }); return id; }
  clearTimer(id) { this.timers.delete(id); }
  advance(ms) {
    const end = this.time + ms;
    for (;;) {
      const due = [...this.timers].filter(([, t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.time = due[1].at; this.timers.delete(due[0]); due[1].callback();
    }
    this.time = end;
  }
}
function deck() {
  const cards = [];
  for (let i = 1; i <= 7; i++) cards.push(`red-${i}-1`, `blue-${i}-1`);
  cards.push('red-9-1', ...Array.from({ length: 9 }, (_, i) => `green-${i + 1}-1`));
  const used = new Set(cards);
  return [...cards, ...createClassicDeck().map(c => c.id).filter(id => !used.has(id))];
}
async function scenario(name, body) {
  const clock = new Clock();
  const server = createTrettaServer({ clock, testHooks: true, randomFactory: () => createSeededRandom(7) });
  const port = await server.listen(0);
  const sockets = [];
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, { forceNew: true, transports: ['websocket'], reconnection: false });
    sockets.push(socket); await new Promise(resolve => socket.once('connect', resolve)); return socket;
  };
  try {
    const a = await connect(); const ca = await req(a, 'client:createRoom', { nickname: 'Ana', avatar: 'raposa' });
    const b = await connect(); await req(b, 'client:joinRoom', { roomCode: ca.roomCode, nickname: 'Bia', avatar: 'lobo' });
    await req(a, 'test:setNextDeck', { roomCode: ca.roomCode, deck: deck() });
    await req(a, 'client:setReady', { ready: true }); await req(b, 'client:setReady', { ready: true });
    await req(a, 'client:startRound');
    const room = server.rooms.debugRoom(ca.roomCode);
    console.log(JSON.stringify({ scenario: name, ...await body({ a, b, ca, room, server, clock, connect }) }));
  } finally { for (const socket of sockets) socket.disconnect(); await server.close(); }
}
await scenario('placar histórico público após vitória e saída', async ({ a, b, ca, room }) => {
  for (let guard = 0; guard < 40 && room.status === 'playing'; guard++) {
    const current = room.round.state.seats[room.round.state.currentIndex].id;
    const base = { roundId: room.round.id };
    if (current === ca.playerId) {
      const view = projectForPlayer(room.round.state, current);
      await req(a, 'client:command', { ...base, command: { type: 'play', cardId: view.playableCardIds[0], ...(view.hand.length === 2 ? { announceLastCard: true } : {}) } });
    } else {
      await req(b, 'client:command', { ...base, command: { type: 'draw' } });
      await req(b, 'client:command', { ...base, command: { type: 'pass' } });
    }
  }
  assert.equal(room.status, 'finished'); assert.equal(room.history.get(ca.playerId).wins, 1);
  const expectedVersion = room.version + 1;
  const snapshot = new Promise(resolve => {
    const onState = message => {
      if (message.room.version < expectedVersion) return;
      b.off('server:state', onState); resolve(message);
    }; b.on('server:state', onState);
  });
  await req(a, 'client:leaveRoom');
  const message = await snapshot;
  const pastWinner = message.room.scoreboard.find(e => e.playerId === ca.playerId);
  assert.equal(pastWinner.wins, 1); assert.equal(pastWinner.current, false);
  return { humanWinsBefore: 1, publicWinsAfter: message.room.scoreboard.reduce((sum,e) => sum + e.wins, 0), historicalWinner: !!pastWinner, winnerOccupiesSeat: message.room.participants.some(p => p.id === ca.playerId) };
});
for (const newcomer of [false, true]) {
  await scenario(newcomer ? 'bot após nova entrada para aguardar' : 'controle: bot sem nova entrada', async ({ a, b, ca, room, clock, connect }) => {
    await req(a, 'client:leaveRoom');
    if (room.round.state.seats[room.round.state.currentIndex].id !== ca.playerId) {
      await req(b, 'client:command', { roundId: room.round.id, command: { type: 'draw' } });
      await req(b, 'client:command', { roundId: room.round.id, command: { type: 'pass' } });
    }
    assert.equal(room.round.state.seats[room.round.state.currentIndex].id, ca.playerId);
    const initialTimer = room.botTimer; assert.notEqual(initialTimer, null);
    const scheduleVersion = room.botTimerVersion;
    let newcomerInRound = null;
    if (newcomer) {
      const c = await connect();
      const joined = await req(c, 'client:joinRoom', { roomCode: ca.roomCode, nickname: 'Cai', avatar: 'lobo' });
      newcomerInRound = room.round.seatIds.includes(joined.playerId);
    }
    const version = room.version;
    const hand = () => room.round.state.seats.find(s => s.id === ca.playerId).hand.length;
    const before = hand();
    clock.advance(700);
    const afterDelay = { version: room.version, hand: hand(), timersPending: clock.timers.size };
    clock.advance(7000);
    const result = {
      newcomerInRound, scheduleVersionBeforeJoin: scheduleVersion, roomVersionBeforeDelay: version,
      versionAfterDelay: afterDelay.version, handBefore: before, handAfterDelay: afterDelay.hand,
      handAfterAdditional7s: hand(), timersPendingAfterDelay: afterDelay.timersPending,
      roomPlaying: room.status === 'playing', currentSeatStillBot: room.round.state.seats[room.round.state.currentIndex].id === ca.playerId,
      staleTimerReferenceRemains: room.botTimer !== null && !clock.timers.has(room.botTimer),
    };
    if (!newcomer) { assert.equal(afterDelay.hand, before - 1); assert.equal(afterDelay.version, version + 1); }
    return result;
  });
}
