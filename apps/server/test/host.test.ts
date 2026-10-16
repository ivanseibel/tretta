import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
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
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';

describe('transferência de anfitrião', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<NonNullable<typeof active>> {
    const clock = new FakeClock();
    const server = await startTestServer({ clock });
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

  interface Member {
    socket: TestClient;
    rec: Recorder;
    id: string;
    credential: string;
  }

  async function createHost(nickname = 'Ana'): Promise<{ roomCode: string } & Member> {
    const socket = await newClient();
    const rec = record(socket);
    const created = await createRoom(socket, nickname);
    if (!created.ok) throw new Error('criação falhou');
    const id = latestState(rec).self.playerId;
    return { roomCode: created.roomCode, socket, rec, id, credential: created.credential };
  }

  async function join(roomCode: string, nickname: string): Promise<Member> {
    const socket = await newClient();
    const rec = record(socket);
    const joined = await joinOrFail(socket, roomCode, nickname);
    if (!joined.ok) throw new Error('entrada falhou');
    return { socket, rec, id: joined.playerId, credential: joined.credential };
  }

  async function reconnect(member: Member, roomCode: string, nickname: string): Promise<Member> {
    if (active === null) throw new Error('setup ausente');
    const socket = await connect(active.server.url);
    active.clients.push(socket);
    // Registra antes do join: o estado da reentrada chega junto do ack.
    const rec = record(socket);
    const ack = await request<Ack<JoinRoomAck>>(socket, 'client:joinRoom', {
      intentId: intent(),
      roomCode,
      nickname,
      avatar: 'lobo',
      credential: member.credential,
    });
    expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
    if (!ack.ok) throw new Error('reentrada falhou');
    expect(ack.playerId).toBe(member.id);
    return { ...member, socket, rec };
  }

  function hostIdOf(roomCode: string): string | undefined {
    return active?.server.server.rooms.debugRoom(roomCode)?.hostId;
  }

  it('transfere para quem está conectado há mais tempo e não reverte com o retorno do anterior', async () => {
    const { clock } = await setup();
    const ana = await createHost('Ana');
    clock.advance(1_000);
    const bia = await join(ana.roomCode, 'Bia');
    clock.advance(1_000);
    const cai = await join(ana.roomCode, 'Cai');
    expect(hostIdOf(ana.roomCode)).toBe(ana.id);

    ana.socket.disconnect();
    await waitFor(() => hostIdOf(ana.roomCode) === bia.id, 'Bia assume');
    bia.socket.disconnect();
    await waitFor(() => hostIdOf(ana.roomCode) === cai.id, 'Cai assume');

    // O retorno do anfitrião anterior não desfaz a transferência.
    const anaBack = await reconnect(ana, ana.roomCode, 'Ana');
    expect(hostIdOf(ana.roomCode)).toBe(cai.id);
    expect(latestState(anaBack.rec).room.hostId).toBe(cai.id);

    // Reentrada perde antiguidade: Bia volta depois de Cai e continua atrás dela.
    clock.advance(1_000);
    const biaBack = await reconnect(bia, ana.roomCode, 'Bia');
    expect(hostIdOf(ana.roomCode)).toBe(cai.id);
    expect(latestState(biaBack.rec).room.participants.filter((p) => p.isHost).map((p) => p.nickname)).toEqual(['Cai']);

    // Com a saída de Cai, a conexão contínua mais antiga (Ana) assume, não a reentrada recente.
    cai.socket.disconnect();
    await waitFor(() => hostIdOf(ana.roomCode) === ana.id, 'Ana reassume');
  });

  it('empate de tempo conectado usa a ordem estável de entrada', async () => {
    await setup();
    const ana = await createHost('Ana');
    const bia = await join(ana.roomCode, 'Bia');
    const cai = await join(ana.roomCode, 'Cai');

    ana.socket.disconnect();
    await waitFor(() => hostIdOf(ana.roomCode) === bia.id, 'Bia por ordem de entrada');
    bia.socket.disconnect();
    await waitFor(() => hostIdOf(ana.roomCode) === cai.id, 'Cai em seguida');
  });

  it('quem não é o anfitrião atual não exerce controles e repetição de quedas não transfere', async () => {
    const { clock } = await setup();
    const ana = await createHost('Ana');
    const bia = await join(ana.roomCode, 'Bia');

    // Repetição de queda/reentrada de quem não é anfitrião não muda o papel.
    for (let attempt = 0; attempt < 2; attempt++) {
      bia.socket.disconnect();
      await waitFor(() => active?.server.server.rooms.debugRoom(ana.roomCode)?.participants.get(bia.id)?.connected === false, 'queda');
      expect(hostIdOf(ana.roomCode)).toBe(ana.id);
      clock.advance(1_000);
      const again = await reconnect(bia, ana.roomCode, 'Bia');
      bia.socket = again.socket;
    }
    expect(hostIdOf(ana.roomCode)).toBe(ana.id);

    // Controles do anfitrião são recusados para Bia.
    const start = await startRound(bia.socket);
    expect(start.ok).toBe(false);
    if (start.ok) throw new Error('esperava recusa');
    expect(start.error.code).toBe('NOT_HOST');

    await setReady(ana.socket, true);
    await setReady(bia.socket, true);
    expect((await startRound(ana.socket)).ok).toBe(true);

    const endAttempt = await request<Ack>(bia.socket, 'client:endRoundWithoutWinner', { intentId: intent() });
    expect(endAttempt.ok).toBe(false);
    if (endAttempt.ok) throw new Error('esperava recusa');
    expect(endAttempt.error.code).toBe('NOT_HOST');
  });
});
