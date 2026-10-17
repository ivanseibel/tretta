import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOT_DELAY_MS, DEFAULT_RETENTION_MS, type Room } from '../src/rooms.js';
import {
  connect,
  continueRound,
  endRoundWithoutWinner,
  FakeClock,
  joinRoom,
  latestState,
  leaveRoom,
  record,
  returnToLobby,
  setNextDeck,
  startTestServer,
  substituteAbsent,
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';
import {
  actCurrentPlayer,
  createTrainingRoom,
  driveUntilBotAction,
  poolOf,
  startTrainingRound,
  trainingDeck,
} from './training.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('mesa de treino: recuperação, retenção e saída', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ clock: FakeClock; server: TestServer; clients: TestClient[] }> {
    const clock = new FakeClock();
    const server = await startTestServer({ testHooks: true, clock });
    const clients: TestClient[] = [];
    active = { clock, server, clients };
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

  /** Garante um agendamento de bot pendente (devolve o handle). */
  async function pendingBotTimer(
    clock: FakeClock,
    host: TestClient,
    hostRec: Recorder,
    room: () => Room | undefined,
  ): Promise<number> {
    for (let step = 0; step < 4 && room()?.botTimer === null && latestState(hostRec).room.status === 'playing'; step++) {
      await actCurrentPlayer(clock, host, hostRec);
    }
    const pending = room()?.botTimer;
    if (pending === undefined || pending === null) throw new Error('sem agendamento de bot pendente');
    return pending as number;
  }

  it('desconexão total congela a rodada; retorno preserva mão, fase, bots e placar', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);

    const pending = await pendingBotTimer(clock, host, hostRec, room);
    const before = latestState(hostRec);
    const handBefore = before.self.view?.hand.map((card) => card.id) ?? [];
    const phaseBefore = before.table?.phase ?? null;
    const roundId = before.room.roundId;
    const botsBefore = before.room.participants.filter((entry) => entry.kind === 'bot').map((entry) => entry.id);
    const scoreBefore = before.room.scoreboard.map((entry) => [entry.playerId, entry.wins]);

    host.disconnect();
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(room()?.status).toBe('paused');
    expect(room()?.retainedUntil).not.toBeNull();
    expect(room()?.hostId).toBe(created.playerId);
    expect(room()?.botTimer).toBeNull();
    const frozen = room()?.version ?? -1;
    clock.advance(DEFAULT_BOT_DELAY_MS * 5);
    await sleep(40);
    expect(room()?.version).toBe(frozen);
    // Callback já entregue à fila antes do cancelamento não age.
    expect(clock.deliver(pending)).toBe(true);
    expect(room()?.version).toBe(frozen);

    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await joinRoom(back, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (!rejoined.ok) throw new Error('retorno recusado');
    expect(rejoined.rejoined).toBe(true);
    expect(rejoined.playerId).toBe(created.playerId);
    await waitFor(() => backRec.states.length > 0, 'estado devolvido');
    const restored = latestState(backRec);
    expect(restored.room.mode).toBe('training');
    expect(restored.room.status).toBe('paused');
    expect(restored.room.roundId).toBe(roundId);
    expect(restored.room.participants.map((entry) => entry.id)).toEqual([created.playerId, ...botsBefore]);
    expect(restored.self.view?.hand.map((card) => card.id)).toEqual(handBefore);
    expect(restored.table?.phase).toBe(phaseBefore);
    expect(restored.room.scoreboard.map((entry) => [entry.playerId, entry.wins])).toEqual(scoreBefore);

    // Substituição de bot não é autorizável; retomada explícita libera sem substituto.
    const subBot = await substituteAbsent(back, botsBefore[0] ?? '');
    expect(subBot.ok).toBe(false);
    if (subBot.ok) throw new Error('esperava recusa');
    expect(subBot.error.code).toBe('SUBSTITUTE_NOT_ELIGIBLE');
    const continued = await continueRound(back);
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => latestState(backRec).room.status === 'playing', 'retomada');
    // O callback antigo continua inerte depois do retorno e da retomada.
    const afterContinue = latestState(backRec).room.version;
    expect(clock.deliver(pending)).toBe(true);
    await sleep(40);
    expect(latestState(backRec).room.version).toBe(afterContinue);

    // Bots voltam a agir sozinhos após a retomada.
    await driveUntilBotAction(clock, back, backRec);
    expect(latestState(backRec).room.version).toBeGreaterThan(restored.room.version);
    expect(poolOf(room())).toEqual({ total: 108, unique: 108 });
  });

  it('retenção de 15 minutos expira a mesa mesmo com bots; callbacks antigos não recriam nada', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    const pending = await pendingBotTimer(clock, host, hostRec, room);

    host.disconnect();
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(clock.pendingTimers()).toBe(1);
    clock.advance(DEFAULT_RETENTION_MS);
    expect(server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();
    expect(clock.pendingTimers()).toBe(0);
    expect(clock.deliver(pending)).toBe(true);
    expect(server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();

    const late = await newClient(server);
    const lateJoin = await joinRoom(late, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(lateJoin.ok).toBe(false);
    if (lateJoin.ok) throw new Error('esperava recusa');
    expect(lateJoin.error.code).toBe('ROOM_NOT_FOUND');
    const stranger = await newClient(server);
    const strangerJoin = await joinRoom(stranger, created.roomCode, 'Cai');
    expect(strangerJoin.ok).toBe(false);
    if (strangerJoin.ok) throw new Error('esperava recusa');
    expect(strangerJoin.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('saída explícita no meio da rodada congela a mesa até o dono voltar', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    const pending = await pendingBotTimer(clock, host, hostRec, room);

    const left = await leaveRoom(host);
    expect(left.ok, left.ok ? '' : left.error.message).toBe(true);
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(room()?.status).toBe('paused');
    expect(room()?.hostId).toBe(created.playerId);
    expect(room()?.botTimer).toBeNull();
    const frozen = room()?.version ?? -1;
    expect(clock.deliver(pending)).toBe(true);
    clock.advance(DEFAULT_BOT_DELAY_MS * 5);
    await sleep(40);
    expect(room()?.version).toBe(frozen);
    expect(room()?.status).toBe('paused');

    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await joinRoom(back, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (!rejoined.ok) throw new Error('retorno recusado');
    await waitFor(() => backRec.states.length > 0, 'estado devolvido');
    const continued = await continueRound(back);
    expect(continued.ok, continued.ok ? '' : continued.error.message).toBe(true);
    await waitFor(() => latestState(backRec).room.status === 'playing', 'retomada');
    await driveUntilBotAction(clock, back, backRec);
    expect(poolOf(room())).toEqual({ total: 108, unique: 108 });
  });

  it('saída entre rodadas libera a vaga; sem gente a retenção expira tudo e bots não seguram a sala', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);

    // Queda na preparação mantém a vaga recuperável e os bots preservados.
    host.disconnect();
    await waitFor(() => room()?.retentionHold === true, 'retenção');
    expect(room()?.participants.size).toBe(4);
    expect(room()?.hostId).toBe(created.playerId);
    const back = await newClient(server);
    const backRec = record(back);
    const rejoined = await joinRoom(back, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    if (!rejoined.ok) throw new Error('retorno recusado');
    expect(rejoined.rejoined).toBe(true);
    await waitFor(() => latestState(backRec).room.participants.length === 4, 'mesa restaurada');
    expect(room()?.retainedUntil).toBeNull();
    const botsNow = latestState(backRec).room.participants.filter((entry) => entry.kind === 'bot');
    expect(botsNow).toHaveLength(3);
    expect(botsNow.every((entry) => entry.ready)).toBe(true);

    // Saída explícita fora de rodada ativa: a pessoa deixa a vaga de fato.
    const left = await leaveRoom(back);
    expect(left.ok, left.ok ? '' : left.error.message).toBe(true);
    await waitFor(() => room()?.retentionHold === true, 'nova retenção');
    expect(room()?.participants.size).toBe(3);
    expect([...(room()?.participants.values() ?? [])].every((entry) => entry.kind === 'bot')).toBe(true);
    expect(room()?.hostId).toBe(created.playerId);
    const late = await newClient(server);
    const lateJoin = await joinRoom(late, created.roomCode, 'Ana', 'raposa', created.credential);
    expect(lateJoin.ok).toBe(false);
    if (lateJoin.ok) throw new Error('esperava recusa');
    expect(lateJoin.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');

    // Bots não mantêm a sala viva: a retenção expira a mesa inteira.
    clock.advance(DEFAULT_RETENTION_MS);
    expect(server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();
    expect(clock.pendingTimers()).toBe(0);
  });

  it('callback de bot da rodada anterior não age depois de nova rodada', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    const room = () => server.server.rooms.debugRoom(created.roomCode);
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    const stale = await pendingBotTimer(clock, host, hostRec, room);

    const ended = await endRoundWithoutWinner(host);
    expect(ended.ok, ended.ok ? '' : ended.error.message).toBe(true);
    await waitFor(() => latestState(hostRec).room.status === 'finished', 'fim da rodada 1');
    expect(room()?.botTimer).toBeNull();
    const lobby = await returnToLobby(host);
    expect(lobby.ok, lobby.ok ? '' : lobby.error.message).toBe(true);
    await waitFor(() => latestState(hostRec).room.status === 'lobby', 'preparação');
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    const round2 = latestState(hostRec).room.roundId;
    const version2 = latestState(hostRec).room.version;

    expect(clock.deliver(stale)).toBe(true);
    await sleep(40);
    expect(room()?.round?.id).toBe(round2);
    expect(room()?.version).toBe(version2);

    // A rodada nova segue normalmente com os bots agindo.
    await driveUntilBotAction(clock, host, hostRec);
    expect(room()?.version).toBeGreaterThan(version2);
    expect(poolOf(room())).toEqual({ total: 108, unique: 108 });
  });
});
