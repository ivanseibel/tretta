import type { AutomaticEffect, TauntEvent } from '@tretta/protocol';

/**
 * Fila serial única de apresentações (efeitos automáticos e provocações
 * manuais): um item na tela por vez, na ordem de chegada. O encerramento é por
 * timer — nunca depende de `animationend`, que pode faltar com animação
 * desligada, desmontagem ou troca de preferência. Preferência alterada muda a
 * aparência via CSS (`data-anim`) sem reanimação nem travamento; a duração do
 * item ativo permanece a decidida na entrada na fila.
 */
export type Presentation =
  | {
      readonly kind: 'taunt';
      readonly id: string;
      readonly durationMs: number;
      readonly taunt: TauntEvent;
    }
  | {
      readonly kind: 'effect';
      readonly id: string;
      readonly durationMs: number;
      readonly effect: AutomaticEffect;
    };

/** Janelas curtas por tipo e modo; "off" ainda exibe a legenda estática. */
export const PRESENTATION_DURATIONS = {
  effect: { full: 2600, reduced: 2000, off: 1400 },
  taunt: { full: 3200, reduced: 2400, off: 1600 },
} as const;

/**
 * Limite de pendências: rajadas (compra + bloqueio + provocação) ficam na
 * ordem; com excedente descarta a mais antiga pendente, nunca o item ativo nem
 * o mais recente — o aviso mais recente é o mais relevante.
 */
export const MAX_PENDING_PRESENTATIONS = 8;

interface QueuedPresentation {
  readonly id: string;
  readonly durationMs: number;
}

export interface PresentationQueueOptions<T extends QueuedPresentation> {
  readonly onActiveChange: (active: T | null) => void;
  readonly setTimer?: (callback: () => void, ms: number) => number;
  readonly clearTimer?: (handle: number) => void;
}

export class PresentationQueue<T extends QueuedPresentation> {
  private readonly pending: T[] = [];
  private activeItem: T | null = null;
  private timer: number | null = null;
  /** Avança a cada troca de item ativo; callbacks de timer antigos não contam. */
  private generation = 0;
  private readonly onActiveChange: (active: T | null) => void;
  private readonly setTimer: (callback: () => void, ms: number) => number;
  private readonly clearTimer: (handle: number) => void;

  constructor(options: PresentationQueueOptions<T>) {
    this.onActiveChange = options.onActiveChange;
    this.setTimer = options.setTimer ?? ((callback, ms) => Number(setTimeout(callback, ms)));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  get active(): T | null {
    return this.activeItem;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Entra uma vez por id: repetição de ack/broadcast não ocupa nova posição. */
  enqueue(item: T): void {
    if (this.activeItem !== null && this.activeItem.id === item.id) return;
    if (this.pending.some((entry) => entry.id === item.id)) return;
    if (this.activeItem === null) {
      this.activate(item);
      return;
    }
    if (this.pending.length >= MAX_PENDING_PRESENTATIONS) this.pending.shift();
    this.pending.push(item);
  }

  /** Conclui o item ativo e avança (fim do timer ou cancelamento pontual). */
  finishActive(): void {
    if (this.activeItem === null) return;
    this.stopTimer();
    this.advance();
  }

  /** Remove pendentes e, se casar, o ativo — sem reapresentar nada removido. */
  remove(predicate: (item: T) => boolean): void {
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      const entry = this.pending[index];
      if (entry !== undefined && predicate(entry)) this.pending.splice(index, 1);
    }
    if (this.activeItem !== null && predicate(this.activeItem)) this.finishActive();
  }

  /** Cancela ativo e pendentes: troca/saída de sala, rodada nova, desmontagem. */
  cancelAll(): void {
    this.pending.length = 0;
    this.stopTimer();
    this.generation += 1;
    if (this.activeItem === null) return;
    this.activeItem = null;
    this.onActiveChange(null);
  }

  private activate(item: T): void {
    this.stopTimer();
    this.generation += 1;
    this.activeItem = item;
    const generation = this.generation;
    this.timer = this.setTimer(() => {
      // Callback de item que já saiu: não avança nem limpa o item novo.
      if (generation !== this.generation) return;
      this.timer = null;
      this.advance();
    }, item.durationMs);
    this.onActiveChange(item);
  }

  private advance(): void {
    const next = this.pending.shift() ?? null;
    if (next === null) {
      this.generation += 1;
      this.activeItem = null;
      this.onActiveChange(null);
      return;
    }
    this.activate(next);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    this.clearTimer(this.timer);
    this.timer = null;
  }
}
