import { describe, expect, it } from 'vitest';
import { MoodLimitTracker } from '@/lib/moodTime';

/**
 * O rastreador trabalha com tempo local relativo e referência do servidor.
 * Nenhum teste usa `Date.now()` direto: o instante local é explícito.
 */
describe('rastreador do intervalo de reações', () => {
  it('calcula o restante a partir do ack e zera no vencimento', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_000);
    expect(tracker.remainingSender('reaction', 1_000)).toBe(5_000);
    expect(tracker.remainingSender('reaction', 5_000)).toBe(1_000);
    expect(tracker.remainingSender('reaction', 6_000)).toBe(0);
    expect(tracker.remainingSender('reaction', 20_000)).toBe(0);
  });

  it('replay vencido não renova o prazo', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_000);
    // O mesmo ack original chega em t0+4.999: faltava 1 ms, não 5 s.
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 5_999);
    expect(tracker.remainingSender('reaction', 5_999)).toBe(1);
    // Um snapshot ainda mais antigo também não repõe a espera.
    tracker.noteState(900, 5_900, 6_100);
    expect(tracker.remainingSender('reaction', 6_100)).toBe(0);
  });

  it('dados novos vencem; snapshot velho não limpa nem reduz a janela', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteState(10_000, 15_000, 10_000);
    expect(tracker.remainingSender('reaction', 12_000)).toBe(3_000);
    // Null antigo não libera o intervalo vigente.
    tracker.noteState(9_000, null, 12_000);
    expect(tracker.remainingSender('reaction', 12_000)).toBe(3_000);
    // Estado novo e posterior manda: janela encerrada.
    tracker.noteState(16_000, null, 16_000);
    expect(tracker.remainingSender('reaction', 16_000)).toBe(0);
  });

  it('limpeza de contexto zera amostras e volta a aceitar a primeira referência', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_000);
    tracker.clear();
    expect(tracker.remainingSender('reaction', 1_000)).toBe(0);
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 50_000);
    // Sem histórico, a amostra é aceita mesmo com relógio local adiantado.
    expect(tracker.remainingSender('reaction', 50_000)).toBe(5_000);
  });
});

/**
 * Ordenação e idempotência das amostras: replay, escopos e estado novo.
 */
describe('ordenação e idempotência das amostras de tempo', () => {
  it('replay após 500 ms preserva o prazo restante, sem renovar a janela', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    expect(tracker.remainingSender('reaction', 20_500)).toBe(4_500);
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_500);
    expect(tracker.remainingSender('reaction', 20_500)).toBe(4_500);
    // Replay ainda mais atrasado também não reancora.
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 24_000);
    expect(tracker.remainingSender('reaction', 24_000)).toBe(1_000);
  });

  it('snapshot no mesmo instante não apaga intervalo confirmado', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteState(10_000, null, 20_000);
    expect(tracker.remainingSender('reaction', 20_500)).toBe(4_500);
    // Alternar estado/aceite antigos não muda mais o estado.
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_600);
    tracker.noteState(10_000, null, 20_700);
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_800);
    expect(tracker.remainingSender('reaction', 20_800)).toBe(4_200);
  });

  it('recusa do emissor bloqueia e novo aceite libera', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteRetry('reaction', { serverTime: 5_000, retryAt: 20_000, scope: 'sender' }, 5_000);
    expect(tracker.remainingSender('reaction', 5_000)).toBe(15_000);
    // Recusa atrasada, anterior ao aceite, não volta a bloquear.
    tracker.noteSender('reaction', { serverTime: 6_000, nextSendAt: 11_000 }, 5_500);
    expect(tracker.remainingSender('reaction', 5_500)).toBe(5_000);
    tracker.noteRetry('reaction', { serverTime: 5_000, retryAt: 20_000, scope: 'sender' }, 7_000);
    expect(tracker.remainingSender('reaction', 7_000)).toBe(3_500);
  });

  it('estado autoritativo mais novo encerra a janela', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteState(16_000, null, 26_000);
    expect(tracker.remainingSender('reaction', 26_000)).toBe(0);
    // Replay do aceite superado não a reabre.
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 27_000);
    expect(tracker.remainingSender('reaction', 27_000)).toBe(0);
    // Informação realmente nova volta a valer.
    tracker.noteSender('reaction', { serverTime: 17_000, nextSendAt: 22_000 }, 27_000);
    expect(tracker.remainingSender('reaction', 27_000)).toBe(5_000);
  });
});

/**
 * Referência comum monotônica e empates desempatados pela origem do fato.
 */
describe('referência monotônica e empates por origem', () => {
  it('timestamp ligeiramente maior não retrocede a estimativa já decorrida', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    expect(tracker.remainingSender('reaction', 24_000)).toBe(1_000);
    // 10.001 > 10.000, mas a estimativa já era 14.000 no local 24.000.
    tracker.noteState(10_001, 15_001, 24_000);
    expect(tracker.remainingSender('reaction', 24_000)).toBe(1_001);
    // O tempo continua correndo na mesma referência.
    expect(tracker.remainingSender('reaction', 24_500)).toBe(501);
  });

  it('timestamp realmente adiantado avança a referência', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteState(30_000, 45_000, 25_000);
    expect(tracker.remainingSender('reaction', 25_000)).toBe(15_000);
    expect(tracker.remainingSender('reaction', 35_000)).toBe(5_000);
  });

  it('estado nulo no mesmo instante não bloqueia aceite posterior', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteState(1_000, null, 1_000);
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_000);
    expect(tracker.remainingSender('reaction', 1_000)).toBe(5_000);
    // Replay idêntico é idempotente e não reancora.
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_500);
    expect(tracker.remainingSender('reaction', 1_500)).toBe(4_500);
  });
});
