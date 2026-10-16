import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, CreateRoomAck, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import type { RoomStore } from '../src/rooms.js';
import {
  connect,
  createRoom,
  joinOrFail,
  latestState,
  record,
  request,
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
import { scenarioDeck } from './decks.js';

const RETENTION_BURST = 256;

describe('retenção e assinatura das intenções', () => {
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

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  async function makePlayingRoom(server: TestServer): Promise<{
    host: TestClient;
    guest: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    roundId: string;
  }> {
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    const started = await startRound(host);
    expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
    return { host, guest, hostRec, guestRec, roundId: latestState(hostRec).room.roundId ?? '' };
  }

  it('repetir uma prontidão antiga após 256 intenções não reexecuta nem altera estado', async () => {
    const { server } = await setup();
    const socket = await newClient(server);
    const rec = record(socket);
    const created = await createRoom(socket, 'Ana');
    if (!created.ok) throw new Error('criação falhou');

    const oldIntent = 'intent-old-ready-retention';
    const originalAck = await request<SimpleAck>(socket, 'client:setReady', { intentId: oldIntent, ready: true });
    expect(originalAck.ok).toBe(true);
    await waitFor(() => latestState(rec).self.ready, 'prontidão inicial');
    const versionAfterOriginal = latestState(rec).room.version;

    for (let index = 0; index < RETENTION_BURST; index++) {
      const ack = await request<SimpleAck>(socket, 'client:setReady', {
        intentId: `intent-burst-${index}`,
        ready: index % 2 === 0,
      });
      expect(ack.ok).toBe(true);
    }
    await waitFor(() => !latestState(rec).self.ready, 'prontidão final do ciclo');
    const versionBeforeReplay = latestState(rec).room.version;
    const statesBeforeReplay = rec.states.length;
    const eventsBeforeReplay = rec.events.length;

    const replay = await request<SimpleAck>(socket, 'client:setReady', { intentId: oldIntent, ready: true });
    expect(replay).toEqual(originalAck);
    expect(versionAfterOriginal).toBeLessThan(versionBeforeReplay);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(latestState(rec).self.ready).toBe(false);
    expect(latestState(rec).room.version).toBe(versionBeforeReplay);
    expect(rec.states.length).toBe(statesBeforeReplay);
    expect(rec.events.length).toBe(eventsBeforeReplay);
  });

  it('repetir uma compra antiga quando comprar voltaria a ser válido não acrescenta carta nem evento', async () => {
    const { server } = await setup();
    const { host, guest, hostRec, guestRec, roundId } = await makePlayingRoom(server);

    const drawIntent = 'intent-old-draw-retention';
    const originalDraw = await sendCommand(host, roundId, { type: 'draw' }, drawIntent);
    expect(originalDraw.ok).toBe(true);
    expect(latestState(hostRec).self.view?.hand).toHaveLength(8);
    expect(latestState(hostRec).self.view?.phase).toBe('after-draw');

    for (let index = 0; index < RETENTION_BURST; index++) {
      const rejected = await sendCommand(host, roundId, { type: 'draw' }, `intent-burst-draw-${index}`);
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.error.code).toBe('ALREADY_DREW');
    }

    const pass = await sendCommand(host, roundId, { type: 'pass' });
    expect(pass.ok).toBe(true);
    const guestDraw = await sendCommand(guest, roundId, { type: 'draw' });
    expect(guestDraw.ok).toBe(true);
    const guestPass = await sendCommand(guest, roundId, { type: 'pass' });
    expect(guestPass.ok).toBe(true);

    await waitFor(() => latestState(hostRec).self.view?.phase === 'play', 'vez de Ana de novo');
    const versionBeforeReplay = latestState(hostRec).room.version;
    const drawEventsBeforeReplay = countEvents(guestRec, 'drew');

    const replay = await sendCommand(host, roundId, { type: 'draw' }, drawIntent);
    expect(replay).toEqual(originalDraw);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(latestState(hostRec).self.view?.hand).toHaveLength(8);
    expect(latestState(hostRec).self.view?.phase).toBe('play');
    expect(latestState(hostRec).room.version).toBe(versionBeforeReplay);
    expect(countEvents(guestRec, 'drew')).toBe(drawEventsBeforeReplay);

    const freshDraw = await sendCommand(host, roundId, { type: 'draw' });
    expect(freshDraw.ok).toBe(true);
    expect(latestState(hostRec).self.view?.hand).toHaveLength(9);
    expect(latestState(hostRec).self.view?.phase).toBe('after-draw');
    await waitFor(() => countEvents(guestRec, 'drew') === drawEventsBeforeReplay + 1, 'evento da compra nova');
    expect(countEvents(guestRec, 'drew')).toBe(drawEventsBeforeReplay + 1);
  });

  it('início versus retorno com payloads iguais: reuso recusado, repetição idêntica consistente', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    await joinOrFail(guest, created.roomCode, 'Bia');
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);

    const crossIntent = 'intent-cross-operation';
    const startAck = await request<SimpleAck>(host, 'client:startRound', { intentId: crossIntent });
    expect(startAck.ok).toBe(true);
    await waitFor(() => latestState(hostRec).room.status === 'playing', 'rodada iniciada');
    const versionAfterStart = latestState(hostRec).room.version;
    const roundId = latestState(hostRec).room.roundId;

    const cross = await request<SimpleAck>(host, 'client:returnToLobby', { intentId: crossIntent });
    expect(cross.ok).toBe(false);
    if (cross.ok) throw new Error('esperava recusa');
    expect(cross.error.code).toBe('INTENT_REUSED');
    expect(latestState(hostRec).room.status).toBe('playing');
    expect(latestState(hostRec).room.version).toBe(versionAfterStart);

    const replayStart = await request<SimpleAck>(host, 'client:startRound', { intentId: crossIntent });
    expect(replayStart).toEqual(startAck);
    expect(latestState(hostRec).room.roundNumber).toBe(1);
    expect(latestState(hostRec).room.roundId).toBe(roundId);
    expect(latestState(hostRec).room.version).toBe(versionAfterStart);
  });

  it('prontidão versus início com o mesmo id: recusa cruzada e repetição idêntica consistente', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    await joinOrFail(guest, created.roomCode, 'Bia');

    const sharedIntent = 'intent-ready-vs-start';
    const readyAck = await request<SimpleAck>(host, 'client:setReady', { intentId: sharedIntent, ready: true });
    expect(readyAck.ok).toBe(true);
    await waitFor(() => latestState(hostRec).self.ready, 'prontidão');
    const versionAfterReady = latestState(hostRec).room.version;

    const sameEventOtherPayload = await request<SimpleAck>(host, 'client:setReady', { intentId: sharedIntent, ready: false });
    expect(sameEventOtherPayload.ok).toBe(false);
    if (sameEventOtherPayload.ok) throw new Error('esperava recusa');
    expect(sameEventOtherPayload.error.code).toBe('INTENT_REUSED');

    const crossStart = await request<SimpleAck>(host, 'client:startRound', { intentId: sharedIntent });
    expect(crossStart.ok).toBe(false);
    if (crossStart.ok) throw new Error('esperava recusa');
    expect(crossStart.error.code).toBe('INTENT_REUSED');
    expect(latestState(hostRec).room.status).toBe('lobby');
    expect(latestState(hostRec).room.version).toBe(versionAfterReady);

    const replayReady = await request<SimpleAck>(host, 'client:setReady', { intentId: sharedIntent, ready: true });
    expect(replayReady).toEqual(readyAck);
    expect(latestState(hostRec).self.ready).toBe(true);
    expect(latestState(hostRec).room.version).toBe(versionAfterReady);
  });

  it('criação e entrada memorizam por conexão sem reexecutar nem duplicar sala/pessoa', async () => {
    const { server } = await setup();
    const creator = await newClient(server);
    const creatorRec = record(creator);

    const createIntent = 'intent-create-retention';
    const createPayload = { intentId: createIntent, nickname: 'Ana', avatar: 'raposa' };
    const first = await request<{ ok: boolean; roomCode?: string; credential?: string }>(creator, 'client:createRoom', createPayload);
    expect(first.ok).toBe(true);
    const replay = await request<typeof first>(creator, 'client:createRoom', createPayload);
    expect(replay).toEqual(first);
    expect(server.server.rooms.roomCodes).toHaveLength(1);

    const conflicting = await request<{ ok: boolean; error?: { code: string } }>(creator, 'client:createRoom', {
      ...createPayload,
      nickname: 'Outra',
    });
    expect(conflicting.ok).toBe(false);
    expect(conflicting.error?.code).toBe('INTENT_REUSED');

    const roomCode = first.roomCode ?? latestState(creatorRec).room.roomCode;
    const joiner = await newClient(server);
    const joinIntent = 'intent-join-retention';
    const joinPayload = { intentId: joinIntent, roomCode, nickname: 'Bia', avatar: 'lobo' };
    const joined = await request<{ ok: boolean }>(joiner, 'client:joinRoom', joinPayload);
    expect(joined.ok).toBe(true);
    const joinedReplay = await request<typeof joined>(joiner, 'client:joinRoom', joinPayload);
    expect(joinedReplay).toEqual(joined);
    const room = server.server.rooms.debugRoom(roomCode);
    expect(room?.participants.size).toBe(2);

    const joinConflict = await request<{ ok: boolean; error?: { code: string } }>(joiner, 'client:joinRoom', {
      ...joinPayload,
      nickname: 'Outra',
    });
    expect(joinConflict.ok).toBe(false);
    expect(joinConflict.error?.code).toBe('INTENT_REUSED');
    expect(room?.participants.size).toBe(2);
  });

  it('duplicata de comando não altera rodada antiga nem reenvia snapshot como atualização nova', async () => {
    const { server } = await setup();
    const { host, hostRec, guestRec, roundId } = await makePlayingRoom(server);

    const playIntent = 'intent-duplicate-snapshot';
    const play = await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' }, playIntent);
    expect(play.ok).toBe(true);
    const statesAfterPlay = hostRec.states.length;

    const replay = await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' }, playIntent);
    expect(replay).toEqual(play);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(hostRec.states.length).toBe(statesAfterPlay);
    expect(countEvents(guestRec, 'played')).toBe(1);
  });

  it('replay de criação devolve o ack original congelado após a sala avançar de versão', async () => {
    const { server } = await setup();
    const creator = await newClient(server);
    const creatorRec = record(creator);

    const createPayload = { intentId: 'intent-create-frozen-ack', nickname: 'Ana', avatar: 'raposa' as const };
    const original = await request<Ack<CreateRoomAck>>(creator, 'client:createRoom', createPayload);
    expect(original.ok).toBe(true);
    if (!original.ok) throw new Error('criação falhou');
    await waitFor(() => latestState(creatorRec).room.version === original.version, 'estado da criação');

    await request<SimpleAck>(creator, 'client:setReady', { intentId: 'intent-frozen-ready-1', ready: true });
    await request<SimpleAck>(creator, 'client:setReady', { intentId: 'intent-frozen-ready-2', ready: false });
    await request<SimpleAck>(creator, 'client:setReady', { intentId: 'intent-frozen-ready-3', ready: true });
    await waitFor(() => latestState(creatorRec).room.version === original.version + 3, 'sala avançou de versão');
    const versionNow = latestState(creatorRec).room.version;
    const statesNow = creatorRec.states.length;
    const eventsNow = creatorRec.events.length;

    const replay = await request<Ack<CreateRoomAck>>(creator, 'client:createRoom', createPayload);
    expect(replay).toEqual(original);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(latestState(creatorRec).room.version).toBe(versionNow);
    expect(creatorRec.states.length).toBe(statesNow);
    expect(creatorRec.events.length).toBe(eventsNow);
    expect(server.server.rooms.roomCodes).toHaveLength(1);
    expect(server.server.rooms.debugRoom(original.roomCode)?.participants.size).toBe(1);
    expect(latestState(creatorRec).room.roundNumber).toBe(0);
  });

  it('replay de entrada devolve o ack original congelado após a sala avançar de versão', async () => {
    const { server } = await setup();
    const creator = await newClient(server);
    const created = await createRoom(creator, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const joiner = await newClient(server);
    const joinerRec = record(joiner);

    const joinPayload = { intentId: 'intent-join-frozen-ack', roomCode: created.roomCode, nickname: 'Bia', avatar: 'lobo' as const };
    const original = await request<Ack<JoinRoomAck>>(joiner, 'client:joinRoom', joinPayload);
    expect(original.ok).toBe(true);
    if (!original.ok) throw new Error('entrada falhou');
    await waitFor(() => latestState(joinerRec).room.version === original.version, 'estado da entrada');

    await request<SimpleAck>(creator, 'client:setReady', { intentId: 'intent-join-ready-1', ready: true });
    await request<SimpleAck>(creator, 'client:setReady', { intentId: 'intent-join-ready-2', ready: false });
    await waitFor(() => latestState(joinerRec).room.version === original.version + 2, 'sala avançou de versão');
    const versionNow = latestState(joinerRec).room.version;
    const statesNow = joinerRec.states.length;

    const replay = await request<Ack<JoinRoomAck>>(joiner, 'client:joinRoom', joinPayload);
    expect(replay).toEqual(original);
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(latestState(joinerRec).room.version).toBe(versionNow);
    expect(joinerRec.states.length).toBe(statesNow);
    expect(server.server.rooms.debugRoom(created.roomCode)?.participants.size).toBe(2);
  });

  it('fim de conexão limpa o cache da conexão mesmo sem sala; cache alheio permanece', async () => {
    const { server } = await setup();
    const refused = await newClient(server);
    const refusedId = refused.id;
    expect(refusedId).toBeDefined();
    if (refusedId === undefined) throw new Error('socket sem id');
    const refusedAck = await request<Ack>(refused, 'client:joinRoom', {
      intentId: 'intent-refused-join',
      roomCode: 'ZZZZZZ',
      nickname: 'Bia',
      avatar: 'lobo',
    });
    expect(refusedAck.ok).toBe(false);
    if (refusedAck.ok) throw new Error('esperava recusa');
    expect(refusedAck.error.code).toBe('ROOM_NOT_FOUND');
    expect(socketIntentCount(server.server.rooms, refusedId)).toBe(1);

    const other = await newClient(server);
    const otherId = other.id;
    expect(otherId).toBeDefined();
    if (otherId === undefined) throw new Error('socket sem id');
    const otherAck = await request<Ack>(other, 'client:joinRoom', {
      intentId: 'intent-other-refused-join',
      roomCode: 'ZZZZZY',
      nickname: 'Cai',
      avatar: 'sapo',
    });
    expect(otherAck.ok).toBe(false);
    expect(socketIntentCount(server.server.rooms, otherId)).toBe(1);

    refused.disconnect();
    await waitFor(() => socketIntentCount(server.server.rooms, refusedId) === 0, 'limpeza do cache da conexão');
    expect(socketIntentCount(server.server.rooms, otherId)).toBe(1);
  });

  it('registros do participante sobrevivem ao fim da conexão e seguem protegendo replays', async () => {
    const { server } = await setup();
    const first = await newClient(server);
    const firstRec = record(first);
    const created = await request<Ack<CreateRoomAck>>(first, 'client:createRoom', {
      intentId: 'intent-persist-create',
      nickname: 'Ana',
      avatar: 'raposa',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('criação falhou');
    const readyAck = await request<SimpleAck>(first, 'client:setReady', { intentId: 'intent-persist-ready', ready: true });
    expect(readyAck.ok).toBe(true);
    const offAck = await request<SimpleAck>(first, 'client:setReady', { intentId: 'intent-persist-off', ready: false });
    expect(offAck.ok).toBe(true);
    await waitFor(() => latestState(firstRec).self.ready === false, 'prontidão desligada');

    const room = server.server.rooms.debugRoom(created.roomCode);
    const playerId = latestState(firstRec).self.playerId;
    const participant = room?.participants.get(playerId);
    const firstSocketId = first.id;
    expect(firstSocketId).toBeDefined();
    if (firstSocketId === undefined) throw new Error('socket sem id');
    expect(participant?.intents.size).toBe(2);
    expect(socketIntentCount(server.server.rooms, firstSocketId)).toBe(1);

    first.disconnect();
    await waitFor(() => participant?.connected === false, 'desconexão de Ana');
    expect(socketIntentCount(server.server.rooms, firstSocketId)).toBe(0);
    expect(participant?.intents.size).toBe(2);

    const second = await newClient(server);
    const secondRec = record(second);
    const rejoined = await request<Ack<JoinRoomAck>>(second, 'client:joinRoom', {
      intentId: 'intent-persist-rejoin',
      roomCode: created.roomCode,
      nickname: 'Ana',
      avatar: 'raposa',
      credential: created.credential,
    });
    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) throw new Error('reentrada falhou');
    expect(rejoined.rejoined).toBe(true);
    await waitFor(() => latestState(secondRec).room.roundNumber === 0, 'estado da reentrada');
    const versionBeforeReplay = latestState(secondRec).room.version;

    const replay = await request<SimpleAck>(second, 'client:setReady', { intentId: 'intent-persist-ready', ready: true });
    expect(replay).toEqual(readyAck);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(latestState(secondRec).self.ready).toBe(false);
    expect(latestState(secondRec).room.version).toBe(versionBeforeReplay);
    expect(participant?.intents.size).toBe(2);
  });
});

function countEvents(recorder: Recorder, type: string): number {
  return recorder.events.reduce((sum, message) => sum + message.events.filter((event) => event.type === type).length, 0);
}

/** Inspeção interna do cache por conexão; não há endpoint público para consultá-lo. */
function socketIntentCount(store: RoomStore, socketId: string): number {
  const internals = store as unknown as { socketIntents: Map<string, Map<string, unknown>> };
  return internals.socketIntents.get(socketId)?.size ?? 0;
}
