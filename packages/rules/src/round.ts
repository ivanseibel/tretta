import { type Card, type CardId, createClassicDeck, isNumberCard } from './card.js';
import { RulesError } from './errors.js';
import { type RandomSource, randomIndex, shuffle } from './random.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const HAND_SIZE = 7;

export type PlayerId = string;

export interface RoundOpening {
  /** Ordem de assentos e de turnos. O sentido inicial segue essa ordem. */
  readonly playerIds: readonly PlayerId[];
  /**
   * Uma propriedade própria por jogador, inclusive para ids como `__proto__`.
   * Objeto sem protótipo: consulta por id e JSON seguem as propriedades próprias.
   */
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>;
  /** Topo da pilha de compra no índice 0. */
  readonly drawPile: readonly Card[];
  /** Topo do descarte no último índice. Sempre numérica na abertura. */
  readonly discardPile: readonly Card[];
  readonly firstPlayerId: PlayerId;
  readonly direction: 'clockwise';
  /**
   * Não numéricas retiradas do topo antes da primeira numérica, na ordem em que
   * saíram. Cada carta aparece uma vez. Ao encontrar a numérica inicial, essas
   * cartas voltam à pilha de compra, que é reembaralhada uma única vez; não entram
   * no descarte nem saem do jogo. Vazia quando a primeira carta do topo já é numérica.
   */
  readonly returnedDuringOpening: readonly Card[];
}

export interface StartRoundOptions {
  readonly playerIds: readonly PlayerId[];
  readonly random: RandomSource;
}

export interface DealRoundOptions extends StartRoundOptions {
  /** Baralho já na ordem desejada; a distribuição consome do topo (índice 0). */
  readonly deck: readonly Card[];
}

/** Cria o Clássico, embaralha e faz a abertura. */
export function startRound(options: StartRoundOptions): RoundOpening {
  const { playerIds, random } = options;
  validatePlayerIds(playerIds);
  return dealRound({ playerIds, random, deck: shuffle(createClassicDeck(), random) });
}

/** Faz a abertura a partir de um baralho dado: 7 cartas por pessoa, descarte numérico e primeiro jogador. */
export function dealRound(options: DealRoundOptions): RoundOpening {
  const { playerIds, random, deck } = options;
  validatePlayerIds(playerIds);
  validateDeck(deck, playerIds.length);

  let drawPile: Card[] = [...deck];
  // Objeto sem protótipo: ids como `__proto__` viram propriedades próprias.
  const hands: Record<PlayerId, Card[]> = Object.create(null) as Record<PlayerId, Card[]>;
  for (const playerId of playerIds) {
    hands[playerId] = [];
  }
  for (let round = 0; round < HAND_SIZE; round++) {
    for (const playerId of playerIds) {
      hands[playerId]?.push(takeTop(drawPile));
    }
  }

  if (!drawPile.some(isNumberCard)) {
    throw new RulesError('INSUFFICIENT_CARDS', 'Não há carta numérica disponível para iniciar o descarte.');
  }

  // Cada retirada consome uma carta da pilha; a busca termina porque existe ao menos uma numérica.
  const returnedDuringOpening: Card[] = [];
  let discard: Card | undefined;
  while (discard === undefined) {
    const top = takeTop(drawPile);
    if (isNumberCard(top)) {
      discard = top;
    } else {
      returnedDuringOpening.push(top);
    }
  }

  if (returnedDuringOpening.length > 0) {
    drawPile = shuffle([...drawPile, ...returnedDuringOpening], random);
  }

  const firstPlayerId = playerIds[randomIndex(random, playerIds.length)];
  if (firstPlayerId === undefined) {
    throw new RulesError('INVALID_PLAYER_COUNT', 'Nenhum jogador disponível para iniciar.');
  }

  return {
    playerIds: [...playerIds],
    hands,
    drawPile,
    discardPile: [discard],
    firstPlayerId,
    direction: 'clockwise',
    returnedDuringOpening,
  };
}

/** Valida 2–8 jogadores com ids textuais, não vazios e únicos. Lança RulesError. */
export function validatePlayerIds(playerIds: readonly PlayerId[]): void {
  if (!Array.isArray(playerIds) || playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    const count = Array.isArray(playerIds) ? playerIds.length : String(playerIds);
    throw new RulesError(
      'INVALID_PLAYER_COUNT',
      `Número de jogadores inválido: ${String(count)}. Use de ${MIN_PLAYERS} a ${MAX_PLAYERS}.`,
    );
  }

  const seen = new Set<string>();
  for (const playerId of playerIds) {
    if (typeof playerId !== 'string' || playerId.trim() === '') {
      throw new RulesError('INVALID_PLAYER_ID', 'Id de jogador deve ser texto não vazio.');
    }
    if (seen.has(playerId)) {
      throw new RulesError('DUPLICATE_PLAYER_ID', `Jogador duplicado: ${playerId}.`);
    }
    seen.add(playerId);
  }
}

function validateDeck(deck: readonly Card[], playerCount: number): void {
  const ids = new Set<CardId>();
  for (const card of deck) {
    if (ids.has(card.id)) {
      throw new RulesError('DUPLICATE_CARD_ID', `Id de carta duplicado: ${card.id}.`);
    }
    ids.add(card.id);
  }
  if (deck.length < HAND_SIZE * playerCount + 1) {
    throw new RulesError(
      'INSUFFICIENT_CARDS',
      `Baralho com ${deck.length} cartas; são necessárias ao menos ${HAND_SIZE * playerCount + 1}.`,
    );
  }
}

function takeTop(pile: Card[]): Card {
  const card = pile.shift();
  if (card === undefined) {
    throw new RulesError('INSUFFICIENT_CARDS', 'Baralho de compra esgotado durante a abertura.');
  }
  return card;
}
