'use client';

import type { ReactNode } from 'react';
import type { AutomaticEffect, EffectVariant, TauntEvent } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { TAUNT_EMOJI, TAUNT_LABELS } from '@/lib/mood';
import { describeAutomaticEffect } from '@/lib/labels';

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

function TauntCaption({ taunt }: { taunt: TauntEvent }): ReactNode {
  return (
    <span className="taunt-caption" data-testid={`taunt-caption-${taunt.id}`}>
      {taunt.sender.nickname} mandou {TAUNT_LABELS[taunt.type].toLowerCase()} em {taunt.target.nickname}!
    </span>
  );
}

function EffectPresentation({ effect }: { effect: AutomaticEffect }): ReactNode {
  return (
    <div
      className={`taunt-effect fx-effect fx-${effect.variant}`}
      data-testid={`auto-effect-${effect.category}`}
      data-effect-id={effect.id}
      data-effect-variant={effect.variant}
    >
      <span className="taunt-emoji" aria-hidden="true">
        {EFFECT_EMOJI[effect.variant]}
      </span>
      <span className="taunt-caption" data-testid={`auto-effect-caption-${effect.id}`}>
        {describeAutomaticEffect(effect)}
      </span>
    </div>
  );
}

/**
 * Camada de apresentações transitórias sobre a sala: a fila serial entrega um
 * item por vez (efeito automático ou provocação) e ele some sozinho, sem
 * histórico e sem toque no conteúdo da página (`pointer-events: none`).
 * `data-anim` aplica o modo efetivo de preferência via CSS; o `aria-live`
 * anuncia cada item uma vez.
 */
export function TauntOverlay(): ReactNode {
  const { activePresentation, activeAnimations } = useRoom();
  if (activePresentation === null) return null;
  return (
    <div
      className="taunt-overlay"
      aria-live="polite"
      data-testid="taunt-overlay"
      data-anim={activeAnimations}
    >
      {activePresentation.kind === 'taunt' ? (
        <div
          key={activePresentation.id}
          className={`taunt-effect taunt-${activePresentation.taunt.type}`}
          data-testid={`taunt-effect-${activePresentation.taunt.type}`}
          data-taunt-id={activePresentation.id}
        >
          <span className="taunt-emoji" aria-hidden="true">
            {TAUNT_EMOJI[activePresentation.taunt.type]}
          </span>
          <TauntCaption taunt={activePresentation.taunt} />
        </div>
      ) : (
        <EffectPresentation key={activePresentation.id} effect={activePresentation.effect} />
      )}
    </div>
  );
}
