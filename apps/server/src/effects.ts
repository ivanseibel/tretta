import type { RoundEvent } from '@tretta/rules';
import type { AutomaticEffect, EffectCategory } from '@tretta/protocol';

export interface EffectDerivationOptions {
  readonly roundId: string;
  /** Próximo `seq` de efeitos da sala; monotônico por sala. */
  readonly firstSeq: number;
  /** Escolha cosmética por categoria; RNG separado do de regras. */
  readonly pickVariant: (category: EffectCategory) => AutomaticEffect['variant'];
  readonly nextId: () => string;
  /**
   * Apelido público congelado no instante do lote. `null` (participante já
   * retirado) descarta o efeito em vez de expor identificador cru.
   */
  readonly nicknameOf: (playerId: string) => string | null;
  /**
   * Substituição congelada antes da retirada do substituto, que acontece no
   * `finishRound` logo após o broadcast.
   */
  readonly isSubstitute: (playerId: string) => boolean;
}

/**
 * Deriva os efeitos automáticos de um lote de eventos públicos. Só grupos com
 * categoria aprovada geram efeito: compra voluntária (`drew`/`voluntary`) e
 * encerramento sem vencedor (que não emite eventos) ficam de fora. Não há
 * mãos, pilha nem ids de cartas aqui — só dados públicos já presentes nos
 * eventos, mais apelido e substituição da sala.
 */
export function deriveAutomaticEffects(
  events: readonly RoundEvent[],
  options: EffectDerivationOptions,
): AutomaticEffect[] {
  const effects: AutomaticEffect[] = [];
  let seq = options.firstSeq;
  events.forEach((event, eventIndex) => {
    const base = {
      id: options.nextId(),
      roundId: options.roundId,
      seq,
      eventIndex,
    };
    switch (event.type) {
      case 'drew': {
        if (event.reason !== 'penalty' && event.reason !== 'challenge') return;
        const nickname = options.nicknameOf(event.playerId);
        if (nickname === null) return;
        seq += 1;
        effects.push({
          ...base,
          category: 'penaltyDraw',
          variant: options.pickVariant('penaltyDraw'),
          targetId: event.playerId,
          targetNickname: nickname,
          drawn: event.drawn,
          requested: event.requested,
          reason: event.reason,
        });
        return;
      }
      case 'turnSkipped': {
        const nickname = options.nicknameOf(event.playerId);
        if (nickname === null) return;
        seq += 1;
        effects.push({
          ...base,
          category: 'blocked',
          variant: options.pickVariant('blocked'),
          playerId: event.playerId,
          playerNickname: nickname,
        });
        return;
      }
      case 'directionChanged': {
        seq += 1;
        effects.push({
          ...base,
          category: 'directionReversed',
          variant: options.pickVariant('directionReversed'),
          direction: event.direction,
        });
        return;
      }
      case 'roundFinished': {
        const nickname = options.nicknameOf(event.winnerId);
        if (nickname === null) return;
        seq += 1;
        effects.push({
          ...base,
          category: 'victory',
          variant: options.pickVariant('victory'),
          winnerId: event.winnerId,
          winnerNickname: nickname,
          substitute: options.isSubstitute(event.winnerId),
        });
        return;
      }
      default:
        return;
    }
  });
  return effects;
}
