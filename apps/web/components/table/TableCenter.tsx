'use client';

import type { ReactNode } from 'react';
import type { Card, Color } from '@tretta/rules';
import { ColorSymbol } from '@/components/ui';
import { COLOR_LABELS, cardLabel } from '@/lib/labels';
import { CardFace } from './CardFace';

/** Centro da mesa: monte com numeral, descarte dominante e cor ativa com nome e símbolo. */
export function TableCenter({
  drawPileCount,
  discardTop,
  activeColor,
}: {
  drawPileCount: number;
  discardTop: Card;
  activeColor: Color;
}): ReactNode {
  return (
    <section className="tv2-table-center" aria-label="Mesa">
      <div className="tv2-table-piles">
        <div
          className="tv2-monte"
          role="img"
          aria-label={`Pilha de compra com ${String(drawPileCount)} cartas`}
          data-testid="draw-pile"
        >
          <span className="tv2-monte-back" aria-hidden="true">
            <span className="tv2-monte-mark">T</span>
          </span>
          <span className="tv2-monte-count" aria-hidden="true">
            <strong>{drawPileCount}</strong>
            <span>cartas</span>
          </span>
        </div>
        <div
          className={`playing-card tv2-card tv2-card--discard card-${discardTop.kind === 'wild' ? 'wild' : discardTop.color}`}
          role="img"
          aria-label={`Descarte: ${cardLabel(discardTop)}`}
          data-testid="discard-top"
          data-card-id={discardTop.id}
          title={cardLabel(discardTop)}
        >
          <CardFace card={discardTop} size="discard" />
        </div>
      </div>
      <span className="tv2-active-color" data-testid="active-color">
        <span className="tv2-active-color-label">cor</span>
        <ColorSymbol color={activeColor} />
        <strong>{COLOR_LABELS[activeColor]}</strong>
      </span>
    </section>
  );
}
