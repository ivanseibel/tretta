import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
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
import { buildDeck, scenarioDeck } from './decks.js';

function poolOf(room: Room): { total: number; unique: number } {
  const round = room.round;
  if (round === null) return { total: 0, unique: 0 };
  const cards = [
    ...round.state.seats.flatMap((seat) => seat.hand),
    ...round.state.drawPile,
    ...round.state.discardPile,
  ];
  return { total: cards.length, unique: new Set(cards.map((card) => card.id)).size };
}

describe('continuidade do bot após entrada nova', () => {
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

  async function makePlaying(deck: string[] = scenarioDeck()): Promise<Pair> {
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await setNextDeck(host, created.roomCode, deck);
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

  function handSize(pair: Pair): number {
    return roomOf(pair).round?.state.seats.find((seat) => seat.id === pair.hostId)?.hand.length ?? -1;
  }

  /** Ana sai; se a vez for de Bia, Bia compra e passa até a vez do substituto de Ana. */
  async function leaveHostAndReachItsTurn(pair: Pair): Promise<void> {
    expect((await request<Ack>(pair.host, 'client:leaveRoom', { intentId: intent() })).ok).toBe(true);
    if (currentSeatId(pair) === pair.guestId) {
      const draw = await sendCommand(pair.guest, pair.roundId, { type: 'draw' });
      expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
      const pass = await sendCommand(pair.guest, pair.roundId, { type: 'pass' });
      expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
    }
    await waitFor(() => currentSeatId(pair) === pair.hostId, 'vez do substituto de Ana');
  }

  it('entrada nova antes do timer não para o substituto: exatamente uma ação no prazo', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);

    const oldHandle = room.botTimer;
    if (oldHandle === null) throw new Error('timer do bot ausente');
    const versionBeforeJoin = room.version;
    const handBefore = handSize(pair);

    // Cai entra sem credencial: aguarda a próxima rodada, sem assento nem mão.
    const cai = await newClient();
    const caiRec = record(cai);
    const joined = await joinOrFail(cai, pair.roomCode, 'Cai');
    if (!joined.ok) throw new Error('entrada falhou');
    await waitFor(() => latestState(caiRec).room.roomCode === pair.roomCode, 'estado de Cai');
    expect(room.round?.seatIds.includes(joined.playerId)).toBe(false);
    expect(latestState(caiRec).self.view).toBeNull();
    expect(room.version).toBe(versionBeforeJoin + 1);

    // O agendamento foi refeito: timer novo, pendente no relógio.
    const newHandle = room.botTimer;
    expect(newHandle).not.toBeNull();
    expect(newHandle).not.toBe(oldHandle);
    expect(clock.pendingTimers()).toBeGreaterThan(0);
    expect(room.status).toBe('playing');
    expect(handSize(pair)).toBe(handBefore);

    // Callback antigo, mesmo entregue à fila, não altera nada nem derruba o timer novo.
    expect(clock.deliver(oldHandle)).toBe(true);
    expect(room.version).toBe(versionBeforeJoin + 1);
    expect(handSize(pair)).toBe(handBefore);
    expect(room.botTimer).toBe(newHandle);

    // No prazo, exatamente uma ação válida: o bot joga, a vez passa ao humano.
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionBeforeJoin + 1, 'ação do substituto');
    await waitFor(
      () => pair.guestRec.events.flatMap((message) => message.events).some((event) => event.type === 'played'),
      'evento do substituto',
    );
    expect(room.version).toBe(versionBeforeJoin + 2);
    expect(handSize(pair)).toBe(handBefore - 1);
    expect(currentSeatId(pair)).toBe(pair.guestId);
    expect(pair.guestRec.events.flatMap((message) => message.events).filter((event) => event.type === 'played')).toHaveLength(1);
    const pool = poolOf(room);
    expect(pool.total).toBe(108);
    expect(pool.unique).toBe(108);

    // O humano da vez continua jogando normalmente (nada ficou parado).
    const draw = await sendCommand(pair.guest, pair.roundId, { type: 'draw' });
    expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
  });

  it('replay da entrada de Cai preserva o ack e não repete associação, mutação nem agendamento', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);

    const cai = await newClient();
    const joinId = intent();
    const joinPayload = { intentId: joinId, roomCode: pair.roomCode, nickname: 'Cai', avatar: 'lobo' as const };
    const original = await request<Ack<JoinRoomAck>>(cai, 'client:joinRoom', joinPayload);
    expect(original.ok, original.ok ? '' : original.error.message).toBe(true);
    if (!original.ok) throw new Error('entrada falhou');
    const versionAfterJoin = room.version;
    const handleAfterJoin = room.botTimer;
    const participantsAfterJoin = room.participants.size;

    const replay = await request<Ack<JoinRoomAck>>(cai, 'client:joinRoom', joinPayload);
    expect(replay).toEqual(original);
    expect(room.version).toBe(versionAfterJoin);
    expect(room.participants.size).toBe(participantsAfterJoin);
    expect(room.botTimer).toBe(handleAfterJoin);
    expect([...room.participants.keys()].filter((id) => id === original.playerId)).toHaveLength(1);
    expect(room.round?.seatIds.includes(original.playerId)).toBe(false);

    // O timer válido continua funcionando após o replay.
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionAfterJoin, 'ação do substituto após replay');
    expect(room.version).toBe(versionAfterJoin + 1);
    expect(currentSeatId(pair)).toBe(pair.guestId);
  });

  it('entrada nova entre a compra e a ação mantém a fase after-draw sem segunda compra', async () => {
    const { clock } = await setup();
    // Ana só tem azuis contra o 9 vermelho: o bot precisa comprar. A compra traz
    // uma carta sem combinação, então a continuação correta é passar.
    const deck = buildDeck({
      hands: [
        ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
        ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1', 'green-7-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-8-1', 'yellow-1-1', 'yellow-2-1'],
    });
    const pair = await makePlaying(deck);
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);

    const versionBeforeDraw = room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionBeforeDraw, 'compra do substituto');
    expect(room.round?.state.phase).toBe('after-draw');
    expect(handSize(pair)).toBe(8);
    const handleAfterDraw = room.botTimer;
    if (handleAfterDraw === null) throw new Error('timer após a compra ausente');
    const versionAfterDraw = room.version;

    // Cai entra entre a compra e a ação: o passe continua agendado e sem nova compra.
    await joinOrFail(await newClient(), pair.roomCode, 'Cai');
    expect(room.botTimer).not.toBe(handleAfterDraw);
    const versionAfterJoin = room.version;
    expect(versionAfterJoin).toBe(versionAfterDraw + 1);
    expect(clock.deliver(handleAfterDraw)).toBe(true);
    expect(room.version).toBe(versionAfterJoin);
    expect(room.round?.state.phase).toBe('after-draw');

    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionAfterJoin, 'passe do substituto');
    expect(room.round?.state.phase).toBe('play');
    expect(handSize(pair)).toBe(8);
    expect(currentSeatId(pair)).toBe(pair.guestId);
    const drewEvents = pair.guestRec.events
      .flatMap((message) => message.events)
      .filter((event) => event.type === 'drew' && event.playerId === pair.hostId);
    expect(drewEvents).toHaveLength(1);
  });

  it('entrada nova com compra válida continua descartando a recém-comprada', async () => {
    const { clock } = await setup();
    const deck = buildDeck({
      hands: [
        ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
        ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1', 'green-7-1'],
      ],
      discard: 'red-9-1',
      draw: ['red-3-1', 'red-4-1', 'yellow-1-1'],
    });
    const pair = await makePlaying(deck);
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);

    const versionBeforeDraw = room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionBeforeDraw, 'compra do substituto');
    const roundAfterDraw = room.round;
    if (roundAfterDraw === null) throw new Error('rodada ausente');
    expect(roundAfterDraw.state.phase).toBe('after-draw');
    const drawnId = roundAfterDraw.state.drawnCardId;
    if (drawnId === null) throw new Error('carta comprada ausente');
    const handleAfterDraw = room.botTimer;
    if (handleAfterDraw === null) throw new Error('timer após a compra ausente');
    const versionAfterDraw = room.version;

    await joinOrFail(await newClient(), pair.roomCode, 'Cai');
    const versionAfterJoin = room.version;
    expect(versionAfterJoin).toBe(versionAfterDraw + 1);
    expect(clock.deliver(handleAfterDraw)).toBe(true);
    expect(room.version).toBe(versionAfterJoin);

    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionAfterJoin, 'descarte do substituto');
    const round = room.round;
    if (round === null) throw new Error('rodada ausente');
    expect(round.state.discardPile[round.state.discardPile.length - 1]?.id).toBe(drawnId);
    expect(handSize(pair)).toBe(7);
    expect(currentSeatId(pair)).toBe(pair.guestId);
    const drewEvents = pair.guestRec.events
      .flatMap((message) => message.events)
      .filter((event) => event.type === 'drew' && event.playerId === pair.hostId);
    expect(drewEvents).toHaveLength(1);
  });

  it('entrada nova com a sala pausada não destrava o bot; retomada volta a agir', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);

    // Bia cai: sem ninguém conectado, retenção; o bot para.
    pair.guest.disconnect();
    await waitFor(() => room.retainedUntil !== null, 'retenção');
    expect(room.status).toBe('paused');

    const cai = await newClient();
    const caiRec = record(cai);
    await joinOrFail(cai, pair.roomCode, 'Cai');
    await waitFor(() => latestState(caiRec).room.roomCode === pair.roomCode, 'estado de Cai');
    expect(room.retainedUntil).toBeNull();
    expect(room.status).toBe('paused');
    const versionPaused = room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS * 2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(room.version).toBe(versionPaused);

    // Bia retorna; como ficou desconectada, a chegada de Cai transferiu o papel
    // de anfitriã para ele — é Cai quem continua a rodada.
    const back = await newClient();
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: pair.guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    expect(room.retentionHold).toBe(true);
    expect(room.hostId).not.toBe(pair.guestId);
    expect((await request<Ack>(cai, 'client:continueRound', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => room.status === 'playing', 'retomada');
    const versionResumed = room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => room.version > versionResumed, 'ação após retomada');
    expect(currentSeatId(pair)).toBe(pair.guestId);
  });

  it('expiração após a entrada mantém timers zerados e invalidação dos callbacks', async () => {
    const { clock, server } = await setup();
    const pair = await makePlaying();
    await leaveHostAndReachItsTurn(pair);
    const room = roomOf(pair);
    const handle = room.botTimer;
    if (handle === null) throw new Error('timer do bot ausente');

    await joinOrFail(await newClient(), pair.roomCode, 'Cai');
    const handleAfterJoin = room.botTimer;
    if (handleAfterJoin === null) throw new Error('timer após entrada ausente');

    // Todos desconectam: retenção e expiração no limite.
    for (const client of active?.clients ?? []) client.disconnect();
    await waitFor(() => room.retainedUntil !== null, 'retenção');
    clock.advance(DEFAULT_RETENTION_MS);
    await waitFor(() => server.server.rooms.debugRoom(pair.roomCode) === undefined, 'expiração');
    expect(clock.pendingTimers()).toBe(0);
    expect(clock.deliver(handle)).toBe(true);
    expect(clock.deliver(handleAfterJoin)).toBe(true);
    expect(clock.pendingTimers()).toBe(0);
  });
});
