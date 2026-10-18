'use client';

import type { ReactNode } from 'react';
import { useRoom } from '@/app/providers';
import type { AnimationPreference } from '@/lib/prefs';

const ANIMATION_OPTIONS: readonly { value: AnimationPreference; label: string }[] = [
  { value: 'full', label: 'Completa' },
  { value: 'reduced', label: 'Reduzida' },
  { value: 'off', label: 'Desligada' },
];

/**
 * Preferências de apresentação deste navegador: animação, som, ocultação de
 * provocações recebidas e de reações. Individuais e sem conta — valem só nesta
 * aba de armazenamento e não alteram sala, motor nem a visão dos demais.
 */
export function MoodSettings(): ReactNode {
  const { preferences, activeAnimations, setPreferences } = useRoom();
  const systemLimited = activeAnimations !== preferences.animations;
  return (
    <section className="mood-settings" data-testid="mood-settings" aria-labelledby="mood-settings-title">
      <h2 id="mood-settings-title">Apresentação</h2>
      <fieldset className="mood-fieldset">
        <legend>Animações</legend>
        {ANIMATION_OPTIONS.map((option) => (
          <label key={option.value} className="mood-option">
            <input
              type="radio"
              name="mood-animations"
              value={option.value}
              data-testid={`pref-animations-${option.value}`}
              checked={preferences.animations === option.value}
              onChange={() => setPreferences({ animations: option.value })}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="mood-option">
        <input
          type="checkbox"
          data-testid="pref-sound-mute"
          checked={preferences.soundMuted}
          onChange={(event) => setPreferences({ soundMuted: event.target.checked })}
        />
        Silenciar sons
      </label>
      <label className="mood-option">
        <input
          type="checkbox"
          data-testid="pref-turn-notification"
          checked={preferences.turnNotificationEnabled}
          onChange={(event) => setPreferences({ turnNotificationEnabled: event.target.checked })}
        />
        Aviso sonoro da sua vez
      </label>
      <label className="mood-option">
        <input
          type="checkbox"
          data-testid="pref-hide-taunts"
          checked={preferences.hideTaunts}
          onChange={(event) => setPreferences({ hideTaunts: event.target.checked })}
        />
        Ocultar provocações recebidas
      </label>
      <label className="mood-option">
        <input
          type="checkbox"
          data-testid="pref-hide-reactions"
          checked={preferences.hideReactions}
          onChange={(event) => setPreferences({ hideReactions: event.target.checked })}
        />
        Ocultar reações
      </label>
      {systemLimited ? (
        <p className="mood-note" data-testid="pref-animations-note">
          Movimento reduzido pelo sistema: a animação completa está limitada a reduzida.
        </p>
      ) : null}
    </section>
  );
}
