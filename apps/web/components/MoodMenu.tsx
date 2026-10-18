'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PublicParticipant } from '@tretta/protocol';
import type { ReactionType } from '@tretta/protocol/shared';
import { useRoom, type MoodAnchor } from '@/app/providers';
import {
  REACTION_EMOJI,
  REACTION_LABELS,
  TAUNT_EMOJI,
  TAUNT_LABELS,
  unavailableReason,
} from '@/lib/mood';
import { useSecondTick } from '@/lib/useSecondTick';
import { TAUNT_TYPES, REACTION_TYPES } from '@tretta/protocol/shared';

/** Posição desktop ancorada no controle; no mobile o CSS vira folha inferior. */
function anchoredStyle(anchor: MoodAnchor): CSSProperties {
  const width = 304;
  const margin = 8;
  if (typeof window === 'undefined') return { left: `${margin}px`, top: `${margin}px` };
  const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - margin);
  const heightGuess = 340;
  const placeAbove = anchor.bottom + heightGuess > window.innerHeight && anchor.top > heightGuess;
  return placeAbove
    ? { left: `${left}px`, bottom: `${window.innerHeight - anchor.top + margin}px` }
    : { left: `${left}px`, top: `${Math.max(margin, anchor.bottom + margin)}px` };
}

function ParticipantName({ participant }: { participant: PublicParticipant | undefined }): ReactNode {
  if (participant === undefined) return null;
  return <strong>{participant.nickname}</strong>;
}

/**
 * Menu único de humor. Provocações direcionadas e reações sem destinatário
 * compartilham o mesmo palco: um menu por vez, foco na primeira opção,
 * Escape devolve o foco à origem e tocar fora apenas fecha. O envio é imediato
 * ao escolher; o estado pendente e os intervalos autoritativos desabilitam as
 * opções sem perder a escolha em caso de recusa.
 */
