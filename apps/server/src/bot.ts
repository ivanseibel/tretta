import { COLORS, type Color, type PlayerView } from '@tretta/rules';

/**
 * Decisão do substituto automático. Sempre uma das três ações simples do motor;
 * o substituto nunca denuncia nem avisa a última carta fora do descarte.
 */
export type BotDecision =
  | {
      readonly type: 'play';
      readonly cardId: string;
      readonly chosenColor?: Color;
      readonly announceLastCard?: boolean;
    }
  | { readonly type: 'draw' }
  | { readonly type: 'pass' };

/**
 * Política simples aprovada, decidida apenas com a projeção da própria mão e
 * informações públicas:
 * - na fase de descarte, joga a primeira carta válida na ordem da mão,
 *   preferindo coloridas a coringas;
 * - coringa escolhe a cor mais presente entre as cartas coloridas da mão,
 *   com desempate pela ordem canônica `COLORS` (vermelho > amarelo > verde > azul);
 * - avisa "Última carta!" junto do descarte que deixa exatamente uma carta;
 * - depois de comprar, joga somente a carta recém-comprada quando válida; senão passa;
 * - sem carta válida na fase de descarte, compra.
 * Retorna null quando não é a vez deste assento ou a rodada não está em andamento.
 */
export function decideBotCommand(view: PlayerView): BotDecision | null {
  if (view.status !== 'playing' || view.currentPlayerId !== view.viewerId) return null;

  if (view.phase === 'after-draw') {
    const drawnId = view.drawnCardId;
    if (drawnId !== null && view.playableCardIds.includes(drawnId)) {
      const drawn = view.hand.find((card) => card.id === drawnId);
      if (drawn !== undefined) return playDecision(view, drawn.id, drawn.kind === 'wild');
    }
    return { type: 'pass' };
  }

  const playable = new Set(view.playableCardIds);
  const colored = view.hand.find((card) => playable.has(card.id) && card.kind !== 'wild');
  const pick = colored ?? view.hand.find((card) => playable.has(card.id));
  if (pick === undefined) return { type: 'draw' };
  return playDecision(view, pick.id, pick.kind === 'wild');
}

function playDecision(view: PlayerView, cardId: string, isWild: boolean): BotDecision {
  const base = { type: 'play' as const, cardId };
  const withColor = isWild ? { ...base, chosenColor: mostPresentColor(view.hand) } : base;
  return view.hand.length - 1 === 1 ? { ...withColor, announceLastCard: true } : withColor;
}

/**
 * Cor mais presente entre as cartas coloridas da mão (coringas não contam).
 * Empate resolvido pela ordem de `COLORS`; sem cartas coloridas, escolhe a
 * primeira cor da ordem canônica.
 */
export function mostPresentColor(hand: PlayerView['hand']): Color {
  const counts = new Map<Color, number>();
  for (const card of hand) {
    if (card.kind !== 'wild') counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }
  let best: Color = COLORS[0] ?? 'red';
  let bestCount = -1;
  for (const color of COLORS) {
    const count = counts.get(color) ?? 0;
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}
