import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, ReactionSendAck, RetryInfo } from '@tretta/protocol';
import { REACTION_SENDER_COOLDOWN_MS, REACTION_TYPES } from '@tretta/protocol/shared';
import {
  connect,
  createRoom,
  endRoundWithoutWinner,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  reactionSend,
  record,
  request,
  sendCommand,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { scenarioDeck } from './decks.js';
import { advanceBotTurn, createTrainingRoom, playHumanTurn, startTrainingRound, trainingDeck } from './training.js';

interface ErrorBody {
  code: string;
  message: string;
  retry?: RetryInfo;
}

function expectOkAck<T extends { ok: boolean; error?: { message: string } }>(ack: T): Extract<T, { ok: true }> {
  expect(ack.ok, ack.ok ? '' : ack.error?.message).toBe(true);
  return ack as Extract<T, { ok: true }>;
}

function expectError(ack: { ok: boolean; error?: ErrorBody }, code: string): ErrorBody {
  expect(ack.ok).toBe(false);
  const error = ack.error;
  if (error === undefined) throw new Error(`Recusa esperada com o código ${code}.`);
  expect(error.code).toBe(code);
  expect(error.message.length).toBeGreaterThan(0);
  return error;
}

describe('reações sem destinatário', () => {
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

  it('reações fluem em preparação, rodada, espera, pausa e resultado com o mesmo evento público para todos', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Preparação: Ana reage com eita. O envelope tem só dados públicos e o mesmo
    // evento sai uma vez para emissor e demais.
    const t0 = ctx.clock.now();
    const first = expectOkAck(await reactionSend(host, created.roomCode, 'eita'));
    expect(first.reaction.type).toBe('eita');
    expect(first.reaction.sender).toEqual({ playerId: created.playerId, nickname: 'Ana', avatar: 'raposa' });
    expect(first.reaction.id.startsWith('rx_')).toBe(true);
    expect(first.reaction.sentAt).toBe(t0);
    expect(Object.keys(first.reaction).sort()).toEqual(['id', 'sender', 'sentAt', 'type']);
    expect(Object.keys(first.reaction.sender).sort()).toEqual(['avatar', 'nickname', 'playerId']);
    expect(first.limits).toEqual({ serverTime: t0, nextSendAt: t0 + REACTION_SENDER_COOLDOWN_MS });
    await waitFor(() => hostRec.reactions.length === 1 && guestRec.reactions.length === 1, 'broadcast na preparação');
    expect(hostRec.reactions[0]).toEqual({ roomCode: created.roomCode, reaction: first.reaction });

    // Rodada com quem aguarda a próxima: Cai reage e todos recebem.
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    expect(latestState(watcherRec).self.waiting).toBe(true);
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
    expectOkAck(await reactionSend(watcher, created.roomCode, 'injustica'));
    await waitFor(() => hostRec.reactions.length === 2 && guestRec.reactions.length === 2 && watcherRec.reactions.length === 1, 'reação de quem aguarda');
    expect(hostRec.reactions[1]?.reaction.sender.nickname).toBe('Cai');
    expect(hostRec.reactions[1]?.reaction.type).toBe('injustica');

    // Pausa: Bia cai; Ana reage mesmo pausada e quem aguarda recebe.
    guest.disconnect();
    await waitFor(() => latestState(hostRec).room.status === 'paused', 'pausa');
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
    expectOkAck(await reactionSend(host, created.roomCode, 'carinho'));
    await waitFor(() => watcherRec.reactions.length === 2, 'reação na pausa');

    // Resultado: a reação continua disponível e compartilhada.
    expectOkAck(await endRoundWithoutWinner(host));
    await waitFor(() => latestState(hostRec).room.status === 'finished', 'resultado');
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
    expectOkAck(await reactionSend(watcher, created.roomCode, 'eita'));
    await waitFor(() => hostRec.reactions.length === 4, 'reação no resultado');
    expect(watcherRec.reactions.map((entry) => entry.reaction.type)).toEqual(['injustica', 'carinho', 'eita']);
    expect(guestRec.reactions).toHaveLength(2);

    // Nova entrada e retorno da mesma identidade não recebem reação antiga.
    const late = await newClient();
    const lateRec = record(late);
    expectOkAck(await joinOrFail(late, created.roomCode, 'Dai'));
    const guestBack = await newClient();
    const guestBackRec = record(guestBack);
    expectOkAck(
      await request<Ack<JoinRoomAck>>(guestBack, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Bia',
        avatar: 'lobo',
        credential: joined.credential,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lateRec.reactions).toHaveLength(0);
    expect(guestBackRec.reactions).toHaveLength(0);

    // Nova emissão chega para quem entrou depois; a outra sala permanece isolada.
    const other = await newClient();
    const otherRec = record(other);
    expectOkAck(await createRoom(other, 'Zara'));
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
    expectOkAck(await reactionSend(host, created.roomCode, 'injustica'));
    await waitFor(() => lateRec.reactions.length === 1, 'reação nova');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(otherRec.reactions).toHaveLength(0);
    // Quem retornou recebe só o que aconteceu depois do retorno.
    expect(guestBackRec.reactions).toHaveLength(1);
  });

  it('aceita e transmite os doze ids sem alvo, áudio ou destinatário', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Cada um dos doze ids é aceito e retransmitido com o mesmo evento público.
    const accepted: ReactionSendAck['reaction'][] = [];
    for (const [index, type] of REACTION_TYPES.entries()) {
      if (index > 0) ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
      const ack = expectOkAck(await reactionSend(host, created.roomCode, type));
      expect(ack.reaction.type).toBe(type);
      expect(Object.keys(ack.reaction).sort()).toEqual(['id', 'sender', 'sentAt', 'type']);
      expect(Object.keys(ack.reaction.sender).sort()).toEqual(['avatar', 'nickname', 'playerId']);
      accepted.push(ack.reaction);
    }
    expect(REACTION_TYPES).toHaveLength(12);
    await waitFor(
      () => hostRec.reactions.length === REACTION_TYPES.length && guestRec.reactions.length === REACTION_TYPES.length,
      'doze reações transmitidas',
    );
    expect(hostRec.reactions.map((entry) => entry.reaction)).toEqual(accepted);
    expect(guestRec.reactions.map((entry) => entry.reaction.type)).toEqual([...REACTION_TYPES]);
    for (const entry of guestRec.reactions) {
      // Envelope de broadcast sem destinatário, autoria forjada ou áudio.
      expect(entry.roomCode).toBe(created.roomCode);
      expect(Object.keys(entry.reaction).sort()).toEqual(['id', 'sender', 'sentAt', 'type']);
      expect(JSON.stringify(entry)).not.toContain('target');
      expect(JSON.stringify(entry)).not.toContain('audio');
    }

    // Ids fora do catálogo atual, inclusive os três antigos, e alvo explícito recusam.
    for (const type of ['rindo', 'chorando', 'bravo', 'bolo']) {
      expectError(
        await request<Ack<ReactionSendAck>>(host, 'client:reactionSend', { intentId: intent(), roomCode: created.roomCode, type }),
        'INVALID_PAYLOAD',
      );
    }
    expectError(
      await request<Ack<ReactionSendAck>>(host, 'client:reactionSend', {
        intentId: intent(),
        roomCode: created.roomCode,
        type: 'eita',
        targetId: joined.playerId,
      }),
      'INVALID_PAYLOAD',
    );
    const broadcastsBefore = hostRec.reactions.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.reactions.length).toBe(broadcastsBefore);
  });

  it('contrato estrito: tipo inválido, destinatário, autoria ou horário forjados e falta de vínculo recusam', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    expectError(
      await request<Ack<ReactionSendAck>>(host, 'client:reactionSend', { intentId: intent(), roomCode: created.roomCode, type: 'bolo' }),
      'INVALID_PAYLOAD',
    );
    expectError(
      await request<Ack<ReactionSendAck>>(host, 'client:reactionSend', {
        intentId: intent(),
        roomCode: created.roomCode,
        type: 'eita',
        targetId: joined.playerId,
      }),
      'INVALID_PAYLOAD',
    );
    expectError(
      await request<Ack<ReactionSendAck>>(host, 'client:reactionSend', {
        intentId: intent(),
        roomCode: created.roomCode,
        type: 'eita',
        author: { playerId: joined.playerId, nickname: 'Bia', avatar: 'lobo' },
        sentAt: 1,
      }),
      'INVALID_PAYLOAD',
    );

    // Conexão sem vínculo e vínculo de outra sala não enviam como outra identidade.
    const idle = await newClient();
    expectError(await reactionSend(idle, created.roomCode, 'eita'), 'NOT_IN_ROOM');
    const other = await newClient();
    expectOkAck(await createRoom(other, 'Zara'));
    expectError(await reactionSend(other, created.roomCode, 'eita'), 'NOT_IN_ROOM');

    // Nenhuma recusa gerou broadcast nem avançou o contador da sala.
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.reactionNextSeq).toBe(1);
  });

  it('bots fixos não reagem sozinhos nem podem ser assumidos por clientes', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createTrainingRoom(host, 'Ana'));
    await setNextDeck(host, created.roomCode, trainingDeck());
    const roundId = await startTrainingRound(host, hostRec);
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');

    // A pessoa reage; os bots fixos não têm conexão e não reagem sozinhos.
    expectOkAck(await reactionSend(host, created.roomCode, 'injustica'));
    const bot = latestState(hostRec).room.participants.find((entry) => entry.kind === 'bot');
    if (bot === undefined) throw new Error('bot ausente');

    // Vários turnos correm sozinhos sem nenhuma reação automática dos bots.
    for (let step = 0; step < 6; step += 1) {
      const state = latestState(hostRec);
      if (state.room.status !== 'playing') break;
      if (state.self.view?.currentPlayerId === created.playerId) {
        await playHumanTurn(host, hostRec, roundId);
        continue;
      }
      await advanceBotTurn(ctx.clock, hostRec);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(room.reactionNextSeq).toBe(2);
    expect(hostRec.reactions).toHaveLength(1);

    // Cliente sem vínculo não emite; identidade de bot não entra pelo payload.
    const impostor = await newClient();
    expectError(await reactionSend(impostor, created.roomCode, 'eita'), 'NOT_IN_ROOM');
    expectError(
      await request<Ack<ReactionSendAck>>(impostor, 'client:reactionSend', {
        intentId: intent(),
        roomCode: created.roomCode,
        type: 'eita',
        author: { playerId: bot.id },
      }),
      'INVALID_PAYLOAD',
    );
  });

  it('intervalo de 5s exato entre tipos, sem consumir a janela em recusas', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));

    const t0 = ctx.clock.now();
    const first = expectOkAck(await reactionSend(host, created.roomCode, 'eita'));
    expect(first.limits.nextSendAt).toBe(t0 + REACTION_SENDER_COOLDOWN_MS);

    // 4.999 ms depois a troca de tipo ainda recusa, sem consumir o intervalo.
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS - 1);
    const refused = await reactionSend(host, created.roomCode, 'injustica');
    const refusedBody = expectError(refused, 'REACTION_SENDER_COOLDOWN');
    expect(refusedBody.retry).toEqual({
      serverTime: t0 + REACTION_SENDER_COOLDOWN_MS - 1,
      retryAt: t0 + REACTION_SENDER_COOLDOWN_MS,
      scope: 'sender',
    });
    expect(Object.keys(refusedBody.retry ?? {}).sort()).toEqual(['retryAt', 'scope', 'serverTime']);
    ctx.clock.advance(1);
    const second = expectOkAck(await reactionSend(host, created.roomCode, 'injustica'));
    expect(second.limits).toEqual({ serverTime: t0 + REACTION_SENDER_COOLDOWN_MS, nextSendAt: t0 + 2 * REACTION_SENDER_COOLDOWN_MS });

    // No limite exato, outro tipo é aceito e a janela seguinte começa ali.
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS);
    const third = expectOkAck(await reactionSend(host, created.roomCode, 'eita'));
    expect(third.limits).toEqual({ serverTime: t0 + 2 * REACTION_SENDER_COOLDOWN_MS, nextSendAt: t0 + 3 * REACTION_SENDER_COOLDOWN_MS });
  });

  it('replay devolve a mesma reação sem retransmitir nem renovar o prazo; reuso conflitante recusa', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    const t0 = ctx.clock.now();
    const shared = intent();
    const first = expectOkAck(await reactionSend(host, created.roomCode, 'eita', shared));
    const replay = expectOkAck(await reactionSend(host, created.roomCode, 'eita', shared));
    expect(replay).toEqual(first);
    await waitFor(() => hostRec.reactions.length === 1 && guestRec.reactions.length === 1, 'broadcast único');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.reactions.length).toBe(1);

    // Replay no meio da janela devolve o ack original: o prazo não é renovado.
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS - 1);
    const replayLater = expectOkAck(await reactionSend(host, created.roomCode, 'eita', shared));
    expect(replayLater.limits).toEqual({ serverTime: t0, nextSendAt: t0 + REACTION_SENDER_COOLDOWN_MS });
    expectError(await reactionSend(host, created.roomCode, 'injustica'), 'REACTION_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await reactionSend(host, created.roomCode, 'injustica'));

    // Mesmo id com outro conteúdo é outra intenção.
    expectError(await reactionSend(host, created.roomCode, 'carinho', shared), 'INTENT_REUSED');

    // Replay de recusa não reexecuta nem retransmite.
    const refused = intent();
    expectError(await reactionSend(host, created.roomCode, 'eita', refused), 'REACTION_SENDER_COOLDOWN');
    expectError(await reactionSend(host, created.roomCode, 'eita', refused), 'REACTION_SENDER_COOLDOWN');
    const broadcastBefore = hostRec.reactions.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.reactions.length).toBe(broadcastBefore);
  });

  it('recuperação, troca de rodada e estado preservam os limites ativos com restante calculável', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    const t0 = ctx.clock.now();
    expectOkAck(await reactionSend(host, created.roomCode, 'eita'));

    // Queda e retorno da mesma identidade no meio da janela: o estado da
    // retomada traz o instante calculável e o replay da retomada é seguro.
    host.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    ctx.clock.advance(1000);
    const back = await newClient();
    const backRec = record(back);
    const rejoined = expectOkAck(
      await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Ana',
        avatar: 'raposa',
        credential: created.credential,
      }),
    );
    expect(rejoined.rejoined).toBe(true);
    expect(rejoined.playerId).toBe(created.playerId);
    await waitFor(() => backRec.states.length > 0, 'estado da retomada');
    const recovered = latestState(backRec);
    expect(recovered.room.serverTime).toBe(t0 + 1000);
    expect(recovered.self.reactionNextSendAt).toBe(t0 + REACTION_SENDER_COOLDOWN_MS);
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS - 1000 - 1);
    expectError(await reactionSend(back, created.roomCode, 'injustica'), 'REACTION_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await reactionSend(back, created.roomCode, 'injustica'));

    // Nova rodada não zera a janela vigente (a hostagem passou para Bia na queda).
    await setReady(back, true);
    await setReady(guest, true);
    expectOkAck(await startRound(guest));
    await waitFor(() => latestState(backRec).room.status === 'playing', 'rodada');
    ctx.clock.advance(REACTION_SENDER_COOLDOWN_MS - 1);
    expectError(await reactionSend(back, created.roomCode, 'carinho'), 'REACTION_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    const afterRound = expectOkAck(await reactionSend(back, created.roomCode, 'carinho'));
    expect(afterRound.reaction.sentAt).toBe(t0 + 2 * REACTION_SENDER_COOLDOWN_MS);
  });

  it('reação não altera o jogo, não invalida intenção legal e não vaza dados privados', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined || room.round === null) throw new Error('rodada ausente');
    const roundId = room.round.id;

    const roundBefore = JSON.stringify(room.round.state);
    const versionBefore = room.version;
    const botTimerBefore = room.botTimer;
    const scoreboardBefore = JSON.stringify(latestState(hostRec).room.scoreboard);
    const handBefore = latestState(hostRec).self.view?.hand.map((card) => card.id) ?? [];
    expect(handBefore.length).toBeGreaterThan(0);

    const accepted = expectOkAck(await reactionSend(host, created.roomCode, 'eita'));
    const refused = await reactionSend(host, created.roomCode, 'injustica');
    expectError(refused, 'REACTION_SENDER_COOLDOWN');

    // Sucesso e recusa preservam motor, versão, placar e agendamento do bot.
    expect(JSON.stringify(room.round.state)).toBe(roundBefore);
    expect(room.version).toBe(versionBefore);
    expect(room.botTimer).toBe(botTimerBefore);
    expect(JSON.stringify(latestState(hostRec).room.scoreboard)).toBe(scoreboardBefore);

    // A intenção legal preparada antes da reação continua válida.
    const cardId = latestState(hostRec).self.view?.playableCardIds[0];
    if (cardId === undefined) throw new Error('carta jogável ausente');
    expectOkAck(await sendCommand(host, roundId, { type: 'play', cardId }));

    // O transporte da reação não carrega carta da mão nem credencial.
    const broadcast = hostRec.reactions[0];
    if (broadcast === undefined) throw new Error('broadcast ausente');
    const raw = JSON.stringify({ ack: accepted, broadcast });
    expect(raw).not.toContain(created.credential);
    expect(raw).not.toContain('credential');
    for (const card of handBefore) expect(raw).not.toContain(card);
  });
});
