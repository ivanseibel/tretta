/**
 * Fila, efeitos e preferências no provider (T005C):
 * 1. Lote de efeitos entra na fila serial e avança pelo timer.
 * 2. Replay/repetição não reapresenta nem repete som.
 * 3. Efeito e provocação compartilham a fila sem sobreposição.
 * 4. Preferências aplicam data-anim, persistem e valem após remontar.
 * 5. prefers-reduced-motion limita "completa" a "reduced" ao vivo.
 * 6. Ocultar provocações descarta as enfileiradas e preserva efeitos.
 * 7. Troca de rodada cancela; finished da mesma rodada preserva.
 * 8. Silenciar chama o controle de áudio e bloqueia sons seguintes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  AutomaticEffect,
  EffectVariant,
  EventsMessage,
  StateMessage,
  TauntEvent,
} from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import { MoodSettings } from '@/components/MoodSettings';
import { TauntOverlay } from '@/components/TauntOverlay';

const soundSpy = vi.hoisted(() => ({
  playEffectSound: vi.fn(),
  playTauntSound: vi.fn(),
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
    on(event: string, callback: (payload: unknown) => void): FakeSocket {
      state.handlers.set(event, callback);
      return socket;
    },
    once(event: string, callback: () => void): FakeSocket {
      const set = state.onceHandlers.get(event) ?? new Set<() => void>();
      set.add(callback);
      state.onceHandlers.set(event, set);
      return socket;
    },
    off(event: string, callback: () => void): FakeSocket {
      state.onceHandlers.get(event)?.delete(callback);
      return socket;
    },
    emit(event: string, payload: Record<string, unknown>, callback: (response: unknown) => void): void {
      state.pending.push({ event, payload, callback });
    },
    disconnect(): void {},
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
}

function stateMessage(roomCode: string, playerId: string, options: StateOptions = {}): StateMessage {
  const { roundId = null, version = 1 } = options;
  return {
    room: {
      roomCode,
      status: roundId === null ? 'lobby' : 'playing',
      version,
      roundId,
      participants: [
        {
          id: 'player_anA',
          playerId: 'player_anA',
          nickname: 'Ana',
          avatar: 'raposa',
          ready: true,
          connected: true,
          inRound: roundId !== null,
          isHost: playerId === 'player_anA',
          autoControlled: false,
          absentSince: null,
          score: 0,
        },
        {
          id: 'player_biA',
          playerId: 'player_biA',
          nickname: 'Bia',
          avatar: 'lobo',
          ready: true,
          connected: true,
          inRound: roundId !== null,
          isHost: false,
          autoControlled: false,
          absentSince: null,
          score: 0,
        },
      ],
      scoreboard: [],
      lastRound: null,
      pause: null,
      retainedUntil: null,
      serverTime: Date.now(),
    },
    self: { playerId, view: null },
    table: null,
  } as unknown as StateMessage;
}

function penaltyEffect(id: string, variant: EffectVariant = 'cards-rain'): AutomaticEffect {
  return {
    id,
    variant,
    roundId: 'r1',
    seq: 1,
    eventIndex: 0,
    category: 'penaltyDraw',
    targetId: 'player_biA',
    targetNickname: 'Bia',
    drawn: 2,
    requested: 2,
    reason: 'penalty',
  };
}

function blockedEffect(id: string, variant: EffectVariant = 'brick-wall'): AutomaticEffect {
  return {
    id,
    variant,
    roundId: 'r1',
    seq: 2,
    eventIndex: 1,
    category: 'blocked',
    playerId: 'player_biA',
    playerNickname: 'Bia',
  };
}

function eventsMessage(
  roomCode: string,
  roundId: string,
  version: number,
  effects: AutomaticEffect[],
): EventsMessage {
  return { roomCode, roundId, version, events: [], effects };
}

function taunt(id: string): TauntEvent {
  return {
    id,
    type: 'tomate',
    sender: { playerId: 'player_anA', nickname: 'Ana', avatar: 'raposa' },
    target: { playerId: 'player_biA', nickname: 'Bia', avatar: 'lobo' },
    sentAt: 1_000_000,
  };
}

function deliver(event: string, payload?: unknown): void {
  const handler = harness.state.handlers.get(event);
  if (handler === undefined) throw new Error(`Handler ausente: ${event}`);
  act(() => {
    handler(payload);
  });
}

function broadcastTaunt(roomCode: string, event: TauntEvent): void {
  deliver('server:taunt', { roomCode, taunt: event });
}

function deliverEffects(roomCode: string, effects: AutomaticEffect[], roundId = 'r1', version = 5): void {
  deliver('server:events', eventsMessage(roomCode, roundId, version, effects));
}

function pushState(roomCode: string, playerId: string, options: StateOptions): void {
  deliver('server:state', stateMessage(roomCode, playerId, options));
}

function renderedEffectIds(): string[] {
  return Array.from(document.querySelectorAll('[data-effect-id]')).map(
    (node) => node.getAttribute('data-effect-id') ?? '',
  );
}

function renderedTauntIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="taunt-effect-"]')).map(
    (node) => node.getAttribute('data-taunt-id') ?? '',
  );
}

function overlay(): HTMLElement | null {
  return document.querySelector('[data-testid="taunt-overlay"]');
}

function overlayAnim(): string | null {
  return overlay()?.getAttribute('data-anim') ?? null;
}

async function mountRoom(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <Probe />
        <MoodSettings />
        <TauntOverlay />
      </RoomProvider>,
    );
  });
}

async function enterRoom(roomCode: string, playerId = 'player_anA'): Promise<void> {
  await act(async () => {
    const promise = api().createRoom('Ana', 'raposa');
    const index = harness.state.pending.findIndex((request) => request.event === 'client:createRoom');
    if (index === -1) throw new Error('Requisição ausente: client:createRoom');
    const [request] = harness.state.pending.splice(index, 1);
    if (request === undefined) throw new Error('Requisição ausente: client:createRoom');
    request.callback({
      ok: true,
      roomCode,
      playerId,
      credential: `cred_${roomCode}_${playerId}`,
      version: 1,
    });
    await promise;
  });
  pushState(roomCode, playerId, { version: 1 });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function setPreference(patch: Partial<{ animations: 'full' | 'reduced' | 'off'; soundMuted: boolean; hideTaunts: boolean }>): Promise<void> {
  await act(async () => {
    api().setPreferences(patch);
  });
}

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  harness.state.connected = true;
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  latest = null;
  window.localStorage.clear();
  soundSpy.playEffectSound.mockClear();
  soundSpy.playTauntSound.mockClear();
  soundSpy.setSoundMuted.mockClear();
  soundSpy.stopAllSounds.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalMatchMedia === undefined) {
    Reflect.deleteProperty(window, 'matchMedia');
  } else {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      configurable: true,
      writable: true,
    });
  }
});


describe('validação independente de T005C', () => {
  it('controle: efeito da rodada corrente aparece e toca uma vez', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    pushState('ABCDDD','player_anA',{roundId:'r2',version:10});
    deliverEffects('ABCDDD',[{...blockedEffect('fx_current'),roundId:'r2'}],'r2',11);
    expect(renderedEffectIds()).toEqual(['fx_current']);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);
  });

  it('lote atrasado de rodada anterior não apresenta nem toca som na rodada nova', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    pushState('ABCDDD','player_anA',{roundId:'r1',version:2});
    pushState('ABCDDD','player_anA',{roundId:'r2',version:10});
    deliverEffects('ABCDDD',[blockedEffect('fx_late_round')],'r1',3);
    const observed={activeRound:api().state?.room.roundId,presented:renderedEffectIds(),soundCalls:soundSpy.playEffectSound.mock.calls.length};
    console.log(JSON.stringify({scenario:'lote antigo em rodada nova',...observed}));
    expect(observed).toEqual({activeRound:'r2',presented:[],soundCalls:0});
  });

  it('ocultar provocação ativa cancela também o áudio dessa apresentação', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    broadcastTaunt('ABCDDD',taunt('t_hide_current'));
    expect(renderedTauntIds()).toEqual(['t_hide_current']);
    expect(soundSpy.playTauntSound).toHaveBeenCalledTimes(1);
    soundSpy.stopAllSounds.mockClear();
    await setPreference({hideTaunts:true});
    const observed={presented:renderedTauntIds(),audioCancelCalls:soundSpy.stopAllSounds.mock.calls.length};
    console.log(JSON.stringify({scenario:'ocultar provocação ativa',...observed}));
    expect(observed.presented).toEqual([]);
    expect(observed.audioCancelCalls).toBeGreaterThan(0);
  });
});
