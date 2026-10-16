import { expect } from 'vitest';
import {
  type Card,
  createClassicDeck,
  type RandomSource,
  type RoundOpening,
  RulesError,
  type RulesErrorCode,
} from '../src/index.js';

/**
 * Limita chamadas à fonte aleatória para que um laço reaparecendo falhe rápido
 * em vez de travar o processo. Não é um teto do algoritmo sob teste.
 */
export function guardedRandom(source: RandomSource, maxCalls = 10_000): RandomSource {
  let calls = 0;
  return () => {
    calls++;
    if (calls > maxCalls) {
      throw new Error(`Fonte aleatória consultada mais de ${maxCalls} vezes: possível laço.`);
    }
    return source();
  };
}

export function playerIdsOf(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

/** Todas as cartas da abertura: mãos, pilha de compra e descarte. */
export function everyCardOf(opening: RoundOpening): Card[] {
  return [
    ...opening.playerIds.flatMap((id) => opening.hands[id] ?? []),
    ...opening.drawPile,
    ...opening.discardPile,
  ];
}

export function classicIds(): string[] {
  return createClassicDeck().map((card) => card.id);
}

export function expectRulesError(fn: () => unknown, code: RulesErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RulesError);
  expect((caught as RulesError).code).toBe(code);
}
