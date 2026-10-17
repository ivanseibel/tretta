/**
 * T010 — comportamento da página da sala durante a retomada (nível interface).
 *
 * A página monta o `RoomProvider` real com transporte falso e navegação dublada:
 * 1. Recarga com identidade guardada mostra "Retomando sua sessão…", nunca o
 *    formulário de entrada nem o erro antigo de "outra aba".
 * 2. Prazo esgotado mostra mensagem neutra com "Tentar novamente" e "Voltar ao
 *    início", preservando a credencial; a retomada explícita converge sem
 *    recarregar.
 * 3. Sem identidade, a entrada normal pelo formulário continua disponível.
 * 4. Desmontar a página cancela a retomada; resposta atrasada não sobrescreve
 *    a identidade guardada.
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

function refusal(code = 'ALREADY_CONNECTED'): unknown {
  return { ok: false, error: { code, message: `recusa ${code}` } };
}

function stateMessage(roomCode: string, playerId: string): StateMessage {
  return {
    room: {
      roomCode,
      status: 'lobby',
      version: 7,
      hostId: playerId,
      roundId: null,
      participants: [
        {
          playerId,
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

async function driveToExhausted(): Promise<void> {
  for (let guard = 0; guard < 40 && screen.queryByTestId('recovery-exhausted') === null; guard++) {
    if (joinRequests().length > 0) await respondJoin(refusal());
    await advance(5_000);
  }
  expect(screen.queryByTestId('recovery-exhausted')).not.toBeNull();
  // Tentativa que ficou em voo no vencimento é abandonada: a resposta dela é
  // inerte (o ciclo já encerrou) e não conta como tentativa do próximo ciclo.
  for (const request of joinRequests()) {
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(request), 1);
      request.callback(okJoin('ROOMP1'));
    });
  }
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

describe('página da sala durante a retomada', () => {
  it('recarga com identidade mostra a retomada e nunca o formulário ou o erro antigo', async () => {
    seedIdentity('ROOMP1');
    await mountPage();

    expect(screen.getByTestId('recovering')).toBeTruthy();
    expect(screen.queryByTestId('join-name-input')).toBeNull();
    expect(screen.queryByTestId('join-room-button')).toBeNull();
    expect(screen.queryByTestId('error-banner')).toBeNull();

    // Recusas temporárias continuam mostrando espera, sem erro nem formulário.
    for (let attempt = 0; attempt < 4; attempt++) {
      await respondJoin(refusal());
      await advance(2_000);
    }
    expect(screen.getByTestId('recovering')).toBeTruthy();
    expect(screen.queryByTestId('join-name-input')).toBeNull();
    expect(screen.queryByTestId('error-banner')).toBeNull();
    expect(screen.queryByText(/já está conectada/i)).toBeNull();
  });

  it('prazo esgotado mostra mensagem neutra e a retomada explícita converge sem recarregar', async () => {
    seedIdentity('ROOMP1');
    await mountPage();
    await driveToExhausted();

    const panel = screen.getByTestId('recovery-exhausted');
    expect(panel.textContent).toMatch(/outra aba ou dispositivo/i);
    expect(screen.getByTestId('retry-recovery-button')).toBeTruthy();
    expect(screen.getByTestId('back-home').getAttribute('href')).toBe('/');
    expect(screen.queryByTestId('join-name-input')).toBeNull();

    // Credencial preservada; retomada explícita parte de novo.
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_ROOMP1');
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-recovery-button'));
    });
    expect(screen.getByTestId('recovering')).toBeTruthy();
    expect(joinRequests()).toHaveLength(1);
    await respondJoin(okJoin('ROOMP1'));

    await act(async () => {
      harness.state.handlers.get('server:state')?.(stateMessage('ROOMP1', 'player_ROOMP1'));
    });
    await respondHistory();
    expect(screen.queryByTestId('recovering')).toBeNull();
    expect(screen.queryByTestId('recovery-exhausted')).toBeNull();
    expect(screen.getByTestId('ready-toggle')).toBeTruthy();
    expect(screen.queryByTestId('join-name-input')).toBeNull();
  });

  it('sem identidade guardada a entrada normal pelo formulário continua', async () => {
    await mountPage();
    expect(screen.getByTestId('join-name-input')).toBeTruthy();
    expect(screen.queryByTestId('recovering')).toBeNull();

    await act(async () => {
      fireEvent.change(screen.getByTestId('join-name-input'), { target: { value: 'Bia' } });
      fireEvent.click(screen.getByTestId('join-room-button'));
    });
    const request = joinRequests()[0];
    expect(request).toBeDefined();
    expect(request?.payload.credential).toBeUndefined();
    await respondJoin({
      ok: true,
      roomCode: 'ROOMP1',
      playerId: 'player_bia',
      credential: 'cred_bia',
      rejoined: false,
      version: 1,
    });
    await act(async () => {
      harness.state.handlers.get('server:state')?.(stateMessage('ROOMP1', 'player_bia'));
    });
    await respondHistory();
    expect(screen.getByTestId('ready-toggle')).toBeTruthy();
  });

  it('desmontar cancela a retomada e resposta atrasada não sobrescreve a identidade', async () => {
    seedIdentity('ROOMP1');
    const view = await mountPage();
    expect(joinRequests()).toHaveLength(1);

    await act(async () => {
      view.unmount();
    });
    await respondJoin(okJoin('ROOMP1', 'cred_atrasada'));
    expect(harness.state.identities.get('ROOMP1')?.credential).toBe('cred_ROOMP1');
    await advance(10_000);
    expect(joinRequests()).toHaveLength(0);
  });
});
