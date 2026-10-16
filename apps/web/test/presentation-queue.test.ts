/**
 * Fila serial de apresentações (T005C): ordem, dedupe, limite, cancelamento e
 * imunidade a callbacks antigos. Timers injetados para determinismo total.
 */
import { describe, expect, it } from 'vitest';
import { MAX_PENDING_PRESENTATIONS, PresentationQueue } from '@/lib/presentationQueue';

interface Item {
  readonly id: string;
  readonly durationMs: number;
  readonly tag: string;
}

interface ManualHarness {
  readonly queue: PresentationQueue<Item>;
  readonly active: () => Item | null;
  readonly activeHistory: (Item | null)[];
  readonly pendingTimers: () => number;
  fire(): void;
  staleCallback(): (() => void) | null;
}

function manualQueue(onActiveChange?: (item: Item | null) => void): ManualHarness {
  const timers = new Map<number, () => void>();
  let nextHandle = 1;
  let lastScheduled: (() => void) | null = null;
  const history: (Item | null)[] = [];
  const queue = new PresentationQueue<Item>({
    onActiveChange: (item) => {
      history.push(item);
      onActiveChange?.(item);
    },
    setTimer: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      timers.set(handle, callback);
      lastScheduled = callback;
      return handle;
    },
    clearTimer: (handle) => {
      timers.delete(handle);
    },
  });
  return {
    queue,
    active: () => queue.active,
    activeHistory: history,
    pendingTimers: () => timers.size,
    fire() {
      const callbacks = [...timers.values()];
      for (const callback of callbacks) {
        timers.clear();
        callback();
      }
    },
    staleCallback: () => lastScheduled,
  };
}

function item(id: string, tag = id): Item {
  return { id, durationMs: 100, tag };
}

describe('PresentationQueue', () => {
  it('ativa o primeiro na hora e avança um por vez, na ordem de chegada', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('a'));
    harness.queue.enqueue(item('b'));
    harness.queue.enqueue(item('c'));
    expect(harness.active()?.id).toBe('a');
    expect(harness.queue.pendingCount).toBe(2);

    harness.fire();
    expect(harness.active()?.id).toBe('b');
    harness.fire();
    expect(harness.active()?.id).toBe('c');
    harness.fire();
    expect(harness.active()).toBeNull();
    expect(harness.activeHistory.map((entry) => entry?.id ?? null)).toEqual(['a', 'b', 'c', null]);
    expect(harness.pendingTimers()).toBe(0);
  });

  it('id repetido (ativo ou pendente) não ocupa nova posição', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('a'));
    harness.queue.enqueue(item('a'));
    harness.queue.enqueue(item('b'));
    harness.queue.enqueue(item('b'));
    expect(harness.queue.pendingCount).toBe(1);

    harness.fire();
    expect(harness.active()?.id).toBe('b');
    harness.fire();
    expect(harness.active()).toBeNull();
  });

  it('rajada acima do limite descarta a mais antiga pendente, nunca a ativa nem a mais nova', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('active'));
    for (let index = 0; index < MAX_PENDING_PRESENTATIONS + 3; index += 1) {
      harness.queue.enqueue(item(`p${index}`));
    }
    expect(harness.queue.pendingCount).toBe(MAX_PENDING_PRESENTATIONS);
    expect(harness.active()?.id).toBe('active');

    harness.fire();
    // p0–p2 já tinham sido descartados ao encher a fila; o ativo segue intacto.
    expect(harness.active()?.id).toBe('p3');
    const seen: string[] = [];
    for (let round = 0; round < MAX_PENDING_PRESENTATIONS + 1; round += 1) {
      seen.push(harness.active()?.id ?? 'null');
      harness.fire();
    }
    expect(seen).not.toContain('p0');
    expect(seen).not.toContain('p1');
    expect(seen).not.toContain('p2');
    expect(seen).not.toContain('active');
    expect(seen).toContain('p10');
    expect(seen[seen.length - 1]).toBe('null');
  });

  it('remove por predicado tira pendentes e, se casar com o ativo, avança na hora', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('taunt-1', 'taunt'));
    harness.queue.enqueue(item('fx-1', 'effect'));
    harness.queue.enqueue(item('taunt-2', 'taunt'));
    expect(harness.active()?.id).toBe('taunt-1');

    harness.queue.remove((entry) => entry.tag === 'taunt');
    // `taunt-2` sai da fila; `taunt-1` (ativo) some e `fx-1` é promovido na hora.
    expect(harness.queue.pendingCount).toBe(0);
    expect(harness.active()?.id).toBe('fx-1');
    harness.fire();
    expect(harness.active()).toBeNull();
  });

  it('cancelAll limpa ativo e pendentes e emite null uma vez', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('a'));
    harness.queue.enqueue(item('b'));
    harness.queue.cancelAll();
    expect(harness.active()).toBeNull();
    expect(harness.queue.pendingCount).toBe(0);
    expect(harness.pendingTimers()).toBe(0);
    expect(harness.activeHistory.at(-1)).toBeNull();
    // Cancelar com fila vazia é no-op (não repete null).
    harness.queue.cancelAll();
    expect(harness.activeHistory.filter((entry) => entry === null)).toHaveLength(1);
  });

  it('callback antigo não avança nem limpa o item novo', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('a'));
    const stale = harness.staleCallback();
    expect(stale).not.toBeNull();

    harness.queue.cancelAll();
    harness.queue.enqueue(item('b'));
    expect(harness.active()?.id).toBe('b');

    stale?.();
    expect(harness.active()?.id).toBe('b');
    expect(harness.pendingTimers()).toBe(1);

    harness.fire();
    expect(harness.active()).toBeNull();
  });

  it('finishActive manual encerra o item ativo e avança', () => {
    const harness = manualQueue();
    harness.queue.enqueue(item('a'));
    harness.queue.enqueue(item('b'));
    harness.queue.finishActive();
    expect(harness.active()?.id).toBe('b');
    harness.queue.finishActive();
    expect(harness.active()).toBeNull();
    // Sem item ativo é no-op.
    harness.queue.finishActive();
    expect(harness.active()).toBeNull();
  });
});
