import { describe, expect, it } from 'vitest';
import { type RoundCommand } from '../src/index.js';
import { act, currentId, expectOk, expectRejected, handIds, makeState, num, run, snapshot, wild } from './fixtures.js';

const three = ['ana', 'bia', 'cai'] as const;

describe('turnos: descarte e validade', () => {
  it('aceita descarte por cor, por número e por símbolo', () => {
    const byColor = makeState({
      hands: { ana: [num('a1', 'red', 5)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    expect(expectOk(run(byColor, { type: 'play', playerId: 'ana', cardId: 'a1' })).state.discardPile.at(-1)?.id).toBe('a1');

    const byNumber = makeState({
      hands: { ana: [num('a1', 'green', 5)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'blue', 5)],
    });
    expect(expectOk(run(byNumber, { type: 'play', playerId: 'ana', cardId: 'a1' })).state.discardPile.at(-1)?.id).toBe('a1');

    const bySymbol = makeState({
      hands: { ana: [act('a1', 'red', 'reverse')], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [act('t', 'green', 'reverse')],
    });
    const after = expectOk(run(bySymbol, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(after.discardPile.at(-1)?.id).toBe('a1');
  });

  it('rejeita descarte sem combinação e preserva o estado', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 2)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    const before = snapshot(state);
    const result = run(state, { type: 'play', playerId: 'ana', cardId: 'a1' });
    expectRejected(result, 'CARD_NOT_PLAYABLE');
    expect(snapshot(state)).toBe(before);
  });

  it('rejeita carta que pertence a outro jogador', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 2)], bia: [num('b1', 'red', 9)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'b1' }), 'CARD_NOT_IN_HAND');
  });

  it('rejeita jogada fora da vez e participante desconhecido', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1)], bia: [num('b1', 'red', 2)], cai: [num('c1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
    });
    expectRejected(run(state, { type: 'play', playerId: 'bia', cardId: 'b1' }), 'NOT_YOUR_TURN');
    expectRejected(run(state, { type: 'play', playerId: 'zoe', cardId: 'a1' }), 'UNKNOWN_PLAYER');
    expectRejected(run(state, { type: 'draw', playerId: 'zoe' }), 'UNKNOWN_PLAYER');
    expectRejected(run(state, { type: 'draw', playerId: 'bia' }), 'NOT_YOUR_TURN');
  });

  it('rejeita tipo de comando desconhecido e comando malformado', () => {
    const state = makeState({ hands: { ana: [num('a1', 'red', 1)], bia: [] }, discard: [num('t', 'red', 9)] });
    expectRejected(run(state, { type: 'fly', playerId: 'ana' } as unknown as RoundCommand), 'INVALID_COMMAND');
    expectRejected(run(state, null as unknown as RoundCommand), 'INVALID_COMMAND');
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 7 } as unknown as RoundCommand), 'INVALID_COMMAND');
  });

  it('compra voluntária com carta válida na mão é permitida; depois só a carta comprada pode ser descartada', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 5)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 2)],
    });
    const drawn = expectOk(run(state, { type: 'draw', playerId: 'ana' })).state;
    expect(drawn.phase).toBe('after-draw');
    expect(drawn.drawnCardId).toBe('d1');
    expect(handIds(drawn, 'ana')).toEqual(['a1', 'd1']);

    expectRejected(run(drawn, { type: 'play', playerId: 'ana', cardId: 'a1' }), 'ONLY_DRAWN_CARD_PLAYABLE');
    expectRejected(run(drawn, { type: 'draw', playerId: 'ana' }), 'ALREADY_DREW');
    const passed = expectOk(run(drawn, { type: 'pass', playerId: 'ana' })).state;
    expect(currentId(passed)).toBe('bia');
    expect(passed.phase).toBe('play');
    expect(passed.drawnCardId).toBeNull();
  });

  it('após comprar, descarta a carta recém-comprada quando válida; um descarte encerra o turno', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'red', 2)],
    });
    const drawn = expectOk(run(state, { type: 'draw', playerId: 'ana' })).state;
    const played = expectOk(run(drawn, { type: 'play', playerId: 'ana', cardId: 'd1' })).state;
    expect(played.discardPile.at(-1)?.id).toBe('d1');
    expect(currentId(played)).toBe('bia');
    expectRejected(run(played, { type: 'play', playerId: 'ana', cardId: 'a1' }), 'NOT_YOUR_TURN');
  });

  it('carta comprada inválida não pode ser descartada; passar encerra o turno', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'blue', 1)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'green', 2)],
    });
    const drawn = expectOk(run(state, { type: 'draw', playerId: 'ana' })).state;
    expectRejected(run(drawn, { type: 'play', playerId: 'ana', cardId: 'd1' }), 'CARD_NOT_PLAYABLE');
    expect(currentId(expectOk(run(drawn, { type: 'pass', playerId: 'ana' })).state)).toBe('bia');
  });

  it('não permite passar sem comprar', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1)], bia: [] },
      discard: [num('t', 'red', 9)],
    });
    expectRejected(run(state, { type: 'pass', playerId: 'ana' }), 'PASS_REQUIRES_DRAW');
  });

  it('não permite dois descartes no mesmo turno, nem comprar duas vezes', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1), num('a2', 'red', 2)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'red', 4)],
    });
    const first = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expectRejected(run(first, { type: 'play', playerId: 'ana', cardId: 'a2' }), 'NOT_YOUR_TURN');
    const bia = expectOk(run(first, { type: 'draw', playerId: 'bia' })).state;
    expectRejected(run(bia, { type: 'draw', playerId: 'bia' }), 'ALREADY_DREW');
  });

  it('coringa exige cor válida antes de qualquer alteração', () => {
    const state = makeState({
      hands: { ana: [wild('w1', 'color'), num('a1', 'blue', 1)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
    });
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'w1' }), 'COLOR_REQUIRED');
    expectRejected(
      run(state, { type: 'play', playerId: 'ana', cardId: 'w1', chosenColor: 'purple' as never }),
      'INVALID_COLOR',
    );
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'a1', chosenColor: 'blue' }), 'CARD_NOT_PLAYABLE');
    const sameAsRed = makeState({
      hands: { ana: [num('a1', 'red', 1)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
    });
    expectRejected(run(sameAsRed, { type: 'play', playerId: 'ana', cardId: 'a1', chosenColor: 'blue' }), 'COLOR_NOT_ALLOWED');
  });

  it('coringa com cor válida define a cor ativa para o próximo descarte', () => {
    const state = makeState({
      hands: { ana: [wild('w1', 'color'), num('a1', 'blue', 2)], bia: [num('b1', 'red', 3), num('b2', 'blue', 4)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
    });
    const after = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'w1', chosenColor: 'blue' })).state;
    expect(after.activeColor).toBe('blue');
    expect(currentId(after)).toBe('bia');
    expectRejected(run(after, { type: 'play', playerId: 'cai', cardId: 'c1' }), 'NOT_YOUR_TURN');
    expectRejected(run(after, { type: 'play', playerId: 'bia', cardId: 'b1' }), 'CARD_NOT_PLAYABLE');
    expectOk(run(after, { type: 'play', playerId: 'bia', cardId: 'b2' }));
  });

  it('a ordem de assentos segue a lista de jogadores', () => {
    const state = makeState({ hands: { ana: [], bia: [], cai: [] }, discard: [num('t', 'red', 9)] });
    expect(state.seats.map((seat) => seat.id)).toEqual([...three]);
  });
});
