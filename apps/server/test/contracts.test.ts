import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, CommandAck, SimpleAck } from '@tretta/protocol';
import {
  connect,
  createRoom,
  intent,
  joinOrFail,
  latestState,
  record,
  request,
  sendCommand,
  setReady,
  startRound,
  startTestServer,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';

describe('contratos e autorização', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(options: { testHooks?: boolean } = {}): Promise<{ server: TestServer; clients: TestClient[] }> {
    const server = await startTestServer(options);
    const clients: TestClient[] = [];
    active = { server, clients };
    return active;
  }

  async function newClient(server: TestServer): Promise<TestClient> {
    const socket = await connect(server.url);
    active?.clients.push(socket);
    return socket;
  }

  interface PlayingRoom {
    host: TestClient;
    guest: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    roundId: string;
    roomCode: string;
  }

  async function makePlayingRoom(server: TestServer): Promise<PlayingRoom> {
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
    if (!started.ok) throw new Error('início falhou');
    const state = latestState(hostRec);
    const roundId = state.room.roundId;
    if (roundId === null) throw new Error('rodada ausente');
    return { host, guest, hostRec, guestRec, roundId, roomCode: created.roomCode };
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  it('recusa payloads malformados sem derrubar o servidor nem alterar estado', async () => {
    const { server } = await setup();
    const socket = await newClient(server);
    const rec = record(socket);
    const created = await createRoom(socket, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const versionBefore = latestState(rec).room.version;

    const malformed: unknown[] = [null, 'texto', 42, [], {}, { nickname: 'Ana' }];
    for (const payload of malformed) {
      const ack = await request<Ack>(socket, 'client:setReady', payload);
      expect(ack.ok).toBe(false);
      if (ack.ok) throw new Error('esperava recusa');
      expect(ack.error.code).toBe('INVALID_PAYLOAD');
    }

    const extraField = await request<Ack>(socket, 'client:setReady', {
      intentId: intent(),
      ready: true,
      roomCode: created.roomCode,
    });
    expect(extraField.ok).toBe(false);

    const stateAfter = latestState(rec);
    expect(stateAfter.room.version).toBe(versionBefore);
    expect(stateAfter.self.ready).toBe(false);
    expect(stateAfter.room.participants).toHaveLength(1);
  });

  it('recusa identidade alheia enviada no payload do comando', async () => {
    const { server } = await setup();
    const { guest, hostRec, roundId } = await makePlayingRoom(server);
    const hostId = latestState(hostRec).self.playerId;

    const spoof = await request<CommandAck>(guest, 'client:command', {
      intentId: intent(),
      roundId,
      command: { type: 'draw', playerId: hostId },
    });
    expect(spoof.ok).toBe(false);
    if (spoof.ok) throw new Error('esperava recusa');
    expect(spoof.error.code).toBe('INVALID_PAYLOAD');
  });

  it('recusa comando fora da sala, com rodada antiga e de participante em espera', async () => {
    const { server } = await setup();
    const { host, roundId, roomCode } = await makePlayingRoom(server);

    const outsider = await newClient(server);
    const outsideAck = await sendCommand(outsider, roundId, { type: 'draw' });
    expect(outsideAck.ok).toBe(false);
    if (outsideAck.ok) throw new Error('esperava recusa');
    expect(outsideAck.error.code).toBe('NOT_IN_ROOM');

    const stale = await sendCommand(host, 'r_inexistente', { type: 'draw' });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('esperava recusa');
    expect(stale.error.code).toBe('STALE_ROUND');

    const latecomer = await newClient(server);
    const lateRec = record(latecomer);
    await joinOrFail(latecomer, roomCode, 'Cai');
    const waiting = await sendCommand(latecomer, roundId, { type: 'draw' });
    expect(waiting.ok).toBe(false);
    if (waiting.ok) throw new Error('esperava recusa');
    expect(waiting.error.code).toBe('WAITING_FOR_NEXT_ROUND');
    expect(latestState(lateRec).self.view).toBeNull();
  });

  it('recusa credencial inválida e não permite assumir identidade sem credencial', async () => {
    const { server } = await setup();
    const { guestRec, roomCode } = await makePlayingRoom(server);
    const playerId = latestState(guestRec).self.playerId;

    const wrong = await newClient(server);
    const wrongAck = await request<Ack>(wrong, 'client:joinRoom', {
      intentId: intent(),
      roomCode,
      nickname: 'Falsa',
      avatar: 'lobo',
      credential: 'credencial-invalida-mas-com-tamanho',
    });
    expect(wrongAck.ok).toBe(false);
    if (wrongAck.ok) throw new Error('esperava recusa');
    expect(wrongAck.error.code).toBe('CREDENTIAL_INVALID');

    const other = await newClient(server);
    const otherRec = record(other);
    await joinOrFail(other, roomCode, 'Outra');
    const otherId = latestState(otherRec).self.playerId;
    expect(otherId).not.toBe(playerId);
    expect(latestState(guestRec).room.participants.filter((p) => p.id === playerId)).toHaveLength(1);
  });

  it('não altera estado nem vaza informação nas recusas', async () => {
    const { server } = await setup();
    const { host, hostRec, guestRec, roundId } = await makePlayingRoom(server);
    const versionBefore = latestState(hostRec).room.version;

    const stale = await sendCommand(host, 'r_antiga', { type: 'draw' });
    expect(stale.ok).toBe(false);
    const badCard = await sendCommand(host, roundId, { type: 'play', cardId: 'blue-9-2' });
    expect(badCard.ok).toBe(false);
    expect(latestState(hostRec).room.version).toBe(versionBefore);

    const ownHand = new Set(latestState(guestRec).self.view?.hand.map((card) => card.id));
    const otherHand = latestState(hostRec).self.view?.hand.map((card) => card.id) ?? [];
    const guestTranscript = JSON.stringify(guestRec.packets);
    for (const id of otherHand) {
      if (!ownHand.has(id)) expect(guestTranscript).not.toContain(`"${id}"`);
    }
  });

  it('mantém o servidor operante após uma rajada de recusas', async () => {
    const { server } = await setup();
    const { host, roundId } = await makePlayingRoom(server);
    for (let index = 0; index < 10; index++) {
      const ack = await request<SimpleAck>(host, 'client:command', { lixo: index });
      expect(ack.ok).toBe(false);
    }
    const stillWorks = await sendCommand(host, roundId, { type: 'draw' });
    if (!stillWorks.ok) {
      expect(stillWorks.error.code).toBe('NOT_YOUR_TURN');
    }
    expect(server.server.port()).not.toBeNull();
  });
});
