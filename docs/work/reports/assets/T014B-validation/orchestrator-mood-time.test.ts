
import { expect, it } from 'vitest';
import { MoodLimitTracker } from '@/lib/moodTime';

it('replay após 500ms preserva o prazo restante, sem renovar a janela', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 20000);
  expect(tracker.remainingSender('reaction', 20500)).toBe(4500);
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 20500);
  expect(tracker.remainingSender('reaction', 20500)).toBe(4500);
});

it('snapshot 500ms mais antigo não apaga intervalo confirmado depois dele', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 20000);
  tracker.noteState(9500, null, null, 20000);
  expect(tracker.remainingSender('reaction', 20000)).toBe(5000);
});
