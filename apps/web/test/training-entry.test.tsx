/**
 * T011B — recusa definitiva da mesa de treino (nível interface).
 *
 * A página monta o `RoomProvider` real com transporte falso:
 * 1. Recusas ALREADY_CONNECTED continuam transitórias: a retomada segue e
 *    converge, exatamente como nas salas comuns.
 * 2. Com credencial guardada, TRAINING_ROOM_ENTRY_REFUSED mostra a recusa
 *    definitiva sem ciclo automático novo e sem tocar a identidade.
 * 3. Sem credencial, o formulário é substituído pela recusa; nada é criado
 *    (nem identidade local, nem vínculo) e nada se repete sozinho.
 * 4. Identidade guardada de outro contexto fica intacta (isolada).
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

function joinRequests(): PendingRequest[] {
  return harness.state.pending.filter((request) => request.event === 'client:joinRoom');
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
      mode: 'training',
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

async function respondJoin(response: unknown): Promise<PendingRequest> {
  let request: PendingRequest | undefined;
  await act(async () => {
    const requests = joinRequests();
    request = requests[0];
    if (request === undefined) throw new Error('Nenhuma requisição client:joinRoom pendente.');
    harness.state.pending.splice(harness.state.pending.indexOf(request), 1);
    request.callback(response);
  });
  if (request === undefined) throw new Error('Nenhuma requisição client:joinRoom pendente.');
  return request;
}

async function respondHistory(): Promise<void> {
  await act(async () => {
    const index = harness.state.pending.findIndex((request) => request.event === 'client:chatHistory');
    if (index === -1) return;
    const [request] = harness.state.pending.splice(index, 1);
    request?.callback({ ok: true, messages: [], hasMore: false });
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
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

describe('recusa da mesa de treino na página da sala', () => {
  it('ALREADY_CONNECTED segue transitória e a retomada converge', async () => {
    seedIdentity('ROOMP1');
    await mountPage();

    await respondJoin(refusal('ALREADY_CONNECTED'));
    await advance(2_000);
    expect(screen.getByTestId('recovering')).toBeTruthy();
    expect(screen.queryByTestId('training-entry-refused')).toBeNull();
    expect(screen.queryByText(/já está conectada/i)).toBeNull();

    await respondJoin(okJoin('ROOMP1'));
    await act(async () => {
      harness.state.handlers.get('server:state')?.(stateMessage('ROOMP1', 'player_ROOMP1'));
    });
    await respondHistory();
    expect(screen.getByTestId('ready-toggle')).toBeTruthy();
    expect(screen.queryByTestId('training-entry-refused')).toBeNull();
  });

  it('TRAINING_ROOM_ENTRY_REFUSED com credencial guardada é definitiva e preserva a identidade', async () => {
    seedIdentity('ROOMP1');
    await mountPage();
    expect(screen.getByTestId('recovering')).toBeTruthy();

    await respondJoin(refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    const panel = screen.getByTestId('training-entry-refused');
    expect(panel.textContent).toMatch(/individual/i);
    expect(panel.textContent).toMatch(/bots/);
    expect(screen.getByTestId('back-home').getAttribute('href')).toBe('/');
    expect(screen.queryByTestId('recovering')).toBeNull();
    expect(screen.queryByTestId('join-name-input')).toBeNull();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_ROOMP1');

    // Nenhum ciclo automático novo e nenhuma troca/limpeza de credencial.
    await advance(30_000);
    expect(joinRequests()).toHaveLength(0);
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_ROOMP1');
  });

  it('sem credencial, o formulário cai na recusa e nada é criado nem repetido', async () => {
    await mountPage();
    expect(screen.getByTestId('join-name-input')).toBeTruthy();

    await act(async () => {
      fireEvent.change(screen.getByTestId('join-name-input'), { target: { value: 'Bia' } });
      fireEvent.click(screen.getByTestId('join-room-button'));
    });
    const request = joinRequests()[0];
    expect(request).toBeDefined();
    expect(request?.payload.credential).toBeUndefined();

    await respondJoin(refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.getByTestId('training-entry-refused')).toBeTruthy();
    expect(screen.queryByTestId('join-name-input')).toBeNull();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(harness.state.identities.size).toBe(0);

    await advance(30_000);
    expect(joinRequests()).toHaveLength(0);
    expect(harness.state.identities.size).toBe(0);
  });

  it('identidade de outro contexto fica isolada e não é substituída', async () => {
    seedIdentity('ROOMP1', 'cred_falsa');
    await mountPage();

    const request = joinRequests()[0];
    expect(request?.payload.credential).toBe('cred_falsa');

    await respondJoin(refusal('TRAINING_ROOM_ENTRY_REFUSED'));
    expect(screen.getByTestId('training-entry-refused')).toBeTruthy();
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_falsa');

    await advance(30_000);
    expect(joinRequests()).toHaveLength(0);
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_falsa');
  });
});
