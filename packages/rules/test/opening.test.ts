import { describe, expect, it } from 'vitest';
import {
  type Card,
  createClassicDeck,
  createSeededRandom,
  dealRound,
  HAND_SIZE,
  isNumberCard,
  type RandomSource,
  type RoundOpening,
  startRound,
} from '../src/index.js';
import { classicIds, everyCardOf, expectRulesError, guardedRandom, playerIdsOf } from './helpers.js';

const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

/** Invariantes da abertura: mãos, pilhas, descarte, primeiro jogador e cartas devolvidas. */
function expectOpeningInvariants(opening: RoundOpening, playerIds: readonly string[], deckIds: readonly string[]): void {
  expect(Object.keys(opening.hands).sort()).toEqual([...playerIds].sort());
  for (const id of playerIds) {
    expect(opening.hands[id]).toHaveLength(HAND_SIZE);
  }

  const everything = everyCardOf(opening);
  expect(everything).toHaveLength(deckIds.length);
  expect(everything.map((card) => card.id).sort()).toEqual([...deckIds].sort());

  expect(opening.discardPile).toHaveLength(1);
  expect(isNumberCard(opening.discardPile[0] as Card)).toBe(true);
  expect(playerIds).toContain(opening.firstPlayerId);
  expect(opening.direction).toBe('clockwise');

  const returnedIds = opening.returnedDuringOpening.map((card) => card.id);
  expect(new Set(returnedIds).size).toBe(returnedIds.length);
  for (const card of opening.returnedDuringOpening) {
    expect(isNumberCard(card)).toBe(false);
    expect(opening.drawPile.map((c) => c.id)).toContain(card.id);
    expect(opening.discardPile.map((c) => c.id)).not.toContain(card.id);
  }
}

