import { afterEach, describe, expect, it } from 'vitest';
import {
  connect,
  createRoom,
  intent,
  joinOrFail,
  latestState,
  record,
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
import { challengeDeck, scenarioDeck, skipDeck } from './decks.js';

describe('deduplicação, ordem e placar', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ server: TestServer; clients: TestClient[] }> {
    const server = await startTestServer({ testHooks: true });
    const clients: TestClient[] = [];
    active = { server, clients };
    return active;
  }

  async function newClient(server: TestServer): Promise<TestClient> {
    const socket = await connect(server.url);
    active?.clients.push(socket);
    return socket;
  }

  async function teardownCurrent(): Promise<void> {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  }

  afterEach(teardownCurrent);

  interface Pair {
    host: TestClient;
    guest: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    roomCode: string;
  }

  async function makeRoom(server: TestServer): Promise<Pair> {
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');
    return { host, guest, hostRec, guestRec, roomCode: created.roomCode };
  }

  async function makePlayingRoom(server: TestServer, deck = scenarioDeck()): Promise<Pair & { roundId: string }> {
    const pair = await makeRoom(server);
    await setNextDeck(pair.host, pair.roomCode, deck);
    await setReady(pair.host, true);
    await setReady(pair.guest, true);
    const started = await startRound(pair.host);
    expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
    const state = latestState(pair.hostRec);
    expect(state.room.status).toBe('playing');
    expect(state.self.view?.hand).toHaveLength(7);
    return { ...pair, roundId: state.room.roundId ?? '' };
  }

  it('repetir prontidão e início mantém a mesma resposta e não duplica efeitos', async () => {
    const { server } = await setup();
    const { host, guest, hostRec, roomCode } = await makeRoom(server);

    const readyIntent = intent();
    const readyOne = await request<{ ok: boolean }>(host, 'client:setReady', { intentId: readyIntent, ready: true });
    expect(readyOne.ok).toBe(true);
    const readyTwo = await request<{ ok: boolean }>(host, 'client:setReady', { intentId: readyIntent, ready: true });
    expect(readyTwo).toEqual(readyOne);

    await setReady(guest, true);

    const startIntent = intent();
    const startOne = await request<{ ok: boolean }>(host, 'client:startRound', { intentId: startIntent });
    expect(startOne.ok).toBe(true);
    const versionAfterStart = latestState(hostRec).room.version;
    const roundId = latestState(hostRec).room.roundId;

    const startTwo = await request<{ ok: boolean }>(host, 'client:startRound', { intentId: startIntent });
    expect(startTwo).toEqual(startOne);
    expect(latestState(hostRec).room.version).toBe(versionAfterStart);
    expect(latestState(hostRec).room.roundId).toBe(roundId);
    expect(latestState(hostRec).room.roundNumber).toBe(1);

    const room = server.server.rooms.debugRoom(roomCode);
    expect(room?.participants.size).toBe(2);
    expect(room?.round?.state.seats.every((seat) => seat.hand.length === 7)).toBe(true);
  });

  it('repetir compra não compra de novo e repetir descarte não joga duas vezes', async () => {
    const { server } = await setup();
    const { host, guest, hostRec, guestRec, roundId } = await makePlayingRoom(server);

    const drawIntent = intent();
    const firstDraw = await sendCommand(host, roundId, { type: 'draw' }, drawIntent);
    expect(firstDraw.ok).toBe(true);
    expect(latestState(hostRec).self.view?.hand).toHaveLength(8);

    const replayDraw = await sendCommand(host, roundId, { type: 'draw' }, drawIntent);
    expect(replayDraw).toEqual(firstDraw);
    expect(latestState(hostRec).self.view?.hand).toHaveLength(8);
    await waitFor(() => countEvents(guestRec, 'drew') >= 1, 'evento de compra');
    expect(countEvents(guestRec, 'drew')).toBe(1);

    const pass = await sendCommand(host, roundId, { type: 'pass' });
    expect(pass.ok).toBe(true);
    const guestDraw = await sendCommand(guest, roundId, { type: 'draw' });
    expect(guestDraw.ok).toBe(true);
    const guestPass = await sendCommand(guest, roundId, { type: 'pass' });
    expect(guestPass.ok).toBe(true);

    const playIntent = intent();
    const firstPlay = await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' }, playIntent);
    expect(firstPlay.ok).toBe(true);
    const replayPlay = await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' }, playIntent);
    expect(replayPlay).toEqual(firstPlay);
    await waitFor(() => countEvents(guestRec, 'played') >= 1, 'evento de descarte');
    expect(countEvents(guestRec, 'played')).toBe(1);
    expect(latestState(hostRec).self.view?.hand.some((card) => card.id === 'red-1-1')).toBe(false);
  });

  it('reusar o mesmo id com outro conteúdo é recusado', async () => {
    const { server } = await setup();
    const { host, hostRec, roundId } = await makePlayingRoom(server);

    const shared = intent();
    const draw = await sendCommand(host, roundId, { type: 'draw' }, shared);
    expect(draw.ok).toBe(true);
    const other = await sendCommand(host, roundId, { type: 'pass' }, shared);
    expect(other.ok).toBe(false);
    if (other.ok) throw new Error('esperava recusa');
    expect(other.error.code).toBe('INTENT_REUSED');
    expect(latestState(hostRec).self.view?.phase).toBe('after-draw');
  });

  it('separa identidades e salas: o mesmo id vale por pessoa e por sala', async () => {
    const { server } = await setup();
    const first = await makePlayingRoom(server);
    const second = await makePlayingRoom(server);

    expect(first.roomCode).not.toBe(second.roomCode);
    const shared = 'intent-shared-000000';

    const firstHostDraw = await sendCommand(first.host, first.roundId, { type: 'draw' }, shared);
    expect(firstHostDraw.ok).toBe(true);
    const firstGuestDraw = await sendCommand(first.guest, first.roundId, { type: 'draw' }, shared);
    expect(firstGuestDraw.ok).toBe(false);
    if (!firstGuestDraw.ok) expect(firstGuestDraw.error.code).toBe('NOT_YOUR_TURN');

    const secondHostDraw = await sendCommand(second.host, second.roundId, { type: 'draw' }, shared);
    expect(secondHostDraw.ok).toBe(true);

    const roomOne = server.server.rooms.debugRoom(first.roomCode);
    const roomTwo = server.server.rooms.debugRoom(second.roomCode);
    expect(roomOne?.round?.state.seats[0]?.hand.length).toBe(8);
    expect(roomTwo?.round?.state.seats[0]?.hand.length).toBe(8);
  });

  it('descarte de Bloqueio com duas pessoas: a vez volta ao mesmo ator e a duplicata é inofensiva', async () => {
    const { server } = await setup();
    const { host, hostRec, guestRec, roundId } = await makePlayingRoom(server, skipDeck());

    const skipIntent = intent();
    const skip = await sendCommand(host, roundId, { type: 'play', cardId: 'red-skip-1' }, skipIntent);
    expect(skip.ok).toBe(true);
    const hostState = latestState(hostRec);
    expect(hostState.self.view?.currentPlayerId).toBe(hostState.self.playerId);

    const duplicate = await sendCommand(host, roundId, { type: 'play', cardId: 'red-skip-1' }, skipIntent);
    expect(duplicate).toEqual(skip);
    expect(latestState(hostRec).room.version).toBe(hostState.room.version);
    expect(latestState(hostRec).self.view?.discardTop.id).toBe('red-skip-1');
    await waitFor(() => countEvents(guestRec, 'played') >= 1 && countEvents(guestRec, 'turnSkipped') >= 1, 'eventos do Bloqueio');
    expect(countEvents(guestRec, 'played')).toBe(1);
    expect(countEvents(guestRec, 'turnSkipped')).toBe(1);

    const nextPlay = await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' });
    expect(nextPlay.ok).toBe(true);
    await waitFor(() => countEvents(guestRec, 'played') >= 2, 'segundo descarte');
    expect(countEvents(guestRec, 'played')).toBe(2);
  });

  it('vitória é contada uma única vez; reenvio não soma e rodada nova exige prontidão', async () => {
    const { server } = await setup();
    const { host, guest, hostRec, guestRec, roundId } = await makePlayingRoom(server);

    const hostId = latestState(hostRec).self.playerId;
    const guestId = latestState(guestRec).self.playerId;

    const sequence: Array<[TestClient, Record<string, unknown>]> = [
      [host, { type: 'play', cardId: 'red-1-1' }],
      [guest, { type: 'draw' }],
      [guest, { type: 'pass' }],
      [host, { type: 'play', cardId: 'red-2-1' }],
      [guest, { type: 'draw' }],
      [guest, { type: 'play', cardId: 'red-7-1' }],
      [host, { type: 'play', cardId: 'red-3-1' }],
      [guest, { type: 'draw' }],
      [guest, { type: 'pass' }],
      [host, { type: 'play', cardId: 'red-4-1' }],
      [guest, { type: 'draw' }],
      [guest, { type: 'pass' }],
      [host, { type: 'play', cardId: 'red-5-1' }],
      [guest, { type: 'draw' }],
      [guest, { type: 'pass' }],
      [host, { type: 'play', cardId: 'red-6-1', announceLastCard: true }],
      [guest, { type: 'draw' }],
      [guest, { type: 'pass' }],
    ];
    for (const [socket, command] of sequence) {
      const ack = await sendCommand(socket, roundId, command);
      expect(ack.ok, ack.ok ? '' : `${ack.error.code}: ${ack.error.message}`).toBe(true);
    }

    const winningIntent = intent();
    const win = await sendCommand(host, roundId, { type: 'play', cardId: 'wild-color-1', chosenColor: 'green' }, winningIntent);
    expect(win.ok).toBe(true);

    const finished = latestState(hostRec);
    expect(finished.room.status).toBe('finished');
    expect(finished.self.view?.winnerId).toBe(hostId);
    expect(finished.room.lastRound).toEqual({
      roundNumber: 1,
      winnerId: hostId,
      winnerNickname: 'Ana',
      substitute: false,
      winnerKind: 'human',
    });
    expect(scoreOf(finished, hostId)).toBe(1);
    expect(scoreOf(finished, guestId)).toBe(0);
    await waitFor(() => latestState(guestRec).self.view?.winnerId === hostId, 'resultado para Bia');
    expect(latestState(guestRec).self.view?.winnerId).toBe(hostId);
    expect(countEvents(guestRec, 'roundFinished')).toBe(1);

    const replay = await sendCommand(host, roundId, { type: 'play', cardId: 'wild-color-1', chosenColor: 'green' }, winningIntent);
    expect(replay).toEqual(win);
    expect(scoreOf(latestState(hostRec), hostId)).toBe(1);

    const freshAttempt = await sendCommand(host, roundId, { type: 'play', cardId: 'wild-color-1', chosenColor: 'green' });
    expect(freshAttempt.ok).toBe(false);
    if (freshAttempt.ok) throw new Error('esperava recusa');
    expect(freshAttempt.error.code).toBe('ROUND_FINISHED');
    expect(scoreOf(latestState(hostRec), hostId)).toBe(1);
    expect(countEvents(guestRec, 'roundFinished')).toBe(1);

    const back = await returnToLobby(host);
    expect(back.ok).toBe(true);
    const lobby = latestState(hostRec);
    expect(lobby.room.status).toBe('lobby');
    expect(lobby.room.participants.every((p) => !p.ready)).toBe(true);
    expect(scoreOf(lobby, hostId)).toBe(1);

    const early = await startRound(host);
    expect(early.ok).toBe(false);
    if (early.ok) throw new Error('esperava recusa');
    expect(early.error.code).toBe('NOT_ALL_READY');

    await setReady(host, true);
    await setReady(guest, true);
    const secondRound = await startRound(host);
    expect(secondRound.ok).toBe(true);
    const secondState = latestState(hostRec);
    expect(secondState.room.roundNumber).toBe(2);
    expect(secondState.self.view?.hand).toHaveLength(7);
    expect(scoreOf(secondState, hostId)).toBe(1);
  });

  it('resolve aviso e denúncia na ordem em que o servidor recebe', async () => {
    {
      const { server } = await setup();
      const { host, guest, hostRec, roundId } = await makePlayingRoom(server, challengeDeck());
      await playRedsToLastCard(host, guest, hostRec, roundId, false);

      const announce = await sendCommand(host, roundId, { type: 'announceLastCard' });
      expect(announce.ok).toBe(true);
      const challenge = await sendCommand(guest, roundId, { type: 'challengeLastCard', targetId: latestState(hostRec).self.playerId });
      expect(challenge.ok).toBe(false);
      if (challenge.ok) throw new Error('esperava recusa');
      expect(challenge.error.code).toBe('INVALID_CHALLENGE');
      await teardownCurrent();
    }

    {
      const { server } = await setup();
      const { host, guest, hostRec, guestRec, roundId } = await makePlayingRoom(server, challengeDeck());
      await playRedsToLastCard(host, guest, hostRec, roundId, false);

      const challenge = await sendCommand(guest, roundId, { type: 'challengeLastCard', targetId: latestState(hostRec).self.playerId });
      expect(challenge.ok).toBe(true);
      await waitFor(() => latestState(hostRec).self.view?.hand.length === 3, 'penalidade para Ana');
      expect(latestState(hostRec).self.view?.hand).toHaveLength(3);
      expect(lastEvents(guestRec).map((event) => event.type)).toEqual(['drew', 'challengeAccepted']);

      const announce = await sendCommand(host, roundId, { type: 'announceLastCard' });
      expect(announce.ok).toBe(false);
      if (announce.ok) throw new Error('esperava recusa');
      expect(announce.error.code).toBe('NO_LAST_CARD_WINDOW');
      await teardownCurrent();
    }
  });
});

