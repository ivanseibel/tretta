import { createClassicDeck } from '@tretta/rules';

interface DeckSpec {
  readonly hands: readonly (readonly string[])[];
  readonly discard: string;
  readonly draw: readonly string[];
}

function buildDeck(spec: DeckSpec): string[] {
  const deck: string[] = [];
  const handSize = spec.hands[0]?.length ?? 0;
  for (let round = 0; round < handSize; round++) {
    for (const hand of spec.hands) {
      const cardId = hand[round];
      if (cardId === undefined) throw new Error('Mãos com tamanhos diferentes.');
      deck.push(cardId);
    }
  }
  deck.push(spec.discard);
  deck.push(...spec.draw);
  const used = new Set(deck);
  const remaining = createClassicDeck()
    .map((card) => card.id)
    .filter((id) => !used.has(id));
  deck.push(...remaining);
  if (deck.length !== 108) throw new Error(`Baralho com ${deck.length} cartas.`);
  return deck;
}

/**
 * Rodada de oito assentos com duas cartas numéricas por cor e quatro coringas
 * de cor. As cartas de compra começam com números amarelos para que a mesa
 * avance pelas cores sem efeitos acidentais.
 */
export function eightSeatValidationDeck(): string[] {
  const classic = createClassicDeck();
  const numbers = (color: 'red' | 'blue' | 'green' | 'yellow') =>
    classic.filter((card) => card.kind === 'number' && card.color === color).map((card) => card.id);
  const red = numbers('red').filter((id) => id !== 'red-9-1');
  const blue = numbers('blue');
  const green = numbers('green');
  const yellow = numbers('yellow');
  const wild = classic.filter((card) => card.kind === 'wild' && card.variant === 'color').map((card) => card.id);
  const hands = Array.from({ length: 8 }, (_, seat) => {
    const hand = [red[seat * 2], red[seat * 2 + 1], blue[seat * 2], blue[seat * 2 + 1], green[seat * 2], green[seat * 2 + 1]];
    if (seat < 4) hand.push(wild[seat]);
    else hand.push(yellow[seat - 4]);
    if (hand.some((id) => id === undefined)) throw new Error(`Carta ausente para o assento ${seat}.`);
    return hand as string[];
  });
  const dealt = new Set(hands.flat());
  const draw = yellow.filter((id) => !dealt.has(id));
  return buildDeck({ hands, discard: 'red-9-1', draw });
}

export function scenarioDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'wild-color-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['blue-8-1', 'red-7-1', 'blue-9-1', 'green-1-1', 'green-2-1', 'green-3-1'],
  });
}

export function challengeDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'wild-draw-four-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'green-4-1'],
    ],
    discard: 'red-9-1',
    draw: ['blue-8-1', 'blue-9-1', 'green-5-1', 'green-6-1', 'green-7-1'],
  });
}

/** Cenário de penalidade: A descarta +2, B compra duas e perde a vez; a vez volta para A. */
export function penaltyDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-draw-two-1', 'red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['blue-8-1', 'blue-9-1', 'green-1-1', 'green-2-1', 'green-3-1'],
  });
}

/** Dois Bloqueios seguidos para A com a vez voltando imediatamente (duas pessoas). */
export function twoSkipsDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-skip-1', 'red-skip-2', 'red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1'],
  });
}

/**
 * Sequência de ações para A na mesma rodada: dois Bloqueios e dois +2
 * encadeados, produzindo quatro pênaltis e quatro bloqueios sem depender de B.
 */
export function moodDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-skip-1', 'red-draw-two-1', 'red-skip-2', 'red-draw-two-2', 'red-1-1', 'red-2-1', 'red-3-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1'],
  });
}

/**
 * Inversão com três assentos: A e B abrem com as duas cópias vermelhas
 * existentes; C só tem cartas que passam a vez até alguém inverter.
 */
export function reverseDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-reverse-1', 'red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1'],
      ['red-reverse-2', 'blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1'],
      ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1', 'green-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-8-1', 'green-9-1', 'blue-7-1'],
  });
}

/**
 * Vaga da Bia sob substituto: A só tem azuis (compra e passa) e B guarda o
 * primeiro Bloqueio vermelho, que o substituto joga na primeira vez da vaga.
 */
export function botDeck(): string[] {
  return buildDeck({
    hands: [
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['red-skip-1', 'yellow-1-1', 'yellow-2-1', 'yellow-3-1', 'yellow-4-1', 'yellow-5-1', 'yellow-6-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1'],
  });
}
