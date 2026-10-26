'use client';

import type { ReactNode } from 'react';
import type { Card } from '@tretta/rules';
import { ColorSymbol } from '@/components/ui';
import { COLOR_LABELS } from '@/lib/labels';

/** Rosto de carta compartilhado pela mão e pelo descarte. Cor nunca é o único canal. */
export function CardFace({ card, size = 'normal' }: { card: Card; size?: 'normal' | 'discard' }): ReactNode {
  const colorLabel = card.kind === 'wild' ? 'Coringa' : COLOR_LABELS[card.color];
  const short = card.kind === 'number' ? String(card.value) : card.kind === 'action' ? actionShort(card.action) : card.variant === 'color' ? 'Cor' : '+4';
  const actionName = card.kind === 'action' ? actionLabel(card.action) : null;
  return (
    <>
      <span className="tv2-card-color" aria-hidden="true">
        {colorLabel}
      </span>
      <span className="tv2-card-center" aria-hidden="true">
        {card.kind === 'number' ? (
          <span className="tv2-card-rank">{short}</span>
        ) : (
          <>
            <span className="tv2-card-action">{short}</span>
            {actionName === null ? null : <span className="tv2-card-action-name">{actionName}</span>}
          </>
        )}
      </span>
      <span className="tv2-card-foot" aria-hidden="true">
        {card.kind === 'wild' ? (
          <span className="tv2-card-wild-colors">
            <ColorSymbol color="red" />
            <ColorSymbol color="yellow" />
            <ColorSymbol color="green" />
            <ColorSymbol color="blue" />
          </span>
        ) : (
          <ColorSymbol color={card.color} />
        )}
      </span>
      {size === 'discard' ? <span className="tv2-card-discard-label">descarte</span> : null}
    </>
  );
}

function actionShort(action: 'skip' | 'reverse' | 'draw-two'): string {
  if (action === 'skip') return '⊘';
  if (action === 'reverse') return '↺';
  return '+2';
}

function actionLabel(action: 'skip' | 'reverse' | 'draw-two'): string {
  if (action === 'skip') return 'Bloqueio';
  if (action === 'reverse') return 'Inversão';
  return 'Compra 2';
}
