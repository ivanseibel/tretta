/**
 * Fila, efeitos e preferências no provider (T005C):
 * 1. Lote de efeitos entra na fila serial e avança pelo timer.
 * 2. Replay/repetição não reapresenta nem repete som.
 * 3. Preferências aplicam data-anim, persistem e valem após remontar.
 * 4. prefers-reduced-motion limita "completa" a "reduced" ao vivo.
 * 5. Troca de rodada cancela; finished da mesma rodada preserva.
 * 6. Silenciar chama o controle de áudio e bloqueia sons seguintes.
 * 7. Ocultar reações remove as apresentações locais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  AutomaticEffect,
  EffectVariant,
  EventsMessage,
  StateMessage,
} from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import type { ReactionEvent } from '@tretta/protocol';
import { MoodSettings } from '@/components/MoodSettings';
import { EffectOverlay } from '@/components/reactions/EffectOverlay';

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
  events: EventsMessage['events'] = [],
): EventsMessage {
  return { roomCode, roundId, version, events, effects };
}

function deliver(event: string, payload?: unknown): void {
  const handler = harness.state.handlers.get(event);
  if (handler === undefined) throw new Error(`Handler ausente: ${event}`);
  act(() => {
    handler(payload);
  });
}

function deliverEffects(
  roomCode: string,
  effects: AutomaticEffect[],
  roundId = 'r1',
  version = 5,
  events: EventsMessage['events'] = [],
): void {
  deliver('server:events', eventsMessage(roomCode, roundId, version, effects, events));
}

function pushState(roomCode: string, playerId: string, options: StateOptions): void {
  deliver('server:state', stateMessage(roomCode, playerId, options));
}

function renderedEffectIds(): string[] {
  return Array.from(document.querySelectorAll('[data-effect-id]')).map(
    (node) => node.getAttribute('data-effect-id') ?? '',
  );
}

function overlay(): HTMLElement | null {
  return document.querySelector('[data-testid="effect-overlay"]');
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
        <EffectOverlay />
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
  pushState(roomCode, playerId, { roundId: 'r1', version: 1 });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function setPreference(
  patch: Partial<{
    animations: 'full' | 'reduced' | 'off';
    soundMuted: boolean;
    turnNotificationEnabled: boolean;
    hideReactions: boolean;
  }>,
): Promise<void> {
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
  soundSpy.playTurnNotificationSound.mockClear();
  soundSpy.prepareSoundPlayback.mockClear();
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

describe('fila serial de apresentações', () => {
  it('lote de efeitos entra um por vez e avança pelo timer até esvaziar', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMF1');

    deliverEffects('ROOMF1', [penaltyEffect('fx_1'), blockedEffect('fx_2')]);
    expect(renderedEffectIds()).toEqual(['fx_1']);
    expect(screen.queryByTestId('auto-effect-blocked')).toBeNull();

    await advance(2601);
    expect(renderedEffectIds()).toEqual(['fx_2']);
    expect(screen.getByTestId('auto-effect-blocked').isConnected).toBe(true);

    await advance(2601);
    expect(renderedEffectIds()).toEqual([]);
    expect(overlay()).toBeNull();
  });

  it('replay do mesmo lote não reapresenta e toca som uma única vez', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMF2');

    deliverEffects('ROOMF2', [penaltyEffect('fx_1')]);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);
    await advance(2601);

    deliverEffects('ROOMF2', [penaltyEffect('fx_1')]);
    deliverEffects('ROOMF2', [penaltyEffect('fx_1')]);
    expect(renderedEffectIds()).toEqual([]);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);
  });

  it('troca de rodada cancela; finished da mesma rodada preserva', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMF4');

    pushState('ROOMF4', 'player_anA', { roundId: 'r1', version: 2 });
    deliverEffects('ROOMF4', [penaltyEffect('fx_1')]);
    expect(renderedEffectIds()).toEqual(['fx_1']);

    // Mesma rodada (mesa → resultados): preserva a sequência final.
    pushState('ROOMF4', 'player_anA', { roundId: 'r1', version: 3 });
    expect(renderedEffectIds()).toEqual(['fx_1']);

    // Nova rodada/preparação: cancela apresentação, timers e áudio.
    pushState('ROOMF4', 'player_anA', { roundId: 'r2', version: 4 });
    expect(renderedEffectIds()).toEqual([]);
    expect(overlay()).toBeNull();
    expect(soundSpy.stopAllSounds).toHaveBeenCalled();

    await advance(4000);
    expect(renderedEffectIds()).toEqual([]);
  });

  it('descarta lotes de rodada antiga sem filtrar lote válido por versão', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMF5');

    const oldLine = {} as unknown as EventsMessage['events'][number];
    pushState('ROOMF5', 'player_anA', { roundId: 'r1', version: 2 });
    deliverEffects('ROOMF5', [penaltyEffect('fx_r1')], 'r1', 3, [oldLine]);
    expect(api().events).toHaveLength(1);

    pushState('ROOMF5', 'player_anA', { roundId: 'r2', version: 10 });
    expect(api().events).toEqual([]);
    expect(renderedEffectIds()).toEqual([]);
    soundSpy.playEffectSound.mockClear();
    soundSpy.stopAllSounds.mockClear();

    deliverEffects('ROOMF5', [blockedEffect('fx_late_r1')], 'r1', 3, [oldLine]);
    expect(api().events).toEqual([]);
    expect(renderedEffectIds()).toEqual([]);
    expect(soundSpy.playEffectSound).not.toHaveBeenCalled();

    const currentLine = {} as unknown as EventsMessage['events'][number];
    deliverEffects(
      'ROOMF5',
      [{ ...blockedEffect('fx_r2'), roundId: 'r2' }],
      'r2',
      9,
      [currentLine],
    );
    expect(api().events).toHaveLength(1);
    expect(api().events[0]?.events).toEqual([currentLine]);
    expect(renderedEffectIds()).toEqual(['fx_r2']);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);

    pushState('ROOMF5', 'player_anA', { roundId: null, version: 11 });
    expect(api().events).toEqual([]);
    soundSpy.playEffectSound.mockClear();
    deliverEffects('ROOMF5', [{ ...blockedEffect('fx_after_finished'), roundId: 'r2' }], 'r2', 10, [oldLine]);
    expect(api().events).toEqual([]);
    expect(renderedEffectIds()).toEqual([]);
    expect(soundSpy.playEffectSound).not.toHaveBeenCalled();

    deliver('server:removed', { roomCode: 'ROOMF5', reason: 'removed' });
    deliverEffects('ROOMF5', [{ ...blockedEffect('fx_after_removed'), roundId: 'r2' }], 'r2', 12, [oldLine]);
    expect(api().events).toEqual([]);
    expect(renderedEffectIds()).toEqual([]);
    expect(soundSpy.playEffectSound).not.toHaveBeenCalled();
  });

  it('recuperação da mesma rodada mantém ids de efeitos já vistos', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMF6');
    pushState('ROOMF6', 'player_anA', { roundId: 'r1', version: 2 });

    deliverEffects('ROOMF6', [penaltyEffect('fx_seen_before_recovery')]);
    expect(renderedEffectIds()).toEqual(['fx_seen_before_recovery']);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);

    // Perda e retorno do transporte: a retomada emite a reentrada autorizada.
    harness.state.connected = false;
    await act(async () => {
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
      await Promise.resolve();
    });
    await act(async () => {
      const requestIndex = harness.state.pending.findIndex((request) => request.event === 'client:joinRoom');
      const [request] = harness.state.pending.splice(requestIndex, 1);
      if (request === undefined) throw new Error('Requisição de reentrada ausente.');
      request.callback({
        ok: true,
        roomCode: 'ROOMF6',
        playerId: 'player_anA',
        credential: 'cred_ROOMF6_player_anA',
        rejoined: true,
        version: 2,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    pushState('ROOMF6', 'player_anA', { roundId: 'r1', version: 2 });
    expect(renderedEffectIds()).toEqual([]);

    soundSpy.playEffectSound.mockClear();
    deliverEffects('ROOMF6', [penaltyEffect('fx_seen_before_recovery')], 'r1', 3);
    expect(renderedEffectIds()).toEqual([]);
    expect(soundSpy.playEffectSound).not.toHaveBeenCalled();
  });
});

describe('reações no provider', () => {
  it('deduplica ack/broadcast, mantém 4 s e limpa ao ocultar', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMR1');

    const event: ReactionEvent = {
      id: 'rx_1',
      type: 'eita',
      sender: { playerId: 'player_anA', nickname: 'Ana', avatar: 'raposa' },
      sentAt: Date.now(),
    };
    deliver('server:reaction', { roomCode: 'ROOMR1', reaction: event });
    expect(api().activeReactions.player_anA?.id).toBe('rx_1');
    deliver('server:reaction', { roomCode: 'ROOMR1', reaction: event });
    expect(Object.keys(api().activeReactions)).toEqual(['player_anA']);

    await advance(3_999);
    expect(api().activeReactions.player_anA?.id).toBe('rx_1');
    await advance(1);
    expect(api().activeReactions.player_anA).toBeUndefined();

    deliver('server:reaction', {
      roomCode: 'ROOMR1',
      reaction: { ...event, id: 'rx_2', type: 'uau' },
    });
    expect(api().activeReactions.player_anA?.id).toBe('rx_2');
    await setPreference({ hideReactions: true });
    expect(api().activeReactions).toEqual({});
    expect(soundSpy.playEffectSound).not.toHaveBeenCalled();
  });
});

describe('preferências de apresentação', () => {
  it('data-anim reflete a escolha e o valor persiste após remontar', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMP1');
    deliverEffects('ROOMP1', [penaltyEffect('fx_1')]);
    expect(overlayAnim()).toBe('full');

    await setPreference({ animations: 'off' });
    expect(overlayAnim()).toBe('off');
    expect(window.localStorage.getItem('tretta.mood')).toContain('"animations":"off"');
    expect((screen.getByTestId('pref-animations-off') as HTMLInputElement).checked).toBe(true);

    // Simula reload: desmonta e monta de novo com o mesmo storage.
    cleanup();
    latest = null;
    await mountRoom();
    await enterRoom('ROOMP1');
    deliverEffects('ROOMP1', [penaltyEffect('fx_2')]);
    expect(overlayAnim()).toBe('off');

    await advance(1401);
    expect(overlay()).toBeNull();
  });

  it('prefers-reduced-motion limita completa a reduced, com aviso visível', async () => {
    const query = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      value: () => query as unknown as MediaQueryList,
      configurable: true,
      writable: true,
    });

    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMP2');
    deliverEffects('ROOMP2', [penaltyEffect('fx_1')]);

    expect(overlayAnim()).toBe('reduced');
    expect((screen.getByTestId('pref-animations-full') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('pref-animations-note').isConnected).toBe(true);
    expect(screen.getByTestId('pref-animations-reduced').isConnected).toBe(true);

    // Mudança ao vivo da mídia: sai do modo reduzido sem recarregar.
    await act(async () => {
      query.matches = false;
      query.addEventListener.mock.calls[0]?.[1]({ matches: false });
    });
    expect(overlayAnim()).toBe('full');
    expect(screen.queryByTestId('pref-animations-note')).toBeNull();
  });

  it('silenciar chama o controle de áudio e bloqueia sons seguintes', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMP4');

    deliverEffects('ROOMP4', [penaltyEffect('fx_1')]);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);
    expect(soundSpy.setSoundMuted).toHaveBeenLastCalledWith(false);

    await setPreference({ soundMuted: true });
    expect(soundSpy.setSoundMuted).toHaveBeenLastCalledWith(true);

    await advance(2601);
    deliverEffects('ROOMP4', [blockedEffect('fx_2')], 'r1', 6);
    expect(renderedEffectIds()).toEqual(['fx_2']);
    expect(soundSpy.playEffectSound).toHaveBeenCalledTimes(1);
  });

  it('controles são acessíveis e refletem o estado no DOM', async () => {
    await mountRoom();
    await enterRoom('ROOMP5');

    const full = screen.getByTestId('pref-animations-full');
    const reduced = screen.getByTestId('pref-animations-reduced');
    const off = screen.getByTestId('pref-animations-off');
    const mute = screen.getByTestId('pref-sound-mute');
    const turnNotification = screen.getByTestId('pref-turn-notification');
    const hide = screen.getByTestId('pref-hide-reactions');
    expect(full.closest('fieldset')?.querySelector('legend')?.textContent).toBe('Animações');
    expect((full as HTMLInputElement).checked).toBe(true);
    expect((turnNotification as HTMLInputElement).checked).toBe(true);

    await act(async () => {
      fireEvent.click(reduced);
    });
    expect((reduced as HTMLInputElement).checked).toBe(true);
    expect((full as HTMLInputElement).checked).toBe(false);
    expect(window.localStorage.getItem('tretta.mood')).toContain('"animations":"reduced"');

    await act(async () => {
      fireEvent.click(off);
      fireEvent.click(mute);
      fireEvent.click(turnNotification);
      fireEvent.click(hide);
    });
    expect((off as HTMLInputElement).checked).toBe(true);
    expect((mute as HTMLInputElement).checked).toBe(true);
    expect((turnNotification as HTMLInputElement).checked).toBe(false);
    expect((hide as HTMLInputElement).checked).toBe(true);
    expect(window.localStorage.getItem('tretta.mood')).toContain('"soundMuted":true');
    expect(window.localStorage.getItem('tretta.mood')).toContain('"turnNotificationEnabled":false');
    expect(window.localStorage.getItem('tretta.mood')).toContain('"hideReactions":true');
  });
});
