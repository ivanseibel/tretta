import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, SimpleAck } from '@tretta/protocol';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';
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
  removeParticipant,
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

describe('saída voluntária e controle da sala', () => {
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
      guestCredential: joined.credential,
    };
  }

  it('saída durante a rodada ativa o substituto imediatamente e o retorno recupera a vaga', async () => {
    const { clock } = await setup();
    const pair = await makePlaying();

    // Deixa a vez com Ana para que a saída de Bia não pause nada.
    if (latestState(pair.hostRec).self.view?.currentPlayerId !== pair.hostId) {
      expect((await sendCommand(pair.guest, pair.roundId, { type: 'draw' })).ok).toBe(true);
      expect((await sendCommand(pair.guest, pair.roundId, { type: 'pass' })).ok).toBe(true);
      await waitFor(() => latestState(pair.hostRec).self.view?.currentPlayerId === pair.hostId, 'vez de Ana');
    }

    const left = await leaveRoom(pair.guest);
    expect(left.ok, left.ok ? '' : left.error.message).toBe(true);
    await waitFor(
      () => latestState(pair.hostRec).room.participants.find((p) => p.id === pair.guestId)?.autoControlled === true,
      'substituto de Bia',
    );
    const afterLeave = latestState(pair.hostRec);
    expect(afterLeave.room.status).toBe('playing');
    expect(afterLeave.room.pause).toBeNull();
    expect(afterLeave.room.participants.find((p) => p.id === pair.guestId)?.connected).toBe(false);

    // A conexão que saiu não controla mais a mão.
    const orphanCommand = await sendCommand(pair.guest, pair.roundId, { type: 'draw' });
    expect(orphanCommand.ok).toBe(false);
    if (orphanCommand.ok) throw new Error('esperava recusa');
    expect(orphanCommand.error.code).toBe('NOT_IN_ROOM');

    // Ana passa a vez; o substituto de Bia age sozinho no relógio controlado.
    expect((await sendCommand(pair.host, pair.roundId, { type: 'draw' })).ok).toBe(true);
    expect((await sendCommand(pair.host, pair.roundId, { type: 'pass' })).ok).toBe(true);
    const versionBeforeBot = latestState(pair.hostRec).room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => latestState(pair.hostRec).room.version > versionBeforeBot, 'ação do substituto');
    const botEvents = pair.hostRec.events.flatMap((message) => message.events).filter((event) => {
      return (event.type === 'drew' || event.type === 'passed') && event.playerId === pair.guestId;
    });
    expect(botEvents.length).toBeGreaterThan(0);
    expect(latestState(pair.hostRec).room.status).toBe('playing');

    // O retorno devolve a mesma vaga e mesma mão do assento.
    const room = active?.server.server.rooms.debugRoom(pair.roomCode);
    const seatHandBefore = room?.round?.state.seats.find((seat) => seat.id === pair.guestId)?.hand.map((card) => card.id);
    const back = await newClient();
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: pair.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: pair.guestCredential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (rejoined.ok) expect(rejoined.playerId).toBe(pair.guestId);
    await waitFor(
      () => latestState(pair.hostRec).room.participants.find((p) => p.id === pair.guestId)?.autoControlled === false,
      'controle devolvido a Bia',
    );
    const seatHandAfter = room?.round?.state.seats.find((seat) => seat.id === pair.guestId)?.hand.map((card) => card.id);
    expect(seatHandAfter).toEqual(seatHandBefore);

    // Nenhuma ação automática pendente roda depois do retorno.
    const versionAfterReturn = latestState(pair.hostRec).room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS * 5);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(latestState(pair.hostRec).room.version).toBe(versionAfterReturn);
  });

  it('saída no lobby libera a vaga e a credencial revogada não permite voltar como a mesma pessoa', async () => {
    const { server } = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    const guestId = joined.playerId;

    const left = await leaveRoom(guest);
    expect(left.ok).toBe(true);
    await waitFor(() => latestState(hostRec).room.participants.length === 1, 'vaga liberada');

    const newcomer = await newClient();
    const joinedNew = await joinOrFail(newcomer, created.roomCode, 'Cai');
    expect(joinedNew.ok).toBe(true);
    await waitFor(() => latestState(hostRec).room.participants.length === 2, 'Cai no lugar');

    const stale = await joinRoom(guest, created.roomCode, 'Bia', 'lobo', joined.credential);
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('esperava recusa');
    expect(stale.error.code).toBe('CREDENTIAL_INVALID');
    expect(server.server.rooms.debugRoom(created.roomCode)?.participants.has(guestId)).toBe(false);
  });

  it('fim da rodada retira o substituto desconectado, libera a vaga e preserva o placar restante', async () => {
    const { server } = await setup();
    const { host, guest, hostRec, roomCode, guestId, guestCredential } = await makePlaying();

    expect((await leaveRoom(guest)).ok).toBe(true);
    await waitFor(
      () => latestState(hostRec).room.participants.find((p) => p.id === guestId)?.autoControlled === true,
      'substituto',
    );

    const endIntent = intent();
    const ended = await request<SimpleAck>(host, 'client:endRoundWithoutWinner', { intentId: endIntent });
    expect(ended.ok, ended.ok ? '' : ended.error.message).toBe(true);
    const finished = latestState(hostRec);
    expect(finished.room.status).toBe('finished');
    expect(finished.room.participants.map((p) => p.nickname)).toEqual(['Ana']);
    expect(finished.room.lastRound).toEqual({ roundNumber: 1, winnerId: null, winnerNickname: null, substitute: false });
    expect(finished.room.participants.reduce((sum, p) => sum + p.score, 0)).toBe(0);

    // Replay da intenção é inofensivo e mantém a resposta memorizada.
    const versionFinished = finished.room.version;
    const replay = await request<SimpleAck>(host, 'client:endRoundWithoutWinner', { intentId: endIntent });
    expect(replay).toEqual(ended);
    expect(latestState(hostRec).room.version).toBe(versionFinished);

    // A vaga liberada aceita pessoa nova, que nunca assume a mão da rodada encerrada.
    const newcomer = await newClient();
    const newcomerRec = record(newcomer);
    const joinedNew = await joinOrFail(newcomer, roomCode, 'Cai');
    expect(joinedNew.ok).toBe(true);
    await waitFor(() => latestState(newcomerRec).room.roundId !== null, 'sala no resultado');
    expect(latestState(newcomerRec).self.view).toBeNull();
    expect(latestState(newcomerRec).self.waiting).toBe(false);

    // A credencial do substituto retirado também não volta.
    const stale = await joinRoom(guest, roomCode, 'Bia', 'lobo', guestCredential);
    expect(stale.ok).toBe(false);
    if (stale.ok) throw new Error('esperava recusa');
    expect(stale.error.code).toBe('CREDENTIAL_INVALID');
    expect(server.server.rooms.debugRoom(roomCode)?.participants.has(guestId)).toBe(false);

    // Nova preparação com a vaga reciclada.
    expect((await request<SimpleAck>(host, 'client:returnToLobby', { intentId: intent() })).ok).toBe(true);
    expect((await request<SimpleAck>(host, 'client:setReady', { intentId: intent(), ready: true })).ok).toBe(true);
    expect((await request<SimpleAck>(newcomer, 'client:setReady', { intentId: intent(), ready: true })).ok).toBe(true);
    expect((await request<SimpleAck>(host, 'client:startRound', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(newcomerRec).self.view?.hand.length === 7, 'Cai na rodada seguinte');
    expect(latestState(newcomerRec).room.roundNumber).toBe(2);
  });

  it('anfitrião remove participante no lobby com aviso, autoridade validada e credencial revogada', async () => {
    const { server } = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    const third = await newClient();
    const joinedThird = await joinOrFail(third, created.roomCode, 'Cai');
    if (!joinedThird.ok) throw new Error('entrada falhou');

    const notHost = await removeParticipant(guest, joinedThird.playerId);
    expect(notHost.ok).toBe(false);
    if (notHost.ok) throw new Error('esperava recusa');
    expect(notHost.error.code).toBe('NOT_HOST');

    const self = await removeParticipant(host, latestState(hostRec).self.playerId);
    expect(self.ok).toBe(false);
    if (self.ok) throw new Error('esperava recusa');
    expect(self.error.code).toBe('CANNOT_REMOVE_SELF');

    const removed = await removeParticipant(host, joined.playerId);
    expect(removed.ok, removed.ok ? '' : removed.error.message).toBe(true);
    await waitFor(() => guestRec.packets.some((packet) => (packet as { event?: string }).event === 'server:removed'), 'aviso de remoção');
    expect(server.server.rooms.debugRoom(created.roomCode)?.participants.has(joined.playerId)).toBe(false);

    // A conexão removida não age e o replay da remoção não tem efeito novo.
    const orphan = await request<SimpleAck>(guest, 'client:setReady', { intentId: intent(), ready: true });
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.error.code).toBe('NOT_IN_ROOM');
    const staleLog = await joinRoom(guest, created.roomCode, 'Bia', 'lobo', joined.credential);
    expect(staleLog.ok).toBe(false);
    if (!staleLog.ok) expect(staleLog.error.code).toBe('CREDENTIAL_INVALID');

    // Entrada como nova identidade segue as regras normais.
    const renewed = await joinOrFail(guest, created.roomCode, 'Bia de novo');
    if (!renewed.ok) throw new Error('entrada como nova identidade falhou');
    expect(renewed.playerId).not.toBe(joined.playerId);

    // Remoção não vale durante a rodada.
    await setReady(host, true);
    await setReady(third, true);
    await setReady(guest, true);
    expect((await startRound(host)).ok).toBe(true);
    const versionBeforeRemove = server.server.rooms.debugRoom(created.roomCode)?.version;
    const duringRound = await removeParticipant(host, renewed.playerId);
    expect(duringRound.ok).toBe(false);
    if (duringRound.ok) throw new Error('esperava recusa');
    expect(duringRound.error.code).toBe('WRONG_ROOM_STATUS');
    expect(server.server.rooms.debugRoom(created.roomCode)?.version).toBe(versionBeforeRemove);
  });
});
