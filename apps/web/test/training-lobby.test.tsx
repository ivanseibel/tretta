/**
 * T011B — preparação da mesa de treino e regressões da preparação comum.
 *
 * No treino a pessoa e os três bots contam assento e prontidão (sem convite,
 * sem remoção e sem estado de conexão para bots); na sala comum nada disso
 * muda: convite, remoção e cálculo por pessoas conectadas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StateMessage } from '@tretta/protocol';

const harness = vi.hoisted(() => ({
  room: {
    interactive: true,
    setReady: vi.fn(),
    startRound: vi.fn(),
    removeParticipant: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('@/components/ui', () => ({ AvatarAction: () => null, AvatarBadge: () => null, LeaveButton: () => null }));

import { Lobby } from '@/components/Lobby';

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
    ready: false,
    connected: true,
    score: 0,
    inRound: false,
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
    id: `b_ROOM1_${index}`,
    kind: 'bot',
    nickname: names[index - 1] ?? 'Bot',
    avatar: avatars[index - 1] ?? 'lobo',
    ready: true,
    connected: false,
    score: 0,
    inRound: false,
    isHost: false,
    autoControlled: false,
    absentSince: null,
    ...overrides,
  };
}

function lobbyState(participants: ParticipantFixture[], mode: 'classic' | 'training', roomCode = 'ROOM1'): StateMessage {
  const me = participants[0];
  if (me === undefined) throw new Error('precisa de pelo menos uma pessoa');
  const host = participants.find((participant) => participant.isHost) ?? me;
  return {
    room: {
      roomCode,
      mode,
      status: 'lobby',
      version: 1,
      hostId: host.id,
      roundId: null,
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
      ready: me.ready,
      inRound: false,
      waiting: false,
      view: null,
    },
    table: null,
  } as unknown as StateMessage;
}

beforeEach(() => {
  harness.room.setReady.mockClear();
  harness.room.startRound.mockClear();
  harness.room.removeParticipant.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('preparação da mesa de treino', () => {
  it('mostra a mesa individual com três bots rotulados, sem convite nem remoção', () => {
    render(<Lobby state={lobbyState([human(), bot(1), bot(2), bot(3)], 'training')} />);

    expect(screen.getByTestId('training-note').textContent).toMatch(/três bots simples/i);
    expect(screen.getByTestId('training-note').textContent).toMatch(/Clássico/);
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.queryByTestId('copy-invite')).toBeNull();

    const rows = screen.getAllByTestId('lobby-participant');
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute('data-player-id')).toBe('p1');
    for (const [index, row] of rows.slice(1).entries()) {
      if (row === undefined) throw new Error('linha de participante ausente');
      expect(row.getAttribute('data-player-id')).toBe(`b_ROOM1_${index + 1}`);
      expect(within(row).getByText('bot')).toBeTruthy();
      expect(within(row).getByText('pronto')).toBeTruthy();
      expect(within(row).queryByText('desconectado')).toBeNull();
    }
    expect(screen.queryByText('Remover')).toBeNull();
    expect(screen.getByText('anfitrião')).toBeTruthy();
  });

  it('destrava o início com bots prontos quando só a pessoa confirma', () => {
    const { rerender } = render(<Lobby state={lobbyState([human(), bot(1), bot(2), bot(3)], 'training')} />);
    const start = screen.getByTestId('start-round-button') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByTestId('start-hint').textContent).toMatch(/pronto para iniciar/i);

    fireEvent.click(screen.getByTestId('ready-toggle'));
    expect(harness.room.setReady).toHaveBeenCalledWith(true);

    rerender(<Lobby state={lobbyState([human({ ready: true }), bot(1), bot(2), bot(3)], 'training')} />);
    expect((screen.getByTestId('start-round-button') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('start-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('start-round-button'));
    expect(harness.room.startRound).toHaveBeenCalledTimes(1);
  });

  it('sala comum segue com convite, remoção e prontidão só de pessoas conectadas', () => {
    const ana = human();
    const bia = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', isHost: false });
    const caio = human({ id: 'p3', nickname: 'Caio', avatar: 'tucano', isHost: false, connected: false });
    render(<Lobby state={lobbyState([ana, bia, caio], 'classic', 'CLASS1')} />);

    expect(screen.getByTestId('invite-link').textContent).toContain('/sala/CLASS1');
    expect(screen.getByTestId('copy-invite')).toBeTruthy();
    expect(screen.queryByTestId('training-note')).toBeNull();
    expect(screen.queryByText('bot')).toBeNull();
    expect(screen.getByText('desconectado')).toBeTruthy();
    expect(screen.getByTestId('start-hint').textContent).toMatch(/Todos precisam estar prontos/i);
    fireEvent.click(screen.getByTestId('remove-Bia'));
    expect(harness.room.removeParticipant).toHaveBeenCalledWith('p2');
  });
});
