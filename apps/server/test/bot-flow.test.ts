import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import { DEFAULT_BOT_DELAY_MS, type Room } from '../src/rooms.js';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  leaveRoom,
  record,
  request,
  returnToLobby,
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
import { buildDeck } from './decks.js';

/** Ana só compra e passa; Bia tem vermelhas em sequência e vence jogando uma por turno. */
function winForGuestDeck(): string[] {
  return buildDeck({
    hands: [
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1'],
  });
}

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

describe('substituto automático integrado ao servidor', () => {
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
    await setNextDeck(host, created.roomCode, winForGuestDeck());
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

  /** Ana compra e passa; a vez de Bia avança o relógio controlado até o substituto agir. */
  async function driveUntilFinished(pair: Pair): Promise<void> {
    if (active === null) throw new Error('setup ausente');
    const { clock } = active;
    for (let guard = 0; guard < 80; guard++) {
      const state = latestState(pair.hostRec);
      if (state.room.status === 'finished') return;
      const view = state.self.view;
      if (view === null) throw new Error('sem projeção');
      if (view.currentPlayerId === pair.hostId) {
        const draw = await sendCommand(pair.host, pair.roundId, { type: 'draw' });
        expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
        const pass = await sendCommand(pair.host, pair.roundId, { type: 'pass' });
        expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
        await waitFor(() => latestState(pair.hostRec).self.view?.currentPlayerId !== pair.hostId, 'turno seguinte');
      } else {
        const version = state.room.version;
        clock.advance(DEFAULT_BOT_DELAY_MS);
        await waitFor(() => latestState(pair.hostRec).room.version > version, 'ação do substituto');
      }
    }
    throw new Error('a rodada não terminou dentro do limite do roteiro');
  }

  it('substituto joga sozinho, conserva cartas e vence com atribuição própria sem somar ao placar pessoal', async () => {
    const { server } = await setup();
    const pair = await makePlaying();
    expect((await leaveRoom(pair.guest)).ok).toBe(true);

    await driveUntilFinished(pair);

    const room = server.server.rooms.debugRoom(pair.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    const pool = poolOf(room);
    expect(pool.total).toBe(108);
    expect(pool.unique).toBe(108);

    const finished = latestState(pair.hostRec);
    expect(finished.room.status).toBe('finished');
    expect(finished.room.lastRound).toEqual({
      roundNumber: 1,
      winnerId: pair.guestId,
      winnerNickname: 'Bia',
      substitute: true,
      winnerKind: 'human',
    });
    expect(finished.room.participants.map((p) => p.nickname)).toEqual(['Ana']);
    expect(finished.room.participants.reduce((sum, p) => sum + p.score, 0)).toBe(0);

    // Depois do resultado, a credencial do substituto retirado não converte a vitória.
    const stale = await request<Ack<JoinRoomAck>>(pair.guest, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: pair.guestCredential,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('esperava recusa');
    expect(stale.error.code).toBe('CREDENTIAL_INVALID');
  });

  it('retomada humana antes do fim devolve o controle e permite vitória pessoal', async () => {
    const { clock, server } = await setup();
    const pair = await makePlaying();
    expect((await leaveRoom(pair.guest)).ok).toBe(true);

    // Deixa o substituto jogar ao menos uma carta vermelha.
    {
      const state = latestState(pair.hostRec);
      if (state.self.view?.currentPlayerId === pair.hostId) {
        expect((await sendCommand(pair.host, pair.roundId, { type: 'draw' })).ok).toBe(true);
        expect((await sendCommand(pair.host, pair.roundId, { type: 'pass' })).ok).toBe(true);
      }
      const version = latestState(pair.hostRec).room.version;
      clock.advance(DEFAULT_BOT_DELAY_MS);
      await waitFor(() => latestState(pair.hostRec).room.version > version, 'substituto jogou');
      const room = server.server.rooms.debugRoom(pair.roomCode);
      const seat = room?.round?.state.seats.find((entry) => entry.id === pair.guestId);
      expect(seat?.hand.length).toBe(6);
    }

    // Bia retoma e joga o resto como humana.
    const back = await newClient();
    const backRec = record(back);
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: pair.guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);

    for (let guard = 0; guard < 40; guard++) {
      const state = latestState(pair.hostRec);
      if (state.room.status === 'finished') break;
      const turn = state.self.view?.currentPlayerId;
      if (turn === pair.guestId) {
        await waitFor(() => latestState(backRec).self.view?.currentPlayerId === pair.guestId, 'vez de Bia em Bia');
        const view = latestState(backRec).self.view;
        if (view === null) throw new Error('sem projeção para Bia');
        const cardId = view.playableCardIds[0];
        if (cardId === undefined) throw new Error('sem carta jogável para Bia');
        const command = {
          type: 'play' as const,
          cardId,
          ...(view.hand.length === 2 ? { announceLastCard: true } : {}),
        };
        const ack = await sendCommand(back, pair.roundId, command);
        expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
        await waitFor(
          () => latestState(pair.hostRec).self.view?.currentPlayerId !== pair.guestId || latestState(pair.hostRec).room.status === 'finished',
          'turno seguinte',
        );
      } else {
        const draw = await sendCommand(pair.host, pair.roundId, { type: 'draw' });
        expect(draw.ok, draw.ok ? '' : `${draw.error.code}: ${draw.error.message}`).toBe(true);
        const pass = await sendCommand(pair.host, pair.roundId, { type: 'pass' });
        expect(pass.ok, pass.ok ? '' : `${pass.error.code}: ${pass.error.message}`).toBe(true);
        await waitFor(() => latestState(pair.hostRec).self.view?.currentPlayerId === pair.guestId, 'vez de Bia');
      }
    }

    const finished = latestState(pair.hostRec);
    expect(finished.room.status).toBe('finished');
    expect(finished.room.lastRound).toEqual({
      roundNumber: 1,
      winnerId: pair.guestId,
      winnerNickname: 'Bia',
      substitute: false,
      winnerKind: 'human',
    });
    expect(finished.room.participants.find((p) => p.id === pair.guestId)?.score).toBe(1);
  });

  it('pausa suspende a ação agendada do substituto e a retomada volta a permiti-la', async () => {
    const { clock, server } = await setup();
    const pair = await makePlaying();
    expect((await leaveRoom(pair.guest)).ok).toBe(true);

    // Garante a vez de Bia: com Ana na vez, Ana compra e passa; então o substituto fica agendado.
    if (latestState(pair.hostRec).self.view?.currentPlayerId === pair.hostId) {
      expect((await sendCommand(pair.host, pair.roundId, { type: 'draw' })).ok).toBe(true);
      expect((await sendCommand(pair.host, pair.roundId, { type: 'pass' })).ok).toBe(true);
    }
    await waitFor(() => latestState(pair.hostRec).self.view?.currentPlayerId === pair.guestId, 'vez de Bia');

    // Ana cai: a pausa cancela o agendamento e o relógio não produz jogada.
    pair.host.disconnect();
    await waitFor(() => server.server.rooms.debugRoom(pair.roomCode)?.status === 'paused', 'pausa');
    const versionPaused = server.server.rooms.debugRoom(pair.roomCode)?.version ?? -1;
    clock.advance(DEFAULT_BOT_DELAY_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.server.rooms.debugRoom(pair.roomCode)?.version).toBe(versionPaused);

    // Como todos estavam fora, a sala entrou em retenção: o retorno encontra pausa e
    // o anfitrião continua explicitamente; a vez segue de Bia e o substituto volta a agir.
    const back = await newClient();
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Ana',
      avatar: 'raposa',
      credential: pair.hostCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    await waitFor(() => server.server.rooms.debugRoom(pair.roomCode)?.status === 'paused', 'pausa de retenção');
    expect(server.server.rooms.debugRoom(pair.roomCode)?.retentionHold).toBe(true);
    const continued = await request<Ack>(back, 'client:continueRound', { intentId: intent() });
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => server.server.rooms.debugRoom(pair.roomCode)?.status === 'playing', 'retomada');
    const versionResumed = server.server.rooms.debugRoom(pair.roomCode)?.version ?? -1;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => (server.server.rooms.debugRoom(pair.roomCode)?.version ?? -1) > versionResumed, 'substituto age após retomada');
  });

  it('encerrar sem vencedor cancela ações pendentes e a rodada seguinte ignora o substituto antigo', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();
    expect((await leaveRoom(pair.guest)).ok).toBe(true);

    const ended = await request<SimpleAck>(pair.host, 'client:endRoundWithoutWinner', { intentId: intent() });
    expect(ended.ok, ended.ok ? '' : ended.error.message).toBe(true);
    const versionFinished = latestState(pair.hostRec).room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(latestState(pair.hostRec).room.version).toBe(versionFinished);
    expect(latestState(pair.hostRec).room.status).toBe('finished');

    // Nova pessoa ocupa a vaga e a rodada nova não tem controle automático pendente.
    const newcomer = await newClient();
    const newcomerRec = record(newcomer);
    await joinOrFail(newcomer, pair.roomCode, 'Cai');
    expect((await returnToLobby(pair.host)).ok).toBe(true);
    await setReady(pair.host, true);
    await setReady(newcomer, true);
    expect((await startRound(pair.host)).ok).toBe(true);
    await waitFor(() => latestState(newcomerRec).self.view?.hand.length === 7, 'rodada nova');
    const versionRoundTwo = latestState(pair.hostRec).room.version;
    const eventsBefore = pair.hostRec.events.length;
    clock.advance(DEFAULT_BOT_DELAY_MS * 4);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(latestState(pair.hostRec).room.version).toBe(versionRoundTwo);
    expect(pair.hostRec.events.length).toBe(eventsBefore);
    expect(latestState(pair.hostRec).room.status).toBe('playing');
  });
});
