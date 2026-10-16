import { afterEach, describe, expect, it } from 'vitest';
import {
  connect,
  createRoom,
  joinOrFail,
  joinRoom,
  latestState,
  record,
  setReady,
  startRound,
  waitFor,
  type TestClient,
  type TestServer,
  startTestServer,
} from './helpers.js';

describe('fluxo de sala', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ server: TestServer; clients: TestClient[] }> {
    const server = await startTestServer();
    const clients: TestClient[] = [];
    active = { server, clients };
    return active;
  }

  function newClient(server: TestServer): Promise<TestClient> {
    return connect(server.url).then((socket) => {
      active?.clients.push(socket);
      return socket;
    });
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  it('cria a sala, entra pelo código e mostra anfitrião e prontidão', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');

    const guest = await newClient(server);
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');

    await waitFor(() => latestState(hostRec).room.participants.length === 2, 'Bia no estado de Ana');
    const hostState = latestState(hostRec);
    expect(hostState.room.roomCode).toBe(created.roomCode);
    expect(hostState.room.status).toBe('lobby');
    expect(hostState.room.participants.map((p) => p.nickname)).toEqual(['Ana', 'Bia']);
    expect(hostState.room.participants[0]?.isHost).toBe(true);
    expect(hostState.room.participants[1]?.isHost).toBe(false);
    expect(hostState.self.view).toBeNull();

    const guestState = latestState(guestRec);
    expect(guestState.self.nickname).toBe('Bia');
    expect(guestState.room.participants).toHaveLength(2);

    const readyAck = await setReady(guest, true);
    expect(readyAck.ok).toBe(true);
    await waitFor(() => latestState(hostRec).room.participants[1]?.ready === true, 'prontidão de Bia');
    expect(latestState(hostRec).room.participants[1]?.ready).toBe(true);
  });

  it('recusa início por não anfitrião, sala sem dois participantes e participante não pronto', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');

    const alone = await startRound(host);
    expect(alone.ok).toBe(false);
    if (alone.ok) throw new Error('esperava recusa');
    expect(alone.error.code).toBe('NOT_ENOUGH_PLAYERS');

    const guest = await newClient(server);
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');

    const notHost = await startRound(guest);
    expect(notHost.ok).toBe(false);
    if (notHost.ok) throw new Error('esperava recusa');
    expect(notHost.error.code).toBe('NOT_HOST');

    await setReady(host, true);
    const notReady = await startRound(host);
    expect(notReady.ok).toBe(false);
    if (notReady.ok) throw new Error('esperava recusa');
    expect(notReady.error.code).toBe('NOT_ALL_READY');
    expect(latestState(hostRec).room.status).toBe('lobby');
    expect(latestState(guestRec).room.status).toBe('lobby');
  });

  it('inicia com todos prontos e distribui sete cartas; prontidão é zerada', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');

    await setReady(host, true);
    await setReady(guest, true);
    const started = await startRound(host);
    expect(started.ok).toBe(true);

    const hostState = latestState(hostRec);
    expect(hostState.room.status).toBe('playing');
    expect(hostState.self.view?.hand).toHaveLength(7);
    expect(hostState.self.view?.players.map((p) => p.handCount)).toEqual([7, 7]);
    expect(hostState.room.participants.every((p) => !p.ready)).toBe(true);

    await waitFor(() => latestState(guestRec).self.view?.hand.length === 7, 'mão de Bia');
    const guestState = latestState(guestRec);
    expect(guestState.self.view?.hand).toHaveLength(7);
    expect(guestState.room.roundId).toBe(hostState.room.roundId);
  });

  it('entrada durante a rodada fica no lobby sem mão e sem alterar assentos', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    await joinOrFail(guest, created.roomCode, 'Bia');
    await setReady(host, true);
    await setReady(guest, true);
    await startRound(host);

    const beforeState = latestState(hostRec);
    const beforeHand = beforeState.self.view?.hand.map((card) => card.id);

    const latecomer = await newClient(server);
    const lateRec = record(latecomer);
    const joined = await joinOrFail(latecomer, created.roomCode, 'Cai');
    if (!joined.ok) throw new Error('entrada falhou');

    await waitFor(() => latestState(lateRec).self.waiting, 'estado de espera');
    const lateState = latestState(lateRec);
    expect(lateState.self.waiting).toBe(true);
    expect(lateState.self.view).toBeNull();
    expect(lateState.room.status).toBe('playing');

    await waitFor(() => latestState(hostRec).room.participants.length === 3, 'entrada de Cai na sala');
    const afterState = latestState(hostRec);
    expect(afterState.room.roundId).toBe(beforeState.room.roundId);
    expect(afterState.self.view?.hand.map((card) => card.id)).toEqual(beforeHand);
    expect(afterState.self.view?.players.map((p) => p.handCount)).toEqual([7, 7]);
    expect(afterState.room.participants).toHaveLength(3);
    expect(afterState.room.participants[2]?.inRound).toBe(false);
  });

  it('recusa a nona pessoa na sala', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    for (let index = 2; index <= 8; index++) {
      const socket = await newClient(server);
      await joinOrFail(socket, created.roomCode, `Jogador ${index}`);
    }
    const ninth = await newClient(server);
    const ack = await joinRoom(ninth, created.roomCode, 'Nona');
    expect(ack.ok).toBe(false);
    if (ack.ok) throw new Error('esperava recusa');
    expect(ack.error.code).toBe('ROOM_FULL');
    expect(server.server.rooms.debugRoom(created.roomCode)?.participants.size).toBe(8);
  });

  it('recusa código de sala inexistente com mensagem compreensível', async () => {
    const { server } = await setup();
    const socket = await newClient(server);
    const ack = await joinRoom(socket, 'ZZZZZZ', 'Bia');
    expect(ack.ok).toBe(false);
    if (ack.ok) throw new Error('esperava recusa');
    expect(ack.error.code).toBe('ROOM_NOT_FOUND');
  });
});
