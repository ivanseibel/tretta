export const PROTOCOL_VERSION = 6;

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;

export const AVATARS = ['raposa', 'pinguim', 'tucano', 'lobo', 'coruja', 'polvo', 'lince', 'sapo'] as const;
export type Avatar = (typeof AVATARS)[number];

export const NICKNAME_MAX_LENGTH = 24;
export const NICKNAME_MIN_LENGTH = 1;
export const ROOM_CAPACITY = 8;

/**
 * Modo da sala. `classic` é a sala humana original; `training` é a mesa de
 * treino individual, com a pessoa dona e três bots fixos que recusam entrada
 * de outras pessoas. Ausente na criação equivale a `classic`.
 */
export const ROOM_MODES = ['classic', 'training'] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

/**
 * Identidade do assento. `human` é uma pessoa real, única recuperável por
 * credencial; `bot` é um bot fixo da mesa de treino, que nunca se conecta,
 * nunca assume anfitrião e não é identidade recuperável por clientes.
 */
export const PARTICIPANT_KINDS = ['human', 'bot'] as const;
export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];

/**
 * Contagem de caracteres do chat: pontos de código Unicode (`Array.from`), não
 * unidades UTF-16. Um emoji fora do BMP vale 1; base mais combining vale 2.
 */
export function chatCodePointLength(text: string): number {
  return Array.from(text).length;
}

export const CHAT_MESSAGE_MAX_LENGTH = 500;
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;
export const CHAT_HISTORY_PAGE_SIZE = 50;
export const CHAT_HISTORY_MAX_LIMIT = 100;

/**
 * Provocações manuais. Quatro tipos aprovados, cada um com apresentação
 * distinta no cliente; o servidor só transporta o identificador do tipo.
 */
export const TAUNT_TYPES = ['tomate', 'torta', 'risadas', 'choro'] as const;
export type TauntType = (typeof TAUNT_TYPES)[number];

/** 15 segundos entre envios aceitos de um mesmo emissor, qualquer tipo ou alvo. */
export const TAUNT_SENDER_COOLDOWN_MS = 15_000;
/** No máximo três provocações aceitas por alvo nesta janela móvel, somando emissores. */
export const TAUNT_TARGET_WINDOW_MS = 60_000;
export const TAUNT_TARGET_MAX_PER_WINDOW = 3;

/**
 * Reações sem destinatário: expressam como quem envia se sente, em vez de
 * brincar com alguém. Correspondência exata com os rótulos exibidos no
 * cliente: `rindo` = 😂 Rindo; `chorando` = 😭 Chorando; `bravo` = 😡 Bravo.
 * Tipos próprios, separados das provocações `risadas`/`choro`, que continuam
 * direcionadas a um alvo escolhido.
 */
export const REACTION_TYPES = ['rindo', 'chorando', 'bravo'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/**
 * Intervalo de 5 segundos entre reações aceitas de um mesmo emissor, vale
 * entre tipos diferentes e em todas as fases da sala. Independente do
 * intervalo e da cota das provocações: reagir não consome provocação e
 * provocar não bloqueia uma reação disponível.
 */
export const REACTION_SENDER_COOLDOWN_MS = 5_000;

/**
 * Efeitos visuais derivados automaticamente do motor de rodada. Cada categoria
 * cobre um grupo de eventos de jogo; a apresentação é puramente cosmética.
 * Compra voluntária e encerramento sem vencedor não têm categoria: não geram
 * efeito.
 */
export const EFFECT_CATEGORIES = [
  'penaltyDraw',
  'blocked',
  'directionReversed',
  'victory',
] as const;
export type EffectCategory = (typeof EFFECT_CATEGORIES)[number];

/**
 * Duas variações por categoria, com id estável em ambos os lados. A variação é
 * escolhida por RNG cosmético separado do RNG de regras.
 */
export const EFFECT_VARIANT_IDS = [
  'cards-rain',
  'cards-avalanche',
  'brick-wall',
  'stumble',
  'boomerang',
  'windmill',
  'confetti',
  'trophy',
] as const;
export type EffectVariant = (typeof EFFECT_VARIANT_IDS)[number];

export const EFFECT_VARIANTS: Record<EffectCategory, readonly [EffectVariant, EffectVariant]> = {
  penaltyDraw: ['cards-rain', 'cards-avalanche'],
  blocked: ['brick-wall', 'stumble'],
  directionReversed: ['boomerang', 'windmill'],
  victory: ['confetti', 'trophy'],
};

export const CLIENT_EVENTS = {
  createRoom: 'client:createRoom',
  joinRoom: 'client:joinRoom',
  setReady: 'client:setReady',
  startRound: 'client:startRound',
  command: 'client:command',
  returnToLobby: 'client:returnToLobby',
  leaveRoom: 'client:leaveRoom',
  substituteAbsent: 'client:substituteAbsent',
  continueRound: 'client:continueRound',
  endRoundWithoutWinner: 'client:endRoundWithoutWinner',
  removeParticipant: 'client:removeParticipant',
  chatSend: 'client:chatSend',
  chatHistory: 'client:chatHistory',
  tauntSend: 'client:tauntSend',
  reactionSend: 'client:reactionSend',
  setNextDeck: 'test:setNextDeck',
  setEffectVariant: 'test:setEffectVariant',
} as const;

export const SERVER_EVENTS = {
  state: 'server:state',
  events: 'server:events',
  chat: 'server:chat',
  taunt: 'server:taunt',
  reaction: 'server:reaction',
  removed: 'server:removed',
} as const;

export const SERVER_ERROR_CODES = [
  'INVALID_PAYLOAD',
  'INTENT_REUSED',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'CREDENTIAL_INVALID',
  'TRAINING_ROOM_ENTRY_REFUSED',
  'ALREADY_CONNECTED',
  'ALREADY_IN_ROOM',
  'NOT_IN_ROOM',
  'NOT_HOST',
  'WRONG_ROOM_STATUS',
  'NOT_ENOUGH_PLAYERS',
  'TOO_MANY_PLAYERS',
  'NOT_ALL_READY',
  'WAITING_FOR_NEXT_ROUND',
  'STALE_ROUND',
  'ROUND_PAUSED',
  'NOT_PAUSED',
  'UNKNOWN_PARTICIPANT',
  'SUBSTITUTE_NOT_ELIGIBLE',
  'SUBSTITUTE_TOO_EARLY',
  'CANNOT_REMOVE_SELF',
  'CANNOT_REMOVE_BOT',
  'CHAT_EMPTY',
  'CHAT_TOO_LONG',
  'CHAT_RATE_LIMITED',
  'TAUNT_SENDER_COOLDOWN',
  'TAUNT_TARGET_LIMIT',
  'TAUNT_TARGET_UNAVAILABLE',
  'REACTION_SENDER_COOLDOWN',
  'TEST_HOOKS_DISABLED',
  'INTERNAL',
] as const;

export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
