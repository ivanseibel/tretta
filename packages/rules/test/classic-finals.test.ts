import { describe, expect, it } from 'vitest';
import { applyCommand, type RoundCommand } from '../src/index.js';
import {
  act,
  allCardIds,
  currentId,
  expectOk,
  expectRejected,
  type FixtureInit,
  handIds,
  makeState,
  num,
  run,
  snapshot,
  wild,
  zeroRandom,
} from './fixtures.js';

const others = {
  bia: [num('b1', 'green', 3), num('b2', 'green', 6)],
  cai: [num('c1', 'yellow', 4)],
};

function finalState(
  card: ReturnType<typeof num> | ReturnType<typeof act> | ReturnType<typeof wild>,
  extra: Partial<FixtureInit> = {},
) {
  return makeState({
    hands: { ana: [card], ...others },
    discard: [num('t', 'red', 9)],
    drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3), num('d4', 'blue', 4), num('d5', 'blue', 5)],
    ...extra,
  });
}

function expectFinishedAndLocked(state: ReturnType<typeof makeState>, playerId: string): void {
  expect(state.status).toBe('finished');
  expect(state.winnerId).toBe(playerId);
  const commands: RoundCommand[] = [
    { type: 'draw', playerId: 'bia' },
    { type: 'pass', playerId: 'bia' },
    { type: 'play', playerId: 'bia', cardId: 'b1' },
    { type: 'announceLastCard', playerId: 'ana' },
    { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' },
  ];
  for (const command of commands) {
    const before = snapshot(state);
    expectRejected(run(state, command), 'ROUND_FINISHED');
    expect(snapshot(state)).toBe(before);
  }
}

describe('finais da rodada', () => {
  it('vitória com número encerra a rodada e bloqueia comandos posteriores', () => {
    const state = finalState(num('a1', 'red', 5));
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(events.map((event) => event.type)).toEqual(['played', 'roundFinished']);
    expect(events.at(-1)).toEqual({ type: 'roundFinished', winnerId: 'ana' });
    expect(handIds(after, 'ana')).toEqual([]);
    expect(handIds(after, 'bia')).toEqual(['b1', 'b2']);
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Bloqueio registra a perda de turno do próximo antes do resultado', () => {
    const state = finalState(act('a1', 'red', 'skip'));
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(after.direction).toBe('clockwise');
    expect(currentId(after)).toBe('cai');
    expect(events.map((event) => event.type)).toEqual(['played', 'turnSkipped', 'roundFinished']);
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Inversão com três pessoas muda o sentido e emite directionChanged', () => {
    const state = finalState(act('a1', 'red', 'reverse'));
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(after.direction).toBe('counterclockwise');
    expect(currentId(after)).toBe('cai');
    expect(events.map((event) => event.type)).toEqual(['played', 'directionChanged', 'roundFinished']);
    expect(events).toContainEqual({ type: 'directionChanged', direction: 'counterclockwise' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Inversão no sentido anti-horário volta ao sentido horário', () => {
    const state = finalState(act('a1', 'red', 'reverse'), { direction: 'counterclockwise' });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(after.direction).toBe('clockwise');
    expect(currentId(after)).toBe('bia');
    expect(events.map((event) => event.type)).toEqual(['played', 'directionChanged', 'roundFinished']);
    expect(events).toContainEqual({ type: 'directionChanged', direction: 'clockwise' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Inversão com duas pessoas funciona como Bloqueio e mantém o sentido', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'reverse')], bia: [num('b1', 'green', 3)] },
      discard: [num('t', 'red', 9)],
    });
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(after.direction).toBe('clockwise');
    expect(currentId(after)).toBe('ana');
    expect(events.map((event) => event.type)).toEqual(['played', 'turnSkipped', 'roundFinished']);
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Compra 2 resolve a compra e a perda de turno do próximo antes do resultado', () => {
    const state = finalState(act('a1', 'red', 'draw-two'));
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom));
    expect(handIds(after, 'bia')).toEqual(['b1', 'b2', 'd1', 'd2']);
    expect(after.drawPile.map((card) => card.id)).toEqual(['d3', 'd4', 'd5']);
    expect(currentId(after)).toBe('cai');
    expect(events.map((event) => event.type)).toEqual(['played', 'drew', 'turnSkipped', 'roundFinished']);
    expect(events.filter((event) => event.type === 'drew')).toHaveLength(1);
    expect(events).toContainEqual({ type: 'drew', playerId: 'bia', reason: 'penalty', requested: 2, drawn: 2, reshuffled: false });
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com Compra 4 resolve as quatro cartas, a cor ativa e a perda de turno', () => {
    const state = finalState(wild('w4', 'draw-four'));
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w4', chosenColor: 'blue' }, zeroRandom));
    expect(handIds(after, 'bia')).toEqual(['b1', 'b2', 'd1', 'd2', 'd3', 'd4']);
    expect(after.activeColor).toBe('blue');
    expect(after.discardPile.at(-1)?.id).toBe('w4');
    expect(currentId(after)).toBe('cai');
    expect(events.map((event) => event.type)).toEqual(['played', 'drew', 'turnSkipped', 'roundFinished']);
    expect(events.filter((event) => event.type === 'drew')).toHaveLength(1);
    expect(events).toContainEqual({ type: 'drew', playerId: 'bia', reason: 'penalty', requested: 4, drawn: 4, reshuffled: false });
    expect(events).toContainEqual({ type: 'turnSkipped', playerId: 'bia' });
    expectFinishedAndLocked(after, 'ana');
  });

  it('vitória com coringa de cor exige a escolha e registra a cor final', () => {
    const state = finalState(wild('w1', 'color'));
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'w1' }, zeroRandom), 'COLOR_REQUIRED');
    expect(state.status).toBe('playing');
    const { state: after, events } = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w1', chosenColor: 'green' }, zeroRandom));
    expect(after.activeColor).toBe('green');
    expect(events.map((event) => event.type)).toEqual(['played', 'roundFinished']);
    expectFinishedAndLocked(after, 'ana');
  });

  it('a jogada vencedora fecha a janela anterior antes de encerrar', () => {
    const state = makeState({
      hands: {
        ana: [num('a1', 'red', 1), num('a2', 'green', 2)],
        bia: [num('b1', 'red', 3)],
        cai: [num('c1', 'yellow', 4)],
      },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2)],
    });
    const opened = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(opened.lastCard).toEqual({ playerId: 'ana', announced: false });
    const { state: after, events } = expectOk(run(opened, { type: 'play', playerId: 'bia', cardId: 'b1' }));
    expect(after.lastCard).toBeNull();
    expect(after.winnerId).toBe('bia');
    expect(events.at(-1)).toEqual({ type: 'roundFinished', winnerId: 'bia' });
    expectFinishedAndLocked(after, 'bia');
  });

  it('após o fim, nenhuma denúncia altera vencedor, mãos ou pilhas', () => {
    const state = finalState(num('a1', 'red', 5));
    const finished = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom)).state;
    const ids = [...allCardIds(finished)].sort();
    const result = applyCommand(finished, { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' }, zeroRandom);
    expect(result.ok).toBe(false);
    expect([...allCardIds(finished)].sort()).toEqual(ids);
    expect(finished.winnerId).toBe('ana');
  });

  it('o motor não calcula placar: o estado final contém apenas o vencedor e as cartas', () => {
    const state = finalState(num('a1', 'red', 5));
    const finished = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }, zeroRandom)).state;
    expect(Object.keys(finished).sort()).toEqual(
      ['activeColor', 'currentIndex', 'direction', 'discardPile', 'drawPile', 'drawnCardId', 'lastCard', 'phase', 'seats', 'status', 'winnerId'],
    );
  });
});
