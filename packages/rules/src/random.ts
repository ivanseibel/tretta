import { RulesError } from './errors.js';

/** Fonte de aleatoriedade: cada chamada retorna um número em [0, 1). */
export type RandomSource = () => number;

/**
 * Gerador determinístico (mulberry32) para testes e reprodução.
 * A semente deve ser inteiro entre 0 e 2^32 - 1.
 */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RulesError('INVALID_SEED', `Semente inválida: ${String(seed)}. Use inteiro de 0 a 4294967295.`);
  }

  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sorteia um índice em [0, length). */
export function randomIndex(random: RandomSource, length: number): number {
  const value = random();
  if (typeof value !== 'number' || !(value >= 0 && value < 1)) {
    throw new RulesError('INVALID_RANDOM', `Fonte de aleatoriedade retornou valor fora de [0, 1): ${String(value)}.`);
  }
  return Math.min(Math.floor(value * length), length - 1);
}

/** Retorna nova lista com as mesmas cartas em ordem embaralhada (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(random, i + 1);
    const current = result[i] as T;
    result[i] = result[j] as T;
    result[j] = current;
  }
  return result;
}
