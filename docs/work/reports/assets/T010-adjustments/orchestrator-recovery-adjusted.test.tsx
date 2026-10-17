/**
 * T010 — recuperação com espera limitada da identidade existente (nível provisão).
 *
 * CÓPIA AJUSTADA do runner do orquestrador (T010-validation), necessária para a
 * entrega dos ajustes pós-validação. Diferenças em relação ao original:
 *  a) teste 2 (prazo esgotado): ao vencer, o ciclo novo abandona a tentativa
 *     que estava em voo — o fake mantém a requisição na lista e ela não pode
 *     contar como tentativa do retry. O teste drena a tentativa abandonada
 *     (resposta tardia inerte) antes de aferir o novo ciclo. Mesmo ajuste do
 *     teste equivalente da suíte permanente (recovery-wait.test.tsx).
 *  b) teste 3 (ack além do timeout local): o fake original respondia
 *     `ALREADY_IN_ROOM` ao reenvio da MESMA intenção, mas o servidor real
 *     memoriza a resposta por (socket, intentId, assinatura) e devolve o
 *     sucesso memorizado — `ALREADY_IN_ROOM` só aparece para socket já
 *     vinculado antes do primeiro join. O teste passa a modelar o replay e a
 *     aferir que o reenvio usa o MESMO payload (dedupe do servidor).
 *
 * Regressões cobertas:
 * 1. Recusa temporária (`ALREADY_CONNECTED`) não esgota em ~1,2 s nem virá erro:
 *    o ciclo espera com backoff, tenta de novo com `intentId` novo e converge.
 * 2. O ciclo tem prazo máximo efetivo (60 s) e para; a retomada explícita
 *    inicia novo ciclo, com a credencial preservada.
 * 3. Falha de transporte não vira credencial inválida; a espera continua.
 * 4. Disparos concorrentes (página, `connect`, chamada manual) são coalescidos
 *    num único laço — sem tentativas sobrepostas.
 * 5. Cancelamento (saída/mudança de contexto) descarta respostas atrasadas.
 * 6. `joinRoom` sem credencial com identidade guardada não sobrescreve a
 *    identidade da sala (teste também pela API direta).
 * 7. Comandos mutáveis ficam bloqueados (`LINK_PENDING`) até o ack autorizado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ClientCommand } from '@tretta/protocol';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RejoinResult, type RoomContextValue } from '@/app/providers';

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

let latest: RoomContextValue | null = null;

function Probe(): ReactNode {
  latest = useRoom();
  return null;
}

function api(): RoomContextValue {
  if (latest === null) throw new Error('RoomProvider não montado.');
  return latest;
}

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

function pendingEvents(): string[] {
  return harness.state.pending.map((request) => request.event);
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

async function mount(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <Probe />
      </RoomProvider>,
    );
    await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startRecovery(code: string): Promise<{ promise: Promise<RejoinResult>; result: { value?: RejoinResult } }> {
  const result: { value?: RejoinResult } = {};
  let promise: Promise<RejoinResult> | undefined;
  await act(async () => {
    promise = api().rejoin(code);
    void promise.then((value) => {
      result.value = value;
    });
  });
  if (promise === undefined) throw new Error('rejoin não retornou promessa.');
  return { promise, result };
}

beforeEach(() => {
  harness.state.connected = true;
  harness.state.pending.length = 0;
  harness.state.handlers.clear();
  harness.state.onceHandlers.clear();
  harness.state.identities.clear();
  harness.state.nonce = 0;
  window.localStorage.clear();
  latest = null;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  latest = null;
  vi.useRealTimers();
});

describe('recuperação com espera limitada', () => {
  it('recusa temporária espera com backoff, segue tentando e converge sem erro', async () => {
    seedIdentity('ROOMR1');
    await mount();
    const { promise, result } = await startRecovery('ROOMR1');

    // Primeira tentativa imediata, com a credencial guardada.
    expect(joinRequests()).toHaveLength(1);
    const intents = new Set<string>();
    intents.add(String(joinRequests()[0]?.payload.intentId));
    await respondJoin(refusal());
    expect(api().recoveryPhase).toBe('recovering');
    expect(api().error).toBeNull();
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);

    // Backoff inicial: nada antes de 500 ms; nova tentativa logo depois.
    await advance(499);
    expect(joinRequests()).toHaveLength(0);
    await advance(1);
    expect(joinRequests()).toHaveLength(1);
    intents.add(String(joinRequests()[0]?.payload.intentId));
    await respondJoin(refusal());

    // Quatro recusas (o limite antigo de ~1,2 s) não encerram o ciclo.
    for (let attempt = 0; attempt < 2; attempt++) {
      await advance(2_000);
      const [request] = joinRequests();
      expect(request).toBeDefined();
      intents.add(String(request?.payload.intentId));
      await respondJoin(refusal());
    }
    expect(api().recoveryPhase).toBe('recovering');
    expect(api().error).toBeNull();
    expect(joinRequests()).toHaveLength(0);

    // Cada tentativa usou um intentId novo.
    expect(intents.size).toBe(4);

    await advance(2_000);
    await respondJoin(okJoin('ROOMR1'));
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('ok');
    expect(api().chatLinkReady).toBe(true);
    expect(api().interactive).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
    expect(api().error).toBeNull();
    expect(harness.state.identities.get('ROOMR1')?.credential).toBe('cred_ROOMR1');
  });

  it('esgota o prazo de 60 s, para de tentar e a retomada explícita reinicia o ciclo', async () => {
    seedIdentity('ROOMR2');
    await mount();
    const { promise, result } = await startRecovery('ROOMR2');

    let attempts = 0;
    const intents = new Set<string>();
    for (let guard = 0; guard < 40 && api().recoveryPhase !== 'exhausted'; guard++) {
      const [request] = joinRequests();
      if (request === undefined) {
        await advance(5_000);
        continue;
      }
      intents.add(String(request.payload.intentId));
      attempts += 1;
      await respondJoin(refusal());
      await advance(5_000);
    }
    expect(api().recoveryPhase).toBe('exhausted');
    // Tentativa que ficou em voo no vencimento é abandonada: a resposta que
    // chega depois do prazo não habilita vínculo nem sobrescreve a identidade
    // (sem isso a tentativa abandonada contaria como tentativa do retry).
    const inFlight = joinRequests();
    expect(inFlight.length).toBeLessThanOrEqual(1);
    for (const request of inFlight) {
      await act(async () => {
        harness.state.pending.splice(harness.state.pending.indexOf(request), 1);
        request.callback(okJoin('ROOMR2', 'cred_tardia'));
      });
    }
    expect(api().error).toBeNull();
    expect(api().chatLinkReady).toBe(false);
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('deadline');
    expect(intents.size).toBe(attempts);

    // Depois do prazo nenhuma tentativa nova parte sozinha.
    await advance(30_000);
    expect(joinRequests()).toHaveLength(0);
    expect(api().recoveryPhase).toBe('exhausted');

    // Entrada nova sem credencial segue bloqueada enquanto o prazo está esgotado.
    let blocked: boolean | undefined;
    await act(async () => {
      blocked = await api().joinRoom('ROOMR2', 'Nova', 'raposa');
    });
    expect(blocked).toBe(false);
    expect(joinRequests()).toHaveLength(0);

    // Retomada explícita: novo ciclo, nova tentativa, credencial preservada.
    await act(async () => {
      void api().retryRecovery('ROOMR2');
    });
    expect(api().recoveryPhase).toBe('recovering');
    expect(joinRequests()).toHaveLength(1);
    await respondJoin(okJoin('ROOMR2'));
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
    expect(harness.state.identities.get('ROOMR2')?.credential).toBe('cred_ROOMR2');
  });

  it('transporte fora não é credencial inválida: a espera continua até o vínculo voltar', async () => {
    seedIdentity('ROOMR3');
    harness.state.connected = false;
    await mount();
    const { promise, result } = await startRecovery('ROOMR3');

    expect(api().recoveryPhase).toBe('recovering');
    expect(joinRequests()).toHaveLength(0);
    await advance(1_000);
    expect(joinRequests()).toHaveLength(0);
    expect(harness.state.identities.get('ROOMR3')?.credential).toBe('cred_ROOMR3');

    harness.state.connected = true;
    await advance(1_000);
    expect(joinRequests()).toHaveLength(1);
    await respondJoin(okJoin('ROOMR3'));
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('ok');
    expect(api().chatLinkReady).toBe(true);
  });

  it('disparos concorrentes (página, connect e chamada direta) não criam laços sobrepostos', async () => {
    await mount();
    // Sala já vinculada cai e volta: o connect dispara a recuperação.
    await act(async () => {
      const created = api().createRoom('Ana', 'raposa');
      const index = harness.state.pending.findIndex((request) => request.event === 'client:createRoom');
      const [request] = harness.state.pending.splice(index, 1);
      request?.callback({
        ok: true,
        roomCode: 'ROOMR4',
        playerId: 'player_anA',
        credential: 'cred_anA',
        version: 1,
      });
      await created;
    });
    expect(api().chatLinkReady).toBe(true);

    harness.state.connected = false;
    await act(async () => {
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
      // Chamadas concorrentes: o efeito da página e a API direta.
      void api().rejoin('ROOMR4');
      void api().rejoin('ROOMR4');
      await Promise.resolve();
    });
    expect(joinRequests()).toHaveLength(1);

    await respondJoin(refusal());
    expect(api().error).toBeNull();
    await advance(2_000);
    expect(joinRequests()).toHaveLength(1);
    await respondJoin(okJoin('ROOMR4', 'cred_anA'));
    expect(api().chatLinkReady).toBe(true);
  });

  it('credencial inválida é definitiva: limpa a identidade e não tenta de novo', async () => {
    seedIdentity('ROOMR5');
    await mount();
    const { promise, result } = await startRecovery('ROOMR5');

    await respondJoin(refusal('CREDENTIAL_INVALID'));
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('invalid');
    expect(harness.state.identities.has('ROOMR5')).toBe(false);
    expect(api().recoveryPhase).toBe('idle');
    await advance(10_000);
    expect(joinRequests()).toHaveLength(0);
  });

  it('joinRoom sem credencial durante a retomada pendente não sobrescreve nem emite', async () => {
    seedIdentity('ROOMR6', 'cred_guardada');
    await mount();
    void api().rejoin('ROOMR6');
    await act(async () => {
      await Promise.resolve();
    });
    expect(joinRequests()).toHaveLength(1);

    let joined: boolean | undefined;
    await act(async () => {
      joined = await api().joinRoom('ROOMR6', 'Nova', 'raposa');
    });
    expect(joined).toBe(false);
    expect(joinRequests()).toHaveLength(1);
    expect(api().error).toContain('retomada');
    expect(harness.state.identities.get('ROOMR6')?.credential).toBe('cred_guardada');
    expect(harness.state.identities.get('ROOMR6')?.nickname).toBe('Ana');
  });

  it('comandos mutáveis ficam bloqueados até o ack autorizado da retomada', async () => {
    seedIdentity('ROOMR7');
    await mount();
    void api().rejoin('ROOMR7');
    await act(async () => {
      await Promise.resolve();
    });
    expect(joinRequests()).toHaveLength(1);

    await act(async () => {
      void api().setReady(true);
    });
    expect(pendingEvents()).not.toContain('client:setReady');

    let substituteAck: { ok: boolean; error?: { code: string } } | undefined;
    await act(async () => {
      substituteAck = (await api().substituteAbsent('player_x')) as { ok: boolean; error?: { code: string } };
    });
    expect(substituteAck?.ok).toBe(false);
    expect(substituteAck?.error?.code).toBe('LINK_PENDING');

    let commandAck: { ok: boolean; error?: { code: string } } | undefined;
    await act(async () => {
      commandAck = (await api().sendCommand({ type: 'draw' } satisfies ClientCommand)) as {
        ok: boolean;
        error?: { code: string };
      };
    });
    expect(commandAck?.ok).toBe(false);
    expect(commandAck?.error?.code).toBe('LINK_PENDING');
    expect(pendingEvents()).not.toContain('client:substituteAbsent');
    expect(pendingEvents()).not.toContain('client:command');

    await respondJoin(okJoin('ROOMR7'));
    expect(api().chatLinkReady).toBe(true);
    await act(async () => {
      void api().setReady(true);
    });
    expect(pendingEvents()).toContain('client:setReady');
  });

  it('cancelamento descarta resposta atrasada e preserva a credencial', async () => {
    seedIdentity('ROOMR8');
    await mount();
    void api().rejoin('ROOMR8');
    await act(async () => {
      await Promise.resolve();
    });
    expect(joinRequests()).toHaveLength(1);

    await act(async () => {
      api().cancelRecovery();
    });
    expect(api().recoveryPhase).toBe('idle');

    await respondJoin(okJoin('ROOMR8', 'cred_do_ack_atrasado'));
    expect(api().chatLinkReady).toBe(false);
    expect(api().state).toBeNull();
    expect(harness.state.identities.get('ROOMR8')?.credential).toBe('cred_ROOMR8');
  });

  it('saída voluntária da mesma janela não dispara retomada automática', async () => {
    await mount();
    await act(async () => {
      const created = api().createRoom('Ana', 'raposa');
      const index = harness.state.pending.findIndex((request) => request.event === 'client:createRoom');
      const [, request] = [index, harness.state.pending.splice(index, 1)[0]];
      request?.callback({
        ok: true,
        roomCode: 'ROOMR9',
        playerId: 'player_anA',
        credential: 'cred_anA',
        version: 1,
      });
      await created;
    });
    await act(async () => {
      const leaving = api().leaveRoom();
      const index = harness.state.pending.findIndex((request) => request.event === 'client:leaveRoom');
      const request = harness.state.pending.splice(index, 1)[0];
      request?.callback({ ok: true, version: 2 });
      await leaving;
    });

    const { result } = await startRecovery('ROOMR9');
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.value).toBe('none');
    expect(joinRequests()).toHaveLength(0);
  });
});


describe('orquestrador: limites de recuperação', () => {
  it('encerra o ciclo em 60 s mesmo com um ack em voo', async () => {
    seedIdentity('ROOMD1');
    await mount();
    const startedAt = Date.now();
    const { result } = await startRecovery('ROOMD1');
    let lastSendAt = Date.now();
    for (let guard = 0; guard < 700; guard++) {
      if (joinRequests().length > 0) {
        lastSendAt = Date.now();
        if (lastSendAt - startedAt >= 57000) break;
        await respondJoin(refusal());
      }
      await advance(100);
    }
    expect(joinRequests()).toHaveLength(1);
    expect(lastSendAt - startedAt).toBeGreaterThanOrEqual(57000);
    await advance(60000 - (Date.now() - startedAt));
    expect(api().recoveryPhase).toBe('exhausted');
    expect(result.value).toBe('deadline');
  });

  it('não autoriza ack de um transporte que desconectou antes da resposta', async () => {
    seedIdentity('ROOMD2');
    await mount();
    await startRecovery('ROOMD2');
    const pending = joinRequests()[0]!;
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(pending), 1);
      pending.callback(okJoin('ROOMD2'));
      // ACK é recebido, mas o transporte cai antes da continuação assíncrona.
      harness.state.connected = false;
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    const linkWhileOffline = api().chatLinkReady;
    harness.state.connected = true;
    await act(async () => harness.state.handlers.get('connect')?.(undefined));
    expect({ linkWhileOffline, linkAfterConnect: api().chatLinkReady,
      interactiveAfterConnect: api().interactive, newJoinAttempts: joinRequests().length })
      .toEqual({ linkWhileOffline: false, linkAfterConnect: false,
        interactiveAfterConnect: false, newJoinAttempts: 1 });
  });

  it('não perde o sucesso do join quando o ack ultrapassa o timeout local', async () => {
    seedIdentity('ROOMD3');
    await mount();
    await startRecovery('ROOMD3');
    const first = joinRequests()[0]!;
    // O servidor já aceitou o primeiro join; somente o ack se perdeu no
    // timeout local. Com a MESMA intenção, o dedupe do servidor devolve a
    // resposta memorizada (sucesso) — nunca ALREADY_IN_ROOM para o replay.
    await advance(6500);
    expect(joinRequests()).toHaveLength(2);
    const second = joinRequests()[1]!;
    expect(second.payload).toEqual(first.payload);
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(second), 1);
      second.callback(okJoin('ROOMD3'));
    });
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(first), 1);
      first.callback(okJoin('ROOMD3'));
    });
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
  });
});
