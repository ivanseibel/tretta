/**
 * Bandeja de reações (T019D): doze opções sem alvo, limite apresentado,
 * envio único e fechamento com foco devolvido à origem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MoodPreferences } from '@/lib/prefs';
import type { MoodMenuState, RoomContextValue } from '@/app/providers';

const holder = vi.hoisted(() => ({
  sendReaction: vi.fn(),
  closeMoodMenu: vi.fn(),
  moodMenu: null as MoodMenuState | null,
  espera: 0,
  pending: false,
  linkReady: true,
  connection: 'live' as 'live' | 'lost',
}));

const preferences: MoodPreferences = {
  animations: 'full',
  soundMuted: false,
  turnNotificationEnabled: true,
  hideReactions: false,
};

vi.mock('@/app/providers', () => ({
  useRoom: () =>
    ({
      moodMenu: holder.moodMenu,
      connection: holder.connection,
      chatLinkReady: holder.linkReady,
      moodPending: holder.pending,
      moodRemaining: () => holder.espera,
      sendReaction: holder.sendReaction,
      closeMoodMenu: holder.closeMoodMenu,
      isMoodMenuCurrent: () => true,
      preferences,
      activeAnimations: 'full',
    }) as unknown as RoomContextValue,
}));

import { ReactionTray } from '@/components/reactions/ReactionTray';
import { REACTION_TYPES } from '@tretta/protocol/shared';

const originalRaf = globalThis.requestAnimationFrame;

beforeEach(() => {
  holder.moodMenu = {
    kind: 'reaction',
    seq: 1,
    anchor: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
    trigger: null,
  };
  holder.espera = 0;
  holder.pending = false;
  holder.linkReady = true;
  holder.connection = 'live';
  holder.sendReaction.mockReset();
  holder.sendReaction.mockResolvedValue({ ok: true });
  holder.closeMoodMenu.mockReset();
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  };
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRaf;
});

describe('bandeja de reações', () => {
  it('mostra as doze reações, sem alvo nem texto de provocação', () => {
    render(<ReactionTray />);
    expect(screen.getByTestId('reaction-tray')).toBeTruthy();
    expect(REACTION_TYPES).toHaveLength(12);
    for (const tipo of REACTION_TYPES) {
      expect(screen.getByTestId(`reaction-option-${tipo}`)).toBeTruthy();
    }
    const texto = screen.getByTestId('reaction-tray').textContent ?? '';
    expect(texto).toContain('individual, sem destinatário');
    expect(texto.toLowerCase()).not.toContain('provocar');
    expect(texto.toLowerCase()).not.toContain('alvo');
  });

  it('envia sem targetId e fecha devolvendo o foco', async () => {
    render(<ReactionTray />);
    fireEvent.click(screen.getByTestId('reaction-option-boa-jogada'));
    await Promise.resolve();
    expect(holder.sendReaction).toHaveBeenCalledWith('boa-jogada');
    expect(holder.sendReaction.mock.calls[0]).toHaveLength(1);
    expect(holder.closeMoodMenu).toHaveBeenCalledWith(true);
  });

  it('respeita o intervalo de 5 s apresentado pelo servidor', () => {
    holder.espera = 3_200;
    render(<ReactionTray />);
    expect(screen.getByTestId('reaction-countdown').textContent).toContain('4s');
    fireEvent.click(screen.getByTestId('reaction-option-eita'));
    expect(holder.sendReaction).not.toHaveBeenCalled();
  });

  it('explica a indisponibilidade sem conexão ou vínculo', () => {
    holder.connection = 'lost';
    holder.linkReady = false;
    render(<ReactionTray />);
    expect(screen.getByTestId('reaction-hint').textContent).toContain('Sem conexão');
    fireEvent.click(screen.getByTestId('reaction-option-eita'));
    expect(holder.sendReaction).not.toHaveBeenCalled();
  });

  it('não renderiza nada sem menu de reação', () => {
    holder.moodMenu = null;
    render(<ReactionTray />);
    expect(screen.queryByTestId('reaction-tray')).toBeNull();
  });
});
