import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { EventsMessage, StateMessage } from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import { MoodSettings } from '@/components/MoodSettings';

const soundSpy = vi.hoisted(() => ({
  playEffectSound: vi.fn(),
  playTurnNotificationSound: vi.fn(),
  prepareSoundPlayback: vi.fn(),
  setSoundMuted: vi.fn(),
  stopAllSounds: vi.fn(),
}));

vi.mock('@/lib/sounds', () => soundSpy);

interface PendingRequest {
  event: string;
  payload: Record<string, unknown>;
  callback: (response: unknown) => void;
}

const harness = vi.hoisted(() => {
  const state = {
    connected: true,
    handlers: new Map<string, (payload: unknown) => void>(),
    onceHandlers: new Map<string, Set<() => void>>(),
    pending: [] as PendingRequest[],
    identities: new Map<string, StoredIdentity>(),
    nonce: 0,
  };
  interface FakeSocket {
    readonly connected: boolean;
    on(event: string, callback: (payload: unknown) => void): FakeSocket;
    once(event: string, callback: () => void): FakeSocket;
    off(event: string, callback: () => void): FakeSocket;
    emit(event: string, payload: Record<string, unknown>, callback: (response: unknown) => void): void;
    disconnect(): void;
  }
  const socket: FakeSocket = {
    get connected(): boolean {
      return state.connected;
    },
    on(event, callback) {
      state.handlers.set(event, callback);
      return socket;
    },
    once(event, callback) {
      const handlers = state.onceHandlers.get(event) ?? new Set<() => void>();
      handlers.add(callback);
      state.onceHandlers.set(event, handlers);
      return socket;
    },
    off(event, callback) {
      state.onceHandlers.get(event)?.delete(callback);
      return socket;
    },
    emit(event, payload, callback) {
      state.pending.push({ event, payload, callback });
    },
    disconnect() {},
  };
  return { state, socket };
});

vi.mock('@/lib/client', () => ({
  createSocket: () => harness.socket as unknown as RoomSocket,
  newIntentId: () => `test_${++harness.state.nonce}`,
  loadIdentity: (code: string): StoredIdentity | null => harness.state.identities.get(code) ?? null,
  saveIdentity: (code: string, identity: StoredIdentity): void => {
    harness.state.identities.set(code, identity);
  },
  clearIdentity: (code: string): void => {
    harness.state.identities.delete(code);
  },
}));

let latest: RoomContextValue | null = null;

function Probe(): ReactNode {
  latest = useRoom();
  return null;
}

function api(): RoomContextValue {
  if (latest === null) throw new Error('RoomProvider não montado.');
  return latest;
}

interface StateOptions {
  readonly roundId?: string | null;
  readonly version?: number;
  readonly currentPlayerId?: string | null;
  readonly selfPlayerId?: string;
  readonly authorized?: boolean;
  readonly phase?: 'play' | 'after-draw' | 'finished';
  readonly roomStatus?: StateMessage['room']['status'];
  readonly pause?: StateMessage['room']['pause'];
}

function stateMessage(roomCode: string, options: StateOptions = {}): StateMessage {
  const {
    roundId = 'r1',
    version = 1,
    currentPlayerId = 'player_anA',
    selfPlayerId = 'player_anA',
    authorized = true,
    phase = 'play',
    roomStatus = roundId === null ? 'lobby' : 'playing',
    pause = null,
  } = options;
  const status = phase === 'finished' ? 'finished' : 'playing';
  const table = roundId === null ? null : {
    status,
    players: [
      { id: 'player_anA', handCount: 7 },
      { id: 'player_biA', handCount: 7 },
    ],
    drawPileCount: 80,
    discardTop: { id: 'top', kind: 'number', color: 'red', value: 1 },
    activeColor: 'red',
    direction: 'clockwise',
    currentPlayerId,
    phase,
    lastCardWindow: null,
    winnerId: null,
  };
  const view = !authorized || roundId === null ? null : {
    viewerId: selfPlayerId,
    status,
    players: [
      { id: 'player_anA', handCount: 7 },
      { id: 'player_biA', handCount: 7 },
    ],
    hand: [],
    playableCardIds: [],
    drawPileCount: 80,
    discardTop: { id: 'top', kind: 'number', color: 'red', value: 1 },
    activeColor: 'red',
    direction: 'clockwise',
    currentPlayerId,
    phase,
    drawnCardId: phase === 'after-draw' ? 'drawn' : null,
    lastCardWindow: null,
    winnerId: null,
  };
  return {
    room: {
      roomCode,
      hostId: 'player_anA',
      status: roomStatus,
      roundNumber: roundId === null ? 0 : 1,
      roundId,
      lastRound: null,
      participants: [
        {
          id: 'player_anA',
          nickname: 'Ana',
          avatar: 'raposa',
          ready: true,
          connected: true,
          score: 0,
          inRound: authorized,
          isHost: true,
          autoControlled: false,
          absentSince: null,
        },
        {
          id: 'player_biA',
          nickname: 'Bia',
          avatar: 'lobo',
          ready: true,
          connected: true,
          score: 0,
          inRound: roundId !== null,
          isHost: false,
          autoControlled: false,
          absentSince: null,
        },
      ],
      scoreboard: [],
      pause,
      retainedUntil: null,
      serverTime: 1_000,
      version,
    },
    self: {
      playerId: selfPlayerId,
      nickname: 'Ana',
      avatar: 'raposa',
      ready: true,
      inRound: authorized,
      waiting: !authorized,
      view,
    },
    table,
  } as unknown as StateMessage;
}

