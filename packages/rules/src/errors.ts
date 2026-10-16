export type RulesErrorCode =
  | 'INVALID_PLAYER_COUNT'
  | 'INVALID_PLAYER_ID'
  | 'DUPLICATE_PLAYER_ID'
  | 'DUPLICATE_CARD_ID'
  | 'INSUFFICIENT_CARDS'
  | 'INVALID_RANDOM'
  | 'INVALID_SEED'
  | 'INVALID_OPENING'
  | 'UNKNOWN_PLAYER';

/** Erro explícito para entradas que o motor recusa. */
export class RulesError extends Error {
  readonly code: RulesErrorCode;

  constructor(code: RulesErrorCode, message: string) {
    super(message);
    this.name = 'RulesError';
    this.code = code;
  }
}
