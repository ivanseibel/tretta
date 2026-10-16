import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, CreateRoomAck, SimpleAck } from '@tretta/protocol';
import { DEFAULT_RETENTION_MS } from '../src/rooms.js';
import {
  connect,
  FakeClock,
  intent,
  request,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';

describe('expiração libera dados mesmo com sockets vivos', () => {
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

  interface Internals {
    socketIntents: Map<string, Map<string, { response: unknown }>>;
    participantsById: Map<string, unknown>;
    participantsBySocket: Map<string, unknown>;
  }

  function internals(): Internals {
    if (active === null) throw new Error('setup ausente');
    return active.server.server.rooms as unknown as Internals;
  }

  function cachedEntries(socket: TestClient): Array<{ response: unknown }> {
    return [...(internals().socketIntents.get(socket.id ?? '')?.values() ?? [])];
  }

  function expectNoInternalReferences(entries: Array<{ response: unknown }>): void {
    for (const entry of entries) {
      // Tombstone público: apenas os campos do ack original; nada da sala.
      expect(entry.response).not.toHaveProperty('room');
      expect(entry.response).not.toHaveProperty('participants');
      expect(entry.response).not.toHaveProperty('round');
      expect(entry.response).not.toHaveProperty('history');
      expect(entry.response).not.toHaveProperty('random');
      const keys = Object.keys(entry.response as Record<string, unknown>).sort();
      for (const key of keys) {
        expect(['ok', 'version', 'roomCode', 'playerId', 'credential', 'rejoined']).toContain(key);
      }
    }
  }

  it('no limite de 15 minutos com socket vivo, sala, índices e timers são liberados sem referências internas', async () => {
    const { clock, server } = await setup();
    const ana = await newClient();
    const creationId = intent();
    const created = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationId, nickname: 'Ana', avatar: 'raposa' });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('criação falhou');
    const leaveId = intent();
    const left = await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: leaveId });
    expect(left.ok).toBe(true);
    if (!left.ok) throw new Error('saída falhou');

    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(created.roomCode) === undefined, 'expiração no limite');

    expect(ana.connected).toBe(true);
    expect(server.server.rooms.roomCodes).toHaveLength(0);
    expect(internals().participantsById.size).toBe(0);
    expect(internals().participantsBySocket.size).toBe(0);
    expect(clock.pendingTimers()).toBe(0);
    const entries = cachedEntries(ana);
    expect(entries).toHaveLength(2);
    expectNoInternalReferences(entries);

    // Replays devolvem os acks originais sem recriar sala nem restaurar vínculo.
    const creationReplay = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationId, nickname: 'Ana', avatar: 'raposa' });
    expect(creationReplay).toEqual(created);
    const leaveReplay = await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: leaveId });
    expect(leaveReplay).toEqual(left);
    expect(server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();
    expect(server.server.rooms.participantOf(ana.id ?? '')).toBeUndefined();
    const sockets = server.server.io.sockets.sockets.get(ana.id ?? '') as unknown as { rooms: Set<string> } | undefined;
    expect(sockets?.rooms.has(created.roomCode)).toBe(false);
  });

  it('ciclos com salas novas não acumulam objetos internos e preservam registros de outra sala válida', async () => {
    const { clock, server } = await setup();
    const ana = await newClient();

    // Sala A esvazia e expira enquanto a sala B, criada depois, segue ativa.
    const creationA = intent();
    const roomA = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationA, nickname: 'Ana', avatar: 'raposa' });
    if (!roomA.ok) throw new Error('criação A falhou');
    expect((await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    const creationB = intent();
    const roomB = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationB, nickname: 'Ana', avatar: 'raposa' });
    if (!roomB.ok) throw new Error('criação B falhou');
    await request<SimpleAck>(ana, 'client:setReady', { intentId: intent(), ready: true });

    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(roomA.roomCode) === undefined, 'A expirou');
    expect(server.server.rooms.debugRoom(roomB.roomCode)).toBeDefined();

    const entries = cachedEntries(ana);
    expectNoInternalReferences(entries);
    expect(entries.length).toBe(3);
    const replayB = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: creationB, nickname: 'Ana', avatar: 'raposa' });
    expect(replayB).toEqual(roomB);
    expect(server.server.rooms.debugRoom(roomB.roomCode)?.participants.size).toBe(1);

    // Encerra B e roda ciclos de criação/expiração: cada rodada deixa tombstones
    // públicos, nunca objetos internos, e os timers não se acumulam.
    expect((await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(roomB.roomCode) === undefined, 'B expirou');

    for (let cycle = 0; cycle < 3; cycle++) {
      const created = await request<Ack<CreateRoomAck>>(ana, 'client:createRoom', { intentId: intent(), nickname: 'Ana', avatar: 'raposa' });
      if (!created.ok) throw new Error('criação do ciclo falhou');
      expect((await request<SimpleAck>(ana, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
      clock.advance(DEFAULT_RETENTION_MS);
      await waitFor(() => server.server.rooms.debugRoom(created.roomCode) === undefined, 'ciclo expirou');
      expectNoInternalReferences(cachedEntries(ana));
      expect(internals().participantsById.size).toBe(0);
    }
    expect(clock.pendingTimers()).toBe(0);
  });
});
