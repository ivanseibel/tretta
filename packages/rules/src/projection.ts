import { type Card, type CardId, type Color } from './card.js';
import { isPlayableOn } from './commands.js';
import { RulesError } from './errors.js';
import { type PlayerId } from './round.js';
import { type Direction, type RoundState, topCard } from './state.js';

export interface PublicPlayer {
  readonly id: PlayerId;
  readonly handCount: number;
}

/**
 * Visão de um participante. Contém somente a própria mão e informações públicas:
 * contagens das demais mãos, tamanho da pilha de compra, topo do descarte, cor ativa,
 * vez, sentido, fase e resultado. Nunca inclui ids nem conteúdo de cartas ocultas.
 */
export interface PlayerView {
  readonly viewerId: PlayerId;
  readonly status: 'playing' | 'finished';
  readonly players: readonly PublicPlayer[];
  readonly hand: readonly Card[];
  /** Ids das cartas da própria mão que podem ser descartadas agora (vazio fora da vez). */
  readonly playableCardIds: readonly CardId[];
  readonly drawPileCount: number;
  readonly discardTop: Card;
  readonly activeColor: Color;
  readonly direction: Direction;
  readonly currentPlayerId: PlayerId | null;
  readonly phase: 'play' | 'after-draw' | 'finished';
  /** Carta comprada neste turno; informada somente a quem está jogando. */
  readonly drawnCardId: CardId | null;
  readonly lastCardWindow: { readonly playerId: PlayerId; readonly announced: boolean } | null;
  readonly winnerId: PlayerId | null;
}

/**
 * Mesa pública da rodada, utilizável sem ocupar assento. Contém somente dados
 * públicos: nunca inclui mãos, ids de cartas ocultas, ordem da pilha de compra,
 * carta recém-comprada, lista de jogáveis nem identificadores de credencial.
 */
export interface PublicTableView {
  readonly status: 'playing' | 'finished';
  readonly players: readonly PublicPlayer[];
  readonly drawPileCount: number;
  readonly discardTop: Card;
  readonly activeColor: Color;
  readonly direction: Direction;
  readonly currentPlayerId: PlayerId | null;
  readonly phase: 'play' | 'after-draw' | 'finished';
  readonly lastCardWindow: { readonly playerId: PlayerId; readonly announced: boolean } | null;
  readonly winnerId: PlayerId | null;
}

/**
 * Projeção pública da mesa atual. Espelha exatamente as informações públicas de
 * `projectForPlayer`, sem depender de um viewer: dois estados que diferem apenas
 * em conteúdo ou ordem ocultos produzem a mesma projeção.
 */
export function projectPublicTable(state: RoundState): PublicTableView {
  const top = topCard(state.discardPile);
  return {
    status: state.status,
    players: state.seats.map((entry) => ({ id: entry.id, handCount: entry.hand.length })),
    drawPileCount: state.drawPile.length,
    discardTop: { ...top },
    activeColor: state.activeColor,
    direction: state.direction,
    currentPlayerId: state.status === 'playing' ? (state.seats[state.currentIndex]?.id ?? null) : null,
    phase: state.status === 'finished' ? 'finished' : state.phase,
    lastCardWindow: state.lastCard === null ? null : { ...state.lastCard },
    winnerId: state.winnerId,
  };
}

/**
 * Projeção para um participante. Retorna cópias profundas: alterar o objeto
 * retornado não altera o estado autoritativo.
 */
export function projectForPlayer(state: RoundState, viewerId: PlayerId): PlayerView {
  const index = typeof viewerId === 'string' ? state.seats.findIndex((seat) => seat.id === viewerId) : -1;
  const seat = state.seats[index];
  if (seat === undefined) {
    throw new RulesError('UNKNOWN_PLAYER', 'Participante desconhecido na rodada.');
  }

  const top = topCard(state.discardPile);
  const isCurrent = state.status === 'playing' && index === state.currentIndex;
  const playable = isCurrent
    ? seat.hand
        .filter(
          (card) =>
            isPlayableOn(card, top, state.activeColor) &&
            (state.phase === 'play' || card.id === state.drawnCardId),
        )
        .map((card) => card.id)
    : [];

  return {
    viewerId,
    status: state.status,
    players: state.seats.map((entry) => ({ id: entry.id, handCount: entry.hand.length })),
    hand: seat.hand.map((card) => ({ ...card })),
    playableCardIds: playable,
    drawPileCount: state.drawPile.length,
    discardTop: { ...top },
    activeColor: state.activeColor,
    direction: state.direction,
    currentPlayerId: state.status === 'playing' ? (state.seats[state.currentIndex]?.id ?? null) : null,
    phase: state.status === 'finished' ? 'finished' : state.phase,
    drawnCardId: isCurrent ? state.drawnCardId : null,
    lastCardWindow: state.lastCard === null ? null : { ...state.lastCard },
    winnerId: state.winnerId,
  };
}
