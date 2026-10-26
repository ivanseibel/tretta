/**
 * Gaveta da sala (T019D): um toque abre, foco preso, Escape devolve o foco,
 * abas reais e controles do anfitrião/silêncio sem mudar a mesa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { StateMessage } from '@tretta/protocol';
import type { RoomContextValue } from '@/app/providers';
import type { MoodPreferences } from '@/lib/prefs';

const holder = vi.hoisted(() => ({
  startRound: vi.fn(),
  endRound: vi.fn(),
  removeParticipant: vi.fn(),
  leaveRoom: vi.fn(),
  muteAuthor: vi.fn(),
  unmuteAuthor: vi.fn(),
  status: 'playing' as 'lobby' | 'playing' | 'paused' | 'finished',
}));

const preferences: MoodPreferences = {
  animations: 'full',
  soundMuted: false,
  turnNotificationEnabled: true,
  hideReactions: false,
};

function state(): StateMessage {
  return {
    room: {
      roomCode: 'TRT-4821',
      mode: 'classic',
      hostId: 'p1',
      status: holder.status,
      roundNumber: 2,
      roundId: 'r1',
      lastRound: null,
      participants: [
        {
          id: 'p1',
          kind: 'human',
          nickname: 'Ana',
          avatar: 'raposa',
          ready: true,
          connected: true,
          score: 1,
          inRound: true,
          isHost: true,
          autoControlled: false,
          absentSince: null,
        },
        {
          id: 'p2',
          kind: 'human',
          nickname: 'Bia',
          avatar: 'lobo',
          ready: false,
          connected: true,
          score: 0,
          inRound: true,
          isHost: false,
          autoControlled: false,
          absentSince: null,
        },
      ],
      scoreboard: [],
      pause: null,
      retainedUntil: null,
      serverTime: 1_000,
      version: 4,
    },
    self: {
      playerId: 'p1',
      nickname: 'Ana',
      avatar: 'raposa',
      ready: true,
      inRound: true,
      waiting: false,
      view: {
        status: 'playing',
        players: [
          { id: 'p1', handCount: 3 },
          { id: 'p2', handCount: 5 },
        ],
      },
      reactionNextSendAt: null,
    },
    table: null,
  } as unknown as StateMessage;
}

vi.mock('@/app/providers', () => ({
  useRoom: () =>
    ({
      state: state(),
      events: [],
      connection: 'live',
      chatLinkReady: true,
      interactive: true,
      preferences,
      activeAnimations: 'full',
      activeReactions: {},
      moodMenu: null,
      mutedPlayerIds: [],
      muteAuthor: holder.muteAuthor,
      unmuteAuthor: holder.unmuteAuthor,
      startRound: holder.startRound,
      endRoundWithoutWinner: holder.endRound,
      removeParticipant: holder.removeParticipant,
      leaveRoom: holder.leaveRoom,
    }) as unknown as RoomContextValue,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/components/ChatPanel', () => ({
  ChatPanel: () => <p data-testid="chat-stub">chat real</p>,
}));
vi.mock('@/components/EventFeed', () => ({
  EventFeed: () => <p data-testid="events-stub">histórico real</p>,
}));
vi.mock('@/components/MoodSettings', () => ({
  MoodSettings: () => <p data-testid="prefs-stub">preferências reais</p>,
}));

import { TableDrawer } from '@/components/drawer/TableDrawer';
import { TableDrawerProvider, useTableDrawer } from '@/components/drawer/TableDrawerProvider';

function Harness(): ReactNode {
  const drawer = useTableDrawer();
  return (
    <>
      <button type="button" data-testid="origem" onClick={(event) => drawer.abrir('sala', event.currentTarget)}>
        Abrir sala
      </button>
      <TableDrawer />
    </>
  );
}

function mount(): void {
  render(
    <TableDrawerProvider>
      <Harness />
    </TableDrawerProvider>,
  );
}

beforeEach(() => {
  holder.status = 'playing';
  holder.startRound.mockReset();
  holder.endRound.mockReset();
  holder.removeParticipant.mockReset();
  holder.leaveRoom.mockReset();
  holder.muteAuthor.mockReset();
  holder.unmuteAuthor.mockReset();
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  };
});

afterEach(() => {
  cleanup();
});

describe('gaveta da sala', () => {
  it('abre em um toque e prende o foco', () => {
    mount();
    fireEvent.click(screen.getByTestId('origem'));
    const layer = screen.getByTestId('table-drawer-layer');
    expect(layer).toBeTruthy();
    expect(layer.querySelector('.tv2-drawer')).toBeTruthy();
    expect(layer.contains(document.activeElement)).toBe(true);

    const focusables = Array.from(layer.querySelectorAll<HTMLElement>('button, [href], input, summary'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    (last as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    (first as HTMLElement).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Escape fecha e devolve o foco ao controle de origem', async () => {
    mount();
    const origem = screen.getByTestId('origem');
    origem.focus();
    fireEvent.click(origem);
    expect(screen.getByTestId('table-drawer-layer')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('table-drawer-layer')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(origem));
  });

  it('mostra abas reais e o conteúdo da sala', () => {
    mount();
    fireEvent.click(screen.getByTestId('origem'));
    expect(screen.getByTestId('drawer-room-code').textContent).toBe('TRT-4821');
    expect(screen.getByTestId('drawer-rules')).toBeTruthy();
    expect(screen.getByTestId('drawer-players').textContent).toContain('Ana');
    expect(screen.getByTestId('drawer-players').textContent).toContain('5 cartas');
    expect(screen.getByTestId('prefs-stub')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Conversa/ }));
    expect(screen.getByTestId('chat-stub')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Histórico/ }));
    expect(screen.getByTestId('events-stub')).toBeTruthy();
  });

  it('silencia participante e encerra a rodada como anfitrião', () => {
    mount();
    fireEvent.click(screen.getByTestId('origem'));
    fireEvent.click(screen.getByTestId('drawer-mute-Bia'));
    expect(holder.muteAuthor).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByTestId('drawer-end-round'));
    expect(holder.endRound).toHaveBeenCalledTimes(1);
  });

  it('pede confirmação para sair', () => {
    mount();
    fireEvent.click(screen.getByTestId('origem'));
    fireEvent.click(screen.getByTestId('drawer-leave'));
    expect(screen.getByTestId('drawer-confirm')).toBeTruthy();
    expect(holder.leaveRoom).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('drawer-confirm-action'));
    expect(holder.leaveRoom).toHaveBeenCalledTimes(1);
  });

  it('na preparação oferece iniciar rodada ao anfitrião', () => {
    holder.status = 'lobby';
    mount();
    fireEvent.click(screen.getByTestId('origem'));
    const start = screen.getByTestId('drawer-start-round') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(start);
    expect(holder.startRound).not.toHaveBeenCalled();
  });
});
