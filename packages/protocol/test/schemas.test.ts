import { describe, expect, it } from 'vitest';
import {
  chatCodePointLength,
  chatHistoryPayloadSchema,
  chatSendPayloadSchema,
  CHAT_MESSAGE_MAX_LENGTH,
  clientCommandSchema,
  commandPayloadSchema,
  continueRoundPayloadSchema,
  createRoomPayloadSchema,
  endRoundWithoutWinnerPayloadSchema,
  joinRoomPayloadSchema,
  leaveRoomPayloadSchema,
  removeParticipantPayloadSchema,
  roomCodeSchema,
  substituteAbsentPayloadSchema,
  tauntSendPayloadSchema,
} from '../src/index.js';

describe('schemas de entrada', () => {
  it('aceita criação válida e apara o apelido', () => {
    const parsed = createRoomPayloadSchema.parse({
      intentId: 'intent-12345678',
      nickname: '  Ana  ',
      avatar: 'raposa',
    });
    expect(parsed.nickname).toBe('Ana');
  });

  it('aceita modo ausente, clássico explícito e treino; recusa modo desconhecido', () => {
    const base = { intentId: 'intent-12345678', nickname: 'Ana', avatar: 'raposa' };
    expect(createRoomPayloadSchema.parse(base).mode).toBeUndefined();
    expect(createRoomPayloadSchema.parse({ ...base, mode: 'classic' }).mode).toBe('classic');
    expect(createRoomPayloadSchema.parse({ ...base, mode: 'training' }).mode).toBe('training');
    expect(createRoomPayloadSchema.safeParse({ ...base, mode: 'solo' }).success).toBe(false);
    expect(createRoomPayloadSchema.safeParse({ ...base, mode: 7 }).success).toBe(false);
  });

  it('recusa campos desconhecidos, apelido vazio e avatar inexistente', () => {
    expect(createRoomPayloadSchema.safeParse({ intentId: 'intent-12345678', nickname: 'Ana', avatar: 'raposa', extra: 1 }).success).toBe(false);
    expect(createRoomPayloadSchema.safeParse({ intentId: 'intent-12345678', nickname: '   ', avatar: 'raposa' }).success).toBe(false);
    expect(createRoomPayloadSchema.safeParse({ intentId: 'intent-12345678', nickname: 'Ana', avatar: 'dragao' }).success).toBe(false);
  });

  it('valida código de sala no alfabeto permitido', () => {
    expect(roomCodeSchema.safeParse('ABCDEF').success).toBe(true);
    expect(roomCodeSchema.safeParse('abcdef').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABC').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABCIEF').success).toBe(false);
  });

  it('aceita entrada com e sem credencial', () => {
    expect(
      joinRoomPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', nickname: 'Bia', avatar: 'lobo' }).success,
    ).toBe(true);
    expect(
      joinRoomPayloadSchema.safeParse({
        intentId: 'intent-12345678',
        roomCode: 'ABCDEF',
        nickname: 'Bia',
        avatar: 'lobo',
        credential: 'credencial-longa-o-suficiente',
      }).success,
    ).toBe(true);
  });

  it('recusa comandos do motor com campos proibidos ou tipos errados', () => {
    expect(clientCommandSchema.safeParse({ type: 'play', cardId: 'red-1-1' }).success).toBe(true);
    expect(clientCommandSchema.safeParse({ type: 'play', cardId: 'red-1-1', chosenColor: 'verde' }).success).toBe(false);
    expect(clientCommandSchema.safeParse({ type: 'play', cardId: 'red-1-1', playerId: 'p1' }).success).toBe(false);
    expect(clientCommandSchema.safeParse({ type: 'draw', playerId: 'p1' }).success).toBe(false);
    expect(clientCommandSchema.safeParse({ type: 'watch' }).success).toBe(false);
    expect(clientCommandSchema.safeParse({ type: 'challengeLastCard', targetId: '' }).success).toBe(false);
  });

  it('valida as intenções de saída, substituição, continuação, encerramento e remoção', () => {
    expect(leaveRoomPayloadSchema.safeParse({ intentId: 'intent-12345678' }).success).toBe(true);
    expect(leaveRoomPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF' }).success).toBe(false);

    expect(substituteAbsentPayloadSchema.safeParse({ intentId: 'intent-12345678', targetId: 'p_1' }).success).toBe(true);
    expect(substituteAbsentPayloadSchema.safeParse({ intentId: 'intent-12345678' }).success).toBe(false);
    expect(substituteAbsentPayloadSchema.safeParse({ intentId: 'intent-12345678', targetId: '' }).success).toBe(false);

    expect(continueRoundPayloadSchema.safeParse({ intentId: 'intent-12345678' }).success).toBe(true);
    expect(endRoundWithoutWinnerPayloadSchema.safeParse({ intentId: 'intent-12345678' }).success).toBe(true);
    expect(removeParticipantPayloadSchema.safeParse({ intentId: 'intent-12345678', targetId: 'p_1' }).success).toBe(true);
    expect(removeParticipantPayloadSchema.safeParse({ intentId: 'intent-12345678', targetId: 'p_1', extra: 1 }).success).toBe(false);
  });

  it('exige rodada e comando válidos no payload de comando', () => {
    expect(
      commandPayloadSchema.safeParse({
        intentId: 'intent-12345678',
        roundId: 'r-1',
        command: { type: 'draw' },
      }).success,
    ).toBe(true);
    expect(
      commandPayloadSchema.safeParse({ intentId: 'intent-12345678', command: { type: 'draw' } }).success,
    ).toBe(false);
    expect(
      commandPayloadSchema.safeParse({
        intentId: 'intent-12345678',
        roundId: 'r-1',
        command: { type: 'draw' },
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('valida payloads de chat sem autor, id ou horário do cliente', () => {
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', text: 'oi' }).success).toBe(true);
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', text: '' }).success).toBe(true);
    // Tamanho e vazio são regras do servidor, com códigos próprios; o schema
    // não escolhe autor, id, seq nem horário e recusa campos desconhecidos.
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', text: 'oi', author: { playerId: 'p1' } }).success).toBe(false);
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', text: 'oi', seq: 1 }).success).toBe(false);
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', text: 'oi', sentAt: 1 }).success).toBe(false);
    expect(chatSendPayloadSchema.safeParse({ intentId: 'intent-12345678', text: 'oi' }).success).toBe(false);
  });

  it('valida a consulta de histórico com cursor e limite', () => {
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF' }).success).toBe(true);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', before: 12 }).success).toBe(true);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', before: 0 }).success).toBe(false);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', before: 1.5 }).success).toBe(false);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', limit: 0 }).success).toBe(false);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', limit: 100 }).success).toBe(true);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', limit: 101 }).success).toBe(false);
    expect(chatHistoryPayloadSchema.safeParse({ roomCode: 'ABCDEF', extra: 1 }).success).toBe(false);
  });

  it('valida payloads de provocação sem autor ou horário e com apenas os quatro tipos aprovados', () => {
    expect(
      tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type: 'tomate', targetId: 'p_1' }).success,
    ).toBe(true);
    for (const type of ['torta', 'risadas', 'choro']) {
      expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type, targetId: 'p_1' }).success).toBe(true);
    }
    // Servidor escolhe tipo por enum fechado; campos autoritativos e desconhecidos recusam a intenção.
    expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type: 'bolo', targetId: 'p_1' }).success).toBe(false);
    expect(
      tauntSendPayloadSchema.safeParse({
        intentId: 'intent-12345678',
        roomCode: 'ABCDEF',
        type: 'tomate',
        targetId: 'p_1',
        author: { playerId: 'p2' },
      }).success,
    ).toBe(false);
    expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type: 'tomate', targetId: 'p_1', sentAt: 1 }).success).toBe(false);
    expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type: 'tomate', targetId: '' }).success).toBe(false);
    expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', roomCode: 'ABCDEF', type: 'tomate' }).success).toBe(false);
    expect(tauntSendPayloadSchema.safeParse({ intentId: 'intent-12345678', type: 'tomate', targetId: 'p_1' }).success).toBe(false);
  });

  it('conta caracteres do chat em pontos de código Unicode', () => {
    expect(chatCodePointLength('')).toBe(0);
    expect(chatCodePointLength('abc')).toBe(3);
    expect(chatCodePointLength('😀')).toBe(1);
    expect(chatCodePointLength('a😀b')).toBe(3);
    // 'e' + combining acute conta dois pontos de código; pré-composto conta um.
    expect(chatCodePointLength('\u00e9')).toBe(1);
    expect(chatCodePointLength('e\u0301')).toBe(2);
    expect(chatCodePointLength('a'.repeat(CHAT_MESSAGE_MAX_LENGTH))).toBe(CHAT_MESSAGE_MAX_LENGTH);
    expect(chatCodePointLength('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1))).toBe(CHAT_MESSAGE_MAX_LENGTH + 1);
    expect(chatCodePointLength('😀'.repeat(CHAT_MESSAGE_MAX_LENGTH))).toBe(CHAT_MESSAGE_MAX_LENGTH);
    expect(chatCodePointLength('😀'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1))).toBe(CHAT_MESSAGE_MAX_LENGTH + 1);
  });
});
