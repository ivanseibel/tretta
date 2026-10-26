/**
 * T019E1 — home no visual da mesa.
 *
 * A página mantém as três entradas reais (criar, entrar por código e treinar),
 * associa a ação principal fixa ao formulário e não introduz nenhuma
 * provocação. O transporte é falso; o `RoomProvider` real continua sendo o
 * dono do estado.
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

describe('home no visual da mesa', () => {
  it('apresenta o convite, os oito avatares e as três entradas reais', async () => {
    await mountHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Tretta' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Entre na mesa' })).toBeTruthy();
    expect(screen.getByLabelText('Seu apelido')).toBeTruthy();
    expect(screen.getByLabelText('Código do convite')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Seu avatar' })).toBeTruthy();
    expect(screen.getByTestId('nickname-input').getAttribute('maxlength')).toBe('24');
    expect(screen.getByTestId('room-code-input').getAttribute('maxlength')).toBe('6');
    expect((screen.getByTestId('train-solo-button') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('enter-code-button') as HTMLButtonElement).disabled).toBe(true);

    const avatars = screen.getAllByRole('button', { name: /^Avatar / });
    expect(avatars).toHaveLength(8);
    for (const avatar of avatars) expect(avatar.getAttribute('aria-pressed')).toMatch(/true|false/);
    expect(screen.getByRole('button', { name: 'Avatar Raposa' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('associa a ação principal fixa ao formulário de criação', async () => {
    await mountHome();
    const createButton = screen.getByTestId('create-room-button');
    const formId = createButton.getAttribute('form');
    expect(formId).not.toBeNull();
    expect(document.getElementById(formId ?? '')).toBe(screen.getByRole('form', { name: 'Criar sala' }));
    expect((createButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('cria a sala pelo botão do rodapé, sem mode, com apelido aparado e avatar escolhido', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: '  Ana  ' } });
    fireEvent.click(screen.getByTestId('avatar-option-tucano'));
    expect(screen.getByTestId('avatar-option-tucano').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      fireEvent.click(screen.getByTestId('create-room-button'));
    });

    const requests = createRequests();
    expect(requests).toHaveLength(1);
    const payload = requests[0]?.payload ?? {};
    expect(payload.nickname).toBe('Ana');
    expect(payload.avatar).toBe('tucano');
    expect('mode' in payload).toBe(false);
    expect(harness.state.pushed).toHaveLength(0);

    await respondCreate(created('ROOM01'));
    expect(harness.state.pushed).toEqual(['/sala/ROOM01']);
  });

  it('entra com código normalizado e navega para a sala', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('room-code-input'), { target: { value: 'abc234' } });
    expect((screen.getByTestId('room-code-input') as HTMLInputElement).value).toBe('ABC234');

    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Entrar com código' }));
    });

    expect(harness.state.pushed).toEqual(['/sala/ABC234']);
    expect(createRequests()).toHaveLength(0);
  });

  it('treina sozinho mantendo o mode explícito e o ack antes de navegar', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('train-solo-button'));
    });

    const requests = createRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.payload.mode).toBe('training');
    expect(harness.state.pushed).toHaveLength(0);

    await respondCreate(created('TREI01'));
    expect(harness.state.pushed).toEqual(['/sala/TREI01']);
  });

  it('mostra a falha em alerta e permite fechar sem navegar', async () => {
    await mountHome();
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: 'Ana' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-room-button'));
    });
    await respondCreate({ ok: false, error: { code: 'SERVER_ERROR', message: 'Servidor indisponível.' } });

    expect(screen.getByRole('alert')).toBe(screen.getByTestId('error-banner'));
    expect(screen.getByTestId('error-banner').textContent).toMatch(/Servidor indisponível/);
    expect(harness.state.pushed).toHaveLength(0);

    fireEvent.click(screen.getByTestId('error-dismiss'));
    expect(screen.queryByTestId('error-banner')).toBeNull();
  });

  it('não apresenta provocação nem alvo de humor', async () => {
    await mountHome();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/provoc/i);
    expect(document.querySelector('[data-target-id], [data-player-target]')).toBeNull();
  });
});
