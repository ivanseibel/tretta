import { describe, expect, it } from 'vitest';
import { type RoundState } from '../src/index.js';
import {
  act,
  allCardIds,
  currentId,
  expectOk,
  expectRejected,
  handIds,
  makeState,
  num,
  run,
  snapshot,
  wild,
} from './fixtures.js';

/** ana tem duas cartas; descartar a1 deixa uma carta. Bia é a próxima. */
function almostOut(extra: Partial<Parameters<typeof makeState>[0]> = {}): RoundState {
  return makeState({
    hands: {
      ana: [num('a1', 'red', 1), num('a2', 'green', 2)],
      bia: [num('b1', 'green', 3)],
      cai: [num('c1', 'yellow', 4)],
    },
    discard: [num('t', 'red', 9)],
    drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3)],
    ...extra,
  });
}

const discardA1 = { type: 'play', playerId: 'ana', cardId: 'a1' } as const;
const announceAna = { type: 'announceLastCard', playerId: 'ana' } as const;
const challengeAna = { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' } as const;

describe('última carta', () => {
  it('aviso junto do descarte que deixa uma carta abre a janela já anunciada', () => {
    const state = almostOut();
    const { state: after, events } = expectOk(
      run(state, { type: 'play', playerId: 'ana', cardId: 'a1', announceLastCard: true }),
    );
    expect(after.lastCard).toEqual({ playerId: 'ana', announced: true });
    expect(events).toContainEqual({ type: 'lastCardAnnounced', playerId: 'ana', withDiscard: true });
  });

  it('aviso junto do descarte é recusado quando o descarte não deixa exatamente uma carta', () => {
    const state = makeState({
      hands: { ana: [num('a1', 'red', 1), num('a2', 'green', 2), num('a3', 'green', 5)], bia: [num('b1', 'green', 3)] },
      discard: [num('t', 'red', 9)],
    });
    const before = snapshot(state);
    expectRejected(run(state, { type: 'play', playerId: 'ana', cardId: 'a1', announceLastCard: true }), 'ANNOUNCE_NOT_APPLICABLE');
    expect(snapshot(state)).toBe(before);
  });

  it('aviso posterior ao descarte é aceito enquanto a janela estiver aberta, mesmo fora da vez', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    expect(afterDiscard.lastCard).toEqual({ playerId: 'ana', announced: false });
    expect(currentId(afterDiscard)).toBe('bia');

    const announced = expectOk(run(afterDiscard, announceAna)).state;
    expect(announced.lastCard).toEqual({ playerId: 'ana', announced: true });
    expect(currentId(announced)).toBe('bia');
  });

  it('denúncia antes do aviso é válida: o denunciado recebe duas cartas e a janela fecha', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    const { state: after, events } = expectOk(run(afterDiscard, challengeAna));
    expect(handIds(after, 'ana')).toEqual(['a2', 'd1', 'd2']);
    expect(after.lastCard).toBeNull();
    expect(currentId(after)).toBe('bia');
    expect(events).toContainEqual({ type: 'challengeAccepted', challengerId: 'bia', targetId: 'ana', penalty: 2 });
    expect(events).toContainEqual(expect.objectContaining({ type: 'drew', playerId: 'ana', reason: 'challenge', drawn: 2 }));
  });

  it('denúncia depois do aviso é recusada com explicação e sem penalidade', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    const announced = expectOk(run(afterDiscard, announceAna)).state;
    const before = snapshot(announced);
    const result = run(announced, challengeAna);
    expectRejected(result, 'INVALID_CHALLENGE');
    if (!result.ok) expect(result.error.message).toMatch(/avisou/);
    expect(snapshot(announced)).toBe(before);
    expect(handIds(announced, 'ana')).toEqual(['a2']);
  });

  it('ordens opostas de aviso e denúncia produzem resultados correspondentes', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;

    // Ordem A: aviso chega antes da denúncia.
    const orderA = expectOk(run(afterDiscard, announceAna)).state;
    expectRejected(run(orderA, challengeAna), 'INVALID_CHALLENGE');
    expect(handIds(orderA, 'ana')).toEqual(['a2']);

    // Ordem B: denúncia chega antes do aviso.
    const challenged = expectOk(run(afterDiscard, challengeAna)).state;
    expect(handIds(challenged, 'ana')).toEqual(['a2', 'd1', 'd2']);
    expectRejected(run(challenged, announceAna), 'NO_LAST_CARD_WINDOW');
  });

  it('a janela fecha quando o próximo jogador compra', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    const afterDraw = expectOk(run(afterDiscard, { type: 'draw', playerId: 'bia' })).state;
    expect(afterDraw.lastCard).toBeNull();
    expectRejected(run(afterDraw, { type: 'challengeLastCard', playerId: 'cai', targetId: 'ana' }), 'NO_LAST_CARD_WINDOW');
    expect(handIds(afterDraw, 'ana')).toEqual(['a2']);
  });

  it('a janela fecha quando o próximo jogador descarta', () => {
    const state = almostOut({ hands: { ana: [num('a1', 'red', 1), num('a2', 'green', 2)], bia: [num('b1', 'red', 3), num('b2', 'green', 5)], cai: [] } });
    const afterDiscard = expectOk(run(state, discardA1)).state;
    const afterBia = expectOk(run(afterDiscard, { type: 'play', playerId: 'bia', cardId: 'b1' })).state;
    // Janela de ana fechada; o descarte de bia (deixa uma carta) abre a janela dela.
    expect(afterBia.lastCard).toEqual({ playerId: 'bia', announced: false });
    expectRejected(run(afterBia, { type: 'challengeLastCard', playerId: 'cai', targetId: 'ana' }), 'NO_LAST_CARD_WINDOW');
    expectRejected(run(afterBia, announceAna), 'NO_LAST_CARD_WINDOW');
  });

  it('duas pessoas com Bloqueio: o próprio jogador volta a jogar e a janela continua aberta até a sua ação', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'skip'), num('a2', 'green', 2)], bia: [num('b1', 'red', 3)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2)],
    });
    const afterDiscard = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(currentId(afterDiscard)).toBe('ana');
    expect(afterDiscard.lastCard).toEqual({ playerId: 'ana', announced: false });
    const challenged = expectOk(run(afterDiscard, { type: 'challengeLastCard', playerId: 'bia', targetId: 'ana' })).state;
    expect(handIds(challenged, 'ana')).toEqual(['a2', 'd1', 'd2']);
  });

  it('Compra 2 obrigatória não fecha a janela do denunciado; a penalidade chega ao próximo', () => {
    const state = makeState({
      hands: { ana: [act('a1', 'red', 'draw-two'), num('a2', 'green', 2)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [num('d1', 'blue', 1), num('d2', 'blue', 2), num('d3', 'blue', 3)],
    });
    const afterDiscard = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1' })).state;
    expect(afterDiscard.lastCard).toEqual({ playerId: 'ana', announced: false });
    expect(handIds(afterDiscard, 'bia')).toHaveLength(3);
    const challenged = expectOk(run(afterDiscard, { type: 'challengeLastCard', playerId: 'cai', targetId: 'ana' })).state;
    expect(handIds(challenged, 'ana')).toEqual(['a2', 'd3', 't']);
  });

  it('Compra 4 obrigatória também não fecha a janela do denunciado', () => {
    const state = makeState({
      hands: { ana: [wild('a1', 'draw-four'), num('a2', 'green', 2)], bia: [num('b1', 'green', 3)], cai: [num('c1', 'yellow', 4)] },
      discard: [num('t', 'red', 9)],
      drawPile: [
        num('d1', 'blue', 1),
        num('d2', 'blue', 2),
        num('d3', 'blue', 3),
        num('d4', 'blue', 4),
        num('d5', 'blue', 5),
        num('d6', 'blue', 6),
      ],
    });
    const afterDiscard = expectOk(run(state, { type: 'play', playerId: 'ana', cardId: 'a1', chosenColor: 'blue' })).state;
    expect(afterDiscard.lastCard).toEqual({ playerId: 'ana', announced: false });
    expect(handIds(afterDiscard, 'bia')).toHaveLength(5);
    const challenged = expectOk(run(afterDiscard, { type: 'challengeLastCard', playerId: 'cai', targetId: 'ana' })).state;
    expect(handIds(challenged, 'ana')).toEqual(['a2', 'd5', 'd6']);
  });

  it('recusa denúncia de quem denuncia a si mesmo e aviso sem janela, sem alterar o estado', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    const before = snapshot(afterDiscard);
    expectRejected(run(afterDiscard, { type: 'challengeLastCard', playerId: 'ana', targetId: 'ana' }), 'INVALID_CHALLENGE');
    expectRejected(run(afterDiscard, { type: 'challengeLastCard', playerId: 'bia', targetId: 'cai' }), 'NO_LAST_CARD_WINDOW');
    expect(snapshot(afterDiscard)).toBe(before);

    expectRejected(run(almostOut(), announceAna), 'NO_LAST_CARD_WINDOW');
    const announced = expectOk(run(afterDiscard, announceAna)).state;
    expectRejected(run(announced, announceAna), 'ALREADY_ANNOUNCED');
  });

  it('aviso de outro jogador não vale para a janela de quem descartou', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    expectRejected(run(afterDiscard, { type: 'announceLastCard', playerId: 'bia' }), 'NO_LAST_CARD_WINDOW');
  });

  it('denúncia válida preserva todas as cartas físicas', () => {
    const afterDiscard = expectOk(run(almostOut(), discardA1)).state;
    const challenged = expectOk(run(afterDiscard, challengeAna)).state;
    expect(allCardIds(challenged).sort()).toEqual(allCardIds(almostOut()).sort());
  });
});
