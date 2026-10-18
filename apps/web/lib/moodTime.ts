import type { RetryInfo, SendLimitInfo } from '@tretta/protocol';

/**
 * Rastreia os intervalos de humor sem confiar no relógio do aparelho e sem
 * renovar prazos por replay. Há duas peças separadas:
 *
 * - **Referência comum** (`clock`): instante do servidor + instante local da
 *   amostra mais nova já vista. Só avança; uma chegada tardia não a retrocede
 *   nem reposiciona o prazo na chegada.
 * - **Conhecimento por escopo** (categoria de emissor ou id de alvo): o dado
 *   mais novo já visto daquele escopo, inclusive um `null` autoritativo que
 *   encerrou a janela (tombstone). Cada informação é comparada apenas com o
 *   próprio escopo, então uma atualização de provocação não invalida reação e
 *   uma recusa de um alvo não invalida a de outro.
 *
 * O restante é `nextSendAt - (clock.serverTime + tempo local decorrido)`, isto
 * é, sempre medido na referência comum. A referência nunca retrocede: uma
 * amostra com timestamp maior que o guardado, mas menor que a estimativa já
 * decorrida, mantém a estimativa anterior (chegada tardia não aumenta espera);
 * um timestamp realmente adiantado avança a referência.
 *
 * Em timestamps iguais, a origem do fato desempata: estado autoritativo <
 * recusa < aceite < liberação. Assim o estado nulo inicial não bloqueia um
 * aceite no mesmo milissegundo, mas o replay desse estado não apaga o aceite;
 * a liberação de alvo prevalece sobre a recusa superada, mas uma recusa com
 * timestamp maior continua bloqueando. Fatos de mesma prioridade no mesmo
 * instante são idempotentes (não alternam por replay).
 */
export type MoodCategory = 'taunt' | 'reaction';

/** Origem do fato de um escopo; desempata timestamps idênticos. */
type FactKind = 'state' | 'refusal' | 'accept' | 'release';

const FACT_PRIORITY: Record<FactKind, number> = {
  state: 0,
  refusal: 1,
  accept: 2,
  release: 3,
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
  private readonly targets = new Map<string, ScopeKnowledge>();

  /** Reinício de contexto: troca de sala, saída ou remoção. */
  clear(): void {
    this.clock = null;
    this.sender.clear();
    this.targets.clear();
  }

  /** Aceite de envio: `limits` do ack (ou replay idêntico). */
  noteSender(category: MoodCategory, limits: SendLimitInfo | undefined, localAt = Date.now()): void {
    if (limits === undefined) return;
    this.noteScope(this.sender, category, limits.serverTime, limits.nextSendAt, localAt, 'accept');
  }

  /** Recusa por limite: escopo do emissor ou cota de um alvo específico. */
  noteRetry(category: MoodCategory, retry: RetryInfo | undefined, localAt = Date.now()): void {
    if (retry === undefined) return;
    if (retry.scope === 'sender') {
      this.noteScope(this.sender, category, retry.serverTime, retry.retryAt, localAt, 'refusal');
      return;
    }
    if (retry.targetId !== undefined) {
      this.noteScope(this.targets, retry.targetId, retry.serverTime, retry.retryAt, localAt, 'refusal');
    }
  }

  /**
   * Snapshot autoritativo do próprio (rejoin/reload/estado): avalia as duas
   * categorias separadamente. `null` encerra a janela daquela categoria quando
   * o snapshot é mais novo que o conhecimento dela.
   */
  noteState(
    serverTime: number,
    tauntNextSendAt: number | null,
    reactionNextSendAt: number | null,
    localAt = Date.now(),
  ): void {
    this.noteScope(this.sender, 'taunt', serverTime, tauntNextSendAt, localAt, 'state');
    this.noteScope(this.sender, 'reaction', serverTime, reactionNextSendAt, localAt, 'state');
  }

  /**
   * Envio aceito para o alvo indica que a cota dele voltou a ter espaço. Com
   * `serverTime`, a liberação vira conhecimento do escopo (impede que uma
   * recusa anterior a ela ressuscite a espera); sem `serverTime`, apenas
   * descarta o conhecimento atual.
   */
  clearTarget(targetId: string, serverTime?: number): void {
    const current = this.targets.get(targetId);
    if (serverTime === undefined) {
      this.targets.delete(targetId);
      return;
    }
    if (current !== undefined) {
      // Recusa com timestamp maior continua bloqueando; no mesmo instante, a
      // liberação prevalece e o replay da recusa superada não ressuscita.
      if (serverTime < current.serverTime) return;
      if (serverTime === current.serverTime && FACT_PRIORITY.release <= FACT_PRIORITY[current.kind]) return;
    }
    // A liberação não altera a referência comum: o aceite que a originou já
    // avançou o relógio; aqui só o conhecimento do alvo muda.
    this.targets.set(targetId, { serverTime, nextSendAt: null, kind: 'release' });
  }

  remainingSender(category: MoodCategory, nowLocal = Date.now()): number {
    return this.remaining(this.sender.get(category), nowLocal);
  }

  remainingTarget(targetId: string, nowLocal = Date.now()): number {
    return this.remaining(this.targets.get(targetId), nowLocal);
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