export function MoodMenu(): ReactNode {
  const room = useRoom();
  const menu = room.moodMenu;
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    setError(null);
    setChosen(null);
    sendingRef.current = false;
    globalThis.requestAnimationFrame(() => firstRef.current?.focus({ preventScroll: true }));
  }, [menu]);

  const participants = room.state?.room.participants ?? [];
  const target = menu?.kind === 'taunt' ? participants.find((participant) => participant.id === menu.targetId) : undefined;
  const missingTarget = menu?.kind === 'taunt' && target === undefined;
  const targetReason = menu?.kind === 'taunt' ? (missingTarget ? 'Esta pessoa saiu da sala.' : unavailableReason(target)) : null;
  const senderRemaining = menu === null ? 0 : room.moodRemaining(menu.kind === 'taunt' ? 'taunt' : 'reaction');
  const targetRemaining = menu?.kind === 'taunt' ? room.moodTargetRemaining(menu.targetId) : 0;
  const waitingMs = senderRemaining > 0 ? senderRemaining : targetRemaining;
  const waitingFromTarget = senderRemaining <= 0 && targetRemaining > 0;
  const waitingSeconds = Math.ceil(waitingMs / 1_000);
  useSecondTick(menu !== null && waitingMs > 0);

  if (menu === null) return null;

  const offline = room.connection !== 'live';
  const linkPending = !room.chatLinkReady;
  const disabled =
    offline || linkPending || room.moodPending || targetReason !== null || waitingMs > 0 || sendingRef.current;
  const title =
    menu.kind === 'reaction'
      ? 'Reagir'
      : menu.source === 'respond' && target !== undefined
        ? `Responder a ${target.nickname}`
        : `Provocar ${target?.nickname ?? 'alguém'}`;
  const hint = offline
    ? 'Sem conexão com o servidor. Aguarde a reconexão para enviar.'
    : linkPending
      ? 'Recuperando o vínculo com a sala. Aguarde a confirmação para enviar.'
      : targetReason;

  async function chooseTaunt(type: (typeof TAUNT_TYPES)[number]): Promise<void> {
    if (menu === null || menu.kind !== 'taunt' || disabled || sendingRef.current) return;
    const targetId = menu.targetId;
    const seq = menu.seq;
    sendingRef.current = true;
    setChosen(type);
    setError(null);
    const result = await room.sendTaunt(type, targetId);
    // Conclusão de um menu fechado/substituído não fecha nem escreve no menu
    // vigente, não libera o envio dele e não devolve foco à origem antiga.
    if (!room.isMoodMenuCurrent(seq)) return;
    sendingRef.current = false;
    if (result.ok) {
      room.closeMoodMenu(true);
      return;
    }
    setError(result.error?.message ?? 'Não foi possível enviar a provocação.');
  }

  async function chooseReaction(type: ReactionType): Promise<void> {
    if (menu === null || menu.kind !== 'reaction' || disabled || sendingRef.current) return;
    const seq = menu.seq;
    sendingRef.current = true;
    setChosen(type);
    setError(null);
    const result = await room.sendReaction(type);
    if (!room.isMoodMenuCurrent(seq)) return;
    sendingRef.current = false;
    if (result.ok) {
      room.closeMoodMenu(true);
      return;
    }
    setError(result.error?.message ?? 'Não foi possível enviar a reação.');
  }

  return (
    <div
      className="mood-menu-layer"
      data-testid="mood-menu-layer"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        room.closeMoodMenu(true);
      }}
    >
      <div
        className="mood-backdrop"
        data-testid="mood-backdrop"
        aria-hidden="true"
        onClick={() => room.closeMoodMenu()}
      />
      <section
        className="mood-menu"
        role="dialog"
        aria-modal="false"
        aria-label={title}
        style={anchoredStyle(menu.anchor)}
        data-testid="mood-menu"
        data-menu-kind={menu.kind}
        data-menu-source={menu.kind === 'taunt' ? menu.source : 'self'}
      >
        <header className="mood-menu-header">
          <h2>{title}</h2>
          {menu.kind === 'taunt' ? (
            <p className="muted">
              <ParticipantName participant={target} /> {target?.kind === 'bot' ? '(bot)' : null}
            </p>
          ) : (
            <p className="muted">Sua expressão aparece para toda a sala por alguns segundos.</p>
          )}
        </header>

        {menu.kind === 'taunt' ? (
          <div className="mood-options" role="group" aria-label="Provocações">
            {TAUNT_TYPES.map((type, index) => (
              <button
                key={type}
                ref={index === 0 ? firstRef : undefined}
                type="button"
                className="mood-option"
                aria-label={`${TAUNT_LABELS[type]} — provocar ${target?.nickname ?? 'alvo'}`}
                aria-disabled={disabled}
                data-testid={`mood-taunt-${type}`}
                data-chosen={chosen === type ? 'true' : undefined}
                onClick={() => void chooseTaunt(type)}
              >
                <span className="mood-option-emoji" aria-hidden="true">{TAUNT_EMOJI[type]}</span>
                <span>{TAUNT_LABELS[type]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mood-options" role="group" aria-label="Reações">
            {REACTION_TYPES.map((type, index) => (
              <button
                key={type}
                ref={index === 0 ? firstRef : undefined}
                type="button"
                className="mood-option mood-reaction-option"
                aria-label={`${REACTION_LABELS[type]} — reagir`}
                aria-disabled={disabled}
                data-testid={`mood-reaction-${type}`}
                data-chosen={chosen === type ? 'true' : undefined}
                onClick={() => void chooseReaction(type)}
              >
                <span className="mood-option-emoji" aria-hidden="true">{REACTION_EMOJI[type]}</span>
                <span>{REACTION_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}

        {hint !== null ? (
          <p className="mood-note" data-testid="mood-menu-hint">
            {hint}
          </p>
        ) : null}
        {waitingMs > 0 ? (
          <p className="mood-wait" data-testid="mood-countdown" data-wait-scope={waitingFromTarget ? 'target' : 'sender'}>
            {waitingFromTarget
              ? `Este alvo já recebeu provocações demais. Tente de novo em ${waitingSeconds}s.`
              : `Aguarde ${waitingSeconds}s para enviar de novo.`}
          </p>
        ) : null}
        {room.moodPending ? (
          <p className="muted" role="status" data-testid="mood-menu-pending">
            Enviando…
          </p>
        ) : null}
        {error !== null ? (
          <p className="chat-error" role="alert" data-testid="mood-menu-error">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="secondary mood-menu-close"
          data-testid="mood-menu-close"
          onClick={() => room.closeMoodMenu(true)}
        >
          Fechar
        </button>
      </section>
    </div>
  );
}
