/**
 * T011B-ajustes — entrada manual presa ao contexto que a originou.
 *
 * Reproduz o achado R1 da validação com o `RoomProvider` real e páginas reais:
 * 1. Recusa atrasada de A não toca o formulário de B (não depende de reordenar acks).
 * 2. Recusa atrasada de A não oculta o lobby de B já autorizado.
 * 3. Sair e voltar ao MESMO código com tentativa nova: a resposta antiga não
 *    interfere (painel, busy/erro e identidade) e a tentativa nova segue valendo.
 * 4. Sucesso atrasado de tentativa antiga não cria vínculo nem identidade.
 * 5. Sucesso de transporte que caiu não confirma vínculo novo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { StateMessage } from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider } from '@/app/providers';
import RoomPage from '../app/sala/[code]/page';

interface PendingRequest {
  event: string;
  payload: Record<string, unknown>;
  callback: (response: unknown) => void;
}

const harness = vi.hoisted(() => {
  const state = {
    connected: true,
    code: 'ROOMP1',
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
    connect(): void;
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
    connect(): void {},
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

vi.mock('next/navigation', () => ({
  useParams: () => ({ code: harness.state.code }),
  usePathname: () => `/sala/${harness.state.code}`,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }): ReactNode => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function seedIdentity(code: string, credential = `cred_${code}`): StoredIdentity {
  const identity: StoredIdentity = {
    playerId: `player_${code}`,
    credential,
    nickname: 'Ana',
    avatar: 'raposa',
  };
  harness.state.identities.set(code, identity);
  return identity;
}

function joinRequestsFor(code: string): PendingRequest[] {
  return harness.state.pending.filter((request) => request.event === 'client:joinRoom' && request.payload.roomCode === code);
}

function requireJoin(code: string): PendingRequest {
  const request = joinRequestsFor(code)[0];
  if (request === undefined) throw new Error(`Sem client:joinRoom pendente para ${code}.`);
  return request;
}

async function submitJoin(nickname: string): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByTestId('join-name-input'), { target: { value: nickname } });
    fireEvent.click(screen.getByTestId('join-room-button'));
  });
}

async function deliver(request: PendingRequest, response: unknown): Promise<void> {
  await act(async () => {
    const index = harness.state.pending.indexOf(request);
    if (index === -1) throw new Error('Requisição já entregue.');
    harness.state.pending.splice(index, 1);
    request.callback(response);
  });
}

async function respondHistory(): Promise<void> {
  await act(async () => {
    const index = harness.state.pending.findIndex((request) => request.event === 'client:chatHistory');
    if (index === -1) return;
    const [request] = harness.state.pending.splice(index, 1);
    request?.callback({ ok: true, messages: [], hasMore: false });
  });
}

function okJoin(code: string, credential = `cred_${code}`): unknown {
  return {
    ok: true,
    roomCode: code,
    playerId: `player_${code}`,
    credential,
    rejoined: true,
    version: 7,
  };
}

function refusal(code: string): unknown {
  return { ok: false, error: { code, message: `recusa ${code}` } };
}

function stateMessage(roomCode: string, playerId: string): StateMessage {
  return {
    room: {
      roomCode,
      mode: 'classic',
      status: 'lobby',
      version: 7,
      hostId: playerId,
      roundId: null,
      participants: [
        {
          id: playerId,
          kind: 'human',
          nickname: 'Ana',
          avatar: 'raposa',
          connected: true,
          inRound: false,
          ready: false,
          isHost: true,
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

async function mountPage(): Promise<ReturnType<typeof render>> {
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(
      <RoomProvider>
        <RoomPage />
      </RoomProvider>,
    );
    await Promise.resolve();
  });
  if (view === undefined) throw new Error('página não montou.');
  return view;
}

async function navigateTo(view: ReturnType<typeof render>, code: string, key: string): Promise<void> {
  harness.state.code = code;
  await act(async () => {
    view.rerender(
      <RoomProvider>
        <RoomPage key={key} />
      </RoomProvider>,
    );
    await Promise.resolve();
  });
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.code = 'ROOMP1';
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  harness.state.nonce = 0;
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('entrada manual presa ao contexto da tentativa', () => {
  it('ignora recusa tardia de A após trocar para o formulário de B', async () => {
    const view = await mountPage();
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    await submitJoin('Bia');
    const oldJoin = requireJoin('ROOMP1');

    await navigateTo(view, 'ROOMP2', 'ROOMP2');
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(joinRequestsFor('ROOMP2')).toHaveLength(0);

    await deliver(oldJoin, refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.queryByTestId('training-entry-refused')).toBeNull();
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(harness.state.identities.size).toBe(0);
    expect(screen.queryByTestId('error-banner')).toBeNull();

    // O busy do formulário de A não fica preso no contexto novo.
    await act(async () => {
      fireEvent.change(screen.getByTestId('join-name-input'), { target: { value: 'Bia' } });
    });
    expect((screen.getByTestId('join-room-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignora recusa tardia de A após trocar para sala B já autorizada', async () => {
    const view = await mountPage();
    await submitJoin('Bia');
    const oldJoin = requireJoin('ROOMP1');

    seedIdentity('ROOMP2');
    await navigateTo(view, 'ROOMP2', 'ROOMP2');
    const nextJoin = joinRequestsFor('ROOMP2')[0];
    if (nextJoin === undefined) throw new Error('Sem recuperação da segunda sala');
    await deliver(nextJoin, okJoin('ROOMP2'));
    await act(async () => {
      harness.state.handlers.get('server:state')?.(stateMessage('ROOMP2', 'player_ROOMP2'));
    });
    await respondHistory();
    expect(screen.getByTestId('ready-toggle')).toBeTruthy();

    await deliver(oldJoin, refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.queryByTestId('training-entry-refused')).toBeNull();
    expect(screen.getByTestId('ready-toggle')).toBeTruthy();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(harness.state.identities.get('ROOMP2')?.credential).toBe('cred_ROOMP2');
    expect(harness.state.identities.get('ROOMP1')).toBeUndefined();
  });

  it('sair e voltar ao mesmo código: resposta antiga não interfere na tentativa nova', async () => {
    const view = await mountPage();
    await submitJoin('Bia');
    const oldJoin = requireJoin('ROOMP1');

    await navigateTo(view, 'ROOMP2', 'away');
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    await navigateTo(view, 'ROOMP1', 'back');
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    await submitJoin('Bia');

    const newJoin = joinRequestsFor('ROOMP1').find((request) => request !== oldJoin);
    if (newJoin === undefined) throw new Error('Sem tentativa nova no mesmo código');
    expect((screen.getByTestId('join-room-button') as HTMLButtonElement).disabled).toBe(true);

    // Resposta da tentativa antiga: nada muda — nem painel, nem busy/erro, nem identidade.
    await deliver(oldJoin, refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.queryByTestId('training-entry-refused')).toBeNull();
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(harness.state.identities.size).toBe(0);
    expect((screen.getByTestId('join-room-button') as HTMLButtonElement).disabled).toBe(true);

    // A tentativa nova segue valendo: a recusa real dela é definitiva.
    await deliver(newJoin, refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.getByTestId('training-entry-refused')).toBeTruthy();
    expect(harness.state.identities.size).toBe(0);
  });

  it('sucesso atrasado de tentativa antiga não cria vínculo nem identidade', async () => {
    const view = await mountPage();
    await submitJoin('Bia');
    const oldJoin = requireJoin('ROOMP1');

    await navigateTo(view, 'ROOMP2', 'away');
    await navigateTo(view, 'ROOMP1', 'back');
    await submitJoin('Bia');
    const newJoin = joinRequestsFor('ROOMP1').find((request) => request !== oldJoin);
    if (newJoin === undefined) throw new Error('Sem tentativa nova no mesmo código');

    await deliver(oldJoin, okJoin('ROOMP1', 'cred_antiga'));
    expect(harness.state.identities.size).toBe(0);
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(screen.queryByTestId('ready-toggle')).toBeNull();

    await deliver(newJoin, refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.getByTestId('training-entry-refused')).toBeTruthy();
    expect(harness.state.identities.size).toBe(0);
  });

  it('sucesso de transporte caído não confirma vínculo nem identidade', async () => {
    await mountPage();
    await submitJoin('Bia');
    const attempt = requireJoin('ROOMP1');

    harness.state.connected = false;
    await act(async () => {
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    await deliver(attempt, okJoin('ROOMP1', 'cred_nova'));
    expect(harness.state.identities.size).toBe(0);
    expect(screen.queryByTestId('ready-toggle')).toBeNull();

    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(harness.state.identities.size).toBe(0);
  });
});
