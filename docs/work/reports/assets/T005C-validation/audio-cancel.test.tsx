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

// Neste caso os sons reais são usados, com apenas WebAudio controlado.

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



class ControlledOscillator {
  static all: ControlledOscillator[]=[];
  type='sine';
  frequency={setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()};
  onended:(()=>void)|null=null;
  cut=false;
  scheduledStop:number|null=null;
  connect=vi.fn();disconnect=vi.fn();start=vi.fn();
  constructor(){ControlledOscillator.all.push(this);}
  stop(when?:number):void {
    if(when===undefined){this.cut=true;this.onended?.();}
    else this.scheduledStop=when;
  }
}
class ControlledAudioContext {
  state='running';currentTime=0;destination={};
  resume():Promise<void>{return Promise.resolve();}
  createOscillator():ControlledOscillator{return new ControlledOscillator();}
  createGain(){return {gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()};}
}

it('ocultar a provocação ativa corta os nós dela antes de ativar o efeito automático seguinte',async()=>{
  vi.useFakeTimers();
  ControlledOscillator.all=[];
  Object.defineProperty(window,'AudioContext',{value:ControlledAudioContext,writable:true,configurable:true});
  await mountRoom();
  await enterRoom('ABCDDD');
  broadcastTaunt('ABCDDD',taunt('t_audio_active'));
  const oldNodes=[...ControlledOscillator.all];
  expect(oldNodes.length).toBeGreaterThan(0);
  expect(oldNodes.every(n=>n.scheduledStop!==null)).toBe(true);
  // O efeito seguinte só pode tocar quando for ativado pela fila.
  deliverEffects('ABCDDD',[blockedEffect('fx_next')]);
  expect(ControlledOscillator.all).toHaveLength(oldNodes.length);
  await setPreference({hideTaunts:true});
  const newNodes=ControlledOscillator.all.slice(oldNodes.length);
  const observed={oldCuts:oldNodes.map(n=>n.cut),newCuts:newNodes.map(n=>n.cut),presented:renderedEffectIds()};
  console.log(JSON.stringify({scenario:'cancelamento com sons reais e WebAudio controlado',...observed}));
  expect(newNodes.length).toBeGreaterThan(0);
  expect(observed).toEqual({oldCuts:oldNodes.map(()=>true),newCuts:newNodes.map(()=>false),presented:['fx_next']});
});
