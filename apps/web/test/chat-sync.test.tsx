/**
 * Regressões dos achados da validação de T005A:
 * 1. Lacuna maior que uma página ficava inacessível (cursor antigo usava o
 *    menor seq global em vez da fronteira da página recente).
 * 2. Respostas assíncronas antigas de histórico/envio eram aplicadas no
 *    vínculo atual (outra sala, reentrada no mesmo código, sala removida).
 * 3. Transporte reconectado habilitava envio antes de a reentrada ser
 *    confirmada (botão e API de sendChat sem vínculo autorizado).
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

describe('recuperação de intervalos do histórico', () => {
  it('recupera a lacuna entre o cache antigo e a página recente (cenário 1 + 60)', async () => {
    await mountRoom();
    await enterRoom('ROOM01');
    await respondHistory([msg(1, 'mensagem 1')], false);
    expect(renderedSeqs()).toEqual([1]);

    // Mais de cinquenta mensagens chegam enquanto o cliente está desconectado.
    dropConnection();
    await restoreConnection('ROOM01', 'player_anA');

    // A recuperação só traz a página recente; o intervalo 2–11 fica abaixo dela.
    await respondHistory(seqRange(12, 61), true);
    expect(renderedSeqs()).toEqual([1, ...Array.from({ length: 50 }, (_, index) => index + 12)]);
    const button = screen.getByTestId('chat-load-older');
    expect(button.isConnected).toBe(true);

    // O cursor da página recente (12) recupera o intervalo perdido.
    fireEvent.click(button);
    const older = takePending('client:chatHistory');
    expect(older.payload.before).toBe(12);
    await act(async () => {
      older.callback({ ok: true, messages: seqRange(2, 11), hasMore: false });
    });
    expect(renderedSeqs()).toEqual(Array.from({ length: 61 }, (_, index) => index + 1));
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
  });

  it('recupera várias páginas perdidas com cliques sucessivos em anteriores', async () => {
    await mountRoom();
    await enterRoom('ROOM02');
    await respondHistory(seqRange(1, 10), false);
    expect(renderedSeqs()).toHaveLength(10);

    dropConnection();
    await restoreConnection('ROOM02', 'player_anA');
    await respondHistory(seqRange(81, 130), true);
    expect(renderedSeqs()).toHaveLength(60);

    fireEvent.click(screen.getByTestId('chat-load-older'));
    const secondPage = takePending('client:chatHistory');
    expect(secondPage.payload.before).toBe(81);
    await act(async () => {
      secondPage.callback({ ok: true, messages: seqRange(31, 80), hasMore: true });
    });
    expect(renderedSeqs()).toHaveLength(110);

    fireEvent.click(screen.getByTestId('chat-load-older'));
    const thirdPage = takePending('client:chatHistory');
    expect(thirdPage.payload.before).toBe(31);
    await act(async () => {
      thirdPage.callback({ ok: true, messages: seqRange(1, 30), hasMore: false });
    });
    expect(renderedSeqs()).toEqual(Array.from({ length: 130 }, (_, index) => index + 1));
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
  });

  it('mensagem ao vivo durante a consulta e respostas anteriores em ordem invertida não criam buraco nem duplicata', async () => {
    await mountRoom();
    await enterRoom('ROOM03');
    await respondHistory([msg(1, 'mensagem 1')], false);

    // Ao vivo chega antes da resposta da consulta em andamento.
    await act(async () => {
      void api().loadChatHistory();
    });
    broadcastChat('ROOM03', msg(2, 'ao vivo'));
    await respondHistory([msg(1, 'mensagem 1'), msg(2, 'ao vivo')], false);
    expect(renderedSeqs()).toEqual([1, 2]);

    // Página recente com lacuna abaixo do cache, e dois pedidos de anteriores
    // concorrentes respondidos fora de ordem.
    dropConnection();
    await restoreConnection('ROOM03', 'player_anA');
    await respondHistory(seqRange(12, 20), true);
    expect(renderedSeqs()).toEqual([1, 2, ...Array.from({ length: 9 }, (_, index) => index + 12)]);

    fireEvent.click(screen.getByTestId('chat-load-older'));
    const firstOlder = takePending('client:chatHistory');
    expect(firstOlder.payload.before).toBe(12);
    await act(async () => {
      void api().loadChatHistory(12);
    });
    const secondOlder = takePending('client:chatHistory');
    await act(async () => {
      secondOlder.callback({ ok: true, messages: seqRange(1, 11), hasMore: false });
    });
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
    await act(async () => {
      firstOlder.callback({ ok: true, messages: seqRange(1, 11), hasMore: false });
    });
    expect(renderedSeqs()).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
  });
});

describe('invalidação de respostas por contexto', () => {
  it('resposta antiga de histórico não contamina outra sala nem mexe no carregamento dela', async () => {
    await mountRoom();
    await enterRoom('ROOMAA');
    await respondHistory([msg(1, 'histórico da sala A')], false);

    // Consulta pendente em A enquanto a pessoa troca de sala.
    await act(async () => {
      void api().loadChatHistory();
    });
    await leaveRoom();
    await joinRoom('ROOMBB', 'player_b');
    // O carregamento inicial de B ainda está pendente quando a resposta de A chega.
    broadcastChat('ROOMBB', msg(2, 'mensagem da sala B'));

    await respond('client:chatHistory', { ok: true, messages: [msg(1, 'histórico da sala A')], hasMore: true });
    expect(renderedTexts()).toEqual(['mensagem da sala B']);
    expect(api().chatHistoryLoading).toBe(true);

    await respondHistory([msg(1, 'B um'), msg(2, 'mensagem da sala B')], false);
    expect(renderedTexts()).toEqual(['B um', 'mensagem da sala B']);
    expect(api().chatHistoryLoading).toBe(false);
    expect(screen.queryByTestId('chat-load-older')).toBeNull();
  });

  it('ack atrasado de envio não ocupa seq da sala nova nem limpa o rascunho', async () => {
    await mountRoom();
    await enterRoom('ROOMAA');
    await respondHistory([msg(1, 'histórico da sala A')], false);

    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'envio da sala A' } });
      fireEvent.click(screen.getByTestId('chat-send'));
    });
    expect(harness.state.pending.some((request) => request.event === 'client:chatSend')).toBe(true);

    await leaveRoom();
    await joinRoom('ROOMBB', 'player_b');
    await respondHistory([], false);

    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'rascunho novo' } });
    });
    // O ack antigo chega antes da mensagem legítima de B com a mesma sequência.
    await respond('client:chatSend', { ok: true, message: msg(1, 'envio da sala A') });
    broadcastChat('ROOMBB', msg(1, 'mensagem da sala B'));

    expect(renderedTexts()).toEqual(['mensagem da sala B']);
    const input = screen.getByTestId('chat-input') as HTMLInputElement;
    expect(input.value).toBe('rascunho novo');
    expect(screen.getByTestId('chat-error').isConnected).toBe(true);
  });

  it('reentrada no mesmo código como nova identidade e remoção invalidam o trabalho antigo', async () => {
    await mountRoom();
    await enterRoom('ROOMCC', 'player_p1');
    await respondHistory([msg(1, 'da identidade antiga')], false);

    await act(async () => {
      void api().loadChatHistory();
    });
    await leaveRoom();
    await joinRoom('ROOMCC', 'player_p2', 'Outra');
    await respond('client:chatHistory', { ok: true, messages: [msg(1, 'da identidade antiga')], hasMore: true });
    expect(renderedSeqs()).toEqual([]);
    expect(api().chatHistoryLoading).toBe(true);

    await respondHistory([msg(1, 'da nova identidade')], false);
    expect(renderedTexts()).toEqual(['da nova identidade']);

    // Remoção durante consulta pendente: a resposta tardia não ressuscita nada.
    await act(async () => {
      void api().loadChatHistory();
    });
    deliver('server:removed', { reason: 'removed', roomCode: 'ROOMCC' });
    await respond('client:chatHistory', { ok: true, messages: [msg(9, 'fantasma')], hasMore: true });
    expect(renderedSeqs()).toEqual([]);
    expect(api().chatMessages).toEqual([]);
  });

});

describe('autorização do vínculo para envio do chat', () => {
  it('reconexão com join pendente preserva o rascunho, bloqueia o botão e impede sendChat de emitir', async () => {
    await mountRoom();
    await enterRoom('ROOMG1');
    await respondHistory([msg(1, 'mensagem 1')], false);

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    // Transporte de volta, mas só o join pendente; nenhuma consulta de histórico.
    expect(harness.state.pending.map((request) => request.event)).toEqual(['client:joinRoom']);
    expect(api().connection).toBe('live');

    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'durante a reentrada' } });
    });
    const input = screen.getByTestId('chat-input') as HTMLInputElement;
    expect(input.value).toBe('durante a reentrada');

    // Observações da fase com transporte vivo e join pendente.
    const button = screen.getByTestId('chat-send') as HTMLButtonElement;
    const buttonEnabledBeforeJoinAck = !button.disabled;
    const placeholderBeforeJoinAck = input.placeholder;
    let refusal: { ok: boolean } | undefined;
    await act(async () => {
      refusal = await api().sendChat('envio direto');
    });
    const chatSendEmittedBeforeJoinAck = harness.state.pending.some(
      (request) => request.event === 'client:chatSend',
    );
    if (chatSendEmittedBeforeJoinAck) {
      await respond('client:chatSend', {
        ok: false,
        error: { code: 'NOT_IN_ROOM', message: 'Sem vínculo autorizado.' },
      });
    }
    expect(buttonEnabledBeforeJoinAck).toBe(false);
    expect(placeholderBeforeJoinAck).toContain('Recuperando');
    expect(chatSendEmittedBeforeJoinAck).toBe(false);
    expect(refusal?.ok).toBe(false);
    expect(button.disabled).toBe(true);
    expect(input.value).toBe('durante a reentrada');

    // Reentrada confirmada: histórico sincroniza e o envio volta a ser permitido.
    await respond('client:joinRoom', {
      ok: true,
      roomCode: 'ROOMG1',
      playerId: 'player_anA',
      credential: 'cred_ROOMG1_player_anA',
      rejoined: true,
      version: 7,
    });
    await respondHistory([msg(1, 'mensagem 1'), msg(2, 'depois do join')], false);
    expect(renderedSeqs()).toEqual([1, 2]);
    expect((screen.getByTestId('chat-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('reentrada confirmada habilita envio com exatamente um envio e merge idempotente de ack/broadcast', async () => {
    await mountRoom();
    await enterRoom('ROOMG2');
    await respondHistory([msg(1, 'mensagem 1')], false);

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    await respond('client:joinRoom', {
      ok: true,
      roomCode: 'ROOMG2',
      playerId: 'player_anA',
      credential: 'cred_ROOMG2_player_anA',
      rejoined: true,
      version: 7,
    });
    await respondHistory([msg(1, 'mensagem 1')], false);

    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'uma mensagem' } });
      fireEvent.click(screen.getByTestId('chat-send'));
    });
    const sends = harness.state.pending.filter((request) => request.event === 'client:chatSend');
    expect(sends).toHaveLength(1);
    expect(sends[0]?.payload.roomCode).toBe('ROOMG2');

    const sent = msg(2, 'uma mensagem');
    await act(async () => {
      sends[0]?.callback({ ok: true, message: sent });
    });
    broadcastChat('ROOMG2', sent);
    expect(renderedSeqs()).toEqual([1, 2]);
    expect((screen.getByTestId('chat-input') as HTMLInputElement).value).toBe('');
  });

  it('reentrada recusada não habilita chat; o vínculo válido posterior habilita só o seu contexto', async () => {
    await mountRoom();
    await enterRoom('ROOMG3');
    await respondHistory([], false);

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    await respond('client:joinRoom', {
      ok: false,
      error: { code: 'ROOM_NOT_FOUND', message: 'Sala inexistente ou encerrada.' },
    });
    expect(api().roomGone).toBe(true);
    expect(api().chatLinkReady).toBe(false);

    let refusal: { ok: boolean } | undefined;
    await act(async () => {
      refusal = await api().sendChat('sem sala');
    });
    expect(refusal?.ok).toBe(false);
    expect(harness.state.pending.some((request) => request.event === 'client:chatSend')).toBe(false);

    // Um vínculo posterior em outra sala habilita somente o contexto novo.
    await joinRoom('ROOMG4', 'player_b');
    await respondHistory([], false);
    expect(api().chatLinkReady).toBe(true);
    await act(async () => {
      fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'na sala nova' } });
      fireEvent.click(screen.getByTestId('chat-send'));
    });
    const sends = harness.state.pending.filter((request) => request.event === 'client:chatSend');
    expect(sends).toHaveLength(1);
    expect(sends[0]?.payload.roomCode).toBe('ROOMG4');
  });

  it('remoção com reentrada pendente mantém o bloqueio e invalida o envio', async () => {
    await mountRoom();
    await enterRoom('ROOMG5');
    await respondHistory([], false);

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    expect(harness.state.pending.map((request) => request.event)).toEqual(['client:joinRoom']);

    deliver('server:removed', { reason: 'removed', roomCode: 'ROOMG5' });
    expect(api().chatLinkReady).toBe(false);

    let refusal: { ok: boolean } | undefined;
    await act(async () => {
      refusal = await api().sendChat('removido');
    });
    expect(refusal?.ok).toBe(false);
    expect(harness.state.pending.some((request) => request.event === 'client:chatSend')).toBe(false);
  });

  it('reconexão sincroniza o histórico após a reentrada autorizada, sem consulta prematura', async () => {
    await mountRoom();
    await enterRoom('ROOMDD');
    await respondHistory([msg(1, 'mensagem 1'), msg(2, 'mensagem 2')], false);

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    // Só a reentrada está pendente: nenhuma consulta antes do vínculo autorizado.
    expect(harness.state.pending.map((request) => request.event)).toEqual(['client:joinRoom']);

    await respond('client:joinRoom', {
      ok: true,
      roomCode: 'ROOMDD',
      playerId: 'player_anA',
      credential: 'cred_ROOMDD_player_anA',
      rejoined: true,
      version: 7,
    });
    await respondHistory([msg(1, 'mensagem 1'), msg(2, 'mensagem 2'), msg(3, 'mensagem 3')], false);
    expect(renderedSeqs()).toEqual([1, 2, 3]);
  });
});
