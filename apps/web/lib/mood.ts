import type { ReactionType } from '@tretta/protocol';

/**
 * Rótulos das doze reações sem destinatário, na ordem aprovada no protótipo.
 * Correspondem exatamente aos ids do protocolo e nunca são enviados ao
 * servidor.
 */
export const REACTION_LABELS: Record<ReactionType, string> = {
  eita: 'Eita!',
  injustica: 'Que injustiça!',
  'ai-eu-gostei': 'Aí eu gostei!',
  'nao-acredito': 'Não acredito!',
  'boa-jogada': 'Boa jogada!',
  'que-comedia': 'Que comédia!',
  tedio: 'Que tédio!',
  uau: 'Uau!',
  'ja-era': 'Já era!',
  suspeito: 'Suspeito...',
  carinho: 'Com carinho!',
  fogo: 'Tá pegando fogo!',
};

export const REACTION_EMOJI: Record<ReactionType, string> = {
  eita: '😂',
  injustica: '😭',
  'ai-eu-gostei': '😈',
  'nao-acredito': '🤬',
  'boa-jogada': '👏',
  'que-comedia': '🤡',
  tedio: '🥱',
  uau: '😱',
  'ja-era': '💀',
  suspeito: '🤔',
  carinho: '😘',
  fogo: '🔥',
};

/** Duração fixa da apresentação de uma reação, em qualquer modo de animação. */
export const REACTION_PRESENTATION_MS = 4_000;
/** Feedback breve de envio aceito. */
export const MOOD_FEEDBACK_MS = 2_500;

/** Feedback textual do envio de reação, inclusive com reações ocultas. */
export function reactionFeedback(type: ReactionType): string {
  return `Reação enviada: ${REACTION_LABELS[type]}.`;
}
