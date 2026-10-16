import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createClassicDeck,
  createRoundState,
  createSeededRandom,
  projectForPlayer,
  type Card,
  type PlayerView,
  type RoundOpening,
  type RoundState,
} from '@tretta/rules';
import { decideBotCommand, mostPresentColor } from '../src/bot.js';

const byId = new Map(createClassicDeck().map((card) => [card.id, card]));

function c(id: string): Card {
  const card = byId.get(id);
  if (card === undefined) throw new Error(`carta desconhecida na fixture: ${id}`);
  return card;
}

function stateOf(spec: {
  readonly players: readonly string[];
  readonly hands: readonly (readonly string[])[];
  readonly discard: string;
  readonly draw: readonly string[];
  readonly first: string;
}): RoundState {
  const hands: Record<string, Card[]> = Object.create(null) as Record<string, Card[]>;
  spec.players.forEach((id, index) => {
    hands[id] = (spec.hands[index] ?? []).map(c);
  });
  const opening: RoundOpening = {
    playerIds: [...spec.players],
    hands,
    drawPile: spec.draw.map(c),
    discardPile: [c(spec.discard)],
    firstPlayerId: spec.first,
    direction: 'clockwise',
    returnedDuringOpening: [],
  };
  return createRoundState(opening);
}

function viewOf(state: RoundState, playerId: string): PlayerView {
  return projectForPlayer(state, playerId);
}

describe('política do substituto automático', () => {
  it('joga a primeira carta válida na ordem da mão, preferindo coloridas a coringas', () => {
    const state = stateOf({
      players: ['a', 'b'],
      hands: [
        ['wild-color-1', 'blue-3-1', 'red-5-1', 'red-7-1'],
        ['blue-1-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-1-1'],
      first: 'a',
    });
    expect(decideBotCommand(viewOf(state, 'a'))).toEqual({ type: 'play', cardId: 'red-5-1' });
  });

  it('sem colorida válida, joga o coringa escolhendo a cor mais presente na mão', () => {
    const state = stateOf({
      players: ['a', 'b'],
      hands: [
        ['wild-color-2', 'blue-1-1', 'blue-3-1', 'yellow-2-1'],
        ['red-1-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-2-1'],
      first: 'a',
    });
    expect(decideBotCommand(viewOf(state, 'a'))).toEqual({ type: 'play', cardId: 'wild-color-2', chosenColor: 'blue' });
  });

  it('empate de cores segue a ordem canônica documentada (vermelho > amarelo > verde > azul)', () => {
    const state = stateOf({
      players: ['a', 'b'],
      hands: [
        ['wild-color-3', 'red-1-1', 'yellow-1-1'],
        ['blue-1-1'],
      ],
      discard: 'blue-9-1',
      draw: ['green-3-1'],
      first: 'a',
    });
    expect(decideBotCommand(viewOf(state, 'a'))).toEqual({ type: 'play', cardId: 'wild-color-3', chosenColor: 'red' });
    expect(mostPresentColor([c('wild-color-3')])).toBe('red');
    expect(mostPresentColor([c('green-1-1'), c('blue-1-1')])).toBe('green');
  });

  it('sem carta válida compra; depois de comprar joga somente a recém-comprada quando válida, senão passa', () => {
    const playableDraw = stateOf({
      players: ['a', 'b'],
      hands: [['green-1-1'], ['blue-1-1']],
      discard: 'red-9-1',
      draw: ['red-3-1'],
      first: 'a',
    });
    expect(decideBotCommand(viewOf(playableDraw, 'a'))).toEqual({ type: 'draw' });
    const afterGoodDraw = applyCommand(playableDraw, { type: 'draw', playerId: 'a' }, createSeededRandom(1));
    if (!afterGoodDraw.ok) throw new Error('compra recusada');
    // A recém-comprada deixa a mão com uma carta: o aviso acompanha o descarte.
    expect(decideBotCommand(viewOf(afterGoodDraw.state, 'a'))).toEqual({
      type: 'play',
      cardId: 'red-3-1',
      announceLastCard: true,
    });

    const uselessDraw = stateOf({
      players: ['a', 'b'],
      hands: [['green-1-1'], ['blue-1-1']],
      discard: 'red-9-1',
      draw: ['green-3-1'],
      first: 'a',
    });
    const afterBadDraw = applyCommand(uselessDraw, { type: 'draw', playerId: 'a' }, createSeededRandom(1));
    if (!afterBadDraw.ok) throw new Error('compra recusada');
    expect(decideBotCommand(viewOf(afterBadDraw.state, 'a'))).toEqual({ type: 'pass' });
  });

  it('avisa a própria última carta junto do descarte e nunca denuncia', () => {
    const state = stateOf({
      players: ['a', 'b'],
      hands: [
        ['red-2-1', 'red-3-1'],
        ['blue-1-1', 'blue-2-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-1-1'],
      first: 'a',
    });
    expect(decideBotCommand(viewOf(state, 'a'))).toEqual({ type: 'play', cardId: 'red-2-1', announceLastCard: true });

    // Depois do descarte de Ana, a janela abre sem aviso; o substituto de Bia não denuncia.
    const played = applyCommand(state, { type: 'play', playerId: 'a', cardId: 'red-2-1' }, createSeededRandom(2));
    if (!played.ok) throw new Error('descarte recusado');
    expect(viewOf(played.state, 'b').lastCardWindow).toEqual({ playerId: 'a', announced: false });
    const decision = decideBotCommand(viewOf(played.state, 'b'));
    expect(decision).not.toBeNull();
    expect(['play', 'draw', 'pass']).toContain(decision?.type);
  });

  it('informação oculta não muda a decisão: só a projeção da própria mão e dados públicos importam', () => {
    const first = stateOf({
      players: ['a', 'b'],
      hands: [
        ['red-5-1', 'blue-2-1'],
        ['green-1-1', 'green-2-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-3-1', 'green-4-1'],
      first: 'a',
    });
    const second = stateOf({
      players: ['a', 'b'],
      hands: [
        ['red-5-1', 'blue-2-1'],
        ['yellow-1-1', 'yellow-2-1'],
      ],
      discard: 'red-9-1',
      draw: ['green-5-1', 'green-6-1'],
      first: 'a',
    });
    const viewA = viewOf(first, 'a');
    const viewB = viewOf(second, 'a');
    expect(viewB).toEqual(viewA);
    expect(decideBotCommand(viewB)).toEqual(decideBotCommand(viewA));
    // Última carta da mão vira aviso junto do descarte; a escolha não muda com dados ocultos.
    expect(decideBotCommand(viewA)).toEqual({ type: 'play', cardId: 'red-5-1', announceLastCard: true });
  });
});
