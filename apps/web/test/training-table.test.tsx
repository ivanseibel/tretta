/**
 * T011B — mesa de treino: o bot na vez é rotulado como bot e nunca aparece
 * como pessoa caída; a queda de uma pessoa continua com banner e rótulo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { StateMessage } from '@tretta/protocol';
import { createClassicDeck } from '@tretta/rules';

const harness = vi.hoisted(() => ({
  room: {
    connection: 'live' as const,
    interactive: true,
    sendCommand: vi.fn(),
    endRoundWithoutWinner: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('@/components/ui', () => ({ AvatarAction: () => null, AvatarBadge: () => null, ColorSymbol: () => null, LeaveButton: () => null }));
vi.mock('@/components/EventFeed', () => ({ EventFeed: () => null }));
vi.mock('@/components/PausePanel', () => ({ PausePanel: () => null }));

import { GameTable } from '@/components/GameTable';

const deck = createClassicDeck();

function card(id: string) {
  const found = deck.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`Carta ausente: ${id}`);
  return found;
}

interface ParticipantFixture {
  id: string;
  kind: 'human' | 'bot';
  nickname: string;
  avatar: string;
  ready: boolean;
  connected: boolean;
  score: number;
  inRound: boolean;
  isHost: boolean;
  autoControlled: boolean;
  absentSince: number | null;
}

function human(overrides: Partial<ParticipantFixture> = {}): ParticipantFixture {
  return {
    id: 'p1',
    kind: 'human',
    nickname: 'Ana',
    avatar: 'raposa',
    ready: true,
    connected: true,
    score: 0,
    inRound: true,
    isHost: true,
    autoControlled: false,
    absentSince: null,
    ...overrides,
  };
}

function bot(index: number, overrides: Partial<ParticipantFixture> = {}): ParticipantFixture {
  const names = ['Tico', 'Lila', 'Nino'];
  const avatars = ['pinguim', 'tucano', 'lobo'];
  return {
    id: `b_TRAIN1_${index}`,
    kind: 'bot',
    nickname: names[index - 1] ?? 'Bot',
    avatar: avatars[index - 1] ?? 'lobo',
    ready: true,
    connected: false,
    score: 0,
    inRound: true,
    isHost: false,
    autoControlled: false,
    absentSince: null,
    ...overrides,
  };
}

function tableState(currentPlayerId: string, participants: ParticipantFixture[]): StateMessage {
  const me = participants[0];
  if (me === undefined) throw new Error('precisa de pelo menos uma pessoa');
  const hand = [card('red-1-1'), card('red-2-1')];
  return {
    room: {
      roomCode: 'TRAIN1',
      mode: 'training',
      hostId: me.id,
      status: 'playing',
      version: 1,
      roundId: 'round1',
      participants,
      scoreboard: participants.map((participant) => ({
        playerId: participant.id,
        kind: participant.kind,
        nickname: participant.nickname,
        avatar: participant.avatar,
        wins: participant.score,
        current: true,
      })),
      lastRound: null,
      pause: null,
      retainedUntil: null,
      serverTime: 1_000,
    },
    self: {
      playerId: me.id,
      nickname: me.nickname,
      avatar: me.avatar,
      ready: true,
      inRound: true,
      waiting: false,
      view: {
        viewerId: me.id,
        status: 'playing',
        players: participants.map((participant) => ({ id: participant.id, handCount: 2 })),
        hand,
        playableCardIds: [],
        drawPileCount: 80,
        discardTop: card('red-9-1'),
        activeColor: 'red',
        direction: 'clockwise',
        currentPlayerId,
        phase: 'play',
        drawnCardId: null,
        lastCardWindow: null,
        winnerId: null,
      },
    },
    table: null,
  } as unknown as StateMessage;
}

beforeEach(() => {
  harness.room.sendCommand.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('mesa de treino na interface', () => {
  it('rotula o bot na vez e não mostra conexão nem substituto para bots', () => {
    render(<GameTable state={tableState('b_TRAIN1_1', [human(), bot(1), bot(2), bot(3)])} events={[]} />);

    expect(screen.getByTestId('turn-indicator').textContent).toBe('Vez de Tico (bot)');
    for (const name of ['Tico', 'Lila', 'Nino']) {
      const row = screen.getByTestId(`seat-${name}`);
      expect(within(row).getByText('bot')).toBeTruthy();
      expect(within(row).queryByText('desconectado')).toBeNull();
    }
    expect(screen.queryByTestId('disconnected-banner')).toBeNull();
    expect(screen.queryByText('substituto')).toBeNull();
  });

  it('na vez da pessoa o aviso é "Sua vez", sem rótulo de bot', () => {
    render(<GameTable state={tableState('p1', [human(), bot(1), bot(2), bot(3)])} events={[]} />);
    expect(screen.getByTestId('turn-indicator').textContent).toBe('Sua vez');
  });

  it('pessoa desconectada na vez mantém banner e rótulo próprios', () => {
    const bia = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', isHost: false, connected: false });
    render(<GameTable state={tableState('p2', [human(), bia, bot(1), bot(2)])} events={[]} />);

    expect(screen.getByTestId('turn-indicator').textContent).toBe('Vez de Bia');
    expect(screen.getByTestId('disconnected-banner').textContent).toMatch(/Bia caiu/);
    expect(within(screen.getByTestId('seat-Bia')).getByText('desconectado')).toBeTruthy();
  });
});
