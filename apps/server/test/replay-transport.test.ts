import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, CreateRoomAck, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import { DEFAULT_RETENTION_MS } from '../src/rooms.js';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  record,
  request,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';

describe('replay preserva o ack sem reassociar o transporte', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<NonNullable<typeof active>> {
    const clock = new FakeClock();
    const server = await startTestServer({ testHooks: true, clock });
    const clients: TestClient[] = [];
    active = { clock, server, clients };
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

  function socketOf(socket: TestClient): { rooms: Set<string> } | undefined {
    if (active === null) return undefined;
    return active.server.server.io.sockets.sockets.get(socket.id ?? '') as unknown as { rooms: Set<string> } | undefined;
  }

  it('replay de criação não reassina o transporte após saída e entrada em outra sala', async () => {
    const { server } = await setup();
    const ana = await newClient();
    const creationId = intent();
    const created = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', {
      intentId: creationId,
      nickname: 'Ana',
      avatar: 'raposa',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('criação falhou');
    const bia = await newClient();
    const biaRec = record(bia);
    await joinOrFail(bia, created.roomCode, 'Bia');

    expect((await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    expect(socketOf(ana)?.rooms.has(created.roomCode)).toBe(false);

    const second = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: intent(), nickname: 'Ana', avatar: 'raposa' });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('segunda criação falhou');

    // Replay da criação antiga: ack idêntico, sem voltar a assinar a sala antiga.
    const replay = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', {
      intentId: creationId,
      nickname: 'Ana',
      avatar: 'raposa',
    });
    expect(replay).toEqual(created);
    expect(socketOf(ana)?.rooms.has(created.roomCode)).toBe(false);
    expect(server.server.rooms.participantOf(ana.id ?? '')?.roomCode).toBe(second.roomCode);

    // Eventos posteriores da sala antiga não chegam ao socket revogado.
    const cai = await newClient();
    await joinOrFail(cai, created.roomCode, 'Cai');
    await setReady(bia, true);
    await setReady(cai, true);
    expect((await startRound(bia)).ok).toBe(true);
    const anaRecorder = record(ana);
    const state = latestState(biaRec);
    const room = server.server.rooms.debugRoom(created.roomCode);
    if (room?.round === null || room?.round === undefined) throw new Error('rodada ausente');
    const currentId = room.round.state.seats[room.round.state.currentIndex]?.id;
    const actor = currentId === state.self.playerId ? bia : cai;
    expect((await request<Ack>(actor, 'client:command', { intentId: intent(), roundId: room.round.id, command: { type: 'draw' } })).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(anaRecorder.events.filter((message) => message.roomCode === created.roomCode)).toHaveLength(0);
    expect(anaRecorder.states.filter((message) => message.room.roomCode === created.roomCode)).toHaveLength(0);
  });

  it('replay de entrada após remoção não reassina nem entrega eventos da sala revogada', async () => {
    const { server } = await setup();
    const ana = await newClient();
    const created = await createRoom(ana, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const bia = await newClient();
    const joinId = intent();
    const joined = await request<Ack<JoinRoomAck>>(bia, 'client:joinRoom', {
      intentId: joinId,
      roomCode: created.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) throw new Error('entrada falhou');

    expect((await request<SimpleAck>(ana, 'client:removeParticipant', { intentId: intent(), targetId: joined.playerId })).ok).toBe(true);
    expect(socketOf(bia)?.rooms.has(created.roomCode)).toBe(false);

    const second = await request<Ack<CreateRoomAck>>(bia, 'client:createRoom', { intentId: intent(), nickname: 'Bia', avatar: 'lobo' });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('segunda criação falhou');

    const replay = await request<Ack<JoinRoomAck>>(bia, 'client:joinRoom', {
      intentId: joinId,
      roomCode: created.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
    });
    expect(replay).toEqual(joined);
    expect(socketOf(bia)?.rooms.has(created.roomCode)).toBe(false);
    expect(server.server.rooms.participantOf(bia.id ?? '')?.roomCode).toBe(second.roomCode);

    const cai = await newClient();
    await joinOrFail(cai, created.roomCode, 'Cai');
    await setReady(ana, true);
    await setReady(cai, true);
    expect((await startRound(ana)).ok).toBe(true);
    const biaRecorder = record(bia);
    const room = server.server.rooms.debugRoom(created.roomCode);
    if (room?.round === null || room?.round === undefined) throw new Error('rodada ausente');
    const currentId = room.round.state.seats[room.round.state.currentIndex]?.id;
    const actor = currentId === created.playerId ? ana : cai;
    expect((await request<Ack>(actor, 'client:command', { intentId: intent(), roundId: room.round.id, command: { type: 'draw' } })).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(biaRecorder.events.filter((message) => message.roomCode === created.roomCode)).toHaveLength(0);
  });

  it('replay de criação depois da expiração não ressuscita sala nem vínculo', async () => {
    const { clock, server } = await setup();
    const ana = await newClient();
    const creationId = intent();
    const created = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationId, nickname: 'Ana', avatar: 'raposa' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('criação falhou');
    expect((await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);

    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(created.roomCode) === undefined, 'expiração');

    const replay = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationId, nickname: 'Ana', avatar: 'raposa' });
    expect(replay).toEqual(created);
    expect(server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();
    expect(socketOf(ana)?.rooms.has(created.roomCode)).toBe(false);
    expect(server.server.rooms.participantOf(ana.id ?? '')).toBeUndefined();

    // Entrada nova na sala expirada é recusada.
    const late = await request<Ack<JoinRoomAck>>(ana, 'client:joinRoom', {
      intentId: intent(),
      roomCode: created.roomCode,
      nickname: 'Ana',
      avatar: 'raposa',
      credential: created.credential,
    });
    expect(late.ok).toBe(false);
    if (late.ok) throw new Error('esperava recusa');
    expect(late.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('replay de saída devolve o ack original mesmo sem vínculo e não afeta a nova sala', async () => {
    const { server } = await setup();
    const ana = await newClient();
    const created = await createRoom(ana, 'Ana');
    if (!created.ok) throw new Error('criação falhou');

    const leaveId = intent();
    const first = await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: leaveId });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('saída falhou');

    // Resposta perdida: o replay imediato devolve o mesmo ack sem exigir participante.
    const immediate = await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: leaveId });
    expect(immediate).toEqual(first);

    // Entra em outra sala; o replay antigo não remove a nova identidade.
    const second = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: intent(), nickname: 'Ana', avatar: 'raposa' });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('segunda criação falhou');
    const replay = await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: leaveId });
    expect(replay).toEqual(first);
    expect(server.server.rooms.participantOf(ana.id ?? '')?.roomCode).toBe(second.roomCode);
    expect(server.server.rooms.debugRoom(second.roomCode)?.participants.size).toBe(1);

    // Mesmo id com outra operação no mesmo escopo da conexão continua recusado.
    const conflict = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: leaveId, nickname: 'Ana', avatar: 'raposa' });
    expect(conflict.ok).toBe(false);
    if (conflict.ok) throw new Error('esperava recusa');
    expect(conflict.error.code).toBe('INTENT_REUSED');
    expect(server.server.rooms.debugRoom(second.roomCode)?.participants.size).toBe(1);

    // O registro memorizado é público: sem referências internas da sala.
    const internals = server.server.rooms as unknown as { socketIntents: Map<string, Map<string, { response: unknown }>> };
    const entries = [...(internals.socketIntents.get(ana.id ?? '')?.values() ?? [])];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.response).not.toHaveProperty('room');
      expect(JSON.stringify(entry.response)).not.toContain('"participants"');
    }
  });
});
