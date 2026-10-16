import { describe, expect, it } from 'vitest';
import { act, currentId, expectOk, expectRejected, handIds, makeState, num, run, wild } from './fixtures.js';

describe('efeitos das cartas de ação e coringas', () => {
  it('Bloqueio pula o próximo jogador', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'skip'), num('a2', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }));
    expect(currentId(after)).toBe('cai');
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
  });

  it('Inversão muda o sentido com mais de duas pessoas e a volta também funciona', () => {
    const start = makeState({
      hands: {
        ana: [act('a1', 'red', 'reverse'), num('a2', 'blue', 1)],
        bia: [num('b1', 'green', 3)],
        cai: [act('c1', 'yellow', 'reverse'), num('c2', 'blue', 2)],
      },
      discard: [num('t', 'red', 9)],
    });
    const reversed = expectOk(run(start, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(reversed.direction).toBe('counterclockwise');
    expect(currentId(reversed)).toBe('cai');

    const back = expectOk(run(reversed, { type: 'play', playerId: 'cai', cardId: 'c1' })).state;
    expect(back.direction).toBe('clockwise');
    expect(currentId(back)).toBe('ana');
  });

  it('Inversão com duas pessoas funciona como Bloqueio e mantém o sentido', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'reverse'), num('a2', 'blue', 1)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }));
    expect(after.direction).toBe('clockwise');
    expect(currentId(after)).toBe('ana');
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
    expect(events.some((event) => event.type === 'directionChanged')).toBe(false);
  });

  it('Compra 2 faz o próximo comprar duas cartas e perder o turno, sem defesa nem acumulação', () => {
    const state = makeState({
      hands: {
        ana: [act('a1', 'red', 'draw-two'), num('a2', 'blue', 1)],
        bia: [act('b1', 'red', 'draw-two'), num('b2', 'green', 2)],
        cai: [num('c1', 'yellow', 4)],
      },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }));
    expect(handIds(after, 'bia')).toEqual(['b1', 'b2', 'd1', 'd2']);
    expect(currentId(after)).toBe('cai');
    expect(events).toContainEqual(expect.objectContaining({ type: 'drew', playerId: 'bia', reason: 'penalty', drawn: 2 }));
    expectRejected(run(after, { type: 'play', playerId: 'bia', cardId: 'b1' }), 'NOT_YOUR_TURN');
  });

  it('Compra 2 respeita o sentido anti-horário', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'draw-two'), num('a2', 'blue', 1)], bia: [num('b1', 'green', 2)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2)],
      direction: 'counterclockwise',
    });
    const after = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(handIds(after, 'cai')).toEqual(['c1', 'd1', 'd2']);
    expect(handIds(after, 'bia')).toEqual(['b1']);
    expect(currentId(after)).toBe('bia');
  });

  it('Compra 4 é utilizável independentemente da mão e o próximo compra quatro cartas', () => {
    const state = makeState({
      hands: {
        ana: [wild('w4', 'draw-four'), num('a1', 'red', 3), num('a2', 'red', 7)],
        bia: [num('b1', 'green', 3)],
        cai: [num('c1', 'yellow', 4)],
      },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3), num('d4', 'blue', 4)],
    });
    const after = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w4', chosenColor: 'green' })).state;
    expect(after.activeColor).toBe('green');
    expect(handIds(after, 'bia')).toEqual(['b1', 'd1', 'd2', 'd3', 'd4']);
    expect(currentId(after)).toBe('cai');
  });

  it('Compra 4 em duas pessoas: o adversário compra e o próprio jogador joga de novo', () => {
    const state = makeState({
      hands: { ana: [wild('w4', 'draw-four')], bia: [num('b1', 'green', 3)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3), num('d4', 'blue', 4)],
    });
    const after = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w4', chosenColor: 'blue' })).state;
    expect(handIds(after, 'bia')).toHaveLength(5);
    expect(currentId(after)).toBe('ana');
  });

  it('Coringa de cor escolhida faz o próximo descarte depender da cor escolhida', () => {
    const state = makeState({
      hands: { ana: [wild('w1', 'color'), num('a1', 'blue', 2)], bia: [num('b1', 'red', 3), num('b2', 'blue', 1)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    const after = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w1', chosenColor: 'blue' })).state;
    expect(after.activeColor).toBe('blue');
    expectRejected(run(after, { type: 'play', playerId: 'bia', cardId: 'b1' }), 'CARD_NOT_PLAYABLE');
    expectOk(run(after, { type: 'play', playerId: 'bia', cardId: 'b2' }));
  });

  it('Compra 4 com escolha de cor também funciona no estado da escolha', () => {
    const state = makeState({
      hands: { ana: [wild('w4', 'draw-four'), num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3), num('d4', 'blue', 4)],
    });
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'w4' }), 'COLOR_REQUIRED');
    expect(handIds(state, 'bia')).toEqual(['b1']);
  });
});
