import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StateMessage, CommandAck } from '@tretta/protocol';
import { createClassicDeck } from '@tretta/rules';

const harness = vi.hoisted(() => ({
  room: {
    connection: 'live' as const,
    sendCommand: vi.fn(),
    endRoundWithoutWinner: vi.fn(),
  },
}));

vi.mock('@/app/providers', () => ({ useRoom: () => harness.room }));
vi.mock('@/components/ui', () => ({ AvatarBadge: () => null, ColorSymbol: () => null, LeaveButton: () => null }));
vi.mock('@/components/EventFeed', () => ({ EventFeed: () => null }));
vi.mock('@/components/PausePanel', () => ({ PausePanel: () => null }));

import { GameTable } from '@/components/GameTable';

function stateAt(version: number, cardStillInHand: boolean, includeArrival = false): StateMessage {
  const deck = createClassicDeck();
  const card = (id: string) => {
    const found = deck.find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`Carta ausente: ${id}`);
    return found;
  };
  const hand = [
    ...(cardStillInHand ? [card('red-1-1')] : []),
    card('red-2-1'),
  ];
  const participants = [
    {
      id: 'p1', nickname: 'Ana', avatar: 'raposa', ready: true, connected: true,
      score: 0, inRound: true, isHost: true, autoControlled: false, absentSince: null,
    },
    {
      id: 'p2', nickname: 'Bia', avatar: 'lobo', ready: true, connected: true,
      score: 0, inRound: true, isHost: false, autoControlled: false, absentSince: null,
    },
    ...(includeArrival ? [{
      id: 'p3', nickname: 'Caio', avatar: 'tucano', ready: true, connected: true,
      score: 0, inRound: true, isHost: false, autoControlled: false, absentSince: null,
    }] : []),
  ];
  return {
    room: {
      roomCode: 'ROOM01', hostId: 'p1', status: 'playing', roundNumber: 1, roundId: 'round1',
      lastRound: null, participants, scoreboard: [], pause: null, retainedUntil: null,
      serverTime: 1_000, version,
    },
    self: {
      playerId: 'p1', nickname: 'Ana', avatar: 'raposa', ready: true, inRound: true, waiting: false,
      view: {
        viewerId: 'p1', status: 'playing', players: participants.map((entry) => ({ id: entry.id, handCount: 2 })),
        hand, playableCardIds: cardStillInHand ? hand.map((entry) => entry.id) : [], drawPileCount: 90,
        discardTop: card(cardStillInHand ? 'red-9-1' : 'red-1-1'), activeColor: 'red', direction: 'clockwise',
        currentPlayerId: cardStillInHand ? 'p1' : 'p2', phase: 'play', drawnCardId: null,
        lastCardWindow: null, winnerId: null,
      },
    },
    table: null,
  } as unknown as StateMessage;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(() => {
  harness.room.sendCommand.mockReset();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('foco após confirmação do comando', () => {
  it('preserva o retorno à mão se um participante entrar antes do ack e a carta sair depois', async () => {
    const acknowledgement = deferred<CommandAck>();
    harness.room.sendCommand.mockReturnValue(acknowledgement.promise);
    const view = render(<GameTable state={stateAt(1, true)} events={[]} />);

    fireEvent.click(screen.getByTestId('card-red-1-1'));
    const playButton = screen.getByTestId('play-button');
    playButton.focus();
    fireEvent.click(playButton);
    expect(harness.room.sendCommand).toHaveBeenCalledOnce();

    // Uma mudança pública independente chega enquanto a jogada ainda aguarda ack.
    view.rerender(<GameTable state={stateAt(2, true, true)} events={[]} />);
    expect(screen.getByTestId('card-red-1-1')).toBeTruthy();

    // O ack autoritativo identifica a versão que retirará a carta.
    await act(async () => {
      acknowledgement.resolve({ ok: true, version: 3 });
      await acknowledgement.promise;
    });
    expect(screen.getByTestId('card-red-1-1')).toBeTruthy();

    view.rerender(<GameTable state={stateAt(3, false, true)} events={[]} />);
    expect(screen.queryByTestId('card-red-1-1')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('my-hand'));
  });
});
