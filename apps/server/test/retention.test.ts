import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import { DEFAULT_BOT_DELAY_MS, DEFAULT_RETENTION_MS, type RoomStore } from '../src/rooms.js';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  joinRoom,
  latestState,
  leaveRoom,
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

describe('retenção de 15 minutos e expiração', () => {
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

  async function makePlaying(): Promise<Pair> {
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await setNextDeck(host, created.roomCode, scenarioDeck());
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

  function roomStore(): RoomStore {
    if (active === null) throw new Error('setup ausente');
    return active.server.server.rooms;
  }

  it('ausência total congela a rodada e os substitutos; o primeiro retornante vira anfitrião e encontra a pausa', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();

    // Bia sai (substituto imediato); Ana cai: ninguém conectado.
    expect((await leaveRoom(pair.guest)).ok).toBe(true);
    const absentAt = clock.now();
    pair.host.disconnect();
    await waitFor(() => roomStore().debugRoom(pair.roomCode)?.status === 'paused', 'congelamento');
    const room = roomStore().debugRoom(pair.roomCode);
    expect(room?.retentionHold).toBe(true);
    expect(room?.retainedUntil).toBe(absentAt + DEFAULT_RETENTION_MS);

    // Bots parados: o relógio passa e nada muda.
    const versionFrozen = room?.version ?? -1;
    clock.advance(DEFAULT_BOT_DELAY_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(roomStore().debugRoom(pair.roomCode)?.version).toBe(versionFrozen);

    // Retorno ainda dentro da retenção: vira anfitrião e encontra a rodada pausada.
    clock.advance(DEFAULT_RETENTION_MS - DEFAULT_BOT_DELAY_MS * 4 - 1);
    const biaBack = await newClient();
    const biaBackRec = record(biaBack);
    const rejoined = await request<Ack<JoinRoomAck>>(biaBack, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: pair.guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    await waitFor(() => latestState(biaBackRec).room.roomCode === pair.roomCode, 'estado da retenção');
    const during = latestState(biaBackRec);
    expect(during.room.status).toBe('paused');
    expect(during.room.hostId).toBe(pair.guestId);
    expect(during.room.pause?.retention).toBe(true);
    expect(during.room.pause?.absent.map((absent) => absent.playerId)).toEqual([pair.hostId]);
    expect(during.room.retainedUntil).toBeNull();

    // No limite exato do prazo de Ana, continuar substitui a ausência elegível e a rodada retoma.
    clock.advance(1);
    const continued = await request<Ack>(biaBack, 'client:continueRound', { intentId: intent() });
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => latestState(biaBackRec).room.status === 'playing', 'retomada');
    expect(roomStore().debugRoom(pair.roomCode)?.participants.get(pair.hostId)?.autoControlled).toBe(true);

    // Com Ana substituta, a rodada avança sozinha quando a vez chega.
    for (let guard = 0; guard < 30; guard++) {
      const state = latestState(biaBackRec);
      if (state.room.status !== 'playing') break;
      const current = state.self.view?.currentPlayerId;
      if (current === pair.guestId) {
        const draw = await sendCommand(biaBack, pair.roundId, { type: 'draw' });
        expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
        const pass = await sendCommand(biaBack, pair.roundId, { type: 'pass' });
        expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
      } else {
        const version = state.room.version;
        clock.advance(DEFAULT_BOT_DELAY_MS);
        await waitFor(() => latestState(biaBackRec).room.version > version, 'substituto de Ana');
      }
    }
    const botEvents = biaBackRec.events
      .flatMap((message) => message.events)
      .filter(
        (event) =>
          (event.type === 'played' || event.type === 'drew' || event.type === 'passed') && event.playerId === pair.hostId,
      );
    expect(botEvents.length).toBeGreaterThan(0);
  });

  it('retorno cancela a expiração antiga, nova ausência total começa novo período e a sala expira no limite', async () => {
    const { clock } = await setup();
    const host = await newClient();
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');

    host.disconnect();
    const firstAbsence = clock.now();
    guest.disconnect();
    await waitFor(() => roomStore().debugRoom(created.roomCode)?.retainedUntil !== null, 'retenção');
    expect(roomStore().debugRoom(created.roomCode)?.retainedUntil).toBe(firstAbsence + DEFAULT_RETENTION_MS);

    // Bia volta no meio do período: a expiração antiga é cancelada.
    clock.advance(600_000);
    const biaBack = await newClient();
    const biaBackRec = record(biaBack);
    const rejoined = await request<Ack<JoinRoomAck>>(biaBack, 'client:joinRoom', {
      intentId: intent(),
      roomCode: created.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: joined.credential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    await waitFor(() => roomStore().debugRoom(created.roomCode)?.retainedUntil === null, 'expiração cancelada');
    expect(latestState(biaBackRec).room.hostId).toBe(joined.playerId);

    // Mesmo depois do prazo antigo, a sala recuperada continua de pé.
    clock.advance(600_000);
    expect(roomStore().debugRoom(created.roomCode)).toBeDefined();

    // Nova ausência total inicia um período novo.
    const secondAbsence = clock.now();
    biaBack.disconnect();
    await waitFor(() => roomStore().debugRoom(created.roomCode)?.retainedUntil !== null, 'nova retenção');
    expect(roomStore().debugRoom(created.roomCode)?.retainedUntil).toBe(secondAbsence + DEFAULT_RETENTION_MS);

    // No limite exato dos 15 minutos a sala expira e libera índices.
    clock.advance(DEFAULT_RETENTION_MS - 1);
    expect(roomStore().debugRoom(created.roomCode)).toBeDefined();
    clock.advance(1);
    await waitFor(() => roomStore().debugRoom(created.roomCode) === undefined, 'expiração no limite');
    expect(roomStore().roomCodes).toHaveLength(0);

    const internals = roomStore() as unknown as {
      participantsById: Map<string, unknown>;
      participantsBySocket: Map<string, unknown>;
    };
    expect(internals.participantsById.size).toBe(0);
    expect(internals.participantsBySocket.size).toBe(0);

    // Credencial de sala expirada é recusada.
    const late = await newClient();
    const lateJoin = await joinRoom(late, created.roomCode, 'Bia', 'lobo', joined.credential);
    expect(lateJoin.ok).toBe(false);
    if (lateJoin.ok) throw new Error('esperava recusa');
    expect(lateJoin.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('todos saem voluntariamente: congelamento, bots parados e expiração', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();

    expect((await leaveRoom(pair.guest)).ok).toBe(true);
    expect((await leaveRoom(pair.host)).ok).toBe(true);
    await waitFor(() => roomStore().debugRoom(pair.roomCode)?.retainedUntil !== null, 'retenção');
    const room = roomStore().debugRoom(pair.roomCode);
    expect(room?.status).toBe('paused');
    expect(room?.participants.get(pair.hostId)?.autoControlled).toBe(true);
    expect(room?.participants.get(pair.guestId)?.autoControlled).toBe(true);

    const versionFrozen = room?.version ?? -1;
    clock.advance(DEFAULT_BOT_DELAY_MS * 6);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(roomStore().debugRoom(pair.roomCode)?.version).toBe(versionFrozen);

    clock.advance(DEFAULT_RETENTION_MS - DEFAULT_BOT_DELAY_MS * 6);
    await waitFor(() => roomStore().debugRoom(pair.roomCode) === undefined, 'expiração com todos fora');
  });
});
