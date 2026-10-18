import type { PublicParticipant, ReactionType, TauntType } from '@tretta/protocol';

/** Rótulos e emojis das quatro provocações direcionadas. */
export const TAUNT_LABELS: Record<TauntType, string> = {
  tomate: 'Tomate voador',
  torta: 'Torta na cara',
  risadas: 'Chuva de risadas',
  choro: 'Choro dramático',
};

export const TAUNT_EMOJI: Record<TauntType, string> = {
  tomate: '🍅',
  torta: '🥧',
  risadas: '😂',
  choro: '😭',
};

/**
 * Rótulos das reações sem destinatário. Correspondem exatamente aos ids do
 * protocolo (`rindo`, `chorando`, `bravo`) e nunca são enviados ao servidor.
 */
export const REACTION_LABELS: Record<ReactionType, string> = {
  rindo: 'Rindo',
  chorando: 'Chorando',
  bravo: 'Bravo',
};

export const REACTION_EMOJI: Record<ReactionType, string> = {
  rindo: '😂',
  chorando: '😭',
  bravo: '😡',
};

/** Duração fixa da apresentação de uma reação, em qualquer modo de animação. */
export const REACTION_PRESENTATION_MS = 4_000;
/** Janela do aviso de resposta, contada da chegada da provocação. */
export const TAUNT_NOTICE_MS = 30_000;
/** Feedback breve de envio aceito. */
export const MOOD_FEEDBACK_MS = 2_500;

/** Feedback textual do envio de reação, inclusive com reações ocultas. */
export function reactionFeedback(type: ReactionType): string {
  return `Reação enviada: ${REACTION_LABELS[type]}.`;
}

/**
 * Alvo pode receber provocação agora? Bot fixo e assento sob substituto
 * continuam elegíveis; humano desconectado sem substituto não.
 */
export function canReceiveTaunt(participant: PublicParticipant | undefined): boolean {
  if (participant === undefined) return false;
  return participant.kind === 'bot' || participant.connected || participant.autoControlled;
}

/** Explicação de indisponibilidade; null quando o alvo está elegível. */
export function unavailableReason(participant: PublicParticipant | undefined): string | null {
  if (participant === undefined) return 'Esta pessoa saiu da sala.';
  if (canReceiveTaunt(participant)) return null;
  return `${participant.nickname} está desconectado(a) e sem substituto no momento.`;
}

/** Rótulo do alvo usado nos menus e no painel; repete avatar/id quando há apelidos iguais. */
export function targetLabel(participant: PublicParticipant, repeatedNickname: boolean): string {
  const suffix = repeatedNickname ? ` · ${participant.avatar} (${participant.id.slice(-4)})` : '';
  return `${participant.nickname}${suffix}`;
}

/** Conta quantas vezes cada apelido aparece entre os participantes atuais. */
export function nicknameCounts(participants: readonly PublicParticipant[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const participant of participants) counts.set(participant.nickname, (counts.get(participant.nickname) ?? 0) + 1);
  return counts;
}
