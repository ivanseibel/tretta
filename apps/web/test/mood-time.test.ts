import { describe, expect, it } from 'vitest';
import { MoodLimitTracker } from '@/lib/moodTime';

/**
 * O rastreador trabalha com tempo local relativo e referência do servidor.
 * Nenhum teste usa `Date.now()` direto: o instante local é explícito.
 */
describe('rastreador de intervalos de humor', () => {
  it('calcula o restante do intervalo próprio a partir do ack', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('taunt', { serverTime: 1_000, nextSendAt: 16_000 }, 1_000);
    expect(tracker.remainingSender('taunt', 1_000)).toBe(15_000);
    expect(tracker.remainingSender('taunt', 10_000)).toBe(6_000);
    expect(tracker.remainingSender('taunt', 16_000)).toBe(0);
    expect(tracker.remainingSender('taunt', 20_000)).toBe(0);
    // Categorias independentes.
    expect(tracker.remainingSender('reaction', 10_000)).toBe(0);
  });

  it('replay vencido não renova o prazo', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 1_000);
    // O mesmo ack original chega em t0+4.999: faltava 1 ms, não 5 s.
    tracker.noteSender('reaction', { serverTime: 1_000, nextSendAt: 6_000 }, 5_999);
    expect(tracker.remainingSender('reaction', 5_999)).toBe(1);
    // Um snapshot ainda mais antigo também não repõe a espera.
    tracker.noteState(900, 5_900, 5_900, 6_100);
    expect(tracker.remainingSender('reaction', 6_100)).toBe(0);
  });

  it('dados novos vencem; snapshot velho não limpa nem reduz a janela', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteState(10_000, 25_000, 15_000, 10_000);
    expect(tracker.remainingSender('taunt', 12_000)).toBe(13_000);
    // Null antigo não libera o intervalo vigente.
    tracker.noteState(9_000, null, null, 12_000);
    expect(tracker.remainingSender('taunt', 12_000)).toBe(13_000);
    // Estado novo e posterior manda: janela encerrada.
    tracker.noteState(27_000, null, null, 27_000);
    expect(tracker.remainingSender('taunt', 27_000)).toBe(0);
    expect(tracker.remainingSender('reaction', 27_000)).toBe(0);
  });

  it('cota do alvo é separada por id e não é herdada pelo próximo destinatário', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteRetry('taunt', { serverTime: 5_000, retryAt: 65_000, scope: 'target', targetId: 'bia' }, 5_000);
    tracker.noteRetry('taunt', { serverTime: 5_000, retryAt: 20_000, scope: 'sender' }, 5_000);
    expect(tracker.remainingTarget('bia', 5_000)).toBe(60_000);
    expect(tracker.remainingTarget('cai', 5_000)).toBe(0);
    expect(tracker.remainingSender('taunt', 5_000)).toBe(15_000);
    // Recusa do emissor não altera a cota de nenhum alvo.
    tracker.clearTarget('bia');
    expect(tracker.remainingTarget('bia', 5_000)).toBe(0);
    expect(tracker.remainingSender('taunt', 5_000)).toBe(15_000);
  });

  it('limpeza de contexto zera amostras e volta a aceitar a primeira referência', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('taunt', { serverTime: 1_000, nextSendAt: 16_000 }, 1_000);
    tracker.clear();
    expect(tracker.remainingSender('taunt', 1_000)).toBe(0);
    tracker.noteSender('taunt', { serverTime: 1_000, nextSendAt: 16_000 }, 50_000);
    // Sem histórico, a amostra é aceita mesmo com relógio local adiantado.
    expect(tracker.remainingSender('taunt', 50_000)).toBe(15_000);
  });
});

