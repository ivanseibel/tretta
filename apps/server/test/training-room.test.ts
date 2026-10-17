import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, CreateRoomAck } from '@tretta/protocol';
import { AVATARS } from '@tretta/protocol/shared';
import {
  connect,
  continueRound,
  createRoom,
  endRoundWithoutWinner,
  intent,
  joinRoom,
  latestState,
  record,
  removeParticipant,
  request,
  sendCommand,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { createTrainingRoom, startTrainingRound } from './training.js';

describe('mesa de treino: criação e contrato', () => {
  let active: { server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ server: TestServer; clients: TestClient[] }> {
    const server = await startTestServer();
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

  it('cria treino com uma pessoa e três bots prontos identificados pelo contrato', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const state = latestState(hostRec);

    expect(state.room.mode).toBe('training');
    expect(state.room.status).toBe('lobby');
    expect(state.room.roundNumber).toBe(0);
    expect(state.room.roundId).toBeNull();
    expect(state.room.hostId).toBe(created.playerId);
    expect(state.table).toBeNull();

    const bots = state.room.participants.filter((entry) => entry.kind === 'bot');
    expect(state.room.participants.map((entry) => entry.kind)).toEqual(['human', 'bot', 'bot', 'bot']);
    expect(state.room.participants.map((entry) => entry.id)).toEqual([created.playerId, ...bots.map((bot) => bot.id)]);
    expect(state.room.participants.find((entry) => entry.id === created.playerId)).toMatchObject({
      nickname: 'Ana',
      ready: false,
      connected: true,
      isHost: true,
      inRound: false,
      score: 0,
      autoControlled: false,
      absentSince: null,
    });

    for (const bot of bots) {
      expect(bot.id.startsWith('b_')).toBe(true);
      expect(bot).toMatchObject({ ready: true, connected: false, isHost: false, score: 0, autoControlled: false, absentSince: null });
      expect(AVATARS).toContain(bot.avatar);
    }
    expect(new Set(bots.map((bot) => bot.id)).size).toBe(3);
    expect(new Set(bots.map((bot) => bot.nickname)).size).toBe(3);
    expect(new Set(bots.map((bot) => bot.avatar)).size).toBe(3);

    expect(state.room.scoreboard.map((entry) => entry.kind)).toEqual(['human', 'bot', 'bot', 'bot']);
    expect(state.room.scoreboard.every((entry) => entry.wins === 0 && entry.current)).toBe(true);
  });

  it('payload antigo cria a sala humana; modo inválido é recusado; replay não duplica', async () => {
    const { server } = await setup();
    const classicClient = await newClient(server);
    const classicRec = record(classicClient);
    const classic = await createRoom(classicClient);
    if (!classic.ok) throw new Error('criação clássica recusada');
    await waitFor(() => classicRec.states.length > 0, 'estado clássico');
    expect(latestState(classicRec).room.mode).toBe('classic');
    expect(latestState(classicRec).room.participants.map((entry) => entry.kind)).toEqual(['human']);

    const plainClient = await newClient(server);
    const invalidMode = await request<Ack<CreateRoomAck>>(plainClient, 'client:createRoom', {
      intentId: intent(),
      nickname: 'Erro',
      avatar: 'raposa',
      mode: 'solo',
    });
    expect(invalidMode.ok).toBe(false);
    if (invalidMode.ok) throw new Error('esperava recusa');
    expect(invalidMode.error.code).toBe('INVALID_PAYLOAD');
    const invalidType = await request<Ack<CreateRoomAck>>(plainClient, 'client:createRoom', {
      intentId: intent(),
      nickname: 'Erro',
      avatar: 'raposa',
      mode: 7,
    });
    expect(invalidType.ok).toBe(false);
    if (invalidType.ok) throw new Error('esperava recusa');
    expect(invalidType.error.code).toBe('INVALID_PAYLOAD');

    const host = await newClient(server);
    const hostRec = record(host);
    const payload = { intentId: intent(), nickname: 'Ana', avatar: 'raposa', mode: 'training' };
    const first = await request<Ack<CreateRoomAck>>(host, 'client:createRoom', payload);
    expect(first.ok, first.ok ? '' : first.error.message).toBe(true);
    const replay = await request<Ack<CreateRoomAck>>(host, 'client:createRoom', payload);
    expect(replay).toEqual(first);
    const conflicting = await request<Ack<CreateRoomAck>>(host, 'client:createRoom', { ...payload, nickname: 'Outra' });
    expect(conflicting.ok).toBe(false);
    if (conflicting.ok) throw new Error('esperava recusa');
    expect(conflicting.error.code).toBe('INTENT_REUSED');

    if (!first.ok) throw new Error('criação recusada');
    const room = server.server.rooms.debugRoom(first.roomCode);
    expect(room?.participants.size).toBe(4);
    expect(server.server.rooms.roomCodes).toHaveLength(2);
    await waitFor(() => hostRec.states.length > 0, 'estado do treino');
    expect(latestState(hostRec).room.mode).toBe('training');
    expect(latestState(hostRec).room.roomCode).toBe(first.roomCode);
  });

  it('recusa entrada de outra pessoa em qualquer fase e comando sem vínculo', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    const rosterBefore = latestState(hostRec).room.participants.map((entry) => entry.id);

    const intruder = await newClient(server);
    const intruderRec = record(intruder);
    const inLobby = await joinRoom(intruder, created.roomCode, 'Cai');
    expect(inLobby.ok).toBe(false);
    if (inLobby.ok) throw new Error('esperava recusa');
    expect(inLobby.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    expect(room()?.participants.size).toBe(4);
    expect(intruderRec.states).toHaveLength(0);
    expect(intruderRec.packets).toHaveLength(0);

    // Em jogo: a recusa não muda a mesa nem a mão da pessoa.
    const roundId = await startTrainingRound(host, hostRec);
    const humanSeat = room()?.round?.state.seats.find((seat) => seat.id === created.playerId);
    const handBefore = humanSeat?.hand.map((card) => card.id) ?? [];
    const inGame = await joinRoom(intruder, created.roomCode, 'Cai');
    expect(inGame.ok).toBe(false);
    if (inGame.ok) throw new Error('esperava recusa');
    expect(inGame.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    expect(room()?.participants.size).toBe(4);
    const humanSeatAfter = room()?.round?.state.seats.find((seat) => seat.id === created.playerId);
    expect(humanSeatAfter?.hand.map((card) => card.id)).toEqual(handBefore);

    // Sem vínculo, comandos e início de rodada são recusados.
    const unlinkedCommand = await sendCommand(intruder, roundId, { type: 'draw' });
    expect(unlinkedCommand.ok).toBe(false);
    if (unlinkedCommand.ok) throw new Error('esperava recusa');
    expect(unlinkedCommand.error.code).toBe('NOT_IN_ROOM');
    const unlinkedStart = await startRound(intruder);
    expect(unlinkedStart.ok).toBe(false);
    if (unlinkedStart.ok) throw new Error('esperava recusa');
    expect(unlinkedStart.error.code).toBe('NOT_IN_ROOM');

    // Em pausa por ausência total: entrada segue recusada.
    host.disconnect();
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(room()?.status).toBe('paused');
    expect(room()?.botTimer).toBeNull();
    const inPause = await joinRoom(intruder, created.roomCode, 'Cai');
    expect(inPause.ok).toBe(false);
    if (inPause.ok) throw new Error('esperava recusa');
    expect(inPause.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    expect(room()?.participants.size).toBe(4);

    // Resultado: só a pessoa dona retorna e conduz o fim.
    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await joinRoom(back, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (!rejoined.ok) throw new Error('retorno recusado');
    expect(rejoined.rejoined).toBe(true);
    expect(rejoined.playerId).toBe(created.playerId);
    await waitFor(() => backRec.states.length > 0, 'estado devolvido');
    const continued = await continueRound(back);
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => latestState(backRec).room.status === 'playing', 'retomada');
    const ended = await endRoundWithoutWinner(back);
    expect(ended.ok, ended.ok ? '' : ended.error.message).toBe(true);
    await waitFor(() => latestState(backRec).room.status === 'finished', 'fim sem vencedor');
    const inResults = await joinRoom(intruder, created.roomCode, 'Cai');
    expect(inResults.ok).toBe(false);
    if (inResults.ok) throw new Error('esperava recusa');
    expect(inResults.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    expect([...(room()?.participants.values() ?? [])].map((entry) => entry.id)).toEqual(rosterBefore);
  });

  it('bot não vira conexão nem anfitrião; credencial, apelido e id de bot não concedem acesso', async () => {
    const { server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    const bots = [...(room()?.participants.values() ?? [])].filter((entry) => entry.kind === 'bot');
    expect(bots).toHaveLength(3);

    // Bots fixos não podem ser removidos individualmente nem no lobby.
    const removed = await removeParticipant(host, bots[0]?.id ?? '');
    expect(removed.ok).toBe(false);
    if (removed.ok) throw new Error('esperava recusa');
    expect(removed.error.code).toBe('CANNOT_REMOVE_BOT');
    expect(room()?.participants.size).toBe(4);

    // Credencial interna, apelido e id do bot não concedem entrada.
    const intruder = await newClient(server);
    const viaCredential = await joinRoom(intruder, created.roomCode, 'Tico', 'lobo', bots[0]?.credential ?? '');
    expect(viaCredential.ok).toBe(false);
    if (viaCredential.ok) throw new Error('esperava recusa');
    expect(viaCredential.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    const viaNickname = await joinRoom(intruder, created.roomCode, bots[0]?.nickname ?? 'Tico');
    expect(viaNickname.ok).toBe(false);
    if (viaNickname.ok) throw new Error('esperava recusa');
    expect(viaNickname.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    const viaBotId = await joinRoom(intruder, created.roomCode, 'Cai', 'lobo', `${bots[0]?.id ?? ''}${'x'.repeat(32)}`);
    expect(viaBotId.ok).toBe(false);
    if (viaBotId.ok) throw new Error('esperava recusa');
    expect(viaBotId.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    for (const bot of bots) expect(bot.socketId).toBeNull();
    expect(room()?.participants.size).toBe(4);

    // Segunda conexão ativa da pessoa é recusada; a primeira segue no comando.
    const second = await newClient(server);
    const secondJoin = await joinRoom(second, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(secondJoin.ok).toBe(false);
    if (secondJoin.ok) throw new Error('esperava recusa');
    expect(secondJoin.error.code).toBe('ALREADY_CONNECTED');
    const stillOperates = await setReady(host, true);
    expect(stillOperates.ok, stillOperates.ok ? '' : stillOperates.error.message).toBe(true);

    // Com a pessoa fora, o anfitrião continua sendo dela; nenhum bot assume.
    await startTrainingRound(host, hostRec);
    host.disconnect();
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(room()?.hostId).toBe(created.playerId);
    expect(room()?.participants.get(room()?.hostId ?? '')?.kind).toBe('human');
  });
});
