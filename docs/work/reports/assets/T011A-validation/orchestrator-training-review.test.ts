import { afterEach, expect, it } from 'vitest';
import { DEFAULT_BOT_DELAY_MS, DEFAULT_RETENTION_MS } from '../src/rooms.js';
import {
  connect, continueRound, FakeClock, joinRoom, latestState, record,
  returnToLobby, sendCommand, setNextDeck, startTestServer, waitFor,
  type TestClient, type TestServer,
} from './helpers.js';
import {
  actCurrentPlayer, advanceBotTurn, botWinsDeck, createTrainingRoom,
  playRoundToEnd, startTrainingRound, trainingDeck,
} from './training.js';

let server: TestServer | undefined;
const clients: TestClient[] = [];
afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect();
  await server?.close();
  server = undefined;
});

it('recupera a fase pós-compra com placar não zero e ignora retenção cancelada', async () => {
  const clock = new FakeClock();
  server = await startTestServer({ testHooks: true, clock });
  const host = await connect(server.url);
  clients.push(host);
  const rec = record(host);
  const created = await createTrainingRoom(host);
  if (!created.ok) throw new Error('criação falhou');
  const room = () => server!.server.rooms.debugRoom(created.roomCode)!;
  await setNextDeck(host, created.roomCode, botWinsDeck());
  await startTrainingRound(host, rec);
  await playRoundToEnd(clock, host, rec, { alwaysDraw: true });
  expect(latestState(rec).room.scoreboard.reduce((sum, p) => sum + p.wins, 0)).toBe(1);
  const bots = latestState(rec).room.participants.filter(p => p.kind === 'bot').map(p => p.id);
  expect((await returnToLobby(host)).ok).toBe(true);
  await waitFor(() => latestState(rec).room.status === 'lobby', 'preparação');
  await setNextDeck(host, created.roomCode, trainingDeck());
  const roundId = await startTrainingRound(host, rec);
  for (let step = 0; latestState(rec).self.view?.currentPlayerId !== created.playerId; step++) {
    if (step > 30) throw new Error('sem vez humana');
    await advanceBotTurn(clock, rec);
  }
  expect((await sendCommand(host, roundId, { type: 'draw' })).ok).toBe(true);
  await waitFor(() => latestState(rec).self.view?.phase === 'after-draw', 'pós-compra');
  const before = latestState(rec);
  expect(before.self.view?.drawnCardId).not.toBeNull();
  host.disconnect();
  await waitFor(() => room().retentionHold, 'ausência');
  const retention = room().retentionTimer;
  expect(retention).not.toBeNull();
  const frozen = room().version;
  clock.advance(DEFAULT_BOT_DELAY_MS * 10);
  expect(room().version).toBe(frozen);
  const back = await connect(server.url);
  clients.push(back);
  const restored = record(back);
  expect((await joinRoom(back, created.roomCode, 'Ana', 'raposa', created.credential)).ok).toBe(true);
  await waitFor(() => restored.states.length > 0, 'retorno');
  const state = latestState(restored);
  expect(state.self.playerId).toBe(before.self.playerId);
  expect(state.self.view?.hand).toEqual(before.self.view?.hand);
  expect(state.self.view?.phase).toBe('after-draw');
  expect(state.self.view?.drawnCardId).toBe(before.self.view?.drawnCardId);
  expect(state.room.scoreboard).toEqual(before.room.scoreboard);
  expect(state.room.participants.filter(p => p.kind === 'bot').map(p => p.id)).toEqual(bots);
  expect(state.room.status).toBe('paused');
  expect(clock.deliver(retention!)).toBe(true);
  clock.advance(DEFAULT_RETENTION_MS);
  expect(server.server.rooms.debugRoom(created.roomCode)).toBeDefined();
  expect(room().status).toBe('paused');
  expect((await continueRound(back)).ok).toBe(true);
  expect((await sendCommand(back, roundId, { type: 'pass' })).ok).toBe(true);
});

it('duas vitórias de bots acumulam e callback vencedor repetido não altera o placar', async () => {
  const clock = new FakeClock();
  server = await startTestServer({ testHooks: true, clock });
  const host = await connect(server.url);
  clients.push(host);
  const rec = record(host);
  const created = await createTrainingRoom(host);
  if (!created.ok) throw new Error('criação falhou');
  const room = () => server!.server.rooms.debugRoom(created.roomCode)!;
  const initialBots = room().order.slice(1);
  for (let number = 1; number <= 2; number++) {
    await setNextDeck(host, created.roomCode, botWinsDeck());
    const roundId = await startTrainingRound(host, rec);
    let lastTimer = room().botTimer;
    for (let step = 0; latestState(rec).room.status !== 'finished'; step++) {
      if (step > 400) throw new Error('sem vencedor');
      lastTimer = room().botTimer ?? lastTimer;
      await actCurrentPlayer(clock, host, rec, { alwaysDraw: true });
    }
    expect(latestState(rec).room.lastRound?.winnerKind).toBe('bot');
    const scoreboard = latestState(rec).room.scoreboard;
    expect(scoreboard.reduce((sum, p) => sum + p.wins, 0)).toBe(number);
    const version = room().version;
    expect(lastTimer).not.toBeNull();
    expect(clock.deliver(lastTimer!)).toBe(true);
    clock.advance(DEFAULT_BOT_DELAY_MS * 10);
    expect(room().version).toBe(version);
    const invalid = await sendCommand(host, roundId, { type: 'draw' });
    expect(invalid.ok).toBe(false);
    expect(latestState(rec).room.scoreboard).toEqual(scoreboard);
    expect(room().order.slice(1)).toEqual(initialBots);
    if (number === 1) {
      expect((await returnToLobby(host)).ok).toBe(true);
      await waitFor(() => latestState(rec).room.status === 'lobby', 'preparação');
    }
  }
});