/**
 * Ajustes T014B (R2): ordenação e idempotência das amostras. Reproduções do
 * orquestrador + escopos separados, categoria vizinha e estado novo.
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

  it('snapshot 500 ms mais antigo não apaga intervalo confirmado depois dele', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteState(9_500, null, null, 20_000);
    expect(tracker.remainingSender('reaction', 20_000)).toBe(5_000);
  });

  it('estado realmente novo encerra a janela e mantém a categoria vizinha', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 20_000);
    // Snapshot posterior zera só a reação; a provocação continua válida.
    tracker.noteState(16_000, 25_000, null, 26_000);
    expect(tracker.remainingSender('reaction', 26_000)).toBe(0);
    expect(tracker.remainingSender('taunt', 26_000)).toBe(9_000);
    // Recusa atrasada da categoria já encerrada não reaparece.
    tracker.noteRetry('reaction', { serverTime: 10_000, retryAt: 15_000, scope: 'sender' }, 26_000);
    expect(tracker.remainingSender('reaction', 26_000)).toBe(0);
  });

  it('cota de alvo tem ordem própria por id e aceite antigo não apaga recusa nova', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteRetry('taunt', { serverTime: 10_000, retryAt: 70_000, scope: 'target', targetId: 'bia' }, 20_000);
    tracker.noteRetry('taunt', { serverTime: 10_000, retryAt: 70_000, scope: 'target', targetId: 'bia' }, 20_500);
    expect(tracker.remainingTarget('bia', 20_500)).toBe(59_500);
    // Aceite com serverTime anterior à recusa não limpa a cota.
    tracker.clearTarget('bia', 9_000);
    expect(tracker.remainingTarget('bia', 20_500)).toBe(59_500);
    // Aceite mais novo libera o alvo, sem tocar a cota de outro id.
    tracker.noteRetry('taunt', { serverTime: 11_000, retryAt: 71_000, scope: 'target', targetId: 'cai' }, 20_500);
    tracker.clearTarget('bia', 11_000);
    expect(tracker.remainingTarget('bia', 20_500)).toBe(0);
    expect(tracker.remainingTarget('cai', 20_500)).toBe(60_000);
  });

  it('dados recebidos em ordem adversa não perdem a categoria válida', () => {
    const tracker = new MoodLimitTracker();
    // Estado novo primeiro; ack antigo chega depois e é ignorado por inteiro.
    tracker.noteState(30_000, null, null, 30_000);
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 30_100);
    expect(tracker.remainingSender('taunt', 30_100)).toBe(0);
    // Ack novo depois do estado entra normalmente nas duas categorias.
    tracker.noteSender('taunt', { serverTime: 31_000, nextSendAt: 46_000 }, 31_000);
    expect(tracker.remainingSender('taunt', 32_000)).toBe(14_000);
  });
});

/**
 * Complemento R2 (S1/S2): validade por escopo com referência comum que não
 * retrocede. Reproduções do orquestrador + ordens adversas, tombstones,
 * expiração e recuperação.
 */
describe('independência entre escopos com referência comum', () => {
  it('reação válida atrasada entra sem sumir por causa de provocação mais nova', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('taunt', { serverTime: 11_000, nextSendAt: 26_000 }, 21_000);
    // O aceite da reação é mais antigo, mas é o único conhecimento do escopo.
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 21_500);
    expect(tracker.remainingSender('reaction', 21_500)).toBe(3_500);
    expect(tracker.remainingSender('taunt', 21_500)).toBe(14_500);
    // Não reancora na chegada: o prazo continua correndo na referência comum.
    expect(tracker.remainingSender('reaction', 22_000)).toBe(3_000);
    expect(tracker.remainingSender('taunt', 22_000)).toBe(14_000);
  });

  it('recusa válida do alvo Bia não desaparece por chegar após dado mais novo do alvo Cai', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteRetry('taunt', { serverTime: 11_000, retryAt: 71_000, scope: 'target', targetId: 'cai' }, 21_000);
    tracker.noteRetry('taunt', { serverTime: 10_000, retryAt: 70_000, scope: 'target', targetId: 'bia' }, 21_500);
    expect(tracker.remainingTarget('bia', 21_500)).toBe(58_500);
    expect(tracker.remainingTarget('cai', 21_500)).toBe(59_500);
    // Ordem inversa: o alvo antigo primeiro e o novo depois também preserva os dois.
    const reversed = new MoodLimitTracker();
    reversed.noteRetry('taunt', { serverTime: 10_000, retryAt: 70_000, scope: 'target', targetId: 'bia' }, 21_500);
    reversed.noteRetry('taunt', { serverTime: 11_000, retryAt: 71_000, scope: 'target', targetId: 'cai' }, 22_000);
    expect(reversed.remainingTarget('bia', 22_000)).toBe(59_000);
    expect(reversed.remainingTarget('cai', 22_000)).toBe(60_000);
  });

  it('janela encerrada por estado autoritativo não ressuscita com replay antigo', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 20_000);
    tracker.noteState(16_000, null, null, 26_000);
    expect(tracker.remainingSender('taunt', 26_000)).toBe(0);
    // Replay do aceite superado pelo estado é rejeitado no próprio escopo.
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 27_000);
    expect(tracker.remainingSender('taunt', 27_000)).toBe(0);
    // Informação realmente nova volta a valer.
    tracker.noteSender('taunt', { serverTime: 17_000, nextSendAt: 32_000 }, 27_000);
    expect(tracker.remainingSender('taunt', 27_000)).toBe(15_000);
  });

  it('expiração e recuperação: prazo vencido não reinicia com o mesmo ack', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    expect(tracker.remainingSender('reaction', 26_000)).toBe(0);
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 27_000);
    expect(tracker.remainingSender('reaction', 27_000)).toBe(0);
    tracker.noteSender('reaction', { serverTime: 28_000, nextSendAt: 33_000 }, 28_000);
    expect(tracker.remainingSender('reaction', 29_000)).toBe(4_000);
  });

  it('liberação e recusa de alvo mantêm a ordem do próprio escopo', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteRetry('taunt', { serverTime: 20_000, retryAt: 80_000, scope: 'target', targetId: 'bia' }, 30_000);
    expect(tracker.remainingTarget('bia', 30_000)).toBe(60_000);
    // Aceite anterior à recusa não libera; no mesmo instante, libera (tombstone).
    tracker.clearTarget('bia', 19_000);
    expect(tracker.remainingTarget('bia', 30_000)).toBe(60_000);
    tracker.clearTarget('bia', 20_000);
    expect(tracker.remainingTarget('bia', 30_000)).toBe(0);
    // Recusa superada não ressuscita a espera; recusa mais nova volta a valer.
    tracker.noteRetry('taunt', { serverTime: 19_000, retryAt: 79_000, scope: 'target', targetId: 'bia' }, 31_000);
    expect(tracker.remainingTarget('bia', 31_000)).toBe(0);
    tracker.noteRetry('taunt', { serverTime: 21_000, retryAt: 81_000, scope: 'target', targetId: 'bia' }, 31_000);
    expect(tracker.remainingTarget('bia', 31_000)).toBe(60_000);
  });

  it('estado com janela nula no mesmo instante não bloqueia um aceite novo do escopo', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteState(1_000, null, null, 1_000);
    tracker.noteSender('taunt', { serverTime: 1_000, nextSendAt: 16_000 }, 1_000);
    expect(tracker.remainingSender('taunt', 1_000)).toBe(15_000);
    // Replay idêntico é idempotente e não reancora.
    tracker.noteSender('taunt', { serverTime: 1_000, nextSendAt: 16_000 }, 1_500);
    expect(tracker.remainingSender('taunt', 1_500)).toBe(14_500);
    expect(tracker.remainingSender('reaction', 1_000)).toBe(0);
  });
});

