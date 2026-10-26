/**
 * T019C — ações da mesa seguem a janela real de última carta, inclusive na
 * própria vez, e a confirmação não depende de mudança de altura.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { StateMessage } from '@tretta/protocol';
import { createClassicDeck } from '@tretta/rules';

const harness = vi.hoisted(() => ({
  room: {
    connection: 'live' as const,
    interactive: true,
    sendCommand: vi.fn(async () => ({ ok: true as const, version: 2 })),
    endRoundWithoutWinner: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('@/components/ui', () => ({
  AvatarAction: () => null,
  AvatarBadge: () => null,
  ColorSymbol: () => null,
  LeaveButton: () => null,
}));
vi.mock('@/components/EventFeed', () => ({ EventFeed: () => null }));
vi.mock('@/components/PausePanel', () => ({ PausePanel: () => null }));

import { GameTable } from '@/components/GameTable';

const deck = createClassicDeck();
const card = (id: string) => {
  const found = deck.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`Carta ausente: ${id}`);
  return found;
};

function tableState(options: {
  currentPlayerId?: string;
  phase?: 'play' | 'after-draw';
  lastCardWindow?: { playerId: string; announced: boolean } | null;
  handIds?: string[];
} = {}): StateMessage {
  const participants = [
    {
      id: 'p1', kind: 'human' as const, nickname: 'Ana', avatar: 'raposa' as const, ready: true,
      connected: true, score: 0, inRound: true, isHost: true, autoControlled: false, absentSince: null,
    },
    {
      id: 'p2', kind: 'human' as const, nickname: 'Bia', avatar: 'lobo' as const, ready: true,
      connected: true, score: 0, inRound: true, isHost: false, autoControlled: false, absentSince: null,
    },
  ];
  const handIds = options.handIds ?? ['red-1-1', 'red-2-1'];
  return {
    room: {
      roomCode: 'ROOM01',
      mode: 'classic',
      hostId: 'p1',
      status: 'playing',
      roundNumber: 1,
      roundId: 'round1',
      lastRound: null,
      participants,
      scoreboard: [],
      pause: null,
      retainedUntil: null,
      serverTime: 1_000,
      version: 1,
    },
    self: {
      playerId: 'p1',
      nickname: 'Ana',
      avatar: 'raposa',
      ready: true,
      inRound: true,
      waiting: false,
      view: {
        viewerId: 'p1',
        status: 'playing',
        players: participants.map((participant) => ({ id: participant.id, handCount: 2 })),
        hand: handIds.map(card),
        playableCardIds: handIds,
        drawPileCount: 90,
        discardTop: card('red-9-1'),
        activeColor: 'red',
        direction: 'clockwise',
        currentPlayerId: options.currentPlayerId ?? 'p1',
        phase: options.phase ?? 'play',
        drawnCardId: null,
        lastCardWindow: options.lastCardWindow ?? null,
        winnerId: null,
      },
    },
    table: null,
  } as unknown as StateMessage;
}

afterEach(() => {
  cleanup();
  harness.room.sendCommand.mockClear();
});

describe('ações da mesa', () => {
  it('na própria vez oferece comprar e avisar última sem esconder a denúncia possível', () => {
    render(<GameTable state={tableState({ lastCardWindow: { playerId: 'p1', announced: false } })} events={[]} />);
    expect(screen.getByTestId('draw-button').textContent).toBe('Comprar');
    expect(screen.getByTestId('announce-button').textContent).toBe('Avisar última');
    expect(screen.queryByTestId('challenge-button')).toBeNull();
    expect(screen.queryByTestId('pass-button')).toBeNull();
  });

  it('denuncia a última de outra pessoa mesmo quando é a própria vez', () => {
    render(<GameTable state={tableState({ lastCardWindow: { playerId: 'p2', announced: false } })} events={[]} />);
    expect(screen.getByTestId('challenge-button').textContent).toBe('Denunciar');
    expect(screen.getByTestId('challenge-button').getAttribute('aria-label')).toContain('Bia');
    expect(screen.queryByTestId('announce-button')).toBeNull();
  });

  it('depois de comprar troca comprar por passar e mantém o aviso da compra', () => {
    render(<GameTable state={tableState({ phase: 'after-draw' })} events={[]} />);
    expect(screen.queryByTestId('draw-button')).toBeNull();
    expect(screen.getByTestId('pass-button').textContent).toBe('Passar');
    expect(screen.getByTestId('after-draw-hint').textContent).toContain('Comprou');
  });

  it('mostra a nota quando a última já foi avisada e some com os botões da janela', () => {
    render(<GameTable state={tableState({ lastCardWindow: { playerId: 'p2', announced: true } })} events={[]} />);
    expect(screen.getByTestId('last-card-note').textContent).toContain('Bia avisou a última carta');
    expect(screen.queryByTestId('announce-button')).toBeNull();
    expect(screen.queryByTestId('challenge-button')).toBeNull();
  });
});
