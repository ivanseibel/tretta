/**
 * Regressões do cliente de provocação (T005B):
 * 1. Sem vínculo autorizado o envio não emite nem consome o botão.
 * 2. Ack e broadcast do mesmo evento apresentam um único efeito.
 * 3. Broadcast repetido ou de outra sala não duplica nem contamina.
 * 4. Troca de sala limpa efeitos ativos e invalida o id visto.
 * 5. Recusa do servidor preserva tipo/alvo escolhidos.
 * 6. Efeito morre sozinho após a janela de apresentação.
 * 7. Reentrada na mesma sala preserva ids apresentados (duplicata não
 *    reapresenta; evento novo aparece uma vez).
 * 8. Envio pendente com timeout após reentrada não bloqueia nem mostra erro.
 * 9. Ack antigo de A após trocar para B não altera efeito/erro/controles.
 * 10. Resultado antigo não libera o loading nem substitui o erro da
 *     operação nova; a nova conclui normalmente.
 * 11. Recuperação/remoção limpam efeitos pendentes; sala removida e sala
 *     inexistente não ressuscitam eventos antigos.
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

/** Perda e reentrada autorizada da mesma sala/identidade via ack de join. */
async function recoverSameRoom(code: string): Promise<void> {
  dropConnection();
  harness.state.connected = true;
  await act(async () => {
    harness.state.handlers.get('connect')?.(undefined);
  });
  await respond('client:joinRoom', {
    ok: true,
    roomCode: code,
    playerId: 'player_anA',
    credential: `cred_${code}_player_anA`,
    rejoined: true,
    version: 7,
  });
}

/** Responde o último pendente do evento (para entregar resultado antigo por último). */
async function respondLast(event: string, response: unknown): Promise<PendingRequest> {
  let request: PendingRequest | undefined;
  await act(async () => {
    const matches = harness.state.pending.filter((entry) => entry.event === event);
    const last = matches[matches.length - 1];
    if (last === undefined) throw new Error(`Requisição ausente: ${event}`);
    harness.state.pending.splice(harness.state.pending.lastIndexOf(last), 1);
    last.callback(response);
    request = last;
  });
  if (request === undefined) throw new Error(`Requisição ausente: ${event}`);
  return request;
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

describe('sincronização de provocações', () => {
  it('vínculo pendente bloqueia sendTaunt sem emitir e preserva a escolha', async () => {
    await mountRoom();
    await enterRoom('ROOMT1');

    dropConnection();
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    expect(harness.state.pending.map((request) => request.event)).toEqual(['client:joinRoom']);

    let refusal: { ok: boolean } | undefined;
    await act(async () => {
      refusal = await api().sendTaunt('torta', 'player_biA');
    });
    expect(refusal?.ok).toBe(false);
    expect(harness.state.pending.some((request) => request.event === 'client:tauntSend')).toBe(false);
    const button = screen.getByTestId('taunt-send') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByTestId('taunt-target') as HTMLSelectElement).value).toBe('player_biA');
    expect(renderedTauntIds()).toEqual([]);
  });

  it('ack e broadcast do mesmo id apresentam um único efeito com legenda', async () => {
    await mountRoom();
    await enterRoom('ROOMT2');

    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    const sends = harness.state.pending.filter((request) => request.event === 'client:tauntSend');
    expect(sends).toHaveLength(1);
    expect(sends[0]?.payload.roomCode).toBe('ROOMT2');
    expect(sends[0]?.payload.type).toBe('tomate');
    expect(sends[0]?.payload.targetId).toBe('player_biA');

    const event = taunt('t_1');
    await respond('client:tauntSend', { ok: true, taunt: event });
    broadcastTaunt('ROOMT2', event);
    expect(renderedTauntIds()).toEqual(['t_1']);
    expect(screen.getByText('Ana mandou tomate voador em Bia!').isConnected).toBe(true);
  });

  it('broadcast antes do ack e broadcast repetido continuam com um efeito só', async () => {
    await mountRoom();
    await enterRoom('ROOMT3');

    const event = taunt('t_2');
    broadcastTaunt('ROOMT3', event);
    broadcastTaunt('ROOMT3', event);
    expect(renderedTauntIds()).toEqual(['t_2']);

    await act(async () => {
      void api().sendTaunt('choro', 'player_biA');
    });
    await respond('client:tauntSend', { ok: true, taunt: event });
    expect(renderedTauntIds()).toEqual(['t_2']);
  });

  it('broadcast de outra sala não apresenta efeito', async () => {
    await mountRoom();
    await enterRoom('ROOMT4');

    broadcastTaunt('ROOMXX', taunt('t_fora'));
    expect(renderedTauntIds()).toEqual([]);
  });

  it('troca de sala limpa efeitos ativos e deixa o novo vínculo apresentar de novo', async () => {
    await mountRoom();
    await enterRoom('ROOMT5');
    broadcastTaunt('ROOMT5', taunt('t_3'));
    expect(renderedTauntIds()).toEqual(['t_3']);

    await leaveRoom();
    expect(renderedTauntIds()).toEqual([]);

    await joinRoom('ROOMT6', 'player_biA', 'Bia');
    broadcastTaunt('ROOMT6', taunt('t_3'));
    expect(renderedTauntIds()).toEqual(['t_3']);
  });

  it('recusa do servidor mostra o erro e preserva tipo e alvo escolhidos', async () => {
    await mountRoom();
    await enterRoom('ROOMT7');

    await act(async () => {
      fireEvent.change(screen.getByTestId('taunt-type'), { target: { value: 'risadas' } });
      fireEvent.change(screen.getByTestId('taunt-target'), { target: { value: 'player_biA' } });
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    await respond('client:tauntSend', {
      ok: false,
      error: { code: 'TAUNT_SENDER_COOLDOWN', message: 'Calma um pouco! Você pode provocar de novo em 12s.' },
    });

    expect(screen.getByTestId('taunt-error').textContent).toContain('Calma um pouco');
    expect((screen.getByTestId('taunt-type') as HTMLSelectElement).value).toBe('risadas');
    expect((screen.getByTestId('taunt-target') as HTMLSelectElement).value).toBe('player_biA');
    expect(renderedTauntIds()).toEqual([]);
  });

  it('efeito some sozinho após a janela de apresentação', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMT8');

    broadcastTaunt('ROOMT8', taunt('t_4'));
    expect(renderedTauntIds()).toEqual(['t_4']);

    await act(async () => {
      vi.advanceTimersByTime(3201);
    });
    expect(renderedTauntIds()).toEqual([]);
  });
});

