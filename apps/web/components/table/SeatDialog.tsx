'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { PublicParticipant } from '@tretta/protocol';
import { AvatarBadge } from '@/components/ui';

export interface SeatDialogData {
  readonly participant: PublicParticipant;
  readonly handCount: number;
  readonly isSelf: boolean;
  readonly isCurrent: boolean;
  readonly isLastCard: boolean;
}

/**
 * Diálogo do assento: nome completo, avatar, cartas e etiquetas. É modal,
 * prende o foco no botão de fechar, fecha com Escape ou clique fora e devolve
 * o foco ao nome que o abriu.
 */
export function SeatDialog({
  seat,
  onClose,
  triggerRef,
}: {
  seat: SeatDialogData;
  onClose: () => void;
  triggerRef: { readonly current: HTMLElement | null };
}): ReactNode {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const { participant } = seat;
  const tags = [
    seat.isSelf ? 'você' : null,
    seat.isCurrent ? 'na vez' : null,
    seat.isLastCard ? 'última carta' : null,
    participant.kind === 'bot' ? 'bot' : null,
    participant.autoControlled ? 'substituto' : null,
    participant.kind === 'human' && !participant.connected ? 'caiu' : null,
    participant.isHost ? 'anfitrião' : null,
  ].filter((tag): tag is string => tag !== null);

  return createPortal(
    <div
      className="tv2-seat-dialog-layer"
      data-testid="seat-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="tv2-seat-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="tv2-seat-dialog-top">
          <AvatarBadge avatar={participant.avatar} />
          <div className="tv2-seat-dialog-title">
            <span className="tv2-seat-dialog-eyebrow">assento</span>
            <h2 id={titleId}>{participant.nickname}</h2>
          </div>
        </div>
        <p className="tv2-seat-dialog-count">
          <strong>{seat.handCount}</strong> {seat.handCount === 1 ? 'carta na mão' : 'cartas na mão'}
        </p>
        {tags.length > 0 ? (
          <p className="tv2-seat-dialog-tags">{tags.join(' · ')}</p>
        ) : (
          <p className="tv2-seat-dialog-tags">sem etiquetas</p>
        )}
        <button
          ref={closeRef}
          type="button"
          className="tv2-btn tv2-btn--principal tv2-btn--bloco"
          data-testid="seat-dialog-close"
          onClick={() => {
            onClose();
            globalThis.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          Fechar
        </button>
      </div>
    </div>,
    document.body,
  );
}
