import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createClassicDeck,
  createRoundState,
  createSeededRandom,
  dealRound,
  projectForPlayer,
  RulesError,
  startRound,
} from '../src/index.js';
import { expectOk, makeState, num, run, wild } from './fixtures.js';
import { expectOnlyPublicAndOwn, handOf, hiddenIdsFor } from './helpers-privacy.js';
import { guardedRandom, playerIdsOf } from './helpers.js';

function startedState(count: number, seed: number) {
  return createRoundState(startRound({ playerIds: playerIdsOf(count), random: createSeededRandom(seed) }));
}

describe('projeções privadas', () => {
  it('cada participante vê somente a própria mão; adversários e pilha ficam ocultos', () => {
    const state = startedState(4, 11);
    for (const seat of state.seats) {
      const view = projectForPlayer(state, seat.id);
      expectOnlyPublicAndOwn(JSON.stringify(view), state, seat.id);
      expect(view.hand.map((card) => card.id)).toEqual(handOf(state, seat.id));
      expect(view.players.map((player) => player.handCount)).toEqual(state.seats.map((entry) => entry.hand.length));
      expect(view.drawPileCount).toBe(state.drawPile.length);
    }
  });

  it('projeção de jogadores diferentes difere somente na própria mão e nas ações disponíveis', () => {
    const state = startedState(3, 4);
    const [first, second] = state.seats;
    const a = projectForPlayer(state, first?.id ?? '');
    const b = projectForPlayer(state, second?.id ?? '');
    expect(a.hand).not.toEqual(b.hand);
    expect(a.discardTop).toEqual(b.discardTop);
    expect(a.players).toEqual(b.players);
    expect(a.currentPlayerId).toBe(b.currentPlayerId);
  });

  it('ids da mão, pilha de compra e ordem da compra não aparecem para adversários, nem em JSON', () => {
    const state = startedState(2, 21);
    const [ana, bia] = state.seats;
    const anaJson = JSON.stringify(projectForPlayer(state, ana?.id ?? ''));
    for (const card of bia?.hand ?? []) {
      expect(anaJson).not.toContain(card.id);
    }
    for (const card of state.drawPile) {
      expect(anaJson).not.toContain(card.id);
    }
    expect(anaJson).not.toContain('returnedDuringOpening');
  });

  it('histórico returnedDuringOpening não revela cartas que voltaram à compra', () => {
    const deck = createClassicDeck();
    const wildIndex = deck.findIndex((card) => card.kind === 'wild');
    const [returnedWild] = deck.splice(wildIndex, 1);
    deck.splice(14, 0, returnedWild ?? wild('x', 'color'));
    const opening = dealRound({ playerIds: ['ana', 'bia'], deck, random: guardedRandom(createSeededRandom(3)) });
    expect(opening.returnedDuringOpening.length).toBe(1);
    const state = createRoundState(opening);
    const returnedId = opening.returnedDuringOpening[0]?.id ?? '';
    for (const seat of state.seats) {
      const json = JSON.stringify(projectForPlayer(state, seat.id));
      expect(json).not.toContain('returnedDuringOpening');
      if (!handOf(state, seat.id).includes(returnedId)) {
        expect(json).not.toContain(`"${returnedId}"`);
      }
    }
  });

  it('projeção após compra, denúncia e término continua privada', () => {
    const drawState = makeState({
      hands: { ana: [num('a1', 'blue', 1)], bia: [num('b1', 'green', 3), num('b2', 'red', 2)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'red', 5), num('d2', 'red', 6), num('d3', 'red', 7)],
    });
    const drawn = expectOk(run(drawState, { type: 'draw', playerId: 'ana' })).state;
    for (const id of ['ana', 'bia', 'cai']) expectOnlyPublicAndOwn(JSON.stringify(projectForPlayer(drawn, id)), drawn, id);

    const afterDiscard = expectOk(run(drawn, { type: 'pass', playerId: 'ana' })).state;
    const finished = expectOk(
      run(
        makeState({
          hands: { ana: [num('a1', 'red', 1), num('a2', 'blue', 4)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
          discard: [num('t', 'red', 9)],
          drawPile: [num('d1', 'red', 5), num('d2', 'red', 6), num('d3', 'red', 7)],
        }),
        { type: 'play', playerId: 'ana', cardId: 'a1', announceLastCard: false },
      ),
    ).state;
    const challenged = expectOk(run(finished, { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' })).state;
    for (const id of ['ana', 'bia', 'cai']) expectOnlyPublicAndOwn(JSON.stringify(projectForPlayer(challenged, id)), challenged, id);
    expect(afterDiscard.status).toBe('playing');

    const winner = makeState({
      hands: { ana: [num('a1', 'red', 1)], bia: [num('b1', 'green', 3), num('b2', 'red', 2)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'red', 5)],
    });
    const done = expectOk(run(winner, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    for (const id of ['ana', 'bia', 'cai']) expectOnlyPublicAndOwn(JSON.stringify(projectForPlayer(done, id)), done, id);
    expect(projectForPlayer(done, 'bia').winnerId).toBe('ana');
  });

  it('eventos públicos de compra não expõem a carta comprada', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'red', 5), num('d2', 'red', 6)],
    });
    const { events } = expectOk(run(state, { type: 'draw', playerId: 'ana' }));
    expect(JSON.stringify(events)).not.toContain('"d1"');
    expect(JSON.stringify(events)).not.toContain('"d2"');
    expect(JSON.stringify(events)).toContain('"drawn":1');
  });

  it('projeção do jogador da vez informa cartas jogáveis e carta comprada somente a ele', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1), num('a2', 'blue', 2)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'green', 5)],
    });
    expect(projectForPlayer(state, 'ana').playableCardIds).toEqual(['a1']);
    expect(projectForPlayer(state, 'bia').playableCardIds).toEqual([]);
    const drawn = expectOk(run(state, { type: 'draw', playerId: 'ana' })).state;
    expect(projectForPlayer(drawn, 'ana').drawnCardId).toBe('d1');
    expect(projectForPlayer(drawn, 'bia').drawnCardId).toBeNull();
    expect(projectForPlayer(drawn, 'ana').playableCardIds).toEqual([]);
  });

  it('dados mutáveis de uma projeção não alteram o estado interno', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1), num('a2', 'blue', 2)], bia: [num('b1', 'red', 3), num('b2', 'red', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'green', 5)],
    });
    const before = JSON.stringify(state);
    const view = projectForPlayer(state, 'ana') as unknown as {
      hand: { id: string; color: string }[];
      players: { handCount: number }[];
      discardTop: { id: string };
      playableCardIds: string[];
    };
    view.hand.push({ id: 'x', color: 'red' });
    view.hand[0] && (view.hand[0].id = 'hacked');
    view.players[0] && (view.players[0].handCount = 99);
    view.discardTop.id = 'hacked';
    view.playableCardIds.length = 0;
    expect(JSON.stringify(state)).toBe(before);
    expect(projectForPlayer(state, 'ana').hand.map((card) => card.id)).toEqual(['a1', 'a2']);
    expect(projectForPlayer(state, 'ana').playableCardIds).toEqual(['a1']);
    expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' }));
  });

  it('participante desconhecido não recebe projeção', () => {
    const state = startedState(2, 2);
    expect(() => projectForPlayer(state, 'zoe')).toThrow(RulesError);
    try {
      projectForPlayer(state, 'zoe');
    } catch (error) {
      expect((error as RulesError).code).toBe('UNKNOWN_PLAYER');
    }
  });

  it('estado de rodada não pode ser alterado por fora dos comandos', () => {
    const state = startedState(2, 9);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.seats[0]?.hand)).toBe(true);
    const result = applyCommand(state, { type: 'draw', playerId: state.seats[state.currentIndex]?.id ?? '' }, createSeededRandom(1));
    expect(result.ok).toBe(true);
    expect(hiddenIdsFor(state, state.seats[0]?.id ?? '').length).toBeGreaterThan(0);
  });
});
