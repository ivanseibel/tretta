import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@tretta/protocol/shared';

export function createPlayerId(): string {
  return `p_${randomUUID()}`;
}

/** Id estável de bot fixo do treino: derivado do código da sala e do índice. */
export function createBotId(roomCode: string, index: number): string {
  return `b_${roomCode}_${index}`;
}

export function createRoundId(): string {
  return `r_${randomUUID()}`;
}

export function createTauntId(): string {
  return `t_${randomUUID()}`;
}

export function createEffectId(): string {
  return `fx_${randomUUID()}`;
}

export function createCredential(): string {
  return randomBytes(32).toString('base64url');
}

export function createRoomCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    if (!exists(code)) return code;
  }
  throw new Error('Não foi possível gerar um código de sala livre.');
}
