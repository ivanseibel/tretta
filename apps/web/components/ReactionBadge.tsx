'use client';

import type { ReactNode } from 'react';
import type { ReactionEvent } from '@tretta/protocol';
import type { AnimationPreference } from '@/lib/prefs';
import { REACTION_EMOJI, REACTION_LABELS } from '@/lib/mood';

/**
 * Reação transitória junto à identificação do emissor. `compact` cabe nos
 * assentos pequenos (emoji + rótulo acessível); nas listas há também o texto.
 * A remoção é feita pelo provider após quatro segundos, em qualquer modo.
 */
export function ReactionBadge({
  reaction,
  animations,
  compact = false,
  className,
}: {
  reaction: ReactionEvent | undefined;
  animations: AnimationPreference;
  compact?: boolean;
  className?: string;
}): ReactNode {
  if (reaction === undefined) return null;
  return (
    <span
      className={`reaction-badge${compact ? ' reaction-compact' : ''}${className === undefined ? '' : ` ${className}`}`}
      data-testid={`reaction-badge-${reaction.sender.playerId}`}
      data-reaction-id={reaction.id}
      data-reaction-type={reaction.type}
      data-anim={animations}
      title={`Reagiu: ${REACTION_LABELS[reaction.type]}`}
    >
      <span className="reaction-emoji" aria-hidden="true">{REACTION_EMOJI[reaction.type]}</span>
      {compact ? (
        <span className="visually-hidden">{REACTION_LABELS[reaction.type]}</span>
      ) : (
        <span className="reaction-label">{REACTION_LABELS[reaction.type]}</span>
      )}
    </span>
  );
}
