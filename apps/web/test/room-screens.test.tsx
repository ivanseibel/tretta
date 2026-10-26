/**
 * T019E2 — telas de preparação, espera, resultado e recuperação no visual novo.
 *
 * Cobre o que é específico destas telas: assentos e prontidão, convite e
 * remoção do anfitrião, mesa pública sem mão e sem assento inventado, resultado
 * dedicado sem replay em um toque, erros/retomada e a barra da gaveta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StateMessage } from '@tretta/protocol';

const harness = vi.hoisted(() => ({
  room: {
    interactive: true,
    connection: 'live',
    recoveryPhase: 'idle',
    reconnectedAt: null,
    error: null,
    busy: false,
    activeReactions: {},
    activeAnimations: 'full',
    moodMenu: null,
    setReady: vi.fn(),
    startRound: vi.fn(),
    removeParticipant: vi.fn(),
    returnToLobby: vi.fn(),
    retryRecovery: vi.fn(),
    openReactionMenu: vi.fn(),
    closeMoodMenu: vi.fn(),
    clearError: vi.fn(),
    clearRemoved: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Lobby } from '@/components/Lobby';
import { Results } from '@/components/Results';
import { WaitingRoom } from '@/components/WaitingRoom';
import {
  JoinRoomScreen,
  RecoveryExhaustedScreen,
  RemovedScreen,
  RoomGoneScreen,
  RoomNotices,
  TrainingRefusedScreen,
} from '@/components/screens/StatusScreens';

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

function bot(index: number): ParticipantFixture {
  const names = ['Tico', 'Lila', 'Nino'];
  return human({
    id: `b_ROOM01_${String(index)}`,
    kind: 'bot',
    nickname: names[index - 1] ?? `Bot ${String(index)}`,
    avatar: ['pinguim', 'tucano', 'lobo'][index - 1] ?? 'lobo',
    ready: true,
    connected: false,
    isHost: false,
  });
}

function roomState(participants: ParticipantFixture[], status: 'lobby' | 'playing' | 'paused' | 'finished' = 'lobby', mode: 'classic' | 'training' = 'classic'): StateMessage {
  const me = participants[0];
  if (me === undefined) throw new Error('precisa de pelo menos uma pessoa');
  return {
    room: {
      roomCode: 'ROOM01',
      mode,
      status,
      version: 1,
      hostId: participants.find((participant) => participant.isHost)?.id ?? me.id,
      roundId: status === 'lobby' ? null : 'round1',
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
      inRound: status !== 'lobby',
      waiting: false,
      view: null,
    },
    table: null,
  } as unknown as StateMessage;
}

function tableState(): StateMessage {
  const host = human({ id: 'p1', nickname: 'Ana', ready: true, inRound: true, score: 1 });
  const guest = human({ id: 'p2', nickname: 'Bia', ready: true, inRound: true, isHost: false, score: 0 });
  const observer = human({ id: 'p3', nickname: 'Cai', ready: false, inRound: false, isHost: false, connected: true });
  const base = roomState([host, guest, observer], 'playing');
  return {
    ...base,
    self: {
      playerId: 'p3',
      nickname: 'Cai',
      avatar: 'sapo',
      ready: false,
      inRound: false,
      waiting: true,
      view: null,
    },
    table: {
      status: 'playing',
      players: [
        { id: 'p1', handCount: 7 },
        { id: 'p2', handCount: 2 },
      ],
      drawPileCount: 93,
      discardTop: { id: 'red-7-1', kind: 'number', color: 'red', value: 7 },
      activeColor: 'red',
      direction: 'clockwise',
      currentPlayerId: 'p2',
      phase: 'play',
      lastCardWindow: { playerId: 'p2', announced: true },
      winnerId: null,
    },
  } as unknown as StateMessage;
}

function resultsState(participants: ParticipantFixture[]): StateMessage {
  return {
    ...roomState(participants, 'finished'),
    room: {
      ...roomState(participants, 'finished').room,
      lastRound: {
        roundNumber: 2,
        winnerId: 'p1',
        winnerNickname: 'Ana',
        substitute: false,
        winnerKind: 'human',
      },
    },
  } as unknown as StateMessage;
}

beforeEach(() => {
  harness.room.setReady.mockClear();
  harness.room.startRound.mockClear();
  harness.room.removeParticipant.mockClear();
  harness.room.returnToLobby.mockClear();
  harness.room.retryRecovery.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('preparação', () => {
  it('mostra assentos, pronto/não pronto, convite, remoção e início do anfitrião', () => {
    const ana = human();
    const bia = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', isHost: false, ready: true });
    render(<Lobby state={roomState([ana, bia])} />);

    expect(screen.getByTestId('open-room-drawer')).toBeTruthy();
    expect(screen.getByTestId('invite-link').textContent).toContain('/sala/ROOM01');
    expect(screen.getByTestId('copy-invite')).toBeTruthy();
    expect(screen.getAllByTestId('lobby-participant')).toHaveLength(2);

    const anaRow = screen.getAllByTestId('lobby-participant')[0];
    if (anaRow === undefined) throw new Error('assento de Ana ausente');
    expect(within(anaRow).getByText('anfitrião')).toBeTruthy();
    expect(within(anaRow).getByText('não pronto')).toBeTruthy();
    expect(within(anaRow).getByText('aguardando')).toBeTruthy();
    const biaRow = screen.getAllByTestId('lobby-participant')[1];
    if (biaRow === undefined) throw new Error('assento de Bia ausente');
    expect(within(biaRow).getByText('pronto')).toBeTruthy();

    const start = screen.getByTestId('start-round-button') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByTestId('start-hint').textContent).toMatch(/Todos precisam estar prontos/i);

    fireEvent.click(screen.getByTestId('ready-toggle'));
    expect(harness.room.setReady).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('remove-Bia'));
    expect(harness.room.removeParticipant).toHaveBeenCalledWith('p2');
  });

  it('libera o início quando todos os assentos contam prontos e preserva o placar histórico', () => {
    const ana = human({ ready: true });
    const bia = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', isHost: false, ready: true });
    const state = roomState([ana, bia]);
    const withHistory = {
      ...state,
      room: {
        ...state.room,
        scoreboard: [
          ...state.room.scoreboard,
          { playerId: 'p9', kind: 'human', nickname: 'Duda', avatar: 'sapo', wins: 2, current: false },
        ],
      },
    } as StateMessage;
    render(<Lobby state={withHistory} />);

    const start = screen.getByTestId('start-round-button') as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    expect(harness.room.startRound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('history-Duda').textContent).toContain('2 v.');
  });

  it('treino mantém três bots e não oferece convite nem remoção', () => {
    render(<Lobby state={roomState([human(), bot(1), bot(2), bot(3)], 'lobby', 'training')} />);

    expect(screen.getByTestId('training-note').textContent).toMatch(/três bots simples/i);
    expect(screen.getByTestId('training-note').textContent).toMatch(/Clássico/);
    expect(screen.queryByTestId('invite-link')).toBeNull();
    expect(screen.queryByTestId('copy-invite')).toBeNull();
    expect(screen.queryByText('Remover')).toBeNull();
    expect(screen.getAllByTestId('lobby-participant')).toHaveLength(4);
  });
});

describe('espera e observador', () => {
  it('mostra a mesa pública sem mão, vez/sentido e sem posição inventada', () => {
    render(<WaitingRoom state={tableState()} />);

    expect(screen.getByTestId('public-table')).toBeTruthy();
    expect(screen.getByTestId('public-table-status').textContent).toContain('Vez de Bia');
    expect(screen.getByText('Sentido horário')).toBeTruthy();
    expect(screen.getByTestId('public-draw-pile').textContent).toContain('93');
    expect(screen.getByTestId('public-discard-top').getAttribute('aria-label')).toContain('Descarte:');
    expect(screen.getByTestId('public-active-color').textContent).toContain('Vermelho');
    expect(screen.getByTestId('waiting-banner').textContent).toContain('automaticamente');
    expect(screen.queryByTestId('my-hand')).toBeNull();
    expect(screen.queryByTestId('seat-Cai')).toBeNull();
    expect(screen.getByTestId('self-reaction-button')).toBeTruthy();
    expect(screen.getByTestId('table-bar-conversa')).toBeTruthy();
    expect(screen.getByTestId('table-bar-reagir')).toBeTruthy();
    expect(screen.getByTestId('table-bar-historico')).toBeTruthy();
  });

  it('mostra a pausa com os controles compartilhados durante a espera', () => {
    const state = tableState();
    const paused = {
      ...state,
      room: {
        ...state.room,
        status: 'paused',
        pause: { retention: true, absent: [] },
      },
    } as StateMessage;
    render(<WaitingRoom state={paused} />);

    expect(screen.getByTestId('pause-panel')).toBeTruthy();
    expect(screen.getByTestId('pause-waiting-host')).toBeTruthy();
    expect(screen.getByTestId('waiting-banner').textContent).toContain('pausada');
  });
});

describe('resultado', () => {
  it('é tela dedicada com vencedor, placar e volta do anfitrião', () => {
    const ana = human({ id: 'p1', nickname: 'Ana', ready: true, inRound: true, score: 2 });
    const bia = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', ready: true, inRound: true, isHost: false, score: 1 });
    render(<Results state={resultsState([ana, bia])} />);

    expect(screen.getByTestId('results-winner').textContent).toBe('Ana venceu a rodada!');
    expect(screen.getByTestId('results-winner').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('score-Ana').textContent).toContain('2 rodada(s)');
    expect(screen.getByTestId('score-Bia').textContent).toContain('1 rodada(s)');
    expect(screen.getByTestId('return-to-lobby-button')).toBeTruthy();
    expect(screen.queryByText(/provoc/i)).toBeNull();

    fireEvent.click(screen.getByTestId('return-to-lobby-button'));
    expect(harness.room.returnToLobby).toHaveBeenCalledTimes(1);
  });

  it('quem não é anfitrião aguarda e não ganha um atalho de replay', () => {
    const host = human({ id: 'p1', nickname: 'Ana', ready: true, inRound: true, score: 2 });
    const guest = human({ id: 'p2', nickname: 'Bia', avatar: 'lobo', ready: true, inRound: true, isHost: false, score: 1 });
    const state = resultsState([host, guest]);
    const guestState = {
      ...state,
      self: { ...state.self, playerId: 'p2', nickname: 'Bia', avatar: 'lobo' },
    } as StateMessage;
    render(<Results state={guestState} />);

    expect(screen.getByTestId('waiting-host').textContent).toContain('Aguardando o anfitrião');
    expect(screen.queryByTestId('return-to-lobby-button')).toBeNull();
  });
});

describe('entrada, erros e retomada', () => {
  it('separa link inválido de sala expirada', () => {
    const { rerender } = render(<RoomGoneScreen code="ABC" tipo="invalida" />);
    expect(screen.getByTestId('room-not-found').textContent).toContain('não corresponde a um convite');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Este link não abre uma sala');

    rerender(<RoomGoneScreen code="ROOM01" tipo="expirada" />);
    expect(screen.getByTestId('room-not-found').textContent).toContain('não existe mais');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Esta sala expirou');
    expect(screen.getByTestId('back-home').getAttribute('href')).toBe('/');
  });

  it('recuperação esgotada tenta de novo sem pedir identidade nova', () => {
    render(<RecoveryExhaustedScreen code="ROOM01" />);

    expect(screen.getByTestId('recovery-exhausted').textContent).toMatch(/outra aba ou dispositivo/i);
    expect(screen.queryByTestId('join-name-input')).toBeNull();
    fireEvent.click(screen.getByTestId('retry-recovery-button'));
    expect(harness.room.retryRecovery).toHaveBeenCalledWith('ROOM01');
  });

  it('recusa de treino e remoção têm tela própria', () => {
    const { rerender } = render(<TrainingRefusedScreen />);
    expect(screen.getByTestId('training-entry-refused').textContent).toMatch(/individual/i);
    expect(screen.getByTestId('back-home').getAttribute('href')).toBe('/');

    rerender(<RemovedScreen code="ROOM01" message="Você foi removido da sala." onClear={() => {}} />);
    expect(screen.getByTestId('removed-message').textContent).toContain('Você foi removido');
  });

  it('entrada por convite valida apelido e envia o formulário', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { rerender } = render(
      <JoinRoomScreen
        code="ROOM01"
        nickname=""
        avatar="lobo"
        busy={false}
        error={null}
        onNickname={() => {}}
        onAvatar={() => {}}
        onDismissError={() => {}}
        onSubmit={onSubmit}
      />,
    );
    expect((screen.getByTestId('join-room-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('join-name-input')).toBeTruthy();

    rerender(
      <JoinRoomScreen
        code="ROOM01"
        nickname="Bia"
        avatar="lobo"
        busy={false}
        error="Sala não encontrada."
        onNickname={() => {}}
        onAvatar={() => {}}
        onDismissError={() => {}}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByTestId('error-banner').textContent).toContain('Sala não encontrada');
    fireEvent.click(screen.getByTestId('join-room-button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('avisos de conexão e erro não mudam a tela', () => {
    const { rerender } = render(
      <RoomNotices connection="lost" recoveryPhase="idle" reconnectedAt={null} error={null} onDismissError={() => {}} />,
    );
    expect(screen.getByTestId('connection-lost').textContent).toContain('Conexão perdida');

    rerender(
      <RoomNotices connection="live" recoveryPhase="idle" reconnectedAt={1} error="Falha ao enviar." onDismissError={() => {}} />,
    );
    expect(screen.getByTestId('connection-recovered')).toBeTruthy();
    expect(screen.getByTestId('error-banner').textContent).toContain('Falha ao enviar');
  });
});
