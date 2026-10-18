
import { expect, it } from 'vitest';
import { MoodLimitTracker } from '@/lib/moodTime';

it('ack válido de reação não desaparece por chegar após dado mais novo de provocação', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteSender('taunt', { serverTime: 11000, nextSendAt: 26000 }, 21000);
  // O evento da reação já foi aceito, seu intervalo ainda está ativo e não
  // existe amostra posterior da categoria reação que o substitua.
  tracker.noteSender('reaction', { serverTime: 10000, nextSendAt: 15000 }, 21500);
  expect(tracker.remainingSender('reaction', 21500)).toBe(3500);
  expect(tracker.remainingSender('taunt', 21500)).toBe(14500);
});

it('recusa válida do alvo Bia não desaparece por chegar após dado mais novo do alvo Cai', () => {
  const tracker = new MoodLimitTracker();
  tracker.noteRetry('taunt', { serverTime: 11000, retryAt: 71000, scope: 'target', targetId: 'cai' }, 21000);
  tracker.noteRetry('taunt', { serverTime: 10000, retryAt: 70000, scope: 'target', targetId: 'bia' }, 21500);
  expect(tracker.remainingTarget('bia', 21500)).toBe(58500);
  expect(tracker.remainingTarget('cai', 21500)).toBe(59500);
});
