import { describe, expect, it } from 'vitest';
import {
  type Card,
  CLASSIC_DECK_SIZE,
  COLORS,
  createClassicDeck,
  createSeededRandom,
  shuffle,
} from '../src/index.js';
import { classicIds } from './helpers.js';

describe('baralho Clássico', () => {
  it('tem exatamente 108 cartas', () => {
    expect(createClassicDeck()).toHaveLength(108);
    expect(CLASSIC_DECK_SIZE).toBe(108);
  });

  it('tem composição exata por cor e 4 coringas de cada tipo', () => {
    const deck = createClassicDeck();

    for (const color of COLORS) {
      const ofColor = deck.filter((card) => 'color' in card && card.color === color);
      expect(ofColor).toHaveLength(25);

      const zeros = ofColor.filter((card) => card.kind === 'number' && card.value === 0);
      expect(zeros).toHaveLength(1);

      for (let value = 1; value <= 9; value++) {
        const copies = ofColor.filter((card) => card.kind === 'number' && card.value === value);
        expect(copies).toHaveLength(2);
      }

      expect(ofColor.filter((card) => card.kind === 'action' && card.action === 'skip')).toHaveLength(2);
      expect(ofColor.filter((card) => card.kind === 'action' && card.action === 'reverse')).toHaveLength(2);
      expect(ofColor.filter((card) => card.kind === 'action' && card.action === 'draw-two')).toHaveLength(2);
    }

    const wilds = deck.filter((card) => card.kind === 'wild');
    expect(wilds).toHaveLength(8);
    expect(wilds.filter((card) => card.kind === 'wild' && card.variant === 'color')).toHaveLength(4);
    expect(wilds.filter((card) => card.kind === 'wild' && card.variant === 'draw-four')).toHaveLength(4);
  });

  it('tem 108 identificadores únicos, mesmo com cartas iguais', () => {
    const ids = classicIds();
    expect(new Set(ids).size).toBe(108);
    expect(ids).toContain('red-7-1');
    expect(ids).toContain('red-7-2');
    expect(ids).toContain('wild-color-1');
    expect(ids).toContain('wild-draw-four-4');
  });

  it('cria uma nova instância a cada chamada', () => {
    const first = createClassicDeck();
    first.pop();
    expect(createClassicDeck()).toHaveLength(108);
  });

  it('embaralhar preserva todas as cartas sem alterar a entrada', () => {
    const deck = createClassicDeck();
    const original = [...deck];
    const shuffled: Card[] = shuffle(deck, createSeededRandom(42));

    expect(deck).toEqual(original);
    expect(shuffled).toHaveLength(108);
    expect(new Set(shuffled.map((card) => card.id))).toEqual(new Set(classicIds()));
    expect(shuffled.map((card) => card.id)).not.toEqual(classicIds());
  });
});
