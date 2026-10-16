import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, ChatSendAck, JoinRoomAck } from '@tretta/protocol';
import { chatCodePointLength, CHAT_MESSAGE_MAX_LENGTH, CHAT_RATE_WINDOW_MS } from '@tretta/protocol/shared';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';
import {
  chatHistory,
  chatSend,
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
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
  substituteAbsent,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { scenarioDeck } from './decks.js';

function expectOkAck<T extends { ok: boolean; error?: { message: string } }>(ack: T): Extract<T, { ok: true }> {
  expect(ack.ok, ack.ok ? '' : ack.error?.message).toBe(true);
  return ack as Extract<T, { ok: true }>;
}

function expectError(ack: { ok: boolean; error?: { code: string; message: string } }, code: string): void {
  expect(ack.ok).toBe(false);
  expect(ack.error?.code).toBe(code);
  expect(ack.error?.message.length).toBeGreaterThan(0);
}

describe('chat da sala', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(options: { retentionMs?: number } = {}): Promise<NonNullable<typeof active>> {
    const clock = new FakeClock();
    const server = await startTestServer({
      testHooks: true,
      clock,
      ...(options.retentionMs === undefined ? {} : { retentionMs: options.retentionMs }),
    });
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

  it('mensagens fluem em preparação, rodada, pausa, espera e resultado com ordem e autor coerentes', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    // Preparação
    expectOkAck(await chatSend(host, created.roomCode, 'olá na preparação'));
    expectOkAck(await chatSend(guest, created.roomCode, 'oi, Ana!'));
    await waitFor(() => hostRec.chat.length === 2, 'chat na preparação');
    expect(hostRec.chat[0]?.message.seq).toBe(1);
    expect(hostRec.chat[0]?.message.author.playerId).toBe(created.playerId);
    expect(hostRec.chat[0]?.message.author.nickname).toBe('Ana');
    expect(hostRec.chat[1]?.message.author.playerId).toBe(joined.playerId);

    // Rodada com quem espera
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expectOkAck(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    expectOkAck(await chatSend(watcher, created.roomCode, 'torcendo da espera'));
    await waitFor(() => hostRec.chat.length === 3, 'chat do espectador');
    expect(hostRec.chat[2]?.message.author.nickname).toBe('Cai');
    expect(hostRec.chat[2]?.message.seq).toBe(3);

    // Pausa
    guest.disconnect();
    await waitFor(() => latestState(hostRec).room.status === 'paused', 'pausa');
    expectOkAck(await chatSend(host, created.roomCode, 'pausa conversada'));
    await waitFor(() => watcherRec.chat.some((entry) => entry.message.text === 'pausa conversada'), 'chat na pausa');

    // Retomada pelo anfitrião com substituto elegível
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined || room.round === null) throw new Error('rodada ausente');
    ctx.clock.advance(90_000);
    expectOkAck(await substituteAbsent(host, joined.playerId));

    // Espera permanece com chat
    expectOkAck(await chatSend(watcher, created.roomCode, 'ainda esperando'));
    await waitFor(() => hostRec.chat.length === 5, 'chat após retomada');

    // Resultado
    expectOkAck(await request<{ ok: boolean }>(host, 'client:endRoundWithoutWinner', { intentId: intent() }));
    await waitFor(() => latestState(hostRec).room.status === 'finished', 'resultado');
    expectOkAck(await chatSend(host, created.roomCode, 'boa rodada!'));
    await waitFor(() => hostRec.chat.length === 6, 'chat no resultado');

    const history = expectOkAck(await chatHistory(host, created.roomCode));
    expect(history.messages.map((message) => message.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(history.messages.map((message) => message.text)).toEqual([
      'olá na preparação',
      'oi, Ana!',
      'torcendo da espera',
      'pausa conversada',
      'ainda esperando',
      'boa rodada!',
    ]);
    expect(history.hasMore).toBe(false);
  });

  it('rejeita vazio e longo com explicação, aceita o limite e exibe texto parecido com HTML literalmente', async () => {
    await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));

    expectError(await chatSend(host, created.roomCode, ''), 'CHAT_EMPTY');
    expectError(await chatSend(host, created.roomCode, '   \n\t '), 'CHAT_EMPTY');
    expectError(await chatSend(host, created.roomCode, 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1)), 'CHAT_TOO_LONG');

    const atLimit = expectOkAck(await chatSend(host, created.roomCode, 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH)));
    expect(chatCodePointLength(atLimit.message.text)).toBe(CHAT_MESSAGE_MAX_LENGTH);
    const emojiLimit = expectOkAck(await chatSend(host, created.roomCode, '😀'.repeat(CHAT_MESSAGE_MAX_LENGTH)));
    expect(chatCodePointLength(emojiLimit.message.text)).toBe(CHAT_MESSAGE_MAX_LENGTH);
    expectError(await chatSend(host, created.roomCode, '😀'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1)), 'CHAT_TOO_LONG');

    const html = '<script>alert("xss")</script> & <b>negrito</b>';
    const sent = expectOkAck(await chatSend(host, created.roomCode, html));
    expect(sent.message.text).toBe(html);
    await waitFor(() => hostRec.chat.some((entry) => entry.message.text === html), 'broadcast literal');
    const history = expectOkAck(await chatHistory(host, created.roomCode));
    expect(history.messages.at(-1)?.text).toBe(html);

    // Payload adulterado: campos de autor/id/horário são proibidos pelo schema.
    const spoofed = await request<Ack<ChatSendAck>>(host, 'client:chatSend', {
      intentId: intent(),
      roomCode: created.roomCode,
      text: 'oi',
      author: { playerId: created.playerId, nickname: 'Hack', avatar: 'lobo' },
      seq: 99,
      sentAt: 1,
    });
    expectError(spoofed, 'INVALID_PAYLOAD');
    const withSeq = await request<Ack<ChatSendAck>>(host, 'client:chatSend', {
      intentId: intent(),
      roomCode: created.roomCode,
      text: 'oi',
      seq: 99,
    });
    expectError(withSeq, 'INVALID_PAYLOAD');
  });

  it('limite de cinco a cada dez segundos por identidade, com janela móvel e reentrada sem reset', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));

    for (let index = 1; index <= 5; index++) {
      expectOkAck(await chatSend(host, created.roomCode, `msg ${index}`));
    }
    const limited = await chatSend(host, created.roomCode, 'sexta');
    expectError(limited, 'CHAT_RATE_LIMITED');
    expect((limited as { error: { message: string } }).error.message).toContain('Tente de novo');

    // Outra pessoa tem janela própria.
    for (let index = 1; index <= 5; index++) {
      expectOkAck(await chatSend(guest, created.roomCode, `bia ${index}`));
    }
    expectError(await chatSend(guest, created.roomCode, 'bia 6'), 'CHAT_RATE_LIMITED');

    // No limite exato de dez segundos a janela libera; um milissegunto antes não.
    ctx.clock.advance(CHAT_RATE_WINDOW_MS - 1);
    expectError(await chatSend(host, created.roomCode, 'ainda limitada'), 'CHAT_RATE_LIMITED');
    ctx.clock.advance(1);
    expectOkAck(await chatSend(host, created.roomCode, 'liberada no limite'));

    // Reentrada com a mesma identidade preserva a cota.
    host.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const back = await newClient();
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
    expect(joined.playerId).not.toBe(rejoined.playerId);
    ctx.clock.advance(1);
    for (let index = 1; index <= 4; index++) {
      expectOkAck(await chatSend(back, created.roomCode, `de volta ${index}`));
    }
    // Cinco aceitas na janela atual já (liberada + 4): a quinta do novo lote é recusada.
    expectError(await chatSend(back, created.roomCode, 'de volta 5'), 'CHAT_RATE_LIMITED');
    expect(created.playerId).toBe(rejoined.playerId);
  });

  it('replays de sucesso/erro e assinatura divergente não duplicam nem consomem cota', async () => {
    await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const sharedIntent = intent();

    const first = expectOkAck(await chatSend(host, created.roomCode, 'replayável', sharedIntent));
    const replay = expectOkAck(await chatSend(host, created.roomCode, 'replayável', sharedIntent));
    expect(replay.message).toEqual(first.message);
    await waitFor(() => hostRec.chat.length === 1, 'broadcast único');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.chat.length).toBe(1);

    const history = expectOkAck(await chatHistory(host, created.roomCode));
    expect(history.messages).toHaveLength(1);

    // Replays de erro: esgotar a cota e repetir o mesmo id devolve a mesma recusa.
    for (let index = 1; index <= 4; index++) {
      expectOkAck(await chatSend(host, created.roomCode, `lote ${index}`));
    }
    const errorIntent = intent();
    const rejected = await chatSend(host, created.roomCode, 'excesso', errorIntent);
    expectError(rejected, 'CHAT_RATE_LIMITED');
    const rejectedReplay = await chatSend(host, created.roomCode, 'excesso', errorIntent);
    expectError(rejectedReplay, 'CHAT_RATE_LIMITED');
    const historyAfter = expectOkAck(await chatHistory(host, created.roomCode));
    expect(historyAfter.messages).toHaveLength(5);

    // Assinatura divergente: mesmo id com outro conteúdo é recusado.
    const divergent = await chatSend(host, created.roomCode, 'outro texto', sharedIntent);
    expectError(divergent, 'INTENT_REUSED');

    // Replay antigo de envio aceito não reemite cópia nem consome mais cota.
    const before = hostRec.chat.length;
    expectOkAck(await chatSend(host, created.roomCode, 'replayável', sharedIntent));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hostRec.chat.length).toBe(before);
  });

  it('intenção atrasada de vínculo anterior não publica na sala nova', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const firstRoom = expectOkAck(await createRoom(host, 'Ana'));
    const staleIntent = intent();
    expectOkAck(await chatSend(host, firstRoom.roomCode, 'da sala antiga', staleIntent));

    // Sai da sala A e entra na sala B como nova identidade.
    expectOkAck(await leaveRoom(host));
    const second = await newClient();
    const secondRec = record(second);
    const secondRoom = expectOkAck(await createRoom(second, 'Ana'));
    expect(secondRoom.roomCode).not.toBe(firstRoom.roomCode);

    // A conexão antiga não está em sala alguma: replay devolve recusa sem publicar.
    const replayOldRoom = await chatSend(host, firstRoom.roomCode, 'da sala antiga', staleIntent);
    // Escopo da conexão antiga morreu com a saída; sem vínculo não há envio.
    expect(replayOldRoom.ok).toBe(false);

    // Nova identidade na sala B: mesmo intentId com sala nova é assinatura diferente.
    const crossIntent = intent();
    expectOkAck(await chatSend(second, secondRoom.roomCode, 'primeira na B', crossIntent));
    const reusedElsewhere = await chatSend(second, firstRoom.roomCode, 'tentativa em A', crossIntent);
    expectError(reusedElsewhere, 'INTENT_REUSED');
    const wrongRoom = await chatSend(second, firstRoom.roomCode, 'sala alheia');
    expectError(wrongRoom, 'NOT_IN_ROOM');

    await waitFor(() => secondRec.chat.length === 1, 'apenas mensagem da sala B');
    expect(secondRec.chat[0]?.roomCode).toBe(secondRoom.roomCode);
    expect(secondRec.chat[0]?.message.text).toBe('primeira na B');
    expect(JSON.stringify(secondRec.chat)).not.toContain('da sala antiga');

    // A sala A, ainda retida, não recebeu nenhuma mensagem nova da tentativa.
    const roomA = ctx.server.server.rooms.debugRoom(firstRoom.roomCode);
    expect(roomA?.chatMessages.map((message) => message.text)).toEqual(['da sala antiga']);
    expect(hostRec.chat).toHaveLength(1);
  });

  it('histórico sobrevive a entrada tardia, paginação estável e mensagem simultânea', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    for (let index = 1; index <= 5; index++) {
      expectOkAck(await chatSend(host, created.roomCode, `hist ${index}`));
    }

    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));

    // Página recente com cursor; páginas anteriores recuperáveis.
    const newest = expectOkAck(await chatHistory(watcher, created.roomCode, { limit: 2 }));
    expect(newest.messages.map((message) => message.text)).toEqual(['hist 4', 'hist 5']);
    expect(newest.hasMore).toBe(true);
    const newestCursor = newest.messages[0]?.seq;
    if (newestCursor === undefined) throw new Error('página vazia');
    const middle = expectOkAck(await chatHistory(watcher, created.roomCode, { before: newestCursor, limit: 2 }));
    expect(middle.messages.map((message) => message.text)).toEqual(['hist 2', 'hist 3']);
    expect(middle.hasMore).toBe(true);
    const middleCursor = middle.messages[0]?.seq;
    if (middleCursor === undefined) throw new Error('página vazia');
    const oldest = expectOkAck(await chatHistory(watcher, created.roomCode, { before: middleCursor, limit: 2 }));
    expect(oldest.messages.map((message) => message.text)).toEqual(['hist 1']);
    expect(oldest.hasMore).toBe(false);

    // Mensagem simultânea à consulta: histórico consistente + broadcast ao vivo,
    // merge por seq não duplica nem abre buraco. A janela do host foi liberada
    // para que o sexto envio não caia no limite por identidade.
    ctx.clock.advance(CHAT_RATE_WINDOW_MS);
    const historyPromise = chatHistory(watcher, created.roomCode, { limit: 10 });
    expectOkAck(await chatSend(host, created.roomCode, 'simultânea'));
    const page = expectOkAck(await historyPromise);
    await waitFor(() => watcherRec.chat.length >= 1, 'broadcast ao vivo');
    const merged = new Map<number, string>();
    for (const message of page.messages) merged.set(message.seq, message.text);
    for (const entry of watcherRec.chat) merged.set(entry.message.seq, entry.message.text);
    const seqs = [...merged.keys()].sort((left, right) => left - right);
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6]);
    expect(merged.get(6)).toBe('simultânea');

    // Recarga: a mesma identidade desconectada recupera tudo.
    host.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const reloaded = await newClient();
    const reloadedRec = record(reloaded);
    expectOkAck(
      await request<Ack<JoinRoomAck>>(reloaded, 'client:joinRoom', {
        intentId: intent(),
        roomCode: created.roomCode,
        nickname: 'Ana',
        avatar: 'raposa',
        credential: created.credential,
      }),
    );
    const full = expectOkAck(await chatHistory(reloaded, created.roomCode));
    expect(full.messages).toHaveLength(6);
    expect(full.hasMore).toBe(false);
    expect(reloadedRec.chat).toHaveLength(0);
  });

  it('saída e remoção preservam autoria; sala revogada não envia nem recebe; expiração elimina', async () => {
    const ctx = await setup({ retentionMs: 60_000 });
    const host = await newClient();
    const hostRec = record(host);
    const created = expectOkAck(await createRoom(host, 'Ana'));
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    const watcher = await newClient();
    const watcherRec = record(watcher);
    const watched = expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));

    expectOkAck(await chatSend(guest, created.roomCode, 'antes de sair'));
    await waitFor(() => watcherRec.chat.length === 1, 'broadcast para todos');

    // Saída no lobby: a mensagem aceita permanece com autoria distinguível.
    expectOkAck(await leaveRoom(guest));
    const afterLeave = expectOkAck(await chatHistory(watcher, created.roomCode));
    expect(afterLeave.messages[0]?.author).toEqual({ playerId: joined.playerId, nickname: 'Bia', avatar: 'lobo' });

    // Remoção pelo anfitrião: revoga envio e recepção do chat da sala.
    expectOkAck(await removeParticipant(host, watched.playerId));
    await waitFor(() => watcherRec.packets.some((packet) => (packet as { event: string }).event === 'server:removed'), 'aviso de remoção');
    expectError(await chatSend(watcher, created.roomCode, 'depois da remoção'), 'NOT_IN_ROOM');
    const broadcastsBefore = hostRec.chat.length;
    expectOkAck(await chatSend(host, created.roomCode, 'sem o removido'));
    await waitFor(() => hostRec.chat.length === broadcastsBefore + 1, 'broadcast sem removido');
    expect(watcherRec.chat).toHaveLength(1);

    // Conexão antiga e obsoleta (saiu no lobby) não recebe mais.
    expectError(await chatSend(guest, created.roomCode, 'fantasma'), 'NOT_IN_ROOM');
    expect(guestRec.chat).toHaveLength(1);

    // Expiração com sala vazia elimina histórico e contadores.
    expectOkAck(await leaveRoom(host));
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room === undefined) throw new Error('sala ausente');
    expect(room.chatMessages).toHaveLength(2);
    ctx.clock.advance(60_000);
    expect(ctx.server.server.rooms.debugRoom(created.roomCode)).toBeUndefined();
    const fresh = await newClient();
    const createdFresh = expectOkAck(await createRoom(fresh, 'Zara'));
    expect(createdFresh.roomCode).not.toBe(created.roomCode);
    const freshHistory = expectOkAck(await chatHistory(fresh, createdFresh.roomCode));
    expect(freshHistory.messages).toHaveLength(0);
  });

  it('retenção de sala vazia mantém o histórico para o retorno da mesma identidade', async () => {
    const ctx = await setup({ retentionMs: 60_000 });
    const host = await newClient();
    const created = expectOkAck(await createRoom(host, 'Ana'));
    expectOkAck(await chatSend(host, created.roomCode, 'antes da queda'));

    // Todos desconectam: a retenção segura a sala com o histórico.
    host.disconnect();
    await waitFor(
      () => ctx.server.server.rooms.debugRoom(created.roomCode)?.retentionHold === true,
      'retenção iniciada',
    );
    expect(
      ctx.server.server.rooms.debugRoom(created.roomCode)?.chatMessages.map((message) => message.text),
    ).toEqual(['antes da queda']);

    // Antes do limite, a mesma identidade volta e recupera tudo.
    ctx.clock.advance(1_000);
    const back = await newClient();
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
    const history = expectOkAck(await chatHistory(back, created.roomCode));
    expect(history.messages.map((message) => message.text)).toEqual(['antes da queda']);
    expect(ctx.server.server.rooms.debugRoom(created.roomCode)).toBeDefined();
  });

  it('chat e consultas não mudam a versão nem reagendam o bot', async () => {
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
    await waitFor(
      () => latestState(hostRec).self.view?.currentPlayerId === joined.playerId,
      'vez do substituto',
    );
    // Quem espera entra antes da medição: a entrada bumpa a versão e reagenda
    // o bot uma vez; o chat a partir daqui não pode repetir isso.
    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    await waitFor(() => latestState(hostRec).room.version === room.version, 'estado estável');
    const versionBeforeChat = latestState(hostRec).room.version;
    const botTimerBefore = room.botTimer;

    // Sequência de mensagens de emissores independentes, antes do prazo do bot.
    for (let index = 1; index <= 3; index++) {
      expectOkAck(await chatSend(host, created.roomCode, `ana ${index}`));
      expectOkAck(await chatSend(watcher, created.roomCode, `cai ${index}`));
      expectOkAck(await chatHistory(watcher, created.roomCode));
    }
    await waitFor(() => watcherRec.chat.length === 6, 'mensagens entregues');
    expect(latestState(hostRec).room.version).toBe(versionBeforeChat);
    expect(room.botTimer).toBe(botTimerBefore);
    expect(room.botTimerVersion).toBe(versionBeforeChat);

    // O bot dispara uma única vez no prazo original, sem reagendamento.
    ctx.clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => latestState(hostRec).room.version > versionBeforeChat, 'ação do bot');
    const versionAfterBot = latestState(hostRec).room.version;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(latestState(hostRec).room.version).toBe(versionAfterBot);
    // O bot agiu uma única vez: jogou (mão menor) ou comprou (mão maior);
    // qualquer um prova ação no prazo sem reagendamento pelo chat.
    const joinedHand = latestState(hostRec).self.view?.players.find((player) => player.id === joined.playerId)?.handCount;
    expect([6, 8]).toContain(joinedHand);
    const table = latestState(hostRec).table;
    expect(table).not.toBeNull();
  });
});
