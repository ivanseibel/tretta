/**
 * T011B — resultados do treino: vitória de bot é rotulada mesmo quando o
 * apelido coincide com o de uma pessoa; a pessoa vencedora e o substituto
 * clássico continuam com seus textos de sempre.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { StateMessage } from '@tretta/protocol';

const harness = vi.hoisted(() => ({
  room: {
    interactive: true,
    returnToLobby: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('@/components/ui', () => ({ AvatarAction: () => null, AvatarBadge: () => null, LeaveButton: () => null }));
vi.mock('@/components/EventFeed', () => ({ EventFeed: () => null }));

import { Results } from '@/components/Results';

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

function resultsState(
  lastRound: Record<string, unknown> | null,
  participants: ParticipantFixture[],
  mode: 'classic' | 'training' = 'training',
): StateMessage {
  const me = participants[0];
  if (me === undefined) throw new Error('precisa de pelo menos uma pessoa');
  return {
    room: {
      roomCode: 'TRAIN1',
      mode,
      status: 'finished',
      version: 9,
      hostId: me.id,
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
      lastRound,
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
      view: null,
    },
    table: null,
  } as unknown as StateMessage;
}

function personTico(score = 0): ParticipantFixture {
  return {
    id: 'p1',
    kind: 'human',
    nickname: 'Tico',
    avatar: 'raposa',
    ready: true,
    connected: true,
    score,
    inRound: true,
    isHost: true,
    autoControlled: false,
    absentSince: null,
  };
}

function botTico(score = 1): ParticipantFixture {
  return {
    id: 'b_TRAIN1_1',
    kind: 'bot',
    nickname: 'Tico',
    avatar: 'pinguim',
    ready: true,
    connected: false,
    score,
    inRound: true,
    isHost: false,
    autoControlled: false,
    absentSince: null,
  };
}

function botLila(): ParticipantFixture {
  return { ...botTico(0), id: 'b_TRAIN1_2', nickname: 'Lila', avatar: 'tucano' };
}

function botNino(): ParticipantFixture {
  return { ...botTico(0), id: 'b_TRAIN1_3', nickname: 'Nino', avatar: 'lobo' };
}

afterEach(() => {
  cleanup();
});

describe('resultados da mesa de treino', () => {
  it('vitória de bot com apelido coincidente desambigua pelo rótulo', () => {
    render(
      <Results
        state={resultsState(
          { roundNumber: 1, winnerId: 'b_TRAIN1_1', winnerNickname: 'Tico', substitute: false, winnerKind: 'bot' },
          [personTico(0), botTico(1), botLila(), botNino()],
        )}
        events={[]}
      />,
    );

    expect(screen.getByTestId('results-winner').textContent).toBe('Tico (bot) venceu a rodada!');
    const rows = screen.getAllByTestId('score-Tico');
    expect(rows).toHaveLength(2);
    const personRow = rows.find((row) => row.getAttribute('data-player-id') === 'p1');
    const botRow = rows.find((row) => row.getAttribute('data-player-id') === 'b_TRAIN1_1');
    expect(personRow?.textContent).toContain('você');
    expect(personRow?.textContent).toContain('0 rodada(s)');
    expect(botRow?.textContent).toContain('bot');
    expect(botRow?.textContent).toContain('1 rodada(s)');
    expect(screen.queryByText('substituto')).toBeNull();
    expect(screen.queryByText('desconectado')).toBeNull();
  });

  it('vitória da pessoa no treino não recebe rótulo de bot', () => {
    render(
      <Results
        state={resultsState(
          { roundNumber: 1, winnerId: 'p1', winnerNickname: 'Tico', substitute: false, winnerKind: 'human' },
          [personTico(1), botTico(0), botLila(), botNino()],
        )}
        events={[]}
      />,
    );

    expect(screen.getByTestId('results-winner').textContent).toBe('Tico venceu a rodada!');
    const personRow = screen
      .getAllByTestId('score-Tico')
      .find((row) => row.getAttribute('data-player-id') === 'p1');
    expect(personRow?.textContent).toContain('1 rodada(s)');
    expect(personRow?.textContent).not.toContain('(bot)');
  });

  it('substituto clássico mantém o texto e a etiqueta de sempre', () => {
    const ana: ParticipantFixture = { ...personTico(0), nickname: 'Ana' };
    const bia: ParticipantFixture = {
      id: 'p2',
      kind: 'human',
      nickname: 'Bia',
      avatar: 'lobo',
      ready: true,
      connected: true,
      score: 0,
      inRound: true,
      isHost: false,
      autoControlled: true,
      absentSince: null,
    };
    render(
      <Results
        state={resultsState(
          { roundNumber: 1, winnerId: 'p2', winnerNickname: 'Bia', substitute: true, winnerKind: 'human' },
          [ana, bia],
          'classic',
        )}
        events={[]}
      />,
    );

    expect(screen.getByTestId('results-winner').textContent).toBe('Substituto de Bia venceu a rodada!');
    expect(screen.getByTestId('score-Bia').textContent).toContain('substituto');
  });
});