function countEvents(recorder: Recorder, type: string): number {
  return recorder.events.reduce((sum, message) => sum + message.events.filter((event) => event.type === type).length, 0);
}

function lastEvents(recorder: Recorder) {
  return recorder.events[recorder.events.length - 1]?.events ?? [];
}

function scoreOf(state: { room: { participants: readonly { id: string; score: number }[] } }, playerId: string): number {
  return state.room.participants.find((participant) => participant.id === playerId)?.score ?? -1;
}

async function playRedsToLastCard(
  host: TestClient,
  guest: TestClient,
  hostRec: Recorder,
  roundId: string,
  withAnnounce: boolean,
): Promise<void> {
  const steps: Array<[TestClient, Record<string, unknown>]> = [
    [host, { type: 'play', cardId: 'red-1-1' }],
    [guest, { type: 'draw' }],
    [guest, { type: 'pass' }],
    [host, { type: 'play', cardId: 'red-2-1' }],
    [guest, { type: 'draw' }],
    [guest, { type: 'pass' }],
    [host, { type: 'play', cardId: 'red-3-1' }],
    [guest, { type: 'draw' }],
    [guest, { type: 'pass' }],
    [host, { type: 'play', cardId: 'red-4-1' }],
    [guest, { type: 'draw' }],
    [guest, { type: 'pass' }],
    [host, { type: 'play', cardId: 'red-5-1' }],
    [guest, { type: 'draw' }],
    [guest, { type: 'pass' }],
    [host, { type: 'play', cardId: 'red-6-1', announceLastCard: withAnnounce }],
  ];
  for (const [socket, command] of steps) {
    const ack = await sendCommand(socket, roundId, command);
    expect(ack.ok, ack.ok ? '' : `${ack.error.code}: ${ack.error.message}`).toBe(true);
  }
  expect(latestState(hostRec).self.view?.hand).toHaveLength(1);
}
