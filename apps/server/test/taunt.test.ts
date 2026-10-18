import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck, RetryInfo, TauntSendAck } from '@tretta/protocol';
import { TAUNT_SENDER_COOLDOWN_MS, TAUNT_TARGET_WINDOW_MS } from '@tretta/protocol/shared';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  leaveRoom,
  record,
  removeParticipant,
  reactionSend,
  request,
  sendCommand,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  tauntSend,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { challengeDeck, scenarioDeck } from './decks.js';

function expectOkAck<T extends { ok: boolean; error?: { message: string } }>(ack: T): Extract<T, { ok: true }> {
  expect(ack.ok, ack.ok ? '' : ack.error?.message).toBe(true);
  return ack as Extract<T, { ok: true }>;
}

function expectError(
  ack: { ok: boolean; error?: { code: string; message: string; retry?: RetryInfo } },
  code: string,
): { code: string; message: string; retry?: RetryInfo } {
  expect(ack.ok).toBe(false);
  expect(ack.error?.code).toBe(code);
  expect(ack.error?.message.length).toBeGreaterThan(0);
  if (ack.error === undefined) throw new Error(`Recusa esperada com o código ${code}.`);
  return ack.error;
}

describe('provocações da sala', () => {
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

  it('provocações fluem em preparação, rodada, espera, pausa e resultado com o mesmo evento para todos', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Preparação: Ana provoca Bia.
    const lobbyTaunt = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    expect(lobbyTaunt.taunt.type).toBe('tomate');
    expect(lobbyTaunt.taunt.sender).toEqual({ playerId: created.playerId, nickname: 'Ana', avatar: 'raposa' });
    expect(lobbyTaunt.taunt.target).toEqual({ playerId: joined.playerId, nickname: 'Bia', avatar: 'lobo' });
    expect(lobbyTaunt.taunt.id.startsWith('t_')).toBe(true);
    await waitFor(() => hostRec.taunts.length === 1 && guestRec.taunts.length === 1, 'broadcast na preparação');
    expect(hostRec.taunts[0]?.taunt).toEqual(lobbyTaunt.taunt);
    expect(hostRec.taunts[0]?.roomCode).toBe(created.roomCode);

    // Rodada com quem espera: Cai provoca Ana.
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const watcher = await newClient();
    const watcherRec = record(watcher);
    const watched = expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(watcher, created.roomCode, 'risadas', created.playerId));
    await waitFor(() => hostRec.taunts.length === 2, 'provocação de quem espera');
    expect(hostRec.taunts[1]?.taunt.sender.nickname).toBe('Cai');
    expect(hostRec.taunts[1]?.taunt.type).toBe('risadas');

    // Pausa: Bia desconecta; Ana provoca mesmo pausada.
    guest.disconnect();
    await waitFor(() => latestState(hostRec).room.status === 'paused', 'pausa');
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(host, created.roomCode, 'torta', watched.playerId));
    await waitFor(() => watcherRec.taunts.some((entry) => entry.taunt.type === 'torta'), 'provocação na pausa');

    // Retomada e resultado: provocação no resultado compartilha com todos.
    // Bia foi substituída e a finalização remove a vaga desconectada do substituto;
    // alvos do resultado são as identidades que permanecem na sala.
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined || room.round === null) throw new Error('rodada ausente');
    ctx.clock.advance(90_000);
    expectOkAck(await request<{ ok: boolean }>(host, 'client:substituteAbsent', { intentId: intent(), targetId: joined.playerId }));
    expectOkAck(await request<{ ok: boolean }>(host, 'client:endRoundWithoutWinner', { intentId: intent() }));
    await waitFor(() => latestState(hostRec).room.status === 'finished', 'resultado');
    expectError(await tauntSend(watcher, created.roomCode, 'choro', joined.playerId), 'UNKNOWN_PARTICIPANT');
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(watcher, created.roomCode, 'choro', created.playerId));
    await waitFor(() => hostRec.taunts.length === 4, 'provocação no resultado');
    expect(hostRec.taunts.at(-1)?.taunt.type).toBe('choro');

    // Sem histórico paginado: nada a recuperar além do que cada sessão já viu.
    expect(watcherRec.taunts.map((entry) => entry.taunt.type)).toEqual(['risadas', 'torta', 'choro']);
  });

  it('recuo do emissor exato de 15s: 14999 recusa, 15000 aceita, e vale para qualquer tipo ou alvo', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    const watcher = await newClient();
    const watched = expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));

    const first = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));

    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    const tooSoon = await tauntSend(host, created.roomCode, 'torta', watched.playerId);
    expectError(tooSoon, 'TAUNT_SENDER_COOLDOWN');
    expect((tooSoon as { error: { message: string } }).error.message).toContain('de novo em');

    ctx.clock.advance(1);
    const second = expectOkAck(await tauntSend(host, created.roomCode, 'torta', watched.playerId));
    expect(second.taunt.id).not.toBe(first.taunt.id);

    // Recusa não consumiu nada: no limite o próximo aceita de novo.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    expectError(await tauntSend(host, created.roomCode, 'choro', joined.playerId), 'TAUNT_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(host, created.roomCode, 'choro', joined.playerId));
  });

  it('máximo de três provocações por alvo em 60s, compartilhado entre emissores, com liberação no limite exato', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    const third = await newClient();
    const thirdJoin = expectOkAck(await joinOrFail(third, created.roomCode, 'Cai'));

    // Três emissores distintos no mesmo instante, mesmo alvo: cota do alvo compartilhada.
    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    expectOkAck(await tauntSend(third, created.roomCode, 'torta', joined.playerId));
    const fourth = await newClient();
    const fourthJoin = expectOkAck(await joinOrFail(fourth, created.roomCode, 'Dai'));
    expectOkAck(await tauntSend(fourth, created.roomCode, 'risadas', joined.playerId));

    // Quarta provocação ao mesmo alvo recusa; outro alvo não herda a cota.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    const limited = await tauntSend(host, created.roomCode, 'choro', joined.playerId);
    expectError(limited, 'TAUNT_TARGET_LIMIT');
    expect((limited as { error: { message: string } }).error.message).toContain('Tente de novo');
    expectOkAck(await tauntSend(host, created.roomCode, 'choro', thirdJoin.playerId));

    // Fronteira da janela: um milissegunto antes do limite das três aceites ainda recusa.
    ctx.clock.advance(TAUNT_TARGET_WINDOW_MS - TAUNT_SENDER_COOLDOWN_MS - 1);
    expectError(await tauntSend(third, created.roomCode, 'tomate', joined.playerId), 'TAUNT_TARGET_LIMIT');
    // No limite exato de 60s as três aceites saem da janela e o alvo libera.
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(third, created.roomCode, 'tomate', joined.playerId));

    // Quarta pessoa como alvo: segue elegível.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(fourth, created.roomCode, 'torta', fourthJoin.playerId));
  });

  it('replay devolve o mesmo evento sem retransmitir nem consumir cota; assinatura divergente é INTENT_REUSED', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    const third = await newClient();
    const thirdJoin = expectOkAck(await joinOrFail(third, created.roomCode, 'Cai'));
    const fourth = await newClient();
    const fourthJoin = expectOkAck(await joinOrFail(fourth, created.roomCode, 'Dai'));

    const sharedIntent = intent();
    const first = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId, sharedIntent));
    const replay = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId, sharedIntent));
    expect(replay.taunt).toEqual(first.taunt);
    // Replay devolve a referência de tempo original: não renova o prazo.
    expect(replay.limits).toEqual(first.limits);
    await waitFor(() => hostRec.taunts.length === 1, 'broadcast único');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.taunts.length).toBe(1);
    expect(guestRec.taunts.length).toBe(1);

    // Replay não consumiu a cota do alvo: só mais dois aceites completam as três.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(third, created.roomCode, 'torta', joined.playerId));
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(fourth, created.roomCode, 'risadas', joined.playerId));
    ctx.clock.advance(1);
    const targetLimited = await tauntSend(host, created.roomCode, 'choro', joined.playerId);
    expectError(targetLimited, 'TAUNT_TARGET_LIMIT');

    // Replay de erro: mesma recusa sem novo broadcast.
    const before = hostRec.taunts.length;
    const errorIntent = intent();
    const rejected = await tauntSend(host, created.roomCode, 'choro', joined.playerId, errorIntent);
    expectError(rejected, 'TAUNT_TARGET_LIMIT');
    const rejectedReplay = await tauntSend(host, created.roomCode, 'choro', joined.playerId, errorIntent);
    expectError(rejectedReplay, 'TAUNT_TARGET_LIMIT');

    // Recuo do emissor: replay de recusa também não reexecuta.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(host, created.roomCode, 'choro', thirdJoin.playerId));
    const cooldownIntent = intent();
    expectError(await tauntSend(host, created.roomCode, 'tomate', fourthJoin.playerId, cooldownIntent), 'TAUNT_SENDER_COOLDOWN');
    expectError(await tauntSend(host, created.roomCode, 'tomate', fourthJoin.playerId, cooldownIntent), 'TAUNT_SENDER_COOLDOWN');

    // Assinatura divergente: mesmo id com outro alvo é outra intenção.
    const divergent = await tauntSend(host, created.roomCode, 'tomate', fourthJoin.playerId, sharedIntent);
    expectError(divergent, 'INTENT_REUSED');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.taunts.length).toBe(before + 1);
  });

  it('sem vínculo, sala alheia, alvo inexistente ou histórico do placar: recusa sem consumir', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Conexão sem sala.
    const idle = await newClient();
    expectError(await tauntSend(idle, created.roomCode, 'tomate', joined.playerId), 'NOT_IN_ROOM');

    // Sala diferente da conexão.
    const other = await newClient();
    expectOkAck(await createRoom(other, 'Zara'));
    expectError(await tauntSend(other, created.roomCode, 'tomate', joined.playerId), 'NOT_IN_ROOM');

    // Alvo desconhecido e alvo vazio.
    expectError(await tauntSend(host, created.roomCode, 'tomate', 'p_inexistente'), 'UNKNOWN_PARTICIPANT');
    expectError(await tauntSend(host, created.roomCode, 'tomate', ''), 'INVALID_PAYLOAD');

    // Entrada histórica do placar não é alvo válido: Bia sai do lobby.
    expectOkAck(await leaveRoom(guest));
    const staleTarget = await tauntSend(host, created.roomCode, 'torta', joined.playerId);
    expectError(staleTarget, 'UNKNOWN_PARTICIPANT');

    // Tipo fora do enum fechado e campos autoritativos adulterados recusam a intenção.
    expectError(await request<Ack<TauntSendAck>>(host, 'client:tauntSend', { intentId: intent(), roomCode: created.roomCode, type: 'bolo', targetId: created.playerId }), 'INVALID_PAYLOAD');
    expectError(
      await request<Ack<TauntSendAck>>(host, 'client:tauntSend', {
        intentId: intent(),
        roomCode: created.roomCode,
        type: 'tomate',
        targetId: created.playerId,
        author: { playerId: created.playerId, nickname: 'Hack', avatar: 'lobo' },
        sentAt: 1,
      }),
      'INVALID_PAYLOAD',
    );

    // Removido pelo anfitrião: alvo deixa de ser elegível.
    const guestBack = await newClient();
    const rejoinedGuest = expectOkAck(await joinOrFail(guestBack, created.roomCode, 'Bia'));
    const toRemove = await newClient();
    const removedJoin = expectOkAck(await joinOrFail(toRemove, created.roomCode, 'Cai'));
    expectOkAck(await removeParticipant(host, removedJoin.playerId));
    expectError(await tauntSend(host, created.roomCode, 'choro', removedJoin.playerId), 'UNKNOWN_PARTICIPANT');

    // Nenhuma recusa gerou broadcast na sala (nenhuma provocação aceita).
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.tauntNextSeq).toBe(1);
    expect(rejoinedGuest.playerId).not.toBe(joined.playerId);
  });

  it('contadores seguem a identidade: retorno, rodada nova e substituição não reiniciam', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));

    // Retorno/reload com a mesma credencial no meio da janela do emissor.
    host.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const back = await newClient();
    expectOkAck(
      await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Ana',
        avatar: 'raposa',
        credential: created.credential,
      }),
    );
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    expectError(await tauntSend(back, created.roomCode, 'torta', joined.playerId), 'TAUNT_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(back, created.roomCode, 'torta', joined.playerId));

    // Troca de rodada não zera a janela. A hostagem passou a Bia durante a
    // ausência de Ana; a identidade recupera a mão, não o cargo de anfitriã.
    await setNextDeck(back, created.roomCode, scenarioDeck());
    await setReady(back, true);
    await setReady(guest, true);
    expectOkAck(await startRound(guest));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    expectError(await tauntSend(back, created.roomCode, 'risadas', joined.playerId), 'TAUNT_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(back, created.roomCode, 'risadas', joined.playerId));

    // Bia provoca e sai da rodada: substituto assume a mão, a identidade permanece.
    expectOkAck(await tauntSend(guest, created.roomCode, 'choro', created.playerId));
    expectOkAck(await leaveRoom(guest));
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.participants.get(joined.playerId)?.autoControlled).toBe(true);

    // Humano volta com a mesma credencial e a cota continua de onde parou.
    const guestAgain = await newClient();
    const rejoined = expectOkAck(
      await request<Ack<JoinRoomAck>>(guestAgain, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Bia',
        avatar: 'lobo',
        credential: joined.credential,
      }),
    );
    expect(rejoined.rejoined).toBe(true);
    expect(rejoined.playerId).toBe(joined.playerId);
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    expectError(await tauntSend(guestAgain, created.roomCode, 'torta', created.playerId), 'TAUNT_SENDER_COOLDOWN');
    ctx.clock.advance(1);
    expectOkAck(await tauntSend(guestAgain, created.roomCode, 'torta', created.playerId));

    // Substituto automático não provoca sozinho: nenhuma provocação espontânea.
    const seqBeforeBot = room.tauntNextSeq;
    ctx.clock.advance(DEFAULT_BOT_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(room.tauntNextSeq).toBe(seqBeforeBot);
  });

  it('expiração da sala vazia elimina a janela; reconexão não reapresenta provocação antiga', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.tauntTargetAts.size).toBe(1);

    // Identidade removida limpa a própria janela.
    expectOkAck(await removeParticipant(host, joined.playerId));
    expect(room.tauntTargetAts.size).toBe(0);

    // Vazia e expirada: estado some com a sala.
    expectOkAck(await leaveRoom(host));
    ctx.clock.advance(15 * 60_000);
    expect(ctx.server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();

    // Nova sala: sessão recarregada não recebe nada antigo.
    const fresh = await newClient();
    const freshRec = record(fresh);
    const freshRoom = expectOkAck(await createRoom(fresh, 'Zara'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(freshRec.taunts).toHaveLength(0);
    const freshGuest = await newClient();
    const freshJoined = expectOkAck(await joinOrFail(freshGuest, freshRoom.roomCode, 'Lia'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(freshGuest.id).toBeDefined();
    expect(freshJoined.playerId).not.toBe(joined.playerId);
  });

  it('provocações não mudam a versão nem reagendam o bot', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');

    // Bia sai: substituto agendado. Ana joga/desconta até passar a vez ao bot.
    expectOkAck(await leaveRoom(guest));
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined || room.round === null) throw new Error('rodada ausente');
    const roundId = room.round.id;
    if (latestState(hostRec).self.view?.currentPlayerId === created.playerId) {
      expectOkAck(await sendCommand(host, roundId, { type: 'draw' }));
      expectOkAck(await sendCommand(host, roundId, { type: 'pass' }));
    }
    await waitFor(() => latestState(hostRec).self.view?.currentPlayerId === joined.playerId, 'vez do substituto');

    // Quatro emissores independentes: três aceites ao mesmo alvo, a quarta recusa.
    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    const third = await newClient();
    const thirdJoin = expectOkAck(await joinOrFail(third, created.roomCode, 'Lia'));
    const fourth = await newClient();
    expectOkAck(await joinOrFail(fourth, created.roomCode, 'Dai'));
    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    expectOkAck(await tauntSend(watcher, created.roomCode, 'risadas', joined.playerId));
    expectOkAck(await tauntSend(third, created.roomCode, 'torta', joined.playerId));
    const refused = await tauntSend(fourth, created.roomCode, 'choro', joined.playerId);
    expectError(refused, 'TAUNT_TARGET_LIMIT');
    await waitFor(() => latestState(hostRec).room.version === room.version, 'estado estável');
    const versionBefore = latestState(hostRec).room.version;
    const botTimerBefore = room.botTimer;

    // Recusa repetida e aceites a outro alvo não tocam versão nem timer. Reação
    // aceita e recusa de reação também ficam fora do jogo.
    expectError(await tauntSend(fourth, created.roomCode, 'choro', joined.playerId), 'TAUNT_TARGET_LIMIT');
    expectOkAck(await tauntSend(fourth, created.roomCode, 'tomate', thirdJoin.playerId));
    expectOkAck(await reactionSend(host, created.roomCode, 'rindo'));
    expectError(await reactionSend(host, created.roomCode, 'bravo'), 'REACTION_SENDER_COOLDOWN');
    expect(latestState(hostRec).room.version).toBe(versionBefore);
    expect(room.botTimer).toBe(botTimerBefore);
    expect(room.botTimerVersion).toBe(versionBefore);

    // O bot dispara uma única vez no prazo original, sem reagendamento.
    ctx.clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => latestState(hostRec).room.version > versionBefore, 'ação do bot');
    const versionAfterBot = latestState(hostRec).room.version;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(latestState(hostRec).room.version).toBe(versionAfterBot);
    const joinedHand = latestState(hostRec).self.view?.players.find((player) => player.id === joined.playerId)?.handCount;
    expect([6, 8]).toContain(joinedHand);
    expect(watcherRec.taunts.length).toBeGreaterThan(0);
  });

  it('invariância do motor durante compra humana, janela de última carta, nova entrada e retomada', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    // Ana chega a uma carta e abre a janela de última carta para Bia.
    await setNextDeck(host, created.roomCode, challengeDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const roundId0 = roomRoundId(ctx, created.roomCode);
    for (let guard = 0; guard < 14; guard += 1) {
      // A janela é pública; qualquer view atualizada encerra a sequência antes
      // de a próxima ação voluntary fechá-la.
      if (latestState(hostRec).self.view?.lastCardWindow !== null || latestState(guestRec).self.view?.lastCardWindow !== null) break;
      const turn = latestState(hostRec).self.view?.currentPlayerId;
      if (turn === created.playerId) {
        const cardId = latestState(hostRec).self.view?.playableCardIds.find((id) => id.startsWith('red-'));
        if (cardId === undefined) throw new Error('carta vermelha jogável ausente');
        expectOkAck(await sendCommand(host, roundId0, { type: 'play', cardId }));
      } else {
        // Bia não tem vermelhas: compra uma carta inofensiva e passa a vez.
        expectOkAck(await sendCommand(guest, roundId0, { type: 'draw' }));
        expectOkAck(await sendCommand(guest, roundId0, { type: 'pass' }));
      }
    }
    await waitFor(() => latestState(guestRec).self.view?.lastCardWindow !== null, 'janela de última carta aberta');
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined || room.round === null) throw new Error('rodada ausente');
    const roundId = room.round.id;
    const versionWithWindow = room.version;

    // Compra humana durante a janela seguida de provocação: a compra muda o jogo, a provocação não.
    expectOkAck(await sendCommand(guest, roundId, { type: 'draw' }));
    const versionAfterHumanDraw = room.version;
    expect(versionAfterHumanDraw).toBeGreaterThan(versionWithWindow);
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    expectOkAck(await tauntSend(guest, created.roomCode, 'risadas', created.playerId));
    expect(room.version).toBe(versionAfterHumanDraw);

    // Nova entrada durante a vez do substituto: provocação de quem acaba de chegar não toca o motor.
    expectOkAck(await leaveRoom(guest));
    await waitFor(() => room.participants.get(joined.playerId)?.autoControlled === true, 'substituto agendado');
    const late = await newClient();
    const lateRec = record(late);
    expectOkAck(await joinOrFail(late, created.roomCode, 'Dai'));
    const versionBeforeLate = room.version;
    expectOkAck(await tauntSend(late, created.roomCode, 'torta', created.playerId));
    expect(room.version).toBe(versionBeforeLate);

    // Queda e retorno durante a vez do bot: a provocação recebida na pausa não
    // reaparece e a retomada preserva a mesa congelada. Ana está desconectada
    // sem substituto, então o alvo é a Bia, elegível como assento substituído.
    host.disconnect();
    await waitFor(() => latestState(lateRec).room.status === 'paused', 'pausa');
    const pausedTable = latestState(lateRec).table;
    expect(pausedTable).not.toBeNull();
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(late, created.roomCode, 'choro', joined.playerId));
    // O retorno da Ana com a credencial resolve a única causa da pausa e a
    // rodada retoma sozinha; a hostemia ficou com Dai e não reverte.
    const backHost = await newClient();
    const backRec = record(backHost);
    expectOkAck(
      await request<Ack<JoinRoomAck>>(backHost, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Ana',
        avatar: 'raposa',
        credential: created.credential,
      }),
    );
    await waitFor(() => latestState(backRec).room.status === 'playing', 'retomada');
    // A rodada volta de pé com os mesmos assentos; mãos podem mudar porque o
    // substituto retoma a vez e age (compra/jogada) — a provocação não interfere.
    expect(latestState(backRec).table?.players.map((player) => player.id).sort()).toEqual(pausedTable?.players.map((player) => player.id).sort());
    expect(latestState(backRec).room.version).toBeGreaterThan(versionBeforeLate);
  });

  it('alvo disponível: conectado, assento substituído e retorno valem; ausente sem substituto recusa sem consumir', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Pessoa conectada: aceita.
    expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));

    // Rodada: Bia cai e fica ausente sem substituto; a provocação à identidade
    // dela é recusada com explicação, sem consumir o recuo do emissor.
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(hostRec).room.status === 'playing', 'rodada');
    const other = await newClient();
    const otherJoin = expectOkAck(await joinOrFail(other, created.roomCode, 'Cai'));
    guest.disconnect();
    await waitFor(() => latestState(hostRec).room.status === 'paused', 'pausa');
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    const unavailable = await tauntSend(host, created.roomCode, 'torta', joined.playerId);
    const unavailableBody = expectError(unavailable, 'TAUNT_TARGET_UNAVAILABLE');
    expect(unavailableBody.message.length).toBeGreaterThan(0);
    expect(unavailableBody.retry).toBeUndefined();
    // No mesmo instante, alvo conectado aceita: a recusa não consumiu nada.
    expectOkAck(await tauntSend(host, created.roomCode, 'torta', otherJoin.playerId));

    // Substituto automático na pausa: o assento volta a ser elegível sem trocar ids.
    ctx.clock.advance(90_000);
    expectOkAck(await request<{ ok: boolean }>(host, 'client:substituteAbsent', { intentId: intent(), targetId: joined.playerId }));
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.participants.get(joined.playerId)?.autoControlled).toBe(true);
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    const toSubstitute = expectOkAck(await tauntSend(host, created.roomCode, 'risadas', joined.playerId));
    expect(toSubstitute.taunt.target.playerId).toBe(joined.playerId);

    // Retorno com a mesma credencial: cancela o substituto e segue elegível.
    const back = await newClient();
    const rejoined = expectOkAck(
      await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Bia',
        avatar: 'lobo',
        credential: joined.credential,
      }),
    );
    expect(rejoined.playerId).toBe(joined.playerId);
    expect(room.participants.get(joined.playerId)?.autoControlled).toBe(false);
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    expectOkAck(await tauntSend(host, created.roomCode, 'choro', joined.playerId));
  });

  it('apelidos e avatares iguais não confundem alvos: a identidade vem do id', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const biaOne = await newClient();
    const first = expectOkAck(await joinOrFail(biaOne, created.roomCode, 'Bia'));
    const biaTwo = await newClient();
    const second = expectOkAck(await joinOrFail(biaTwo, created.roomCode, 'Bia'));
    expect(first.playerId).not.toBe(second.playerId);

    const accepted = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', first.playerId));
    expect(accepted.taunt.target).toEqual({ playerId: first.playerId, nickname: 'Bia', avatar: 'lobo' });

    // Só a segunda Bia cai; a primeira continua elegível e a recusa aponta a
    // identidade ausente, sem redirecionar o envio.
    await waitFor(() => latestState(hostRec).room.participants.length === 3, 'lobby completo');
    biaTwo.disconnect();
    await waitFor(
      () => latestState(hostRec).room.participants.find((entry) => entry.id === second.playerId)?.connected === false,
      'queda da segunda Bia',
    );
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS);
    const toFirst = expectOkAck(await tauntSend(host, created.roomCode, 'torta', first.playerId));
    expect(toFirst.taunt.target.playerId).toBe(first.playerId);
    expectError(await tauntSend(host, created.roomCode, 'choro', second.playerId), 'TAUNT_TARGET_UNAVAILABLE');
  });

  it('metadados de tempo: sucesso, recuo do emissor e cota do alvo com escopos distintos', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    const third = await newClient();
    const thirdJoin = expectOkAck(await joinOrFail(third, created.roomCode, 'Cai'));

    const t0 = ctx.clock.now();
    const accepted = expectOkAck(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    expect(accepted.limits).toEqual({ serverTime: t0, nextSendAt: t0 + TAUNT_SENDER_COOLDOWN_MS });

    // Recuo do emissor: escopo próprio, sem alvo, com o restante calculável.
    ctx.clock.advance(TAUNT_SENDER_COOLDOWN_MS - 1);
    const senderBody = expectError(await tauntSend(host, created.roomCode, 'torta', thirdJoin.playerId), 'TAUNT_SENDER_COOLDOWN');
    expect(senderBody.retry).toEqual({
      serverTime: t0 + TAUNT_SENDER_COOLDOWN_MS - 1,
      retryAt: t0 + TAUNT_SENDER_COOLDOWN_MS,
      scope: 'sender',
    });
    expect(senderBody.retry?.targetId).toBeUndefined();

    // Cota do alvo: três aceites de emissores distintos esgotam a janela de Bia.
    expectOkAck(await tauntSend(third, created.roomCode, 'torta', joined.playerId));
    const fourth = await newClient();
    const fourthJoin = expectOkAck(await joinOrFail(fourth, created.roomCode, 'Dai'));
    expectOkAck(await tauntSend(fourth, created.roomCode, 'risadas', joined.playerId));

    // No limite do recuo, a quarta provocação à Bia recusa pela cota do alvo e
    // informa escopo/alvo; o próximo destinatário não herda a espera.
    ctx.clock.advance(1);
    const quotaBody = expectError(await tauntSend(host, created.roomCode, 'choro', joined.playerId), 'TAUNT_TARGET_LIMIT');
    expect(quotaBody.retry).toEqual({
      serverTime: t0 + TAUNT_SENDER_COOLDOWN_MS,
      retryAt: t0 + TAUNT_TARGET_WINDOW_MS,
      scope: 'target',
      targetId: joined.playerId,
    });
    const nextTarget = expectOkAck(await tauntSend(host, created.roomCode, 'choro', fourthJoin.playerId));
    expect(nextTarget.limits).toEqual({
      serverTime: t0 + TAUNT_SENDER_COOLDOWN_MS,
      nextSendAt: t0 + 2 * TAUNT_SENDER_COOLDOWN_MS,
    });
    expect(thirdJoin.playerId).not.toBe(fourthJoin.playerId);
  });
});

function roomRoundId(ctx: { server: TestServer }, roomCode: string): string {
  const room = ctx.server.server.rooms.debugRoom(roomCode);
  if (room === undefined || room.round === null) throw new Error('rodada ausente');
  return room.round.id;
}
