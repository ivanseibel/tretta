import { describe, expect, it } from 'vitest';
import { createSeededRandom, randomIndex, shuffle } from '../src/index.js';
import { expectRulesError } from './helpers.js';

describe('aleatoriedade controlável', () => {
  it('a mesma semente produz a mesma sequência', () => {
    const a = createSeededRandom(2026);
    const b = createSeededRandom(2026);
    const sequenceA = Array.from({ length: 50 }, () => a());
    const sequenceB = Array.from({ length: 50 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('sementes diferentes produzem sequências diferentes', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 10 }, () => a())).not.toEqual(Array.from({ length: 10 }, () => b()));
  });

  it('valores ficam sempre em [0, 1)', () => {
    const random = createSeededRandom(0xffffffff);
    for (let i = 0; i < 10_000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('rejeita sementes inválidas explicitamente', () => {
    for (const seed of [-1, 1.5, 0x100000000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectRulesError(() => createSeededRandom(seed), 'INVALID_SEED');
    }
  });

  it('rejeita fonte que retorne valor fora de [0, 1)', () => {
    for (const value of [1, -0.1, Number.NaN]) {
      expectRulesError(() => randomIndex(() => value, 5), 'INVALID_RANDOM');
    }
    expectRulesError(() => shuffle([1, 2, 3], () => 1), 'INVALID_RANDOM');
  });

  it('randomIndex escolhe índices válidos nos limites', () => {
    expect(randomIndex(() => 0, 4)).toBe(0);
    expect(randomIndex(() => 0.999999999, 4)).toBe(3);
  });

  it('shuffle com fonte fixa é reproduzível e retorna permutação', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const first = shuffle(items, createSeededRandom(7));
    const second = shuffle(items, createSeededRandom(7));
    expect(first).toEqual(second);
    expect([...first].sort((x, y) => x - y)).toEqual(items);
  });
});
