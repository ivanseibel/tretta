'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ReactionEvent } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { REACTION_EMOJI, REACTION_LABELS } from '@/lib/mood';
import { REACTION_PRESENTATION_MS } from '@/lib/mood';
import './reactions.css';

/** Máximo de reações na sequência visual; a excedente é descartada. */
const MAX_NA_FILA = 3;

/**
 * Apresentação central de reações. Entra, fica 4 s e sai suave; a fila aceita
 * até três e o excedente é descartado. `pointer-events: none`, sem escurecer a
 * mesa, e silenciosa. O anúncio acessível fica no MoodAnnouncer, uma vez por
 * evento; este palco é só visual.
 */
export function ReactionOverlay(): ReactNode {
  const { activeReactions, preferences, activeAnimations } = useRoom();
  const [fila, setFila] = useState<readonly ReactionEvent[]>([]);
  const vistosRef = useRef<Set<string>>(new Set());
  const montadoRef = useRef(false);

  useEffect(() => {
    if (preferences.hideReactions) {
      vistosRef.current.clear();
      setFila([]);
      return;
    }
    // A primeira passagem só registra o que já estava ativo: nada é
    // reapresentado por abrir a página ou remontar a camada.
    if (!montadoRef.current) {
      montadoRef.current = true;
      for (const reaction of Object.values(activeReactions)) vistosRef.current.add(reaction.id);
      return;
    }
    const entrantes = Object.values(activeReactions).filter(
      (reaction) => !vistosRef.current.has(reaction.id),
    );
    if (entrantes.length === 0) return;
    for (const reaction of entrantes) vistosRef.current.add(reaction.id);
    setFila((anterior) => {
      const proxima = [...anterior];
      for (const reaction of entrantes) {
        if (proxima.length >= MAX_NA_FILA) break;
        proxima.push(reaction);
      }
      return proxima;
    });
  }, [activeReactions, preferences.hideReactions]);

  useEffect(() => {
    if (fila.length === 0) return;
    const timer = globalThis.setTimeout(() => {
      setFila((anterior) => anterior.slice(1));
    }, REACTION_PRESENTATION_MS);
    return () => globalThis.clearTimeout(timer);
  }, [fila]);

  const atual = fila[0];
  if (atual === undefined || preferences.hideReactions) return null;

  return (
    <div
      className="tv2-reaction-overlay"
      data-testid="reaction-overlay"
      data-anim={activeAnimations}
      data-reaction-id={atual.id}
      data-reaction-type={atual.type}
      aria-hidden="true"
    >
      <div className="tv2-reaction-palco" key={atual.id}>
        <span className="tv2-reaction-faisca tv2-reaction-faisca--a" aria-hidden="true">
          {REACTION_EMOJI[atual.type]}
        </span>
        <span className="tv2-reaction-faisca tv2-reaction-faisca--b" aria-hidden="true">
          {REACTION_EMOJI[atual.type]}
        </span>
        <span className="tv2-reaction-faisca tv2-reaction-faisca--c" aria-hidden="true">
          {REACTION_EMOJI[atual.type]}
        </span>
        <span className="tv2-reaction-emoji" aria-hidden="true">
          {REACTION_EMOJI[atual.type]}
        </span>
        <p className="tv2-reaction-nome">
          <strong>{atual.sender.nickname}</strong>
          <span aria-hidden="true"> · </span>
          {REACTION_LABELS[atual.type]}
        </p>
      </div>
    </div>
  );
}
