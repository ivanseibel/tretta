import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import {
  connect,
  createRoom,
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
import { challengeDeck, scenarioDeck } from './decks.js';

describe('recuperação de identidade e estado', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ server: TestServer; clients: TestClient[] }> {
    const server = await startTestServer({ testHooks: true });
    const clients: TestClient[] = [];
    active = { server, clients };
    return active;
  }

  async function newClient(server: TestServer): Promise<TestClient> {
    const socket = await connect(server.url);
    active?.clients.push(socket);
    return socket;
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  interface Playing {
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

  async function makePlaying(server: TestServer, deck: string[] = scenarioDeck()): Promise<Playing> {
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient(server);
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await setNextDeck(host, created.roomCode, deck);
    await setReady(host, true);
    await setReady(guest, true);
    const started = await startRound(host);
    expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
    const state = latestState(hostRec);
    const roundId = state.room.roundId;
    if (roundId === null) throw new Error('rodada ausente');
    await waitFor(() => latestState(guestRec).room.roundId === roundId, 'rodada de Bia');
    return {
      host,
      guest,
      hostRec,
      guestRec,
      roomCode: created.roomCode,
      roundId,
      hostId: state.self.playerId,
      guestId: latestState(guestRec).self.playerId,
      hostCredential: created.credential,
      guestCredential: joined.credential,
    };
  }

  it('reentrada com a mesma credencial recupera identidade, mão e fase após compra', async () => {
    const { server } = await setup();
    const playing = await makePlaying(server);
    const { host, hostRec, guestRec, guestCredential } = playing;

    // Coloca a vez com Bia e compra, para congelar a fase after-draw.
    let state = latestState(guestRec);
    if (state.self.view?.currentPlayerId !== playing.guestId) {
      const drawAck = await sendCommand(host, playing.roundId, { type: 'draw' });
      expect(drawAck.ok).toBe(true);
      const passAck = await sendCommand(host, playing.roundId, { type: 'pass' });
      expect(passAck.ok).toBe(true);
      await waitFor(() => latestState(guestRec).self.view?.currentPlayerId === playing.guestId, 'vez de Bia');
      state = latestState(guestRec);
    }
    const drawn = await sendCommand(playing.guest, playing.roundId, { type: 'draw' });
    expect(drawn.ok).toBe(true);
    await waitFor(() => latestState(guestRec).self.view?.phase === 'after-draw', 'fase after-draw');
    const before = latestState(guestRec).self.view;
    if (before === null) throw new Error('projeção ausente');
    const handIds = before.hand.map((card) => card.id);
    expect(handIds).toHaveLength(8);

    playing.guest.disconnect();
    await waitFor(() => latestState(hostRec).room.status === 'paused', 'pausa por desconexão');
    const paused = latestState(hostRec);
    expect(paused.room.pause?.absent.map((absent) => absent.playerId)).toEqual([playing.guestId]);

    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: playing.roomCode,
      nickname: 'Apelido Diferente',
      avatar: 'tucano',
      credential: guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (!rejoined.ok) throw new Error('reentrada falhou');
    expect(rejoined.playerId).toBe(playing.guestId);
    expect(rejoined.rejoined).toBe(true);

    await waitFor(() => latestState(backRec).room.status === 'playing', 'rodada retomada');
    const after = latestState(backRec).self.view;
    if (after === null) throw new Error('projeção ausente na reentrada');
    expect(latestState(backRec).self.playerId).toBe(playing.guestId);
    expect(latestState(backRec).self.nickname).toBe('Bia');
    expect(after.hand.map((card) => card.id)).toEqual(handIds);
    expect(after.phase).toBe('after-draw');
    expect(after.drawnCardId).toBe(before.drawnCardId);
    expect(after.discardTop.id).toBe(before.discardTop.id);
    expect(after.drawPileCount).toBe(before.drawPileCount);
    expect(after.currentPlayerId).toBe(before.currentPlayerId);
    expect(after.direction).toBe(before.direction);

    // Recuperação devolve o mando: a próxima ação da vez é aceita.
    const next = await sendCommand(back, playing.roundId, { type: 'pass' });
    expect(next.ok, next.ok ? '' : next.error.message).toBe(true);

    // A conexão antiga não controla a mão nem volta a receber estado.
    const hostStatesBefore = hostRec.states.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(hostRec.states.length).toBeGreaterThanOrEqual(hostStatesBefore);
    expect(
      active?.server.server.rooms.debugRoom(playing.roomCode)?.participants.get(playing.guestId)?.socketId,
    ).toBe(back.id);
  });

  it('credencial inválida é recusada e não assume identidade alheia', async () => {
    const { server } = await setup();
    const playing = await makePlaying(server);

    const intruder = await newClient(server);
    const wrong = await request<Ack<JoinRoomAck>>(intruder, 'client:joinRoom', {
      intentId: intent(),
      roomCode: playing.roomCode,
      nickname: 'Falsa',
      avatar: 'lobo',
      credential: 'credencial-invalida-mas-com-tamanho',
    });
    expect(wrong.ok).toBe(false);
    if (wrong.ok) throw new Error('esperava recusa');
    expect(wrong.error.code).toBe('CREDENTIAL_INVALID');

    // Mesmo com a credencial correta, identidade conectada não é roubada.
    const duplicate = await request<Ack<JoinRoomAck>>(intruder, 'client:joinRoom', {
      intentId: intent(),
      roomCode: playing.roomCode,
      nickname: 'Disfarce',
      avatar: 'lobo',
      credential: playing.hostCredential,
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error('esperava recusa');
    expect(duplicate.error.code).toBe('ALREADY_CONNECTED');
    const room = server.server.rooms.debugRoom(playing.roomCode);
    expect(room?.participants.get(playing.hostId)?.socketId).toBe(playing.host.id);
  });

  it('pausa por desconexão fora da vez recusa comandos e preserva a janela de última carta', async () => {
    const { server } = await setup();
    const playing = await makePlaying(server, challengeDeck());
    const { host, guest, hostRec, guestRec, roundId } = playing;

    // Ana desce a mão de vermelhas (Bia compra e passa entre uma e outra) até sobrar a última carta.
    const playHostRed = async (cardId: string): Promise<void> => {
      if (latestState(hostRec).self.view?.currentPlayerId !== playing.hostId) {
        const draw = await sendCommand(guest, roundId, { type: 'draw' });
        expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
        const pass = await sendCommand(guest, roundId, { type: 'pass' });
        expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
        await waitFor(() => latestState(hostRec).self.view?.currentPlayerId === playing.hostId, 'vez de Ana');
      }
      const ack = await sendCommand(host, roundId, { type: 'play', cardId });
      expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
      await waitFor(() => latestState(hostRec).self.view?.currentPlayerId === playing.guestId, 'vez de Bia');
    };
    for (const cardId of ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1']) {
      await playHostRed(cardId);
    }
    if (latestState(hostRec).self.view?.currentPlayerId !== playing.hostId) {
      const draw = await sendCommand(guest, roundId, { type: 'draw' });
      expect(draw.ok, draw.ok ? '' : draw.error.message).toBe(true);
      const pass = await sendCommand(guest, roundId, { type: 'pass' });
      expect(pass.ok, pass.ok ? '' : pass.error.message).toBe(true);
      await waitFor(() => latestState(hostRec).self.view?.currentPlayerId === playing.hostId, 'vez de Ana');
    }
    const played = await sendCommand(host, roundId, { type: 'play', cardId: 'red-6-1' });
    expect(played.ok, played.ok ? '' : played.error.message).toBe(true);
    await waitFor(() => latestState(hostRec).self.view?.lastCardWindow !== null, 'janela aberta');
    const windowBefore = latestState(hostRec).self.view?.lastCardWindow;
    expect(windowBefore).toEqual({ playerId: playing.hostId, announced: false });
    expect(latestState(hostRec).self.view?.currentPlayerId).toBe(playing.guestId);

    // Já era o turno de Bia quando Ana cai: pausa mesmo fora da vez de quem caiu.
    host.disconnect();
    await waitFor(() => latestState(guestRec).room.status === 'paused', 'pausa');
    const versionPaused = latestState(guestRec).room.version;

    const refused = await sendCommand(guest, roundId, { type: 'draw' });
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error('esperava recusa');
    expect(refused.error.code).toBe('ROUND_PAUSED');
    expect(latestState(guestRec).room.version).toBe(versionPaused);

    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: playing.roomCode,
      nickname: 'Ana',
      avatar: 'raposa',
      credential: playing.hostCredential,
    });
    expect(rejoined.ok).toBe(true);
    await waitFor(() => latestState(backRec).room.status === 'playing', 'retomada');
    const view = latestState(backRec).self.view;
    expect(view?.lastCardWindow).toEqual(windowBefore);
    expect(view?.currentPlayerId).toBe(playing.guestId);
    expect(view?.hand.map((card) => card.id)).toEqual(['wild-draw-four-1']);

    // A vez de Bia segue valendo depois da retomada.
    const guestDraw = await sendCommand(guest, roundId, { type: 'draw' });
    expect(guestDraw.ok, guestDraw.ok ? '' : guestDraw.error.message).toBe(true);
  });

  it('quedas e reentradas repetidas não criam identidades ou vagas duplicadas', async () => {
    const { server } = await setup();
    const playing = await makePlaying(server);
    const room = server.server.rooms.debugRoom(playing.roomCode);
    const before = room?.participants.size;

    for (let attempt = 0; attempt < 3; attempt++) {
      playing.guest.disconnect();
      await waitFor(() => room?.participants.get(playing.guestId)?.connected === false, 'desconexão');
      const back = await newClient(server);
      const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
        intentId: intent(),
        roomCode: playing.roomCode,
        nickname: 'Bia',
        avatar: 'lobo',
        credential: playing.guestCredential,
      });
      expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
      if (rejoined.ok) expect(rejoined.playerId).toBe(playing.guestId);
      playing.guest = back;
    }

    expect(room?.participants.size).toBe(before);
    expect([...room?.participants.keys() ?? []].filter((id) => id === playing.guestId)).toHaveLength(1);
    await waitFor(() => server.server.rooms.debugRoom(playing.roomCode)?.status === 'playing', 'rodada retomada');
    expect(room?.participants.get(playing.guestId)?.socketId).not.toBeNull();
  });
});
