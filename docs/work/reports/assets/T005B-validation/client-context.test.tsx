/**
 * Regressões do cliente de provocação (T005B):
 * 1. Sem vínculo autorizado o envio não emite nem consome o botão.
 * 2. Ack e broadcast do mesmo evento apresentam um único efeito.
 * 3. Broadcast repetido ou de outra sala não duplica nem contamina.
 * 4. Troca de sala limpa efeitos ativos e invalida o id visto.
 * 5. Recusa do servidor preserva tipo/alvo escolhidos.
 * 6. Efeito morre sozinho após a janela de apresentação.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { StateMessage, TauntEvent } from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import { TauntOverlay } from '@/components/TauntOverlay';
import { TauntPanel } from '@/components/TauntPanel';

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

function stateMessage(roomCode: string, playerId: string): StateMessage {
  return {
    room: {
      roomCode,
      status: 'lobby',
      version: 1,
      roundId: null,
      participants: [
        {
          id: 'player_anA',
          playerId: 'player_anA',
          nickname: 'Ana',
          avatar: 'raposa',
          ready: true,
          connected: true,
          inRound: false,
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
          inRound: false,
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

function taunt(id: string, roomish?: Partial<TauntEvent>): TauntEvent {
  return {
    id,
    type: 'tomate',
    sender: { playerId: 'player_anA', nickname: 'Ana', avatar: 'raposa' },
    target: { playerId: 'player_biA', nickname: 'Bia', avatar: 'lobo' },
    sentAt: 1_000_000,
    ...roomish,
  };
}

function takePending(event: string): PendingRequest {
  const index = harness.state.pending.findIndex((request) => request.event === event);
  if (index === -1) {
    throw new Error(
      `Requisição ausente: ${event}; pendentes: ${harness.state.pending.map((request) => request.event).join(', ')}`,
    );
  }
  const [request] = harness.state.pending.splice(index, 1);
  if (request === undefined) throw new Error(`Requisição ausente: ${event}`);
  return request;
}

async function respond(event: string, response: unknown): Promise<PendingRequest> {
  let request: PendingRequest | undefined;
  await act(async () => {
    request = takePending(event);
    request.callback(response);
  });
  if (request === undefined) throw new Error(`Requisição ausente: ${event}`);
  return request;
}

function deliver(event: string, payload?: unknown): void {
  const handler = harness.state.handlers.get(event);
  if (handler === undefined) throw new Error(`Handler ausente: ${event}`);
  act(() => {
    handler(payload);
  });
}

function broadcastTaunt(roomCode: string, event: TauntEvent): void {
  act(() => {
    harness.state.handlers.get('server:taunt')?.({ roomCode, taunt: event });
  });
}

function renderedTauntIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="taunt-effect-"]')).map(
    (node) => node.getAttribute('data-taunt-id') ?? '',
  );
}

async function mountRoom(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <Probe />
        <TauntPanel />
        <TauntOverlay />
      </RoomProvider>,
    );
  });
}

async function enterRoom(roomCode: string, playerId = 'player_anA'): Promise<void> {
  await act(async () => {
    const promise = api().createRoom('Ana', 'raposa');
    takePending('client:createRoom').callback({
      ok: true,
      roomCode,
      playerId,
      credential: `cred_${roomCode}_${playerId}`,
      version: 1,
    });
    await promise;
  });
  await act(async () => {
    harness.state.handlers.get('server:state')?.(stateMessage(roomCode, playerId));
  });
}

async function leaveRoom(): Promise<void> {
  await act(async () => {
    const promise = api().leaveRoom();
    takePending('client:leaveRoom').callback({ ok: true, version: 90 });
    await promise;
  });
}

async function joinRoom(roomCode: string, playerId: string, nickname = 'Nova'): Promise<void> {
  await act(async () => {
    const promise = api().joinRoom(roomCode, nickname, 'raposa');
    takePending('client:joinRoom').callback({
      ok: true,
      roomCode,
      playerId,
      credential: `cred_${roomCode}_${playerId}`,
      rejoined: false,
      version: 5,
    });
    await promise;
  });
  await act(async () => {
    harness.state.handlers.get('server:state')?.(stateMessage(roomCode, playerId));
  });
}

function dropConnection(): void {
  harness.state.connected = false;
  deliver('disconnect');
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  latest = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});


async function recoverSameRoom(code: string): Promise<void> {
  dropConnection();
  harness.state.connected = true;
  await act(async () => { harness.state.handlers.get('connect')?.(undefined); });
  await respond('client:joinRoom', {
    ok: true, roomCode: code, playerId: 'player_anA',
    credential: `cred_${code}_player_anA`, rejoined: true, version: 7,
  });
}

describe('validação independente de T005B', () => {
  it('controle: duplicata no vínculo atual não reapresenta efeito encerrado', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    const event = taunt('t_control', {sentAt: Date.now()});
    broadcastTaunt('ABCDDD', event);
    expect(renderedTauntIds()).toEqual(['t_control']);
    await act(async () => { vi.advanceTimersByTime(3201); });
    expect(renderedTauntIds()).toEqual([]);
    broadcastTaunt('ABCDDD', event);
    expect(renderedTauntIds()).toEqual([]);
  });

  it('duplicata do mesmo evento após recuperar a mesma identidade não reapresenta efeito encerrado', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    const event = taunt('t_old', {sentAt: Date.now()});
    broadcastTaunt('ABCDDD', event);
    await act(async () => { vi.advanceTimersByTime(3201); });
    await recoverSameRoom('ABCDDD');
    expect(api().chatLinkReady).toBe(true);
    expect(renderedTauntIds()).toEqual([]);
    broadcastTaunt('ABCDDD', event);
    console.log(JSON.stringify({scenario:'duplicata após reentrada', presentedIds:renderedTauntIds()}));
    expect(renderedTauntIds()).toEqual([]);
  });

  it('timeout do envio anterior à reconexão não bloqueia nem coloca erro no vínculo recuperado', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ABCDDD');
    await act(async () => { fireEvent.click(screen.getByTestId('taunt-send')); });
    expect(harness.state.pending.filter(r => r.event === 'client:tauntSend')).toHaveLength(1);
    await recoverSameRoom('ABCDDD');
    expect(api().chatLinkReady).toBe(true);
    const blockedAfterRejoin = (screen.getByTestId('taunt-send') as HTMLButtonElement).disabled;
    // Sem ack da conexão perdida: emitWithAck resolve pelo timeout real do provider.
    await act(async () => { vi.advanceTimersByTime(6001); });
    const errorAfterOldTimeout = screen.queryByTestId('taunt-error')?.textContent ?? null;
    console.log(JSON.stringify({scenario:'envio antigo após recuperar vínculo',blockedAfterRejoin,errorAfterOldTimeout}));
    expect({blockedAfterRejoin,errorAfterOldTimeout}).toEqual({blockedAfterRejoin:false,errorAfterOldTimeout:null});
  });

  it('ack antigo não coloca erro no painel após trocar de sala', async () => {
    await mountRoom();
    await enterRoom('ABCDDD');
    await act(async () => { fireEvent.click(screen.getByTestId('taunt-send')); });
    await leaveRoom();
    await joinRoom('EFGHHH','player_biA','Bia');
    const old = taunt('t_old_ack', {sentAt: Date.now()});
    await respond('client:tauntSend',{ok:true,taunt:old});
    const error = screen.queryByTestId('taunt-error')?.textContent ?? null;
    console.log(JSON.stringify({scenario:'ack de A após entrar em B',error,presentedIds:renderedTauntIds()}));
    expect(renderedTauntIds()).toEqual([]);
    expect(error).toBeNull();
  });
});
