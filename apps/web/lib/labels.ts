import type { Card, Color, RoundEvent } from '@tretta/rules';
import type { AutomaticEffect } from '@tretta/protocol';

export const COLOR_LABELS: Record<Color, string> = {
  red: 'Vermelho',
  yellow: 'Amarelo',
  green: 'Verde',
  blue: 'Azul',
};

export const COLOR_SYMBOLS: Record<Color, string> = {
  red: '●',
  yellow: '◆',
  green: '▲',
  blue: '■',
};

export const ACTION_LABELS: Record<'skip' | 'reverse' | 'draw-two', string> = {
  skip: 'Bloqueio',
  reverse: 'Inversão',
  'draw-two': '+2',
};

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return `${COLOR_LABELS[card.color]} ${card.value}`;
  if (card.kind === 'action') return `${COLOR_LABELS[card.color]} ${ACTION_LABELS[card.action]}`;
  return card.variant === 'color' ? 'Coringa' : 'Coringa +4';
}

export function cardShort(card: Card): string {
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'action') return ACTION_LABELS[card.action];
  return card.variant === 'color' ? 'Cor' : '+4';
}

export interface EventNames {
  nicknameOf: (playerId: string) => string;
  /** Vaga sob controle de substituto automático; a linha passa a atribuir ao substituto. */
  isSubstitute?: (playerId: string) => boolean;
}

export function describeEvent(event: RoundEvent, names: EventNames): string {
  const who = (playerId: string): string =>
    names.isSubstitute?.(playerId) === true ? `Substituto de ${names.nicknameOf(playerId)}` : names.nicknameOf(playerId);
  switch (event.type) {
    case 'played':
      return `${who(event.playerId)} jogou ${cardLabel(event.card)}`;
    case 'drew':
      return event.reason === 'voluntary'
        ? `${who(event.playerId)} comprou uma carta`
        : event.reason === 'challenge'
          ? `${who(event.playerId)} comprou ${event.drawn} por denúncia`
          : `${who(event.playerId)} comprou ${event.drawn} de penalidade`;
    case 'passed':
      return `${who(event.playerId)} passou`;
    case 'turnSkipped':
      return `${who(event.playerId)} foi bloqueado e perde a vez`;
    case 'directionChanged':
      return event.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';
    case 'lastCardAnnounced':
      return `${who(event.playerId)} avisou "Última carta!"`;
    case 'challengeAccepted':
      return `${who(event.challengerId)} denunciou ${names.nicknameOf(event.targetId)}: +${event.penalty} cartas`;
    case 'roundFinished':
      return `${who(event.winnerId)} venceu a rodada!`;
  }
}

/**
 * Legenda curta do efeito automático, com os dados públicos congelados no
 * servidor. Compra de zero cartas não afirma entrega inexistente; a quantidade
 * exibida é a realmente entregue.
 */
export function describeAutomaticEffect(effect: AutomaticEffect): string {
  switch (effect.category) {
    case 'penaltyDraw': {
      if (effect.drawn === 0) return `${effect.targetNickname} não recebeu cartas desta vez`;
      const noun = effect.drawn === 1 ? 'carta' : 'cartas';
      const source = effect.reason === 'challenge' ? 'por denúncia' : 'de penalidade';
      return `${effect.targetNickname} comprou ${effect.drawn} ${noun} ${source}`;
    }
    case 'blocked':
      return `${effect.playerNickname} perdeu a vez`;
    case 'directionReversed':
      return effect.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';
    case 'victory':
      return effect.substitute
        ? `Substituto de ${effect.winnerNickname} venceu a rodada!`
        : `${effect.winnerNickname} venceu a rodada!`;
  }
}