function deliver(event: string, payload?: unknown): void {
  const handler = harness.state.handlers.get(event);
  if (handler === undefined) throw new Error(`Handler ausente: ${event}`);
  act(() => handler(payload));
}

function pushState(roomCode: string, options: StateOptions = {}): void {
  deliver('server:state', stateMessage(roomCode, options));
}

function eventsMessage(roomCode: string, version: number, events: EventsMessage['events']): EventsMessage {
  return { roomCode, roundId: 'r1', version, events, effects: [] };
}

async function mountRoom(strict = false): Promise<void> {
  const children = (
    <>
      <Probe />
      <MoodSettings />
    </>
  );
  await act(async () => {
    render(
      strict ? <StrictMode><RoomProvider>{children}</RoomProvider></StrictMode> : <RoomProvider>{children}</RoomProvider>,
    );
  });
}

async function createRoom(roomCode: string): Promise<void> {
  await act(async () => {
    const created = api().createRoom('Ana', 'raposa');
    const index = harness.state.pending.findIndex((request) => request.event === 'client:createRoom');
    const [request] = harness.state.pending.splice(index, 1);
    if (request === undefined) throw new Error('Requisição ausente: client:createRoom');
    request.callback({ ok: true, roomCode, playerId: 'player_anA', credential: `cred_${roomCode}`, version: 1 });
    await created;
  });
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.pending.length = 0;
  harness.state.identities.clear();
  harness.state.nonce = 0;
  latest = null;
  window.localStorage.clear();
  for (const spy of Object.values(soundSpy)) spy.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('aviso sonoro da vez', () => {
  it('toca uma vez ao entrar na própria vez e nas transições reais, sem repetir por versão, compra ou replay', async () => {
    await mountRoom();
    await createRoom('TURN01');
    pushState('TURN01', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    // Snapshot repetido é filtrado pelo provider; re-render também não cria nova vez.
    pushState('TURN01', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    deliver('server:events', eventsMessage('TURN01', 2, [
      { type: 'drew', playerId: 'player_anA', reason: 'voluntary', requested: 1, drawn: 1, reshuffled: false },
    ]));
    pushState('TURN01', { version: 2, currentPlayerId: 'player_anA', phase: 'after-draw' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    deliver('server:events', eventsMessage('TURN01', 3, [{ type: 'passed', playerId: 'player_anA' }]));
    pushState('TURN01', { version: 3, currentPlayerId: 'player_biA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);
    deliver('server:events', eventsMessage('TURN01', 4, [
      { type: 'played', playerId: 'player_biA', card: { id: 'red-1-1', kind: 'number', color: 'red', value: 1 }, chosenColor: null },
    ]));
    pushState('TURN01', { version: 4, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);

    deliver('server:events', eventsMessage('TURN01', 5, [
      { type: 'challengeAccepted', challengerId: 'player_biA', targetId: 'player_anA', penalty: 2 },
      { type: 'drew', playerId: 'player_anA', reason: 'challenge', requested: 2, drawn: 2, reshuffled: false },
    ]));
    pushState('TURN01', { version: 5, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);

    deliver('server:events', eventsMessage('TURN01', 6, [{ type: 'lastCardAnnounced', playerId: 'player_anA', withDiscard: false }]));
    pushState('TURN01', { version: 6, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);

    pushState('TURN01', { version: 7, currentPlayerId: 'player_anA', phase: 'finished', roomStatus: 'finished' });
    pushState('TURN01', { version: 8, roundId: null, currentPlayerId: null });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);
  });

  it('detecta Bloqueio/Inversão em dois jogadores pelo lote turnSkipped quando a pessoa continua sendo a vez', async () => {
    await mountRoom();
    await createRoom('TURN02');
    pushState('TURN02', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    // A state snapshot can arrive before its matching events batch; the exact
    // versioned turnSkipped batch still identifies a new same-player turn.
    pushState('TURN02', { version: 2, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    const skipped = eventsMessage('TURN02', 2, [{ type: 'turnSkipped', playerId: 'player_biA' }]);
    deliver('server:events', skipped);
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);

    deliver('server:events', skipped);
    pushState('TURN02', { version: 2, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);
  });

  it('não avisa observador, pausa, desconexão ou reentrada no mesmo turno; avisa na rodada nova', async () => {
    await mountRoom();
    await createRoom('TURN03');
    pushState('TURN03', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    pushState('TURN03', {
      version: 2,
      currentPlayerId: 'player_anA',
      roomStatus: 'paused',
      pause: { retention: false, absent: [] },
    });
    pushState('TURN03', { version: 3, currentPlayerId: 'player_anA', roomStatus: 'playing' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    harness.state.connected = false;
    deliver('disconnect');
    harness.state.connected = true;
    deliver('connect');
    await act(async () => {
      await Promise.resolve();
      const index = harness.state.pending.findIndex((request) => request.event === 'client:joinRoom');
      const [request] = harness.state.pending.splice(index, 1);
      if (request === undefined) throw new Error('Reentrada não solicitada.');
      request.callback({
        ok: true,
        roomCode: 'TURN03',
        playerId: 'player_anA',
        credential: 'cred_TURN03',
        rejoined: true,
        version: 3,
      });
      await Promise.resolve();
    });
    pushState('TURN03', { version: 3, currentPlayerId: 'player_anA', roomStatus: 'playing' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    pushState('TURN03', { version: 4, roundId: 'r2', currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(2);
  });

  it('só avisa quando a entrada passa a ter uma mão autorizada e não duplica em StrictMode', async () => {
    await mountRoom(true);
    await createRoom('TURN04');
    pushState('TURN04', { version: 1, currentPlayerId: 'player_anA', authorized: false });
    expect(soundSpy.playTurnNotificationSound).not.toHaveBeenCalled();

    pushState('TURN04', { version: 2, currentPlayerId: 'player_anA', authorized: true });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);
    pushState('TURN04', { version: 3, currentPlayerId: 'player_anA', authorized: true });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(window);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(soundSpy.prepareSoundPlayback).toHaveBeenCalledTimes(2);
  });

  it('aguarda o vínculo autorizado para consumir a vez já presente', async () => {
    await mountRoom();
    let createResult: Promise<string | null> | null = null;
    act(() => {
      createResult = api().createRoom('Ana', 'raposa');
    });
    pushState('TURN06', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).not.toHaveBeenCalled();

    await act(async () => {
      const index = harness.state.pending.findIndex((request) => request.event === 'client:createRoom');
      const [request] = harness.state.pending.splice(index, 1);
      if (request === undefined) throw new Error('Requisição ausente: client:createRoom');
      request.callback({ ok: true, roomCode: 'TURN06', playerId: 'player_anA', credential: 'cred_TURN06', version: 1 });
      await createResult;
    });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);

    pushState('TURN06', { version: 2, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).toHaveBeenCalledTimes(1);
  });

  it('a opção própria e o mute geral bloqueiam somente os sons que devem bloquear', async () => {
    await mountRoom();
    await createRoom('TURN05');
    const alert = document.querySelector('[data-testid="pref-turn-notification"]') as HTMLInputElement;
    expect(alert.checked).toBe(true);
    act(() => alert.click());
    expect(alert.checked).toBe(false);
    pushState('TURN05', { version: 1, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).not.toHaveBeenCalled();

    const mute = document.querySelector('[data-testid="pref-sound-mute"]') as HTMLInputElement;
    act(() => {
      alert.click();
    });
    expect(alert.checked).toBe(true);
    expect(soundSpy.playTurnNotificationSound).not.toHaveBeenCalled();
    act(() => mute.click());
    pushState('TURN05', { version: 2, currentPlayerId: 'player_biA' });
    pushState('TURN05', { version: 3, currentPlayerId: 'player_anA' });
    expect(soundSpy.playTurnNotificationSound).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('tretta.mood')).toContain('"turnNotificationEnabled":true');
    expect(window.localStorage.getItem('tretta.mood')).toContain('"soundMuted":true');
  });
});
