import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import {
  connect,
  createRoom,
  intent,
  joinOrFail,
  latestState,
  record,
  removeParticipant,
  request,
  returnToLobby,
  sendCommand,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { buildDeck, scenarioDeck } from './decks.js';

/** Bia tem vermelhas em sequência; Ana só compra e passa. */
function winForGuestDeck(): string[] {
  return buildDeck({
    hands: [
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1'],
  });
}

describe('placar histórico independente da vaga', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<NonNullable<typeof active>> {
    const server = await startTestServer({ testHooks: true });
    const clients: TestClient[] = [];
    active = { server, clients };
    return active;
  }

  async function newClient(): Promise<TestClient> {
    if (active === null) throw new Error('setup ausente');
    const socket = await connect(active.server.url);
    active.clients.push(socket);
    return socket;
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  interface Pair {
    host: TestClient;
    guest: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    roomCode: string;
    roundId: string;
    hostId: string;
    guestId: string;
    hostCredential: string;
    guestCredential: string;
  }

  async function makePlaying(deck: string[]): Promise<Pair> {
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await setNextDeck(host, created.roomCode, deck);
    await setReady(host, true);
    await setReady(guest, true);
    const started = await startRound(host);
    expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada em andamento');
    return {
      host,
      guest,
      hostRec,
      guestRec,
      roomCode: created.roomCode,
      roundId: latestState(hostRec).room.roundId ?? '',
      hostId: latestState(hostRec).self.playerId,
      guestId: latestState(guestRec).self.playerId,
      hostCredential: created.credential,
      guestCredential: joined.credential,
    };
  }

  /** Sequência determinística de scenarioDeck: Ana vence com o coringa. */
  async function hostWins(pair: Pair): Promise<void> {
    const sequence: Array<[TestClient, Record<string, unknown>]> = [
      [pair.host, { type: 'play', cardId: 'red-1-1' }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'pass' }],
      [pair.host, { type: 'play', cardId: 'red-2-1' }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'play', cardId: 'red-7-1' }],
      [pair.host, { type: 'play', cardId: 'red-3-1' }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'pass' }],
      [pair.host, { type: 'play', cardId: 'red-4-1' }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'pass' }],
      [pair.host, { type: 'play', cardId: 'red-5-1' }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'pass' }],
      [pair.host, { type: 'play', cardId: 'red-6-1', announceLastCard: true }],
      [pair.guest, { type: 'draw' }],
      [pair.guest, { type: 'pass' }],
      [pair.host, { type: 'play', cardId: 'wild-color-1', chosenColor: 'green' }],
    ];
    for (const [socket, command] of sequence) {
      const ack = await sendCommand(socket, pair.roundId, command);
      expect(ack.ok, ack.ok ? '' : `${ack.error.code}: ${ack.error.message}`).toBe(true);
    }
    await waitFor(() => latestState(pair.hostRec).room.status === 'finished', 'fim da rodada');
  }

  /** Bia vence jogando as vermelhas; Ana compra e passa quando é a vez dela. */
  async function guestWins(pair: Pair): Promise<void> {
    for (let guard = 0; guard < 60; guard++) {
      const state = latestState(pair.hostRec);
      if (state.room.status === 'finished') return;
      const turn = state.self.view?.currentPlayerId;
      if (turn === pair.guestId) {
        await waitFor(() => latestState(pair.guestRec).self.view?.currentPlayerId === pair.guestId, 'vez de Bia em Bia');
        const view = latestState(pair.guestRec).self.view;
        if (view === null) throw new Error('sem projeção para Bia');
        const cardId = view.playableCardIds[0];
        if (cardId === undefined) throw new Error('sem carta jogável para Bia');
        const command = {
          type: 'play' as const,
          cardId,
          ...(view.hand.length === 2 ? { announceLastCard: true } : {}),
        };
        const ack = await sendCommand(pair.guest, pair.roundId, command);
        expect(ack.ok, ack.ok ? '' : `${ack.error.code}: ${ack.error.message}`).toBe(true);
        await waitFor(
          () => latestState(pair.hostRec).self.view?.currentPlayerId !== pair.guestId || latestState(pair.hostRec).room.status === 'finished',
          'turno seguinte',
        );
      } else {
        const draw = await sendCommand(pair.host, pair.roundId, { type: 'draw' });
        expect(draw.ok, draw.ok ? '' : `${draw.error.code}: ${draw.error.message}`).toBe(true);
        const pass = await sendCommand(pair.host, pair.roundId, { type: 'pass' });
        expect(pass.ok, pass.ok ? '' : `${pass.error.code}: ${pass.error.message}`).toBe(true);
        await waitFor(() => latestState(pair.hostRec).self.view?.currentPlayerId === pair.guestId, 'vez de Bia');
      }
    }
    throw new Error('a rodada não terminou');
  }

  it('vitória humana permanece no placar após a saída e a vaga liberada aceita pessoa nova', async () => {
    const { server } = await setup();
    const pair = await makePlaying(scenarioDeck());
    await hostWins(pair);

    await waitFor(() => latestState(pair.guestRec).room.status === 'finished', 'fim para Bia');
    const finished = latestState(pair.guestRec);
    expect(finished.room.scoreboard).toEqual([
      { playerId: pair.hostId, nickname: 'Ana', avatar: 'raposa', wins: 1, current: true },
      { playerId: pair.guestId, nickname: 'Bia', avatar: 'lobo', wins: 0, current: true },
    ]);
    expect(finished.room.participants.find((p) => p.id === pair.hostId)?.score).toBe(1);

    // Ana sai entre rodadas: a vaga libera, a linha do placar permanece.
    expect((await request<SimpleAck>(pair.host, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(pair.guestRec).room.participants.length === 1, 'vaga liberada');
    const afterLeave = latestState(pair.guestRec);
    expect(afterLeave.room.participants.map((p) => p.nickname)).toEqual(['Bia']);
    expect(afterLeave.room.scoreboard).toEqual([
      { playerId: pair.hostId, nickname: 'Ana', avatar: 'raposa', wins: 1, current: false },
      { playerId: pair.guestId, nickname: 'Bia', avatar: 'lobo', wins: 0, current: true },
    ]);

    // Pessoa nova ocupa a vaga liberada; o placar conservado continua visível.
    const newcomer = await newClient();
    const newcomerRec = record(newcomer);
    const joined = await joinOrFail(newcomer, pair.roomCode, 'Cai');
    if (!joined.ok) throw new Error('entrada falhou');
    await waitFor(() => latestState(newcomerRec).room.participants.length === 2, 'Cai na sala');
    expect(latestState(newcomerRec).room.scoreboard.map((entry) => [entry.nickname, entry.wins, entry.current])).toEqual([
      ['Ana', 1, false],
      ['Bia', 0, true],
      ['Cai', 0, true],
    ]);

    // Nova preparação com a vaga reciclada mantém o histórico.
    expect((await returnToLobby(pair.guest)).ok).toBe(true);
    expect((await setReady(pair.guest, true)).ok).toBe(true);
    expect((await setReady(newcomer, true)).ok).toBe(true);
    expect((await startRound(pair.guest)).ok).toBe(true);
    await waitFor(() => latestState(newcomerRec).self.view?.hand.length === 7, 'rodada seguinte');
    const roundTwo = latestState(newcomerRec);
    expect(roundTwo.room.roundNumber).toBe(2);
    expect(roundTwo.room.scoreboard.find((entry) => entry.playerId === pair.hostId)).toMatchObject({ wins: 1, current: false });

    // A credencial de quem saiu continua revogada.
    const stale = await request<Ack<JoinRoomAck>>(pair.host, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Ana',
      avatar: 'raposa',
      credential: pair.hostCredential,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('esperava recusa');
    expect(stale.error.code).toBe('CREDENTIAL_INVALID');
    expect(server.server.rooms.debugRoom(pair.roomCode)?.participants.has(pair.hostId)).toBe(false);
  });

  it('remoção no lobby preserva vitórias e libera a vaga', async () => {
    const { server } = await setup();
    const pair = await makePlaying(winForGuestDeck());
    await guestWins(pair);
    expect(latestState(pair.hostRec).room.scoreboard.find((entry) => entry.playerId === pair.guestId)?.wins).toBe(1);

    expect((await returnToLobby(pair.host)).ok).toBe(true);
    await waitFor(() => latestState(pair.guestRec).room.status === 'lobby', 'preparação');
    const removed = await removeParticipant(pair.host, pair.guestId);
    expect(removed.ok, removed.ok ? '' : removed.error.message).toBe(true);
    await waitFor(() => latestState(pair.hostRec).room.participants.length === 1, 'remoção');
    const afterRemoval = latestState(pair.hostRec);
    expect(afterRemoval.room.scoreboard).toEqual([
      { playerId: pair.hostId, nickname: 'Ana', avatar: 'raposa', wins: 0, current: true },
      { playerId: pair.guestId, nickname: 'Bia', avatar: 'lobo', wins: 1, current: false },
    ]);

    // Vaga liberada recebe pessoa nova e o histórico permanece.
    const newcomer = await newClient();
    const newcomerRec = record(newcomer);
    await joinOrFail(newcomer, pair.roomCode, 'Cai');
    await waitFor(() => latestState(newcomerRec).room.participants.length === 2, 'Cai na sala');
    expect(latestState(newcomerRec).room.scoreboard.find((entry) => entry.playerId === pair.guestId)).toMatchObject({
      wins: 1,
      current: false,
    });
    expect(server.server.rooms.debugRoom(pair.roomCode)?.participants.size).toBe(2);
  });

  it('retirada do substituto no fim da rodada preserva vitórias de rodada anterior', async () => {
    await setup();
    const pair = await makePlaying(winForGuestDeck());
    await guestWins(pair);
    expect((await returnToLobby(pair.host)).ok).toBe(true);

    // Rodada 2: Bia sai durante a rodada e o anfitrião encerra sem vencedor.
    expect((await setReady(pair.host, true)).ok).toBe(true);
    expect((await setReady(pair.guest, true)).ok).toBe(true);
    expect((await startRound(pair.host)).ok).toBe(true);
    await waitFor(() => latestState(pair.guestRec).room.status === 'playing', 'rodada 2');
    expect((await request<SimpleAck>(pair.guest, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    await waitFor(
      () => latestState(pair.hostRec).room.participants.find((p) => p.id === pair.guestId)?.autoControlled === true,
      'substituto de Bia',
    );
    expect((await request<SimpleAck>(pair.host, 'client:endRoundWithoutWinner', { intentId: intent() })).ok).toBe(true);

    const finished = latestState(pair.hostRec);
    expect(finished.room.participants.map((p) => p.nickname)).toEqual(['Ana']);
    expect(finished.room.lastRound?.winnerId).toBeNull();
    expect(finished.room.scoreboard.find((entry) => entry.playerId === pair.guestId)).toMatchObject({
      nickname: 'Bia',
      wins: 1,
      current: false,
    });
    expect(finished.room.scoreboard.reduce((sum, entry) => sum + entry.wins, 0)).toBe(1);
  });

  it('identidades distintas com o mesmo apelido não se fundem no placar', async () => {
    const { server } = await setup();
    const pair = await makePlaying(winForGuestDeck());
    await guestWins(pair);
    expect((await returnToLobby(pair.host)).ok).toBe(true);
    expect((await request<SimpleAck>(pair.guest, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(pair.hostRec).room.participants.length === 1, 'vaga liberada');

    const sameName = await newClient();
    const sameNameRec = record(sameName);
    const joined = await joinOrFail(sameName, pair.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await waitFor(() => latestState(sameNameRec).room.participants.length === 2, 'nova Bia');
    const board = latestState(sameNameRec).room.scoreboard.filter((entry) => entry.nickname === 'Bia');
    expect(board).toHaveLength(2);
    expect(new Set(board.map((entry) => entry.playerId)).size).toBe(2);
    expect(board.find((entry) => entry.playerId === pair.guestId)).toMatchObject({ wins: 1, current: false });
    expect(board.find((entry) => entry.playerId === joined.playerId)).toMatchObject({ wins: 0, current: true });
    expect(server.server.rooms.debugRoom(pair.roomCode)?.participants.size).toBe(2);
  });
});
