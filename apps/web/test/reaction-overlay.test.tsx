/**
 * Palco central de reações (T019D): fila de até três, quatro segundos por
 * item, excedente descartado, sem bloquear a mesa e sem áudio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactionEvent } from '@tretta/protocol';
import type { MoodPreferences } from '@/lib/prefs';

const holder = vi.hoisted(() => ({
  activeReactions: {} as Record<string, ReactionEvent>,
  preferences: {
    animations: 'full',
    soundMuted: false,
    turnNotificationEnabled: true,
    hideReactions: false,
  } as MoodPreferences,
}));

vi.mock('@/app/providers', () => ({
  useRoom: () => ({
    activeReactions: holder.activeReactions,
    preferences: holder.preferences,
    activeAnimations: holder.preferences.animations,
  }),
}));

import { ReactionOverlay } from '@/components/reactions/ReactionOverlay';

function reaction(id: string, senderId: string, type: ReactionEvent['type']): ReactionEvent {
  return {
    id,
    type,
    sender: { playerId: senderId, nickname: senderId, avatar: 'raposa' },
    sentAt: 1_000,
  };
}

beforeEach(() => {
  holder.activeReactions = {};
  holder.preferences = {
    animations: 'full',
    soundMuted: false,
    turnNotificationEnabled: true,
    hideReactions: false,
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('palco central de reações', () => {
  it('não reapresenta reações que já estavam ativas na montagem', () => {
    holder.activeReactions = { p1: reaction('r1', 'p1', 'eita') };
    render(<ReactionOverlay />);
    expect(screen.queryByTestId('reaction-overlay')).toBeNull();
  });

  it('mostra a reação nova por 4 s e anuncia quem reagiu', () => {
    vi.useFakeTimers();
    const view = render(<ReactionOverlay />);
    holder.activeReactions = { p1: reaction('r1', 'Ana', 'boa-jogada') };
    view.rerender(<ReactionOverlay />);

    const palco = screen.getByTestId('reaction-overlay');
    expect(palco.getAttribute('data-reaction-type')).toBe('boa-jogada');
    expect(palco.textContent).toContain('Ana');
    expect(palco.textContent).toContain('Boa jogada!');
    expect(palco.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(screen.getByTestId('reaction-overlay')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('reaction-overlay')).toBeNull();
  });

  it('enfileira até três e descarta a quarta', () => {
    vi.useFakeTimers();
    const view = render(<ReactionOverlay />);
    holder.activeReactions = {
      p1: reaction('r1', 'Ana', 'eita'),
      p2: reaction('r2', 'Bia', 'uau'),
      p3: reaction('r3', 'Cai', 'tedio'),
      p4: reaction('r4', 'Duda', 'fogo'),
    };
    view.rerender(<ReactionOverlay />);
    expect(screen.getByTestId('reaction-overlay').textContent).toContain('Ana');

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByTestId('reaction-overlay').textContent).toContain('Bia');
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByTestId('reaction-overlay').textContent).toContain('Cai');
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByTestId('reaction-overlay')).toBeNull();
  });

  it('ocultar reações limpa o palco e reativar só mostra as novas', () => {
    const view = render(<ReactionOverlay />);
    holder.activeReactions = { p1: reaction('r1', 'Ana', 'eita') };
    view.rerender(<ReactionOverlay />);
    expect(screen.getByTestId('reaction-overlay')).toBeTruthy();

    holder.preferences = { ...holder.preferences, hideReactions: true };
    holder.activeReactions = {};
    view.rerender(<ReactionOverlay />);
    expect(screen.queryByTestId('reaction-overlay')).toBeNull();

    holder.preferences = { ...holder.preferences, hideReactions: false };
    holder.activeReactions = { p2: reaction('r2', 'Bia', 'injustica') };
    view.rerender(<ReactionOverlay />);
    expect(screen.getByTestId('reaction-overlay').textContent).toContain('Bia');
  });

  it('não tem alvo, áudio nem captura de ponteiro', () => {
    const view = render(<ReactionOverlay />);
    holder.activeReactions = { p1: reaction('r1', 'Ana', 'carinho') };
    view.rerender(<ReactionOverlay />);
    const palco = screen.getByTestId('reaction-overlay');
    expect(palco.textContent).not.toContain('provocar');
    expect(palco.className).toContain('tv2-reaction-overlay');
  });
});
