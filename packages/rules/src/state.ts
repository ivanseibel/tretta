import { type Card, type CardId, type Color, isNumberCard } from './card.js';
import { RulesError } from './errors.js';
import { type RandomSource, shuffle } from './random.js';
import { type PlayerId, type RoundOpening } from './round.js';

export type Direction = 'clockwise' | 'counterclockwise';

/**
 * `play`: aguarda descarte ou compra. `after-draw`: comprou neste turno e deve
 * passar ou descartar a carta recém-comprada.
 */
export type TurnPhase = 'play' | 'after-draw';

export interface Seat {
  readonly id: PlayerId;
  readonly hand: readonly Card[];
}

/**
 * Janela aberta após um descarte que deixa uma carta. Fecha na próxima compra voluntária
 * ou descarte aceito de quem age, inclusive quando a vez volta à mesma pessoa; compras
 * obrigatórias de Compra 2/4 não a fecham. Denúncia válida ou fim da rodada também fecham.
 */
export interface LastCardWindow {
  readonly playerId: PlayerId;
  readonly announced: boolean;
}

/**
 * Estado autoritativo da rodada. Nunca deve ser enviado inteiro aos jogadores:
 * use `projectForPlayer`. Todos os campos são somente leitura.
 */
export interface RoundState {
  readonly status: 'playing' | 'finished';
  /** Assentos na ordem de turnos iniciais. */
  readonly seats: readonly Seat[];
  /** Topo da pilha de compra no índice 0. */
  readonly drawPile: readonly Card[];
  /** Topo do descarte no último índice. */
  readonly discardPile: readonly Card[];
  /**
   * Índice do assento da vez. Depois do fim, aponta o assento que jogaria em seguida com
   * os efeitos da carta vencedora já aplicados; a projeção publica vez nula nesse estado.
   */
  readonly currentIndex: number;
  readonly direction: Direction;
  /** Cor ativa: cor da última carta ou escolha do coringa. */
  readonly activeColor: Color;
  readonly phase: TurnPhase;
  /** Carta comprada neste turno, quando a compra trouxe uma carta. */
  readonly drawnCardId: CardId | null;
  readonly lastCard: LastCardWindow | null;
  readonly winnerId: PlayerId | null;
}

/** Cria o estado inicial a partir da abertura de `startRound` ou `dealRound`. */
export function createRoundState(opening: RoundOpening): RoundState {
  const seats = opening.playerIds.map(
    (id): Seat => Object.freeze({ id, hand: Object.freeze((opening.hands[id] ?? []).map(freezeCard)) }),
  );
  if (seats.some((seat) => seat.hand.length === 0)) {
    throw new RulesError('INVALID_OPENING', 'Abertura sem mão para algum jogador.');
  }
  const currentIndex = seats.findIndex((seat) => seat.id === opening.firstPlayerId);
  if (currentIndex < 0) {
    throw new RulesError('INVALID_OPENING', 'Primeiro jogador ausente dos assentos.');
  }
  const discardPile = opening.discardPile.map(freezeCard);
  const top = discardPile[discardPile.length - 1];
  if (top === undefined || !isNumberCard(top)) {
    throw new RulesError('INVALID_OPENING', 'O descarte inicial deve ser uma carta numérica.');
  }

  const all = [...seats.flatMap((seat) => seat.hand), ...opening.drawPile, ...discardPile];
  if (new Set(all.map((card) => card.id)).size !== all.length) {
    throw new RulesError('DUPLICATE_CARD_ID', 'Ids de carta repetidos na abertura.');
  }

  return Object.freeze({
    status: 'playing',
    seats: Object.freeze(seats),
    drawPile: Object.freeze(opening.drawPile.map(freezeCard)),
    discardPile: Object.freeze(discardPile),
    currentIndex,
    direction: 'clockwise',
    activeColor: top.color,
    phase: 'play',
    drawnCardId: null,
    lastCard: null,
    winnerId: null,
  });
}

export function freezeCard(card: Card): Card {
  return Object.freeze({ ...card });
}

export function topCard(discardPile: readonly Card[]): Card {
  const top = discardPile[discardPile.length - 1];
  if (top === undefined) {
    throw new RulesError('INVALID_OPENING', 'Descarte vazio.');
  }
  return top;
}

/** Índice do próximo assento a partir de `from`, andando `steps` no sentido indicado. */
export function seatAt(from: number, steps: number, count: number, direction: Direction): number {
  const sign = direction === 'clockwise' ? 1 : -1;
  return (((from + sign * steps) % count) + count) % count;
}

export interface MutablePiles {
  drawPile: Card[];
  discardPile: Card[];
}

export interface DrawResult {
  readonly cards: Card[];
  readonly reshuffled: boolean;
}

/**
 * Retira até `count` cartas do topo da pilha de compra. Quando a pilha acaba,
 * reembaralha o descarte mantendo o topo. Se não houver cartas suficientes,
 * entrega as disponíveis. Termina porque cada iteração retira carta ou interrompe.
 */
export function drawFromPiles(piles: MutablePiles, count: number, random: RandomSource): DrawResult {
  const cards: Card[] = [];
  let reshuffled = false;
  while (cards.length < count) {
    if (piles.drawPile.length === 0) {
      if (piles.discardPile.length <= 1) break;
      const top = piles.discardPile[piles.discardPile.length - 1];
      const rest = piles.discardPile.slice(0, -1);
      piles.drawPile = shuffle(rest, random);
      piles.discardPile = top === undefined ? [] : [top];
      reshuffled = true;
    }
    const card = piles.drawPile.shift();
    if (card === undefined) break;
    cards.push(card);
  }
  return { cards, reshuffled };
}
