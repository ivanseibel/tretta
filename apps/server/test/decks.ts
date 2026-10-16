import { createClassicDeck } from '@tretta/rules';

interface DeckSpec {
  readonly hands: readonly (readonly string[])[];
  readonly discard: string;
  readonly draw: readonly string[];
}

/**
 * Monta um baralho Clássico completo na ordem pedida: as mãos são distribuídas
 * em rodízio por assento, seguidas do descarte inicial e da pilha de compra.
 * O restante das cartas preenche o fim da pilha de compra.
 */
export function buildDeck(spec: DeckSpec): string[] {
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

/** Mesa curta de oito assentos usada pela prova local de transporte. */
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

/**
 * Cenário com dois assentos (A e B): A descarta vermelhas em sequência; B não
 * tem vermelhas. A compra em B entrega uma carta vermelha jogável (descarte da
 * recém-comprada) e depois cartas verdes inofensivas. A vence com um coringa.
 */
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

/**
 * Cenário para denúncia: A chega a uma carta sem avisar; B denuncia. A compra
 * de B traz apenas cartas sem combinação.
 */
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

/** Cenário de Bloqueio: A descarta Bloqueio e a vez volta imediatamente para A. */
export function skipDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-skip-1', 'red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'blue-1-1'],
      ['blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1', 'blue-8-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1'],
  });
}

/**
 * Cenário de penalidade: A descarta +2 e B compra duas e perde a vez. B não
 * tem vermelhas para reagir; a vez volta para A. Cobre `drew`/`penalty` e
 * `turnSkipped` no mesmo lote.
 */
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

/**
 * Dois Bloqueios seguidos para A: dois lotes distintos com efeito, cobrindo
 * `seq` monotônico entre mensagens da mesma sala.
 */
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
 * Cenário de Inversão com três assentos: A e B abrem com Inversão vermelha
 * (as duas cópias vermelhas existem); C compra e passa até alguém inverter.
 * O teste dirigido não depende de quem abre a rodada.
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
