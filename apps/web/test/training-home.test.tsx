/**
 * T011B — entrada pela home: o payload clássico continua implícito (sem `mode`)
 * e o treino é explícito (`mode: 'training'`); clique pendente não emite outra
 * criação nem navega antes do ack; falha mostra banner e não navega.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider } from '@/app/providers';
import HomePage from '../app/page';

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
    pushed: [] as string[],
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
  useParams: () => ({}),
  usePathname: () => '/',
  useRouter: () => ({
    push: (href: string): void => {
      harness.state.pushed.push(href);
    },
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

function createRequests(): PendingRequest[] {
  return harness.state.pending.filter((request) => request.event === 'client:createRoom');
}

async function respondCreate(response: unknown): Promise<void> {
  await act(async () => {
    const [request] = harness.state.pending.splice(
      harness.state.pending.findIndex((pending) => pending.event === 'client:createRoom'),
      1,
    );
    if (request === undefined) throw new Error('Nenhuma requisição client:createRoom pendente.');
    request.callback(response);
  });
}

function created(code: string): unknown {
  return { ok: true, roomCode: code, playerId: `player_${code}`, credential: `cred_${code}`, version: 1 };
}

async function mountHome(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <HomePage />
      </RoomProvider>,
    );
    await Promise.resolve();
  });
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  harness.state.nonce = 0;
  harness.state.pushed.length = 0;
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('entrada pela home da mesa de treino', () => {
  it('criar sala comum envia o payload clássico sem mode e navega após o ack', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-room-button'));
    });

    const requests = createRequests();
    expect(requests).toHaveLength(1);
    const payload = requests[0]?.payload ?? {};
    expect('mode' in payload).toBe(false);
    expect(payload.nickname).toBe('Ana');
    expect(harness.state.pushed).toHaveLength(0);

    await respondCreate(created('ROOM01'));
    expect(harness.state.pushed).toEqual(['/sala/ROOM01']);
  });

  it('treinar sozinho envia mode: training explicitamente', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('train-solo-button'));
    });

    const requests = createRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.payload.mode).toBe('training');

    await respondCreate(created('TREI01'));
    expect(harness.state.pushed).toEqual(['/sala/TREI01']);
  });

  it('clique pendente não emite outra criação nem navega antes do ack', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('train-solo-button'));
      fireEvent.click(screen.getByTestId('train-solo-button'));
    });

    expect(createRequests()).toHaveLength(1);
    expect(harness.state.pushed).toHaveLength(0);

    await respondCreate(created('TREI01'));
    expect(harness.state.pushed).toEqual(['/sala/TREI01']);
  });

  it('falha na criação mostra o banner e não navega', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('train-solo-button'));
    });

    await respondCreate({ ok: false, error: { code: 'SERVER_ERROR', message: 'Servidor indisponível.' } });
    expect(screen.getByTestId('error-banner').textContent).toMatch(/Servidor indisponível/);
    expect(harness.state.pushed).toHaveLength(0);
    expect(createRequests()).toHaveLength(0);
  });
});
