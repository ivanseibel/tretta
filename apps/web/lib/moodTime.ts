import type { RetryInfo, SendLimitInfo } from '@tretta/protocol';

/**
 * Rastreia o intervalo de envio das reações sem confiar no relógio do aparelho
 * e sem renovar prazos por replay. Há duas peças:
 *
 * - **Referência comum** (`clock`): instante do servidor + instante local da
 *   amostra mais nova já vista. Só avança; uma chegada tardia não a retrocede
 *   nem reposiciona o prazo na chegada.
 * - **Conhecimento do escopo** (categoria de emissor): o dado mais novo já
 *   visto, inclusive um `null` autoritativo que encerrou a janela (tombstone).
 *
 * O restante é `nextSendAt - (clock.serverTime + tempo local decorrido)`, isto
 * é, sempre medido na referência comum. A referência nunca retrocede: uma
 * amostra com timestamp maior que o guardado, mas menor que a estimativa já
 * decorrida, mantém a estimativa anterior (chegada tardia não aumenta espera);
 * um timestamp realmente adiantado avança a referência.
 *
 * Em timestamps iguais, a origem do fato desempata: estado autoritativo <
 * recusa < aceite. Assim o estado nulo inicial não bloqueia um aceite no mesmo
 * milissegundo, mas o replay desse estado não apaga o aceite. Fatos de mesma
 * prioridade no mesmo instante são idempotentes (não alternam por replay).
 */
export type MoodCategory = 'reaction';

/** Origem do fato de um escopo; desempata timestamps idênticos. */
type FactKind = 'state' | 'refusal' | 'accept';

const FACT_PRIORITY: Record<FactKind, number> = {
  state: 0,
  refusal: 1,
  accept: 2,
};

/** Conhecimento de um escopo: `nextSendAt` nulo encerra a janela naquele instante. */
interface ScopeKnowledge {
  readonly serverTime: number;
  readonly nextSendAt: number | null;
  readonly kind: FactKind;
}

interface ClockSample {
  readonly serverTime: number;
  readonly localAt: number;
}

export class MoodLimitTracker {
  private clock: ClockSample | null = null;
  private readonly sender = new Map<MoodCategory, ScopeKnowledge>();

  /** Reinício de contexto: troca de sala, saída ou remoção. */
  clear(): void {
    this.clock = null;
    this.sender.clear();
  }

  /** Aceite de envio: `limits` do ack (ou replay idêntico). */
  noteSender(category: MoodCategory, limits: SendLimitInfo | undefined, localAt = Date.now()): void {
    if (limits === undefined) return;
    this.noteScope(this.sender, category, limits.serverTime, limits.nextSendAt, localAt, 'accept');
  }

  /** Recusa por limite do próprio emissor. */
  noteRetry(category: MoodCategory, retry: RetryInfo | undefined, localAt = Date.now()): void {
    if (retry === undefined || retry.scope !== 'sender') return;
    this.noteScope(this.sender, category, retry.serverTime, retry.retryAt, localAt, 'refusal');
  }

  /**
   * Snapshot autoritativo do próprio (rejoin/reload/estado): `null` encerra a
   * janela quando o snapshot é mais novo que o conhecimento corrente.
   */
  noteState(serverTime: number, reactionNextSendAt: number | null, localAt = Date.now()): void {
    this.noteScope(this.sender, 'reaction', serverTime, reactionNextSendAt, localAt, 'state');
  }

  remainingSender(category: MoodCategory, nowLocal = Date.now()): number {
    return this.remaining(this.sender.get(category), nowLocal);
  }

  /**
   * Aceita a informação conforme a ordem do próprio escopo. Timestamps iguais
   * desempatam pela origem do fato; a referência comum nunca retrocede (uma
   * chegada tardia mantém a estimativa já decorrida).
   */
  private noteScope<K>(
    map: Map<K, ScopeKnowledge>,
    key: K,
    serverTime: number,
    nextSendAt: number | null,
    localAt: number,
    kind: FactKind,
  ): void {
    const normalized = nextSendAt === null || nextSendAt <= serverTime ? null : nextSendAt;
    const current = map.get(key);
    if (current !== undefined) {
      if (serverTime < current.serverTime) return;
      // Mesmo instante: só uma origem mais forte substitui. Mesma prioridade é
      // idempotente para não alternar entre fatos antigos por replay.
      if (serverTime === current.serverTime && FACT_PRIORITY[kind] <= FACT_PRIORITY[current.kind]) return;
    }
    this.advanceClock(serverTime, localAt);
    map.set(key, { serverTime, nextSendAt: normalized, kind });
  }

  /**
   * Referência comum: a estimativa corrente (`serverTime` da âncora + tempo
   * local decorrido) é um piso. Um timestamp maior que o da âncora, mas menor
   * que essa estimativa, mantém o piso; um timestamp realmente adiantado avança.
   */
  private advanceClock(serverTime: number, localAt: number): void {
    if (this.clock === null) {
      this.clock = { serverTime, localAt };
      return;
    }
    const elapsed = Math.max(0, localAt - this.clock.localAt);
    const estimate = this.clock.serverTime + elapsed;
    this.clock = { serverTime: Math.max(serverTime, estimate), localAt };
  }

  private remaining(sample: ScopeKnowledge | undefined, nowLocal: number): number {
    if (sample === undefined || sample.nextSendAt === null || this.clock === null) return 0;
    const elapsed = Math.max(0, nowLocal - this.clock.localAt);
    return Math.max(0, sample.nextSendAt - (this.clock.serverTime + elapsed));
  }
}
