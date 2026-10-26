/**
 * Matriz das oito apresentações (T005C): cada variação renderiza com legenda,
 * emoji e classe próprios, alimentada por fixture controlada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AutomaticEffect, EffectCategory, EffectVariant } from '@tretta/protocol';
import type { AnimationPreference } from '@/lib/prefs';
import type { Presentation } from '@/lib/presentationQueue';

const holder = vi.hoisted(() => ({
  room: {
    activePresentation: null as Presentation | null,
    activeAnimations: 'full' as AnimationPreference,
  },
}));

vi.mock('@/app/providers', () => ({
  useRoom: () => holder.room,
}));

import { EffectOverlay } from '@/components/reactions/EffectOverlay';

function effectFixture(variant: EffectVariant, category: EffectCategory): AutomaticEffect {
  const base = { id: `fx_${variant}`, roundId: 'r1', seq: 1, eventIndex: 0, variant };
  switch (category) {
    case 'penaltyDraw':
      return {
        ...base,
        category,
        targetId: 'p2',
        targetNickname: 'Bia',
        drawn: 2,
        requested: 2,
        reason: 'penalty',
      };
    case 'blocked':
      return { ...base, category, playerId: 'p2', playerNickname: 'Bia' };
    case 'directionReversed':
      return { ...base, category, direction: 'clockwise' };
    case 'victory':
      return { ...base, category, winnerId: 'p1', winnerNickname: 'Ana', substitute: false };
  }
}

const MATRIX: readonly {
  variant: EffectVariant;
  category: EffectCategory;
  emoji: string;
  caption: string;
}[] = [
  { variant: 'cards-rain', category: 'penaltyDraw', emoji: '🌧️', caption: 'Bia comprou 2 cartas de penalidade' },
  { variant: 'cards-avalanche', category: 'penaltyDraw', emoji: '🌊', caption: 'Bia comprou 2 cartas de penalidade' },
  { variant: 'brick-wall', category: 'blocked', emoji: '🧱', caption: 'Bia perdeu a vez' },
  { variant: 'stumble', category: 'blocked', emoji: '🤕', caption: 'Bia perdeu a vez' },
  { variant: 'boomerang', category: 'directionReversed', emoji: '🪃', caption: 'Sentido horário' },
  { variant: 'windmill', category: 'directionReversed', emoji: '🌬️', caption: 'Sentido horário' },
  { variant: 'confetti', category: 'victory', emoji: '🎉', caption: 'Ana venceu a rodada!' },
  { variant: 'trophy', category: 'victory', emoji: '🏆', caption: 'Ana venceu a rodada!' },
];

function present(presentation: Presentation | null, animations: AnimationPreference = 'full'): void {
  holder.room.activePresentation = presentation;
  holder.room.activeAnimations = animations;
}

beforeEach(() => {
  present(null);
});

afterEach(() => {
  cleanup();
  present(null);
});

describe('matriz das oito apresentações', () => {
  for (const entry of MATRIX) {
    it(`${entry.category}/${entry.variant} renderiza legenda, emoji e classe próprios`, () => {
      const effect = effectFixture(entry.variant, entry.category);
      present({ kind: 'effect', id: effect.id, durationMs: 2600, effect });
      render(<EffectOverlay />);

      const node = screen.getByTestId(`auto-effect-${entry.category}`);
      expect(node.getAttribute('data-effect-variant')).toBe(entry.variant);
      expect(node.getAttribute('data-effect-id')).toBe(effect.id);
      expect(node.classList.contains('fx-effect')).toBe(true);
      expect(node.classList.contains(`fx-${entry.variant}`)).toBe(true);
      expect(screen.getByTestId(`auto-effect-caption-${effect.id}`).textContent).toBe(entry.caption);
      expect(node.textContent).toContain(entry.emoji);
    });
  }

  it('as oito combinações categoria/variação são distintas entre si', () => {
    const keys = MATRIX.map((entry) => `${entry.category}:${entry.variant}`);
    expect(new Set(keys).size).toBe(8);
    expect(new Set(MATRIX.map((entry) => `fx-${entry.variant}`)).size).toBe(8);
  });
});

describe('legendas refletem dados reais', () => {
  function captionFor(effect: AutomaticEffect): string {
    present({ kind: 'effect', id: effect.id, durationMs: 2600, effect });
    render(<EffectOverlay />);
    return screen.getByTestId(`auto-effect-caption-${effect.id}`).textContent ?? '';
  }

  it('compra de zero cartas não afirma entrega inexistente', () => {
    const caption = captionFor({
      id: 'fx_zero',
      roundId: 'r1',
      seq: 1,
      eventIndex: 0,
      variant: 'cards-rain',
      category: 'penaltyDraw',
      targetId: 'p2',
      targetNickname: 'Bia',
      drawn: 0,
      requested: 4,
      reason: 'penalty',
    });
    expect(caption).toBe('Bia não recebeu cartas desta vez');
    expect(caption).not.toMatch(/\d+ carta/);
  });

  it('denúncia e quantidade singular aparecem como tal', () => {
    const caption = captionFor({
      id: 'fx_challenge',
      roundId: 'r1',
      seq: 2,
      eventIndex: 1,
      variant: 'cards-avalanche',
      category: 'penaltyDraw',
      targetId: 'p3',
      targetNickname: 'Caio',
      drawn: 1,
      requested: 4,
      reason: 'challenge',
    });
    expect(caption).toBe('Caio comprou 1 carta por denúncia');
  });

  it('inversão anti-horária e vitória de substituto', () => {
    const counter = captionFor({
      id: 'fx_counter',
      roundId: 'r1',
      seq: 3,
      eventIndex: 0,
      variant: 'boomerang',
      category: 'directionReversed',
      direction: 'counterclockwise',
    });
    cleanup();
    expect(counter).toBe('Sentido anti-horário');

    const substitute = captionFor({
      id: 'fx_sub',
      roundId: 'r1',
      seq: 4,
      eventIndex: 1,
      variant: 'trophy',
      category: 'victory',
      winnerId: 'p9',
      winnerNickname: 'Bia',
      substitute: true,
    });
    expect(substitute).toBe('Substituto de Bia venceu a rodada!');
  });
});

describe('apresentações automáticas e modos de preferência', () => {
  it('overlay espelha o modo efetivo em data-anim', () => {
    const effect = effectFixture('brick-wall', 'blocked');
    present({ kind: 'effect', id: effect.id, durationMs: 2000, effect }, 'reduced');
    const view = render(<EffectOverlay />);
    expect(screen.getByTestId('effect-overlay').getAttribute('data-anim')).toBe('reduced');

    present({ kind: 'effect', id: effect.id, durationMs: 1400, effect }, 'off');
    view.rerender(<EffectOverlay />);
    expect(screen.getByTestId('effect-overlay').getAttribute('data-anim')).toBe('off');
  });

  it('sem apresentação ativa não há overlay', () => {
    present(null);
    render(<EffectOverlay />);
    expect(screen.queryByTestId('effect-overlay')).toBeNull();
  });

});
