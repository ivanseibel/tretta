/**
 * Regressões dos achados da validação de T005A:
 * 1. Lacuna maior que uma página ficava inacessível (cursor antigo usava o
 *    menor seq global em vez da fronteira da página recente).
 * 2. Respostas assíncronas antigas de histórico/envio eram aplicadas no
 *    vínculo atual (outra sala, reentrada no mesmo código, sala removida).
 *
 * Montam o RoomProvider e o ChatPanel reais com transporte controlado;
 * a paginação replica o contrato do servidor (`before` exclusivo, ascendente).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ChatMessage, StateMessage } from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import { ChatPanel } from '@/components/ChatPanel';

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

function msg(seq: number, text: string): ChatMessage {
  return {
    seq,
    text,
    author: { playerId: 'author_fixture', nickname: 'Autor', avatar: 'lobo' },
    sentAt: 1_000_000 + seq,
  };
}

function seqRange(from: number, to: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let seq = from; seq <= to; seq++) messages.push(msg(seq, `mensagem ${seq}`));
  return messages;
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
          playerId,
          nickname: 'Ana',
          avatar: 'raposa',
          connected: true,
          inRound: false,
          isHost: true,
          autoControlled: false,
          absentSince: null,
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

function broadcastChat(roomCode: string, message: ChatMessage): void {
  act(() => {
    harness.state.handlers.get('server:chat')?.({ roomCode, message });
  });
}

function renderedSeqs(): number[] {
  return Array.from(document.querySelectorAll('[data-testid^="chat-message-"]')).map((node) =>
    Number(node.getAttribute('data-testid')?.replace('chat-message-', '')),
  );
}

function renderedTexts(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="chat-text-"]')).map((node) => node.textContent ?? '');
}

async function mountRoom(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <Probe />
        <ChatPanel />
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

async function restoreConnection(roomCode: string, playerId: string): Promise<void> {
  harness.state.connected = true;
  await act(async () => {
    harness.state.handlers.get('connect')?.(undefined);
  });
  await respond('client:joinRoom', {
    ok: true,
    roomCode,
    playerId,
    credential: `cred_${roomCode}_${playerId}`,
    rejoined: true,
    version: 7,
  });
}

async function respondHistory(messages: ChatMessage[], hasMore: boolean): Promise<void> {
  await respond('client:chatHistory', { ok: true, messages, hasMore });
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  window.localStorage.clear();
  latest = null;
});

afterEach(() => {
  cleanup();
});


describe('orquestrador: autorização durante reconexão', () => {
  it('bloqueia botão e API de envio enquanto o join aguarda confirmação', async () => {
    await mountRoom();
    await enterRoom('ABCDDD');
    await respondHistory([msg(1, 'mensagem 1')], false);
    dropConnection();
    harness.state.connected = true;
    await act(async () => { harness.state.handlers.get('connect')?.(undefined); });
    const join = takePending('client:joinRoom');
    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'durante reentrada' } });
    });
    const buttonEnabledBeforeJoinAck = !(screen.getByTestId('chat-send') as HTMLButtonElement).disabled;
    let sendPromise: Promise<unknown> | undefined;
    await act(async () => { sendPromise = api().sendChat('durante reentrada'); });
    const chatSendEmittedBeforeJoinAck = harness.state.pending.some(request => request.event === 'client:chatSend');
    if (chatSendEmittedBeforeJoinAck) {
      await respond('client:chatSend', { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Sem vínculo autorizado.' } });
    }
    await act(async () => { await sendPromise; });
    console.log(JSON.stringify({ scenario: 'envio antes da confirmação de reentrada', transportLive: api().connection === 'live', buttonEnabledBeforeJoinAck, chatSendEmittedBeforeJoinAck }));
    await act(async () => {
      join.callback({ ok: true, roomCode: 'ABCDDD', playerId: 'player_anA', credential: 'cred_ABCDDD_player_anA', rejoined: true, version: 7 });
    });
    await respondHistory([msg(1, 'mensagem 1')], false);
    expect(buttonEnabledBeforeJoinAck).toBe(false);
    expect(chatSendEmittedBeforeJoinAck).toBe(false);
  });
});
