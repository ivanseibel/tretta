import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import { DEFAULT_BOT_DELAY_MS, DEFAULT_RETENTION_MS, type Room } from '../src/rooms.js';
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
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { scenarioDeck } from './decks.js';

describe('invalidação do agendamento do bot', () => {
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
    expect((await startRound(host)).ok).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
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

  function roomOf(pair: Pair): Room {
    if (active === null) throw new Error('setup ausente');
    const room = active.server.server.rooms.debugRoom(pair.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    return room;
  }

  function currentSeatId(pair: Pair): string | undefined {
    const room = roomOf(pair);
    if (room.round === null) return undefined;
    return room.round.state.seats[room.round.state.currentIndex]?.id;
  }

  /** Ana sai; se a vez for de Bia, Bia compra e passa até a vez do substituto. */
  async function leaveHostAndReachItsTurn(pair: Pair): Promise<void> {
    expect((await request<SimpleAck>(pair.host, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    if (currentSeatId(pair) === pair.guestId) {
      const draw = await sendCommand(pair.guest, pair.roundId, { type: 'draw' });
      expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
      const pass = await sendCommand(pair.guest, pair.roundId, { type: 'pass' });
      expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
    }
    await waitFor(() => currentSeatId(pair) === pair.hostId, 'vez do substituto de Ana');
  }

  async function rejoinAs(pair: Pair, who: 'host' | 'guest'): Promise<TestClient> {
    const back = await newClient();
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: who === 'host' ? 'Ana' : 'Bia',
      avatar: who === 'host' ? 'raposa' : 'lobo',
      credential: who === 'host' ? pair.hostCredential : pair.guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    return back;
  }

  it('callback cancelado após retorno e nova saída não altera nada e o timer atual segue válido', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);

    const room = roomOf(pair);
    const oldHandle = room.botTimer;
    if (oldHandle === null) throw new Error('timer do bot ausente');
    const oldGeneration = room.botGeneration;

    // Retorno humano cancela o agendamento antigo; nova saída agenda outro.
    const back = await rejoinAs(pair, 'host');
    expect(room.botTimer).toBeNull();
    expect((await request<SimpleAck>(back, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    const newHandle = room.botTimer;
    expect(newHandle).not.toBeNull();
    expect(newHandle).not.toBe(oldHandle);
    expect(room.botGeneration).not.toBe(oldGeneration);

    const versionBefore = room.version;
    const handBefore = room.round?.state.seats.find((seat) => seat.id === pair.hostId)?.hand.length ?? -1;
    const eventsBefore = pair.guestRec.events.length;

    // Callback antigo já entregue à fila, sem avançar o relógio: nada muda e o
    // timer atual continua identificado.
    expect(clock.deliver(oldHandle)).toBe(true);
    expect(room.version).toBe(versionBefore);
    expect(room.round?.state.seats.find((seat) => seat.id === pair.hostId)?.hand.length).toBe(handBefore);
    expect(room.botTimer).toBe(newHandle);
    expect(pair.guestRec.events.length).toBe(eventsBefore);

    // Entregar o timer atual no prazo produz exatamente uma ação válida.
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionBefore, 'ação do substituto');
    await waitFor(
      () => pair.guestRec.events.flatMap((message) => message.events).some((event) => event.type === 'played'),
      'evento do substituto',
    );
    expect(room.version).toBe(versionBefore + 1);
    expect(room.round?.state.seats.find((seat) => seat.id === pair.hostId)?.hand.length).toBe(handBefore - 1);
    const botEvents = pair.guestRec.events.flatMap((message) => message.events);
    expect(botEvents.filter((event) => event.type === 'played')).toHaveLength(1);
    expect(room.botTimer).toBeNull();
  });

  it('callback antigo não age durante pausa e a retomada volta a permitir o substituto', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);
    const oldHandle = room.botTimer;
    if (oldHandle === null) throw new Error('timer do bot ausente');

    // Bia cai: pausa cancela o agendamento; o callback antigo não altera o motor.
    pair.guest.disconnect();
    await waitFor(() => room.status === 'paused', 'pausa');
    const versionPaused = room.version;
    expect(clock.deliver(oldHandle)).toBe(true);
    expect(room.version).toBe(versionPaused);
    expect(room.status).toBe('paused');

    // Retomada por Bia: a sala ficou sem ninguém, então ela retoma explicitamente;
    // o substituto de Ana volta a agir no prazo.
    const back = await rejoinAs(pair, 'guest');
    expect(room.retentionHold).toBe(true);
    expect((await request<SimpleAck>(back, 'client:continueRound', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => room.status === 'playing', 'retomada');
    const versionResumed = room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionResumed, 'ação após retomada');
    expect(room.version).toBe(versionResumed + 1);
  });

  it('callback antigo não age após encerramento nem na rodada seguinte', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);
    const oldHandle = room.botTimer;
    if (oldHandle === null) throw new Error('timer do bot ausente');

    // Bia (anfitriã após a saída de Ana) encerra sem vencedor; Ana é retirada.
    expect((await request<SimpleAck>(pair.guest, 'client:endRoundWithoutWinner', { intentId: intent() })).ok).toBe(true);
    const versionFinished = room.version;
    expect(clock.deliver(oldHandle)).toBe(true);
    expect(room.version).toBe(versionFinished);
    expect(room.status).toBe('finished');

    // Rodada nova sem controle automático: callback antigo e relógio não mudam nada.
    const cai = await newClient();
    await joinOrFail(cai, pair.roomCode, 'Cai');
    expect((await request<SimpleAck>(pair.guest, 'client:returnToLobby', { intentId: intent() })).ok).toBe(true);
    expect((await setReady(pair.guest, true)).ok).toBe(true);
    expect((await setReady(cai, true)).ok).toBe(true);
    expect((await startRound(pair.guest)).ok).toBe(true);
    const versionRoundTwo = room.version;
    expect(clock.deliver(oldHandle)).toBe(true);
    clock.advance(DEFAULT_BOT_DELAY_MS * 2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(room.version).toBe(versionRoundTwo);
    expect(room.status).toBe('playing');
  });

  it('callback antigo não age depois da expiração da sala', async () => {
    const { clock, server } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);
    const oldHandle = room.botTimer;
    if (oldHandle === null) throw new Error('timer do bot ausente');

    // Bia cai: ninguém conectado; retenção e expiração no limite.
    pair.guest.disconnect();
    await waitFor(() => room.retainedUntil !== null, 'retenção');
    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(pair.roomCode) === undefined, 'expiração');
    expect(clock.deliver(oldHandle)).toBe(true);
    expect(clock.pendingTimers()).toBe(0);
  });
});
