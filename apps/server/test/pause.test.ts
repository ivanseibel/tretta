import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import { DEFAULT_PAUSE_GRACE_MS } from '../src/rooms.js';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  record,
  request,
  sendCommand,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  substituteAbsent,
  continueRound,
  waitFor,
  type Recorder,
  type TestClient,
} from './helpers.js';
import { scenarioDeck } from './decks.js';

const GRACE = DEFAULT_PAUSE_GRACE_MS;

describe('pausa por ausência e prazo de substituição', () => {
  let active: { clock: FakeClock; server: Awaited<ReturnType<typeof startTestServer>>; clients: TestClient[] } | null = null;

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

  interface Trio {
    host: TestClient;
    guest: TestClient;
    third: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    thirdRec: Recorder;
    roomCode: string;
    roundId: string;
    hostId: string;
    guestId: string;
    thirdId: string;
    guestCredential: string;
    thirdCredential: string;
  }

  async function makePlaying(playerCount: 2 | 3): Promise<Trio> {
    if (active === null) throw new Error('setup ausente');
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    let third: TestClient = guest;
    let thirdRec: Recorder = guestRec;
    let thirdCredential = joined.credential;
    if (playerCount === 3) {
      third = await newClient();
      thirdRec = record(third);
      const thirdJoined = await joinOrFail(third, created.roomCode, 'Cai');
      if (!thirdJoined.ok) throw new Error('entrada falhou');
      thirdCredential = thirdJoined.credential;
    }
    if (playerCount === 2) {
      await setNextDeck(host, created.roomCode, scenarioDeck());
    }
    await setReady(host, true);
    await setReady(guest, true);
    if (playerCount === 3) await setReady(third, true);
    const started = await startRound(host);
    expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada em andamento');
    return {
      host,
      guest,
      third,
      hostRec,
      guestRec,
      thirdRec,
      roomCode: created.roomCode,
      roundId: latestState(hostRec).room.roundId ?? '',
      hostId: latestState(hostRec).self.playerId,
      guestId: latestState(guestRec).self.playerId,
      thirdId: playerCount === 3 ? latestState(thirdRec).self.playerId : '',
      guestCredential: joined.credential,
      thirdCredential,
    };
  }

  async function rejoinAs(client: TestClient, trio: Trio, credential: string, nickname: string): Promise<void> {
    const ack = await request<Ack<JoinRoomAck>>(client, 'client:joinRoom', {
      intentId: intent(),
      roomCode: trio.roomCode,
      nickname,
      avatar: 'lobo',
      credential,
    });
    expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
  }

  it('desconexão fora da vez pausa, recusa comandos e o retorno dentro do prazo retoma o estado', async () => {
    const { clock } = await setup();
    const trio = await makePlaying(2);

    // Garante que a vez é de Ana para que a queda de Bia seja fora da vez.
    if (latestState(trio.hostRec).self.view?.currentPlayerId !== trio.hostId) {
      expect((await sendCommand(trio.guest, trio.roundId, { type: 'draw' })).ok).toBe(true);
      expect((await sendCommand(trio.guest, trio.roundId, { type: 'pass' })).ok).toBe(true);
      await waitFor(() => latestState(trio.hostRec).self.view?.currentPlayerId === trio.hostId, 'vez de Ana');
    }
    const before = latestState(trio.hostRec).self.view;
    if (before === null) throw new Error('projeção ausente');

    const absentAt = clock.now();
    trio.guest.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'pausa');
    const paused = latestState(trio.hostRec);
    expect(paused.room.pause?.absent).toEqual([
      { playerId: trio.guestId, absentSince: absentAt, eligibleAt: absentAt + GRACE, eligible: false },
    ]);
    expect(paused.room.pause?.retention).toBe(false);

    // Enquanto pausada, o motor não muda por comando de ninguém.
    const versionPaused = paused.room.version;
    const refusedDraw = await sendCommand(trio.host, trio.roundId, { type: 'draw' });
    expect(refusedDraw.ok).toBe(false);
    if (refusedDraw.ok) throw new Error('esperava recusa');
    expect(refusedDraw.error.code).toBe('ROUND_PAUSED');
    const refusedAnnounce = await sendCommand(trio.host, trio.roundId, { type: 'announceLastCard' });
    expect(refusedAnnounce.ok).toBe(false);
    expect(latestState(trio.hostRec).room.version).toBe(versionPaused);
    expect(latestState(trio.hostRec).self.view?.currentPlayerId).toBe(before.currentPlayerId);
    expect(latestState(trio.hostRec).self.view?.discardTop.id).toBe(before.discardTop.id);

    // Retorno antes dos 90 segundos retoma preservado.
    clock.advance(30_000);
    const back = await newClient();
    const backRec = record(back);
    await rejoinAs(back, trio, trio.guestCredential, 'Bia');
    await waitFor(() => latestState(trio.hostRec).room.status === 'playing', 'retoma');
    expect(latestState(backRec).self.view?.hand).toHaveLength(7);
    expect(latestState(trio.hostRec).room.pause).toBeNull();
  });

  it('substituição fica elegível no limite dos 90 segundos e depois, e não é automática no timeout', async () => {
    const { clock } = await setup();
    const trio = await makePlaying(2);

    trio.guest.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'pausa');

    clock.advance(GRACE - 1);
    const tooEarly = await substituteAbsent(trio.host, trio.guestId);
    expect(tooEarly.ok).toBe(false);
    if (tooEarly.ok) throw new Error('esperava recusa');
    expect(tooEarly.error.code).toBe('SUBSTITUTE_TOO_EARLY');

    // O timeout sozinho não substitui nem retoma: a rodada segue pausada.
    clock.advance(300_000);
    const stillPaused = latestState(trio.hostRec);
    expect(stillPaused.room.status).toBe('paused');
    const room = active?.server.server.rooms.debugRoom(trio.roomCode);
    expect(room?.participants.get(trio.guestId)?.autoControlled).toBe(false);
    const refused = await sendCommand(trio.host, trio.roundId, { type: 'draw' });
    expect(refused.ok).toBe(false);

    // Retorno depois do prazo, sem decisão do anfitrião, ainda recupera a mão.
    const back = await newClient();
    await rejoinAs(back, trio, trio.guestCredential, 'Bia');
    await waitFor(() => latestState(trio.hostRec).room.status === 'playing', 'retoma após prazo');
    expect(room?.participants.get(trio.guestId)?.connected).toBe(true);
  });

  it('no limite exato dos 90 segundos a substituição é aceita e o retorno devolve o controle', async () => {
    const { clock } = await setup();
    const trio = await makePlaying(2);

    const absentAt = clock.now();
    trio.guest.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'pausa');

    clock.advance(GRACE - 1);
    expect((await substituteAbsent(trio.host, trio.guestId)).ok).toBe(false);
    clock.advance(1);
    // O estado emitido na pausa informa o instante de elegibilidade; no limite exato a
    // substituição é aceita pelo servidor.
    const paused = latestState(trio.hostRec);
    expect(paused.room.pause?.absent[0]?.eligibleAt).toBe(absentAt + GRACE);
    const substituted = await substituteAbsent(trio.host, trio.guestId);
    expect(substituted.ok, substituted.ok ? '' : substituted.error.message).toBe(true);
    await waitFor(() => latestState(trio.hostRec).room.status === 'playing', 'retoma com substituto');
    expect(
      latestState(trio.hostRec).room.participants.find((p) => p.id === trio.guestId)?.autoControlled,
    ).toBe(true);

    // O retorno cancela o substituto e devolve a mesma vaga ao humano.
    const back = await newClient();
    await rejoinAs(back, trio, trio.guestCredential, 'Bia');
    await waitFor(
      () => latestState(trio.hostRec).room.participants.find((p) => p.id === trio.guestId)?.autoControlled === false,
      'controle devolvido',
    );
    expect(latestState(trio.hostRec).room.status).toBe('playing');

    // Nova ausência inicia novo prazo a partir de agora.
    const secondAbsence = clock.now();
    back.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'nova pausa');
    clock.advance(GRACE - 1);
    expect((await substituteAbsent(trio.host, trio.guestId)).ok).toBe(false);
    clock.advance(1);
    const second = latestState(trio.hostRec).room.pause?.absent[0];
    expect(second?.absentSince).toBe(secondAbsence);
    expect((await substituteAbsent(trio.host, trio.guestId)).ok).toBe(true);
  });

  it('múltiplas ausências têm prazos independentes e o retorno não resolve a pausa da outra', async () => {
    const { clock } = await setup();
    const trio = await makePlaying(3);

    trio.guest.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'pausa de Bia');
    clock.advance(GRACE);
    trio.third.disconnect();
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'pausa de Cai');

    // Continuar substitui somente a ausência elegível; a outra causa mantém a pausa.
    const continued = await continueRound(trio.host);
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => latestState(trio.hostRec).room.status === 'paused', 'continua pausada por Cai');
    const room = active?.server.server.rooms.debugRoom(trio.roomCode);
    expect(room?.participants.get(trio.guestId)?.autoControlled).toBe(true);
    expect(room?.participants.get(trio.thirdId)?.autoControlled).toBe(false);
    const tooEarly = await substituteAbsent(trio.host, trio.thirdId);
    expect(tooEarly.ok).toBe(false);
    if (tooEarly.ok) throw new Error('esperava recusa');
    expect(tooEarly.error.code).toBe('SUBSTITUTE_TOO_EARLY');

    // O retorno de Bia (substituída) devolve o controle dela, mas Cai segue ausente.
    const back = await newClient();
    await rejoinAs(back, trio, trio.guestCredential, 'Bia');
    await waitFor(
      () => latestState(trio.hostRec).room.participants.find((p) => p.id === trio.guestId)?.autoControlled === false,
      'controle de Bia',
    );
    expect(latestState(trio.hostRec).room.status).toBe('paused');
    expect(latestState(trio.hostRec).room.pause?.absent.map((absent) => absent.playerId)).toEqual([trio.thirdId]);

    clock.advance(GRACE);
    const substituteThird = await substituteAbsent(trio.host, trio.thirdId);
    expect(substituteThird.ok, substituteThird.ok ? '' : substituteThird.error.message).toBe(true);
    await waitFor(() => latestState(trio.hostRec).room.status === 'playing', 'todas as causas resolvidas');
    expect(latestState(trio.hostRec).room.pause).toBeNull();
  });
});