/**
 * Ajuste S2 (U1/U2): referência comum monotônica e empates desempatados pela
 * origem do fato. Reproduções do orquestrador + avanço real, recusa posterior
 * e repetições/intercalações.
 */
describe('referência monotônica e empates por origem', () => {
  it('timestamp ligeiramente maior não retrocede a estimativa já decorrida', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    expect(tracker.remainingSender('reaction', 24_000)).toBe(1_000);
    // 10001 > 10000, mas a estimativa já era 14000 no local 24000.
    tracker.noteSender('taunt', { serverTime: 10_001, nextSendAt: 25_001 }, 24_000);
    expect(tracker.remainingSender('reaction', 24_000)).toBe(1_000);
    expect(tracker.remainingSender('taunt', 24_000)).toBe(11_001);
    // O tempo continua correndo na mesma referência.
    expect(tracker.remainingSender('reaction', 24_500)).toBe(500);
  });

  it('timestamp realmente adiantado avança a referência', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    tracker.noteSender('taunt', { serverTime: 30_000, nextSendAt: 45_000 }, 25_000);
    expect(tracker.remainingSender('reaction', 25_000)).toBe(0);
    expect(tracker.remainingSender('taunt', 25_000)).toBe(15_000);
    expect(tracker.remainingSender('taunt', 35_000)).toBe(5_000);
  });

  it('replay do snapshot nulo no mesmo milissegundo não apaga aceite posterior', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteState(10_000, null, null, 20_000);
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_000);
    expect(tracker.remainingSender('reaction', 20_500)).toBe(4_500);
    tracker.noteState(10_000, null, null, 20_500);
    expect(tracker.remainingSender('reaction', 20_500)).toBe(4_500);
    // Alternar estado/aceite antigos não muda mais o estado.
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_600);
    tracker.noteState(10_000, null, null, 20_700);
    tracker.noteSender('reaction', { serverTime: 10_000, nextSendAt: 15_000 }, 20_800);
    expect(tracker.remainingSender('reaction', 20_800)).toBe(4_200);
  });

  it('replay da recusa no mesmo milissegundo não ressuscita alvo liberado', () => {
    const tracker = new MoodLimitTracker();
    const retry = { serverTime: 10_000, retryAt: 70_000, scope: 'target' as const, targetId: 'bia' };
    tracker.noteRetry('taunt', retry, 20_000);
    tracker.clearTarget('bia', 10_000);
    expect(tracker.remainingTarget('bia', 20_500)).toBe(0);
    // Repetições intercaladas da recusa continuam sem efeito.
    tracker.noteRetry('taunt', retry, 20_500);
    tracker.clearTarget('bia', 10_000);
    tracker.noteRetry('taunt', retry, 20_700);
    expect(tracker.remainingTarget('bia', 20_700)).toBe(0);
    // Recusa realmente posterior (timestamp maior) volta a bloquear.
    const later = { serverTime: 10_001, retryAt: 70_001, scope: 'target' as const, targetId: 'bia' };
    tracker.noteRetry('taunt', later, 20_800);
    expect(tracker.remainingTarget('bia', 20_800)).toBe(59_201);
  });

  it('estado autoritativo mais novo continua encerrando a janela', () => {
    const tracker = new MoodLimitTracker();
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 20_000);
    tracker.noteState(10_001, null, null, 20_500);
    expect(tracker.remainingSender('taunt', 20_500)).toBe(0);
    // Replay do aceite superado não a reabre.
    tracker.noteSender('taunt', { serverTime: 10_000, nextSendAt: 25_000 }, 21_000);
    expect(tracker.remainingSender('taunt', 21_000)).toBe(0);
  });
});