describe('abertura da rodada', () => {
  describe.each([2, 3, 4, 5, 6, 7, 8])('com %i jogadores', (count) => {
    it('dá sete cartas por pessoa e preserva as 108 cartas sem perdas ou duplicações', () => {
      for (const seed of SEEDS) {
        const opening = startRound({ playerIds: playerIdsOf(count), random: createSeededRandom(seed) });

        for (const id of opening.playerIds) {
          expect(opening.hands[id]).toHaveLength(HAND_SIZE);
        }

        const everything = everyCardOf(opening);
        expect(everything).toHaveLength(108);
        expect(new Set(everything.map((card) => card.id))).toEqual(new Set(classicIds()));
      }
    });

    it('inicia o descarte com carta numérica e sorteia primeiro jogador válido, em sentido horário', () => {
      for (const seed of SEEDS) {
        const opening = startRound({ playerIds: playerIdsOf(count), random: createSeededRandom(seed) });

        expect(opening.discardPile).toHaveLength(1);
        expect(isNumberCard(opening.discardPile[0] as Card)).toBe(true);
        expect(opening.playerIds).toContain(opening.firstPlayerId);
        expect(opening.direction).toBe('clockwise');
        expect(opening.playerIds).toEqual(playerIdsOf(count));
      }
    });

    it('sorteia cada assento ao menos uma vez ao longo das sementes', () => {
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        seen.add(startRound({ playerIds: playerIdsOf(count), random: createSeededRandom(seed) }).firstPlayerId);
      }
      expect(seen.size).toBe(count);
    });
  });

  it('a mesma semente reproduz exatamente a mesma abertura', () => {
    const a = startRound({ playerIds: playerIdsOf(4), random: createSeededRandom(99) });
    const b = startRound({ playerIds: playerIdsOf(4), random: createSeededRandom(99) });
    expect(a).toEqual(b);
  });

  it('cartas não numéricas no topo voltam à pilha de compra, sem sair do jogo', () => {
    const playerIds = playerIdsOf(3);
    const deck = createClassicDeck();
    const dealt = HAND_SIZE * playerIds.length;

    // Um coringa e um Bloqueio logo após as mãos; o restante segue na ordem canônica.
    const wild = deck.splice(deck.findIndex((card) => card.kind === 'wild'), 1)[0] as Card;
    const block = deck.splice(deck.findIndex((card) => card.kind === 'action'), 1)[0] as Card;
    const ordered = [...deck.slice(0, dealt), wild, block, ...deck.slice(dealt)];

    const opening = dealRound({ playerIds, deck: ordered, random: createSeededRandom(5) });

    const firstNumberAfterHands = ordered.slice(dealt).findIndex(isNumberCard);
    expect(opening.returnedDuringOpening).toEqual(ordered.slice(dealt, dealt + firstNumberAfterHands));
    expect(opening.returnedDuringOpening.slice(0, 2)).toEqual([wild, block]);
    expect(opening.returnedDuringOpening.every((card) => !isNumberCard(card))).toBe(true);
    expect(isNumberCard(opening.discardPile[0] as Card)).toBe(true);
    for (const card of opening.returnedDuringOpening) {
      expect(opening.drawPile.map((c) => c.id)).toContain(card.id);
    }
    expect(everyCardOf(opening)).toHaveLength(108);
    expect(new Set(everyCardOf(opening).map((card) => card.id))).toEqual(new Set(classicIds()));
  });

  it('não altera o baralho recebido pela abertura', () => {
    const playerIds = playerIdsOf(2);
    const deck = createClassicDeck();
    const before = deck.map((card) => card.id);
    dealRound({ playerIds, deck, random: createSeededRandom(8) });
    expect(deck.map((card) => card.id)).toEqual(before);
  });

  describe('regressões de hands e de término da abertura', () => {
    const SPECIAL_IDS = [
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
      'valueOf',
      '__defineGetter__',
      '__lookupGetter__',
      'ana',
    ];

    it('guarda cada mão como propriedade própria, inclusive para ids especiais', () => {
      const opening = startRound({ playerIds: SPECIAL_IDS, random: createSeededRandom(1) });

      expect(Object.keys(opening.hands).sort()).toEqual([...SPECIAL_IDS].sort());
      expect(Object.values(opening.hands)).toHaveLength(SPECIAL_IDS.length);
      for (const id of SPECIAL_IDS) {
        expect(Object.hasOwn(opening.hands, id)).toBe(true);
        expect(opening.hands[id]).toHaveLength(HAND_SIZE);
      }
      expect(new Set(everyCardOf(opening).map((card) => card.id))).toEqual(new Set(classicIds()));
    });

    it('preserva todas as mãos na representação JSON, inclusive para ids especiais', () => {
      const opening = startRound({ playerIds: SPECIAL_IDS, random: createSeededRandom(2) });
      const parsed = JSON.parse(JSON.stringify(opening)) as { hands: Record<string, Card[]> };

      expect(Object.keys(parsed.hands).sort()).toEqual([...SPECIAL_IDS].sort());
      for (const id of SPECIAL_IDS) {
        expect(parsed.hands[id]).toEqual(opening.hands[id]);
      }
    });

    it('termina com a fonte periódica do relatório: 108 cartas, coringa inserido no índice 14', () => {
      const playerIds = ['ana', 'bia'];
      const deck = createClassicDeck();
      const wild = deck.splice(
        deck.findIndex((card) => card.kind === 'wild'),
        1,
      )[0] as Card;
      deck.splice(14, 0, wild);

      let calls = 0;
      const periodic: RandomSource = () => (calls++ % 93 === 0 ? 0 : 0.999);
      const opening = dealRound({ playerIds, deck, random: guardedRandom(periodic) });

      expectOpeningInvariants(opening, playerIds, classicIds());
      expect(opening.returnedDuringOpening).toEqual([wild]);
      expect(opening.drawPile).toContainEqual(wild);
    });

    it('termina no caso mínimo com fonte constante: uma não numérica antes da numérica', () => {
      const numbers = createClassicDeck().filter(isNumberCard);
      const action = createClassicDeck().find((card) => card.kind === 'action') as Card;
      const playerIds = ['ana', 'bia'];
      const deck: Card[] = [...numbers.slice(0, 14), action, numbers[14] as Card];

      const opening = dealRound({ playerIds, deck, random: guardedRandom(() => 0) });

      expectOpeningInvariants(
        opening,
        playerIds,
        deck.map((card) => card.id),
      );
      expect(opening.returnedDuringOpening).toEqual([action]);
      expect(opening.drawPile).toEqual([action]);
      expect(opening.discardPile).toEqual([numbers[14]]);
    });

    it('devolve não numéricas na ordem em que saíram e reembaralha uma única vez', () => {
      const playerIds = ['ana', 'bia'];
      const deck = createClassicDeck();
      const nonNumbers = deck.filter((card) => !isNumberCard(card));
      const numbers = deck.filter(isNumberCard);
      const [firstWild, firstAction] = nonNumbers.slice(0, 2) as [Card, Card];
      const rest = nonNumbers.slice(2);
      const ordered: Card[] = [
        ...numbers.slice(0, 14),
        firstWild,
        firstAction,
        numbers[14] as Card,
        ...rest,
        ...numbers.slice(15),
      ];

      const opening = dealRound({ playerIds, deck: ordered, random: guardedRandom(createSeededRandom(77)) });

      expectOpeningInvariants(opening, playerIds, deck.map((card) => card.id));
      expect(opening.returnedDuringOpening).toEqual([firstWild, firstAction]);
      expect(opening.discardPile).toEqual([numbers[14]]);
    });

    it('rejeita explicitamente quando nenhuma numérica resta na pilha de compra', () => {
      const playerIds = ['ana', 'bia'];
      const deck = createClassicDeck();
      const numbers = deck.filter(isNumberCard);
      const nonNumbers = deck.filter((card) => !isNumberCard(card));
      const ordered: Card[] = [...numbers.slice(0, 14), ...nonNumbers];

      expectRulesError(
        () => dealRound({ playerIds, deck: ordered, random: guardedRandom(createSeededRandom(3)) }),
        'INSUFFICIENT_CARDS',
      );
    });
  });

  describe('entradas inválidas', () => {
    it.each([0, 1, 9, 12])('rejeita %i jogadores explicitamente', (count) => {
      expectRulesError(
        () => startRound({ playerIds: playerIdsOf(count), random: createSeededRandom(1) }),
        'INVALID_PLAYER_COUNT',
      );
    });

    it('rejeita id vazio, só com espaços ou não textual', () => {
      for (const bad of ['', '   ', 42 as unknown as string]) {
        expectRulesError(
          () => startRound({ playerIds: ['ana', bad], random: createSeededRandom(1) }),
          'INVALID_PLAYER_ID',
        );
      }
    });

    it('rejeita jogadores duplicados', () => {
      expectRulesError(
        () => startRound({ playerIds: ['ana', 'bia', 'ana'], random: createSeededRandom(1) }),
        'DUPLICATE_PLAYER_ID',
      );
    });

    it('rejeita baralho com id de carta duplicado', () => {
      const deck = createClassicDeck();
      deck[1] = deck[0] as Card;
      expectRulesError(
        () => dealRound({ playerIds: playerIdsOf(2), deck, random: createSeededRandom(1) }),
        'DUPLICATE_CARD_ID',
      );
    });

    it('rejeita baralho insuficiente para a distribuição', () => {
      const deck = createClassicDeck().slice(0, 14);
      expectRulesError(
        () => dealRound({ playerIds: playerIdsOf(2), deck, random: createSeededRandom(1) }),
        'INSUFFICIENT_CARDS',
      );
    });

    it('rejeita baralho sem nenhuma carta numérica disponível', () => {
      const deck = createClassicDeck().filter((card) => !isNumberCard(card));
      expectRulesError(
        () => dealRound({ playerIds: playerIdsOf(2), deck, random: createSeededRandom(1) }),
        'INSUFFICIENT_CARDS',
      );
    });
  });
});
