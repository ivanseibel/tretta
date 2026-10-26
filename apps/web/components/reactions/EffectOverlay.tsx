'use client';

import type { ReactNode } from 'react';
import type { AutomaticEffect, EffectVariant } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { describeAutomaticEffect } from '@/lib/labels';
import './reactions.css';

/** Uma face por variação; a classe `fx-<variant>` carrega a animação própria. */
const EFFECT_EMOJI: Record<EffectVariant, string> = {
  'cards-rain': '🌧️',
  'cards-avalanche': '🌊',
  'brick-wall': '🧱',
  stumble: '🤕',
  boomerang: '🪃',
  windmill: '🌬️',
  confetti: '🎉',
  trophy: '🏆',
};

function EffectPresentation({ effect }: { effect: AutomaticEffect }): ReactNode {
  return (
    <div
      className={`effect-pill fx-effect fx-${effect.variant}`}
      data-testid={`auto-effect-${effect.category}`}
      data-effect-id={effect.id}
      data-effect-variant={effect.variant}
    >
      <span className="effect-emoji" aria-hidden="true">
        {EFFECT_EMOJI[effect.variant]}
      </span>
      <span className="effect-caption" data-testid={`auto-effect-caption-${effect.id}`}>
        {describeAutomaticEffect(effect)}
      </span>
    </div>
  );
}

/**
 * Apresentações automáticas da mesa (carta vira, troca de sentido, vitória
 * etc.). Reações saíram daqui para a camada própria; provocações não são
 * apresentadas. `data-anim` aplica o modo efetivo de preferência via CSS.
 */
export function EffectOverlay(): ReactNode {
  const { activePresentation, activeAnimations } = useRoom();
  if (activePresentation === null || activePresentation.kind !== 'effect') return null;
  return (
    <div
      className="effect-overlay"
      aria-live="polite"
      data-testid="effect-overlay"
      data-anim={activeAnimations}
    >
      <EffectPresentation key={activePresentation.id} effect={activePresentation.effect} />
    </div>
  );
}
