import { describe, expect, it } from 'vitest';
import { simulateRound } from './simulation.js';

/** Sementes fixas: a sequência de cada rodada é reproduzível com estes números. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const COUNTS = [2, 3, 4, 5, 6, 7, 8];

describe('rodada integrada até o vencedor', () => {
  const runs = COUNTS.flatMap((playerCount) => SEEDS.map((seed) => simulateRound(playerCount, seed)));

  it.each(COUNTS)('conclui rodadas com %i jogadores até um vencedor da mesa, sem perder cartas', (playerCount) => {
    for (const run of runs.filter((entry) => entry.playerCount === playerCount)) {
      expect(run.winnerId).not.toBe('');
      expect(run.finalCards).toBe(108);
      expect(run.commands).toBeGreaterThan(0);
    }
  });

  it('a mesma semente reproduz exatamente a mesma sequência de comandos e eventos', () => {
    const first = simulateRound(5, 3);
    const second = simulateRound(5, 3);
    expect(second.trace).toEqual(first.trace);
    expect(second.events).toEqual(first.events);
    expect(second.winnerId).toBe(first.winnerId);
  });

  it('as simulações exercitam as regras principais', () => {
    const totals = new Map<string, number>();
    for (const run of runs) {
      for (const [key, count] of Object.entries(run.events)) {
        totals.set(key, (totals.get(key) ?? 0) + count);
      }
    }
    for (const key of [
      'played',
      'drew',
      'passed',
      'turnSkipped',
      'directionChanged',
      'lastCardAnnounced',
      'challengeAccepted',
      'roundFinished',
      'wildPlayed',
      'action:skip',
      'action:reverse',
      'action:draw-two',
    ]) {
      expect(totals.get(key) ?? 0, `evento ${key} não exercitado`).toBeGreaterThan(0);
    }
  });
});
