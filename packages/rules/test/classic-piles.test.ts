import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../src/index.js';
import { act, allCardIds, currentId, expectOk, handIds, makeState, num, run, wild, zeroRandom } from './fixtures.js';
import { guardedRandom } from './helpers.js';

describe('pilha de compra e conservação de cartas', () => {
  it('pilha vazia reembaralha o descarte mantendo o topo e registra a compra', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1), num('a2', 'blue', 2)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('x1', 'red', 1), num('x2', 'red', 2), num('x3', 'red', 3), num('top', 'red', 4)],
      drawPile: [],
    });
    const before = [...allCardIds(state)].sort();
    const { state: after, events } = expectOk(
      run(state, { type: 'draw', playerId: 'ana' }, createSeededRandom(5)),
    );
    expect(after.discardPile.map((card) => card.id)).toEqual(['top']);
    expect(after.drawPile).toHaveLength(2);
    const drawn = handIds(after, 'ana').filter((id) => id !== 'a1' && id !== 'a2');
    expect(drawn).toHaveLength(1);
    expect(['x1', 'x2', 'x3']).toContain(drawn[0]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'drew', playerId: 'ana', reason: 'voluntary', requested: 1, drawn: 1, reshuffled: true }),
    );
    expect([...allCardIds(after)].sort()).toEqual(before);
  });

  it('compra voluntária sem cartas disponíveis conclui com zero cartas e permite passar', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)] },
      discard: [num('top', 'red', 4)],
      drawPile: [],
    });
    const drawn = expectOk(run(state, { type: 'draw', playerId: 'ana' }, guardedRandom(zeroRandom))).state;
    expect(drawn.phase).toBe('after-draw');
    expect(drawn.drawnCardId).toBeNull();
    expect(handIds(drawn, 'ana')).toEqual(['a1']);
    const passed = expectOk(run(drawn, { type: 'pass', playerId: 'ana' })).state;
    expect(currentId(passed)).toBe('bia');
  });

  it('compra 4 com duas cartas disponíveis entrega as que existem e conclui o efeito', () => {
    const state = makeState({
      hands: { ana: [wild('w4', 'draw-four'), num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('top', 'red', 9)],
      drawPile: [num('d1', 'blue', 5), num('d2', 'blue', 6)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w4', chosenColor: 'green' }, guardedRandom(zeroRandom)));
    // Sem mais cartas na pilha, reembaralha o descarte anterior mantendo só o topo (w4).
    expect(handIds(after, 'bia')).toEqual(['b1', 'd1', 'd2', 'top']);
    expect(after.drawPile).toHaveLength(0);
    expect(currentId(after)).toBe('cai');
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'drew', playerId: 'bia', reason: 'penalty', requested: 4, drawn: 3, reshuffled: true }),
    );
    expect([...allCardIds(after)].sort()).toEqual([...allCardIds(state)].sort());
  });

  it('compra 2 sem cartas nenhuma ainda faz o próximo perder o turno', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'draw-two'), num('a2', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('top', 'red', 9)],
      drawPile: [],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, guardedRandom(zeroRandom)));
    // A pilha vazia reembaralha o descarte anterior (topo preservado): só 'top' volta à mão.
    expect(handIds(after, 'bia')).toEqual(['b1', 'top']);
    expect(currentId(after)).toBe('cai');
    expect(events).toContainEqual(expect.objectContaining({ type: 'drew', playerId: 'bia', drawn: 1, requested: 2, reshuffled: true }));
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
  });

  it('penalidade que atravessa o reembaralhamento preserva o topo e completa a compra', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'draw-two'), num('a2', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('x1', 'red', 1), num('x2', 'red', 2)],
      drawPile: [num('d1', 'blue', 5)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, guardedRandom(zeroRandom)));
    expect(handIds(after, 'bia')).toHaveLength(3);
    expect(after.discardPile.map((card) => card.id)).toEqual(['a1']);
    expect(after.drawPile).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'drew', playerId: 'bia', drawn: 2, requested: 2, reshuffled: true }),
    );
    expect([...allCardIds(after)].sort()).toEqual([...allCardIds(state)].sort());
  });

  it('denúncia usa a mesma regra de compra e preserva as cartas quando faltam', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1), num('a0', 'blue', 2)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('top', 'red', 4)],
      drawPile: [],
    });
    const before = [...allCardIds(state)].sort();
    const afterPlay = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1', announceLastCard: false }, zeroRandom)).state;
    expect(afterPlay.lastCard).toEqual({ playerId: 'ana', announced: false });
    const challenged = expectOk(run(afterPlay, { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' }, zeroRandom)).state;
    // Só uma carta restou para reembaralhar (o topo anterior): a penalidade de duas cartas é parcial.
    expect(handIds(challenged, 'ana')).toEqual(['a0', 'top']);
    expect(challenged.discardPile.map((card) => card.id)).toEqual(['a1']);
    expect([...allCardIds(challenged)].sort()).toEqual(before);
  });
});
