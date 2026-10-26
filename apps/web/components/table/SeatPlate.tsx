'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { PublicParticipant, ReactionEvent } from '@tretta/protocol';
import { AvatarAction, AvatarBadge } from '@/components/ui';
import { ReactionBadge } from '@/components/ReactionBadge';
import type { AnimationPreference } from '@/lib/prefs';
import { isLongName, type SeatPosition } from './layout';

export interface SeatViewData {
  readonly id: string;
  readonly slot: number;
  readonly position: SeatPosition;
  readonly nickname: string;
  readonly handCount: number;
  readonly participant: PublicParticipant | undefined;
  readonly avatar: PublicParticipant['avatar'] | null;
  readonly isSelf: boolean;
  readonly isCurrent: boolean;
  readonly isBot: boolean;
  readonly isDisconnected: boolean;
  readonly isSubstitute: boolean;
  readonly isLastCard: boolean;
}

export function SeatPlate({
  seat,
  variant,
  onAvatarActivate,
  onOpen,
  reactions,
  animations,
  triggerRef,
}: {
  seat: SeatViewData;
  variant: 'table' | 'public';
  onAvatarActivate?: (playerId: string, trigger: HTMLElement) => void;
  onOpen: (seat: SeatViewData, trigger: HTMLButtonElement) => void;
  reactions?: Readonly<Record<string, ReactionEvent>>;
  animations: AnimationPreference;
  triggerRef: { current: HTMLElement | null };
}): ReactNode {
  const long = isLongName(seat.nickname);
  const classes = [
    'seat',
    'tv2-seat',
    `tv2-seat--${seat.position.side}`,
    seat.isCurrent ? 'tv2-seat--current' : '',
    seat.isSelf ? 'tv2-seat--self' : '',
    seat.isDisconnected ? 'tv2-seat--offline' : '',
    seat.isLastCard ? 'tv2-seat--last' : '',
  ].filter(Boolean);
  const handCountTestId = variant === 'table' ? `hand-count-${seat.nickname}` : `public-hand-count-${seat.nickname}`;
  const accessibleTags = [
    seat.isSelf ? 'você' : null,
    seat.isCurrent ? 'na vez' : null,
    seat.isLastCard ? 'última' : null,
    seat.isBot ? 'bot' : null,
    seat.isSubstitute ? 'substituto' : null,
    seat.isDisconnected ? 'caiu, desconectado' : null,
  ].filter((tag): tag is string => tag !== null);
  const accessibleName = `${seat.nickname}${accessibleTags.length > 0 ? `, ${accessibleTags.join(', ')}` : ''}, ${String(seat.handCount)} cartas. Abrir detalhes do assento.`;

  return (
    <li
      className={classes.join(' ')}
      style={{ '--seat-y': `${String(seat.position.top)}%` } as CSSProperties}
      data-testid={`seat-${seat.nickname}`}
      data-player-id={seat.id}
      data-ring-index={seat.slot}
      data-tv2-seat-side={seat.position.side}
      data-self={seat.isSelf ? 'true' : 'false'}
      data-current={seat.isCurrent ? 'true' : 'false'}
      data-last={seat.isLastCard ? 'true' : 'false'}
      aria-current={seat.isCurrent ? 'true' : undefined}
    >
      <button
        type="button"
        className="seat-name tv2-seat-hit"
        aria-label={accessibleName}
        aria-haspopup="dialog"
        data-testid={`seat-name-${seat.slot}`}
        onClick={(event) => {
          triggerRef.current = event.currentTarget;
          onOpen(seat, event.currentTarget);
        }}
      />
      {seat.isCurrent ? (
        <span className="tv2-seat-now" data-testid={`seat-now-${seat.slot}`}>
          na vez
        </span>
      ) : null}
      <span className="tv2-seat-line">
        <span className="tv2-seat-avatar">
          {seat.avatar === null ? (
            <span className="tv2-seat-avatar-empty" aria-hidden="true" />
          ) : onAvatarActivate === undefined ? (
            <AvatarBadge avatar={seat.avatar} size="small" />
          ) : (
            <AvatarAction
              avatar={seat.avatar}
              size="small"
              label={seat.isSelf ? `Reagir como ${seat.nickname}` : `Provocar ${seat.nickname}`}
              testId={`seat-avatar-${seat.slot}`}
              onActivate={(trigger) => onAvatarActivate(seat.id, trigger)}
            />
          )}
          <ReactionBadge
            reaction={reactions?.[seat.id]}
            animations={animations}
            compact
            className="seat-reaction"
          />
        </span>
        <span className={`participant-name tv2-seat-name${long ? ' tv2-seat-name--long' : ''}`} title={seat.nickname}>
          {seat.nickname}
        </span>
      </span>
      <span className="tv2-seat-count" data-testid={handCountTestId}>
        <strong className="hand-count">{seat.handCount}</strong> <span>cartas</span>
      </span>
      <span className="tv2-seat-tags">
        {seat.isLastCard ? <span className="tv2-chip tv2-chip--ultima">última</span> : null}
        {seat.isBot ? <span className="tv2-chip tv2-chip--bot">bot</span> : null}
        {seat.isSubstitute ? <span className="tv2-chip tv2-chip--substituto">substituto</span> : null}
        {seat.isDisconnected ? (
          <span className="status disconnected tv2-chip tv2-chip--offline">
            caiu<span className="tv2-sr-only"> desconectado</span>
          </span>
        ) : null}
        {seat.isSelf ? <span className="tv2-chip tv2-chip--creme">Você</span> : null}
      </span>
    </li>
  );
}
