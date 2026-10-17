import { afterEach, describe, expect, it } from 'vitest';
import {
  connect,
  endRoundWithoutWinner,
  FakeClock,
  latestState,
  record,
  returnToLobby,
  setNextDeck,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import {
  advanceBotTurn,
  botWinsDeck,
  createTrainingRoom,
  playRoundToEnd,
  poolOf,
  startTrainingRound,
  trainingDeck,
} from './training.js';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';

describe('mesa de treino: rodada jogável e resultado', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ clock: FakeClock; server: TestServer; clients: TestClient[] }> {
    const clock = new FakeClock();
    const server = await startTestServer({ testHooks: true, clock });
    const clients: TestClient[] = [];
    active = { clock, server, clients };
    return active;
  }

  async function newClient(server: TestServer): Promise<TestClient> {
    const socket = await connect(server.url);
    active?.clients.push(socket);
    return socket;
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  it('vitória da pessoa: bots jogam sozinhos, compram e usam a fase pós-compra com 108 cartas conservadas', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const deckOk = await setNextDeck(host, created.roomCode, trainingDeck());
    expect(deckOk.ok, deckOk.ok ? '' : deckOk.error.message).toBe(true);
    await startTrainingRound(host, hostRec);
    const room = () => server.server.rooms.debugRoom(created.roomCode);

    // A vez humana não avança sem comando aceito, mesmo com o relógio correndo.
    let guard = 0;
    while (latestState(hostRec).self.view?.currentPlayerId !== created.playerId) {
      if (guard++ > 20) throw new Error('a vez humana não chegou');
      await advanceBotTurn(clock, hostRec);
    }
    const frozen = latestState(hostRec).room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(latestState(hostRec).room.version).toBe(frozen);
    expect(room()?.botTimer).toBeNull();

    await playRoundToEnd(clock, host, hostRec);

    const finished = latestState(hostRec);
    expect(finished.room.status).toBe('finished');
    expect(finished.room.lastRound).toEqual({
      roundNumber: 1,
      winnerId: created.playerId,
      winnerNickname: 'Ana',
      substitute: false,
      winnerKind: 'human',
    });
    expect(finished.room.participants.find((entry) => entry.id === created.playerId)?.score).toBe(1);
    for (const bot of finished.room.participants.filter((entry) => entry.kind === 'bot')) {
      expect(bot.score).toBe(0);
    }

    // Bots agiram sozinhos: descartaram, compraram e passaram; descartes de
    // cartas compradas provam a decisão da fase pós-compra.
    const botIds = new Set(
      finished.room.participants.filter((entry) => entry.kind === 'bot').map((entry) => entry.id),
    );
    const botEvents = hostRec.events
      .flatMap((message) => message.events)
      .filter((event) => 'playerId' in event && botIds.has(event.playerId));
    expect(botEvents.some((event) => event.type === 'played')).toBe(true);
    expect(botEvents.some((event) => event.type === 'drew' && event.reason === 'voluntary')).toBe(true);
    expect(botEvents.some((event) => event.type === 'passed')).toBe(true);
    const playedIds = new Set(
      botEvents.filter((event) => event.type === 'played').map((event) => event.card.id),
    );
    const pilePlays = ['red-8-1', 'red-8-2', 'red-9-2', 'red-1-2', 'red-2-2'].filter((id) => playedIds.has(id));
    expect(pilePlays.length).toBeGreaterThan(0);

    // Bots nunca denunciam nem anunciam carta fora de hora.
    expect(botEvents.some((event) => event.type === 'challengeAccepted')).toBe(false);

    const pool = poolOf(room());
    expect(pool).toEqual({ total: 108, unique: 108 });

    const victory = hostRec.events
      .flatMap((message) => message.effects)
      .find((effect) => effect.category === 'victory');
    expect(victory).toMatchObject({ winnerId: created.playerId, winnerNickname: 'Ana', substitute: false });

    // Segunda rodada reusa as mesmas quatro identidades e preserva o placar.
    const seatIds = finished.room.participants.map((entry) => entry.id).sort();
    const backToLobby = await returnToLobby(host);
    expect(backToLobby.ok, backToLobby.ok ? '' : backToLobby.error.message).toBe(true);
    await waitFor(() => latestState(hostRec).room.status === 'lobby', 'preparação');
    const lobby = latestState(hostRec);
    expect(lobby.room.participants.map((entry) => entry.id).sort()).toEqual(seatIds);
    expect(lobby.room.participants.filter((entry) => entry.kind === 'bot').every((entry) => entry.ready)).toBe(true);
    expect(lobby.room.participants.find((entry) => entry.id === created.playerId)?.ready).toBe(false);

    const deck2 = await setNextDeck(host, created.roomCode, trainingDeck());
    expect(deck2.ok, deck2.ok ? '' : deck2.error.message).toBe(true);
    await startTrainingRound(host, hostRec);
    const round2 = latestState(hostRec);
    expect(round2.room.roundNumber).toBe(2);
    expect(round2.room.status).toBe('playing');
    expect(round2.room.participants.map((entry) => entry.id).sort()).toEqual(seatIds);
    expect(round2.room.scoreboard.find((entry) => entry.playerId === created.playerId)?.wins).toBe(1);

    const ended = await endRoundWithoutWinner(host);
    expect(ended.ok, ended.ok ? '' : ended.error.message).toBe(true);
    await waitFor(() => latestState(hostRec).room.status === 'finished', 'fim sem vencedor');
    const noWinner = latestState(hostRec);
    expect(noWinner.room.lastRound).toEqual({
      roundNumber: 2,
      winnerId: null,
      winnerNickname: null,
      substitute: false,
      winnerKind: null,
    });
    expect(noWinner.room.scoreboard.find((entry) => entry.playerId === created.playerId)?.wins).toBe(1);
  });

  it('vitória de bot: soma única no próprio placar, resumo e efeito atribuídos ao bot', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const deckOk = await setNextDeck(host, created.roomCode, botWinsDeck());
    expect(deckOk.ok, deckOk.ok ? '' : deckOk.error.message).toBe(true);
    await startTrainingRound(host, hostRec);

    await playRoundToEnd(clock, host, hostRec, { alwaysDraw: true });

    const finished = latestState(hostRec);
    expect(finished.room.status).toBe('finished');
    const lastRound = finished.room.lastRound;
    if (lastRound === null) throw new Error('sem resumo da rodada');
    expect(lastRound.roundNumber).toBe(1);
    expect(lastRound.substitute).toBe(false);
    expect(lastRound.winnerKind).toBe('bot');
    const bots = finished.room.participants.filter((entry) => entry.kind === 'bot');
    const winner = bots.find((bot) => bot.id === lastRound.winnerId);
    expect(winner).toBeDefined();
    expect(lastRound.winnerNickname).toBe(winner?.nickname);

    // Uma única soma: só o bot vencedor tem vitória e exatamente uma.
    const winners = finished.room.scoreboard.filter((entry) => entry.wins > 0);
    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({ playerId: lastRound.winnerId, kind: 'bot', wins: 1, current: true });
    expect(finished.room.participants.find((entry) => entry.id === created.playerId)?.score).toBe(0);
    for (const bot of bots) expect(bot.score).toBe(bot.id === lastRound.winnerId ? 1 : 0);
    expect(finished.room.lastRound?.winnerKind).not.toBe('human');

    const victory = hostRec.events
      .flatMap((message) => message.effects)
      .find((effect) => effect.category === 'victory');
    expect(victory).toMatchObject({
      winnerId: lastRound.winnerId,
      winnerNickname: lastRound.winnerNickname,
      substitute: false,
    });

    const pool = poolOf(server.server.rooms.debugRoom(created.roomCode));
    expect(pool).toEqual({ total: 108, unique: 108 });
  });
});
