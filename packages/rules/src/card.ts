export const COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof COLORS)[number];

export type NumberValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type ActionKind = 'skip' | 'reverse' | 'draw-two';
export type WildVariant = 'color' | 'draw-four';

/** Identificador único por carta física, incluindo cópias iguais. */
export type CardId = string;

export interface NumberCard {
  readonly id: CardId;
  readonly kind: 'number';
  readonly color: Color;
  readonly value: NumberValue;
}

export interface ActionCard {
  readonly id: CardId;
  readonly kind: 'action';
  readonly color: Color;
  readonly action: ActionKind;
}

export interface WildCard {
  readonly id: CardId;
  readonly kind: 'wild';
  readonly variant: WildVariant;
}

export type Card = NumberCard | ActionCard | WildCard;

export function isNumberCard(card: Card): card is NumberCard {
  return card.kind === 'number';
}

/** Composição do Clássico: 108 cartas. Cada cor tem 25 cartas; coringas somam 8. */
export const CLASSIC_DECK_SIZE = 108;

const ACTION_KINDS: readonly ActionKind[] = ['skip', 'reverse', 'draw-two'];

/**
 * Cria o baralho Clássico em ordem canônica (sem embaralhar).
 * Ids seguem o padrão `<cor>-<face>-<cópia>` ou `wild-<variante>-<cópia>`.
 */
export function createClassicDeck(): Card[] {
  const cards: Card[] = [];

  for (const color of COLORS) {
    cards.push(numberCard(color, 0, 1));
    for (let value = 1; value <= 9; value++) {
      for (let copy = 1; copy <= 2; copy++) {
        cards.push(numberCard(color, value as NumberValue, copy));
      }
    }
    for (const action of ACTION_KINDS) {
      for (let copy = 1; copy <= 2; copy++) {
        cards.push({ id: `${color}-${action}-${copy}`, kind: 'action', color, action });
      }
    }
  }

  for (const variant of ['color', 'draw-four'] as const) {
    for (let copy = 1; copy <= 4; copy++) {
      cards.push({ id: `wild-${variant}-${copy}`, kind: 'wild', variant });
    }
  }

  return cards;
}

function numberCard(color: Color, value: NumberValue, copy: number): NumberCard {
  return { id: `${color}-${value}-${copy}`, kind: 'number', color, value };
}
