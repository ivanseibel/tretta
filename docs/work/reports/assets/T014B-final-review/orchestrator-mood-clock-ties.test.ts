
import { expect, it } from 'vitest';
import { MoodLimitTracker } from '@/lib/moodTime';

it('amostra com timestamp ligeiramente maior não retrocede a estimativa de tempo já transcorrido', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 20000);
  expect(tracker.remainingSender('reaction', 24000)).toBe(1000);
  // O novo timestamp é maior que o da âncora, mas menor que a estimativa
  // corrente (14000). Chegada atrasada não pode aumentar uma espera vigente.
  tracker.noteSender('taunt', { serverTime: 10001, nextSendAt: 25001 }, 24000);
  expect(tracker.remainingSender('reaction', 24000)).toBe(1000);
});

it('replay do snapshot nulo no mesmo milissegundo não apaga aceite posterior', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteState(10000, null, null, 20000);
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 20000);
  expect(tracker.remainingSender('reaction', 20500)).toBe(4500);
  tracker.noteState(10000, null, null, 20500);
  expect(tracker.remainingSender('reaction', 20500)).toBe(4500);
});

it('replay da recusa no mesmo milissegundo não ressuscita alvo já liberado', () => {
  const tracker = new MoodLimitTracker();
  const retry = { serverTime: 10000, retryAt: 70000, scope: 'target' as const, targetId: 'bia' };
  tracker.noteRetry('taunt', retry, 20000);
  tracker.clearTarget('bia', 10000);
  expect(tracker.remainingTarget('bia', 20500)).toBe(0);
  tracker.noteRetry('taunt', retry, 20500);
  expect(tracker.remainingTarget('bia', 20500)).toBe(0);
});
