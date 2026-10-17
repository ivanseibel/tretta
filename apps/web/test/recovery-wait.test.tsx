/**
 * T010 — recuperação com espera limitada da identidade existente (nível provisão).
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
 * 8. O ciclo vence no prazo mesmo com um ack em voo; sucesso que chega depois
 *    do limite não habilita vínculo nem salva identidade.
 * 9. Ack de um transporte que caiu antes da continuação não habilita o vínculo
 *    no transporte novo (confirmação presa à geração do transporte).
 * 10. Resultado incerto (timeout local/offline/transporte caído) preserva a
 *     intenção — reenvio com o MESMO payload para o dedupe do servidor;
 *     recusa conhecida consome a intenção (id novo).
 * 11. Queda/reconexão invalidam tentativas sem reiniciar o prazo do ciclo.
 * 12. Falha definitiva continua valendo se o transporte caiu antes da
 *     continuação (decisão do servidor não depende do transporte).
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
    // chega depois do prazo não habilita vínculo nem sobrescreve a identidade.
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

describe('prazo e vínculo de transporte da retomada (ajustes pós-validação)', () => {
  it('encerra o ciclo no prazo de 60 s mesmo com um ack em voo e ignora o sucesso tardio', async () => {
    seedIdentity('ROOMS1');
    await mount();
    const startedAt = Date.now();
    const { promise, result } = await startRecovery('ROOMS1');

    // Recusas conhecidas até perto do limite; a última tentativa fica em voo.
    let lastSendAt = Date.now();
    for (let guard = 0; guard < 1_200; guard++) {
      if (joinRequests().length > 0) {
        lastSendAt = Date.now();
        if (lastSendAt - startedAt >= 57_000) break;
        await respondJoin(refusal());
      }
      await advance(100);
    }
    expect(lastSendAt - startedAt).toBeGreaterThanOrEqual(57_000);
    expect(joinRequests()).toHaveLength(1);

    // O ack em voo não estende o prazo: o ciclo vence no limite dos 60 s.
    await advance(60_000 - (Date.now() - startedAt));
    expect(api().recoveryPhase).toBe('exhausted');
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('deadline');

    // Sucesso que chega depois do limite não habilita nem salva identidade.
    await respondJoin(okJoin('ROOMS1', 'cred_tardia'));
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);
    expect(api().state).toBeNull();
    expect(api().recoveryPhase).toBe('exhausted');
    expect(harness.state.identities.get('ROOMS1')?.credential).toBe('cred_ROOMS1');

    // Nenhuma tentativa nova parte sozinha depois do prazo.
    await advance(30_000);
    expect(joinRequests()).toHaveLength(0);
  });

  it('ack de um transporte que caiu antes da continuação não habilita o vínculo novo', async () => {
    seedIdentity('ROOMS2');
    await mount();
    const { promise, result } = await startRecovery('ROOMS2');

    const [pending] = joinRequests();
    expect(pending).toBeDefined();
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(pending!), 1);
      pending!.callback(okJoin('ROOMS2'));
      // O transporte cai ANTES da continuação assíncrona da resposta.
      harness.state.connected = false;
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);

    // Reconecta: a tentativa é retomada no transporte novo, sem atalho de
    // "vínculo vivo" — o ack antigo não vale para este transporte.
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);
    expect(joinRequests()).toHaveLength(1);

    await respondJoin(okJoin('ROOMS2'));
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('ok');
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
  });

  it('ack perdido no timeout local: reenvia a MESMA intenção e recupera pelo replay', async () => {
    seedIdentity('ROOMS3');
    await mount();
    const { promise, result } = await startRecovery('ROOMS3');

    const [first] = joinRequests();
    expect(first).toBeDefined();

    // O servidor já aceitou o join; só o ack se perdeu no timeout local de 6 s.
    await advance(6_500);
    const [stale, second] = joinRequests();
    expect(second).toBeDefined();
    // Reenvio com o MESMO payload (assinatura do dedupe do servidor): a
    // retentativa recebe a resposta memorizada em vez de recusa nova.
    expect(second?.payload).toEqual(first?.payload);
    expect(stale?.payload).toEqual(first?.payload);

    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(second!), 1);
      second!.callback(okJoin('ROOMS3'));
    });
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('ok');
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
  });

  it('recusa conhecida consome a intenção; resultado incerto a preserva', async () => {
    seedIdentity('ROOMS4');
    await mount();
    const { promise, result } = await startRecovery('ROOMS4');

    const [first] = joinRequests();
    await respondJoin(refusal());
    await advance(500);
    const [second] = joinRequests();
    expect(second).toBeDefined();
    expect(second?.payload.intentId).not.toBe(first?.payload.intentId);

    // A segunda tentativa fica sem resposta (incerto): a retentativa reusa o
    // payload exato da segunda — nada de id novo para o servidor recusar.
    await advance(7_250);
    const attempts = joinRequests();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.payload).toEqual(second?.payload);

    const target = attempts[1]!;
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(target), 1);
      target.callback(okJoin('ROOMS4'));
    });
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('ok');
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
  });

  it('queda e volta do transporte não reiniciam o prazo do ciclo em curso', async () => {
    seedIdentity('ROOMS5');
    await mount();
    const { promise, result } = await startRecovery('ROOMS5');

    await advance(30_000);
    harness.state.connected = false;
    await act(async () => {
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    harness.state.connected = true;
    await act(async () => {
      harness.state.handlers.get('connect')?.(undefined);
    });
    expect(api().recoveryPhase).toBe('recovering');

    // O prazo continua contado do início do ciclo: vence aos 60 s, não aos 90 s.
    await advance(29_500);
    expect(api().recoveryPhase).toBe('recovering');
    await advance(500);
    expect(api().recoveryPhase).toBe('exhausted');
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('deadline');
  });

  it('recusa definitiva vale mesmo com o transporte caído antes da continuação', async () => {
    seedIdentity('ROOMS6');
    await mount();
    const { promise, result } = await startRecovery('ROOMS6');

    const [pending] = joinRequests();
    expect(pending).toBeDefined();
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(pending!), 1);
      pending!.callback(refusal('CREDENTIAL_INVALID'));
      harness.state.connected = false;
      harness.state.handlers.get('disconnect')?.(undefined);
    });
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('invalid');
    expect(harness.state.identities.has('ROOMS6')).toBe(false);
    expect(api().recoveryPhase).toBe('idle');
    expect(api().chatLinkReady).toBe(false);
  });
});

describe('resultado incerto entre ciclos explícitos', () => {
  it('retomada explícita após o vencimento confirma a intenção incerta com o replay exato', async () => {
    seedIdentity('ROOMC1');
    await mount();
    const { promise, result } = await startRecovery('ROOMC1');
    const accepted = { ...joinRequests()[0]!.payload };

    // Ciclo inteiro sem resposta: vence aos 60 s com resultado incerto.
    await advance(60_000);
    expect(api().recoveryPhase).toBe('exhausted');
    await act(async () => {
      await promise;
    });
    expect(result.value).toBe('deadline');
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);
    harness.state.pending.length = 0;

    // Retomada explícita: o novo ciclo reenvia o payload exato da intenção
    // incerta (replay do dedupe), sem mintar id novo.
    let retry!: Promise<RejoinResult>;
    await act(async () => {
      retry = api().retryRecovery('ROOMC1');
    });
    expect(api().recoveryPhase).toBe('recovering');
    expect(joinRequests()).toHaveLength(1);
    expect(joinRequests()[0]?.payload).toEqual(accepted);

    await respondJoin(okJoin('ROOMC1'));
    await act(async () => {
      await retry;
    });
    expect(api().chatLinkReady).toBe(true);
    expect(api().interactive).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
    expect(harness.state.identities.get('ROOMC1')?.credential).toBe('cred_ROOMC1');
  });

  it('callback do ciclo vencido não encerra nem habilita o ciclo novo', async () => {
    seedIdentity('ROOMC2');
    await mount();
    const first = await startRecovery('ROOMC2');

    await advance(60_000);
    expect(api().recoveryPhase).toBe('exhausted');
    await act(async () => {
      await first.promise;
    });
    expect(first.result.value).toBe('deadline');
    const abandoned = joinRequests().at(-1)!;

    let retry!: Promise<RejoinResult>;
    await act(async () => {
      retry = api().retryRecovery('ROOMC2');
    });
    const replay = joinRequests().at(-1)!;
    expect(replay.payload).toEqual(abandoned.payload);

    // Resposta atrasada do ciclo vencido: inerte — não encerra nem habilita.
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(abandoned), 1);
      abandoned.callback(okJoin('ROOMC2'));
    });
    expect(api().chatLinkReady).toBe(false);
    expect(api().interactive).toBe(false);
    expect(api().recoveryPhase).toBe('recovering');

    // Só o ack da tentativa do próprio ciclo novo confirma.
    await act(async () => {
      harness.state.pending.splice(harness.state.pending.indexOf(replay), 1);
      replay.callback(okJoin('ROOMC2'));
    });
    await act(async () => {
      await retry;
    });
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
  });

  it('intenção incerta não contamina outra sala', async () => {
    seedIdentity('ROOMC3A');
    await mount();
    const first = await startRecovery('ROOMC3A');
    const storedIntentId = String(joinRequests()[0]!.payload.intentId);

    await advance(60_000);
    await act(async () => {
      await first.promise;
    });
    expect(first.result.value).toBe('deadline');
    harness.state.pending.length = 0;

    // Outra sala: tentativa nova, sem replay da intenção de ROOMC3A.
    seedIdentity('ROOMC3B');
    await act(async () => {
      void api().rejoin('ROOMC3B');
    });
    expect(joinRequests()).toHaveLength(1);
    expect(joinRequests()[0]?.payload.roomCode).toBe('ROOMC3B');
    expect(joinRequests()[0]?.payload.credential).toBe('cred_ROOMC3B');
    expect(String(joinRequests()[0]?.payload.intentId)).not.toBe(storedIntentId);
  });

  it('troca de identidade na mesma sala descarta a intenção incerta', async () => {
    seedIdentity('ROOMC4', 'cred_antiga');
    await mount();
    const first = await startRecovery('ROOMC4');
    const storedIntentId = String(joinRequests()[0]!.payload.intentId);

    await advance(60_000);
    await act(async () => {
      await first.promise;
    });
    expect(first.result.value).toBe('deadline');
    harness.state.pending.length = 0;

    // Identidade local trocada: o contexto antigo não é reutilizado.
    seedIdentity('ROOMC4', 'cred_nova');
    let retry!: Promise<RejoinResult>;
    await act(async () => {
      retry = api().retryRecovery('ROOMC4');
    });
    expect(joinRequests()).toHaveLength(1);
    expect(String(joinRequests()[0]?.payload.intentId)).not.toBe(storedIntentId);
    expect(joinRequests()[0]?.payload.credential).toBe('cred_nova');

    await respondJoin(okJoin('ROOMC4', 'cred_nova'));
    await act(async () => {
      await retry;
    });
    expect(api().chatLinkReady).toBe(true);
    expect(harness.state.identities.get('ROOMC4')?.credential).toBe('cred_nova');
  });

  it('ciclo explícito que retoma a intenção incerta continua limitado ao próprio prazo', async () => {
    seedIdentity('ROOMC5');
    await mount();
    const first = await startRecovery('ROOMC5');
    const accepted = { ...joinRequests()[0]!.payload };
    await advance(60_000);
    await act(async () => {
      await first.promise;
    });
    expect(first.result.value).toBe('deadline');
    harness.state.pending.length = 0;

    // Retomada 1: reenvia o payload exato, nada responde e o prazo próprio vence.
    const retry1Result: { value?: RejoinResult } = {};
    let retry1!: Promise<RejoinResult>;
    await act(async () => {
      retry1 = api().retryRecovery('ROOMC5');
      void retry1.then((value) => {
        retry1Result.value = value;
      });
    });
    expect(joinRequests()).toHaveLength(1);
    expect(joinRequests()[0]?.payload).toEqual(accepted);
    await advance(60_000);
    expect(api().recoveryPhase).toBe('exhausted');
    await act(async () => {
      await retry1;
    });
    expect(retry1Result.value).toBe('deadline');
    harness.state.pending.length = 0;

    // Retomada 2: a intenção incerta segue preservada e confirma com o replay.
    let retry2!: Promise<RejoinResult>;
    await act(async () => {
      retry2 = api().retryRecovery('ROOMC5');
    });
    expect(joinRequests()).toHaveLength(1);
    expect(joinRequests()[0]?.payload).toEqual(accepted);
    await respondJoin(okJoin('ROOMC5'));
    await act(async () => {
      await retry2;
    });
    expect(api().chatLinkReady).toBe(true);
    expect(api().recoveryPhase).toBe('idle');
    expect(harness.state.identities.get('ROOMC5')?.credential).toBe('cred_ROOMC5');
  });
});