describe('recuperação do vínculo e isolamento de operações', () => {
  it('reentrada na mesma sala preserva ids apresentados; duplicata não reapresenta e evento novo aparece uma vez', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOMT9');

    const old = taunt('t_old');
    broadcastTaunt('ROOMT9', old);
    expect(renderedTauntIds()).toEqual(['t_old']);
    await act(async () => {
      vi.advanceTimersByTime(3201);
    });
    expect(renderedTauntIds()).toEqual([]);

    await recoverSameRoom('ROOMT9');
    expect(api().chatLinkReady).toBe(true);
    expect(renderedTauntIds()).toEqual([]);

    broadcastTaunt('ROOMT9', old);
    expect(renderedTauntIds()).toEqual([]);

    const fresh = taunt('t_new');
    broadcastTaunt('ROOMT9', fresh);
    broadcastTaunt('ROOMT9', fresh);
    expect(renderedTauntIds()).toEqual(['t_new']);
  });

  it('envio pendente com timeout após reentrada libera o botão e não mostra erro', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOM10');

    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    expect(harness.state.pending.filter((request) => request.event === 'client:tauntSend')).toHaveLength(1);

    await recoverSameRoom('ROOM10');
    expect(api().chatLinkReady).toBe(true);
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(false);

    // Sem ack da conexão perdida: o emitWithAck antigo resolve pelo timeout.
    await act(async () => {
      vi.advanceTimersByTime(6001);
    });
    expect(screen.queryByTestId('taunt-error')).toBeNull();
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('ack antigo de A após trocar para B não apresenta efeito nem erro em B', async () => {
    await mountRoom();
    await enterRoom('ROOM11');

    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    await leaveRoom();
    await joinRoom('ROOM12', 'player_biA', 'Bia');

    await respond('client:tauntSend', { ok: true, taunt: taunt('t_old_ack') });
    expect(renderedTauntIds()).toEqual([]);
    expect(screen.queryByTestId('taunt-error')).toBeNull();
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('resultado antigo não libera o loading nem toca no erro da operação nova', async () => {
    await mountRoom();
    await enterRoom('ROOM13');

    // Envio 1 fica pendente; a reentrada invalida a operação antiga.
    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    await recoverSameRoom('ROOM13');

    // Operação nova em voo; o resultado antigo chega primeiro.
    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    expect(harness.state.pending.filter((request) => request.event === 'client:tauntSend')).toHaveLength(2);
    await respond('client:tauntSend', { ok: true, taunt: taunt('t_from_old') });
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('taunt-error')).toBeNull();
    expect(renderedTauntIds()).toEqual([]);

    // A operação nova conclui com recusa legítima e mostra o próprio erro.
    await respond('client:tauntSend', {
      ok: false,
      error: { code: 'TAUNT_SENDER_COOLDOWN', message: 'Calma um pouco! Você pode provocar de novo em 12s.' },
    });
    expect(screen.getByTestId('taunt-error').textContent).toContain('Calma um pouco');
    expect((screen.getByTestId('taunt-type') as HTMLSelectElement).value).toBe('tomate');
    expect((screen.getByTestId('taunt-target') as HTMLSelectElement).value).toBe('player_biA');
    expect(renderedTauntIds()).toEqual([]);
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('resultado antigo que chega depois não substitui nem limpa o erro da operação nova', async () => {
    await mountRoom();
    await enterRoom('ROOM15');

    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });
    await recoverSameRoom('ROOM15');
    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });

    // A operação nova conclui primeiro, com recusa; erro novo fica no painel.
    await respondLast('client:tauntSend', {
      ok: false,
      error: { code: 'TAUNT_TARGET_LIMIT', message: 'Essa pessoa já levou três provocações neste minuto.' },
    });
    expect(screen.getByTestId('taunt-error').textContent).toContain('três provocações');

    // O resultado antigo (sucesso com efeito) chega por último: nada muda.
    await respond('client:tauntSend', { ok: true, taunt: taunt('t_late_old') });
    expect(screen.getByTestId('taunt-error').textContent).toContain('três provocações');
    expect(renderedTauntIds()).toEqual([]);
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(false);
  });

  it('recuperação e remoção limpam efeitos pendentes e sala inexistente não ressuscita eventos', async () => {
    vi.useFakeTimers();
    await mountRoom();
    await enterRoom('ROOM14');

    broadcastTaunt('ROOM14', taunt('t_pend'));
    expect(renderedTauntIds()).toEqual(['t_pend']);

    // Envio fica pendente antes das mudanças de vínculo.
    await act(async () => {
      fireEvent.click(screen.getByTestId('taunt-send'));
    });

    // Recuperação do vínculo: efeito em tela some, mas o id segue protegido.
    await recoverSameRoom('ROOM14');
    expect(renderedTauntIds()).toEqual([]);
    broadcastTaunt('ROOM14', taunt('t_pend'));
    expect(renderedTauntIds()).toEqual([]);

    // Remoção: efeitos zerados e broadcasts da sala antiga não ressuscitam.
    deliver('server:removed', { reason: 'removed' });
    expect(renderedTauntIds()).toEqual([]);
    broadcastTaunt('ROOM14', taunt('t_pend'));
    expect(renderedTauntIds()).toEqual([]);

    // Reentrada em sala inexistente invalida o envio antigo sem efeito nem erro.
    await act(async () => {
      void api().rejoin('ROOM14');
    });
    await respond('client:joinRoom', {
      ok: false,
      error: { code: 'ROOM_NOT_FOUND', message: 'Sala não encontrada.' },
    });
    expect(api().roomGone).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(6001);
    });
    expect(screen.queryByTestId('taunt-error')).toBeNull();
    expect(renderedTauntIds()).toEqual([]);
  });
});
