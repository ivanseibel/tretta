import { describe, expect, it } from 'vitest';
import { createRoundState, createSeededRandom, projectForPlayer, projectPublicTable, startRound } from '../src/index.js';
import { expectOk, makeState, num, run, wild } from './fixtures.js';

function startedState(count: number, seed: number) {
  return createRoundState(startRound({ playerIds: Array.from({ length: count }, (_, index) => `p${index + 1}`), random: createSeededRandom(seed) }));
}

describe('projeção pública da mesa', () => {
  it('espelha exatamente as informações públicas da projeção de qualquer participante', () => {
    const state = startedState(4, 15);
    const table = projectPublicTable(state);
    for (const seat of state.seats) {
      const view = projectForPlayer(state, seat.id);
      expect(table.status).toBe(view.status);
      expect(table.players).toEqual(view.players);
      expect(table.drawPileCount).toBe(view.drawPileCount);
      expect(table.discardTop).toEqual(view.discardTop);
      expect(table.activeColor).toBe(view.activeColor);
      expect(table.direction).toBe(view.direction);
      expect(table.currentPlayerId).toBe(view.currentPlayerId);
      expect(table.phase).toBe(view.phase);
      expect(table.lastCardWindow).toEqual(view.lastCardWindow);
      expect(table.winnerId).toBe(view.winnerId);
    }
  });

  it('permanece idêntica ao mudar só conteúdo e ordem ocultos', () => {
    const base = makeState({
      hands: { ana: [num('a1', 'blue', 1), num('a2', 'red', 3)], bia: [num('b1', 'green', 2), num('b2', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 5), num('d2', 'blue', 6)],
      drawnCardId: 'a1',
    });
    const hiddenOnly = makeState({
      hands: { ana: [num('a3', 'yellow', 7), num('a4', 'green', 8)], bia: [num('b3', 'red', 1), num('b4', 'blue', 9)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d2', 'blue', 6), num('d1', 'blue', 5)],
      drawnCardId: 'a3',
      lastCard: { playerId: 'ana', announced: true },
    });
    const samePublic = { ...base, lastCard: { playerId: 'ana' as const, announced: true } };
    expect(projectPublicTable(samePublic)).toEqual(projectPublicTable(hiddenOnly));
    expect(JSON.stringify(projectPublicTable(base))).not.toContain('a1');
    expect(JSON.stringify(projectPublicTable(base))).not.toContain('d1');
  });

  it('não revela mãos, ordem da compra, carta recém-comprada, jogáveis ou credencial em JSON', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1), wild('w1', 'color')], bia: [num('b1', 'green', 2), wild('w2', 'draw-four')] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 5), num('d2', 'red', 6), num('d3', 'green', 7)],
      drawnCardId: 'a1',
      phase: 'after-draw',
      current: 'ana',
    });
    const json = JSON.stringify(projectPublicTable(state));
    expect(json).not.toMatch(/"hand":/);
    expect(json).not.toContain('drawnCardId');
    expect(json).not.toContain('playableCardIds');
    expect(json).not.toContain('viewerId');
    expect(json).not.toContain('credential');
    for (const id of ['a1', 'w1', 'b1', 'w2', 'd1', 'd2', 'd3']) {
      expect(json).not.toContain(id);
    }
  });

  it('rodada encerrada publica o vencedor e a vez nula sem expor mãos', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1)], bia: [num('b1', 'green', 2), num('b2', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    const finished = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    const table = projectPublicTable(finished);
    expect(table.status).toBe('finished');
    expect(table.phase).toBe('finished');
    expect(table.winnerId).toBe('ana');
    expect(table.currentPlayerId).toBeNull();
    expect(table.players).toEqual([
      { id: 'ana', handCount: 0 },
      { id: 'bia', handCount: 2 },
    ]);
    expect(JSON.stringify(table)).not.toContain('b1');
  });
});
