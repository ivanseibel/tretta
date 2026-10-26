'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { Direction } from '@tretta/rules';
import type { PublicParticipant, ReactionEvent } from '@tretta/protocol';
import type { AnimationPreference } from '@/lib/prefs';
import { SeatDialog, type SeatDialogData } from './SeatDialog';
import { SeatPlate, type SeatViewData } from './SeatPlate';
import { pawnPosition, seatPositions } from './layout';

export interface SeatRailPlayer {
  readonly id: string;
  readonly handCount: number;
}

export interface SeatRailProps {
  readonly players: readonly SeatRailPlayer[];
  readonly direction: Direction;
  readonly currentPlayerId: string | null;
  readonly selfId: string | null;
  readonly participants: readonly PublicParticipant[];
  readonly paused: boolean;
  readonly roundFinished: boolean;
  readonly variant: 'table' | 'public';
  readonly onAvatarActivate?: (playerId: string, trigger: HTMLElement) => void;
  readonly reactions?: Readonly<Record<string, ReactionEvent>>;
  readonly animations?: AnimationPreference;
}

function labelOf(seat: SeatViewData): string {
  if (seat.isSelf) return `Você (${seat.nickname})`;
  return seat.isBot ? `${seat.nickname} (bot)` : seat.nickname;
}

/**
 * Trilho contínuo em SVG, assentos 2–8 distribuídos pela base, laterais e topo,
 * peão ao lado de quem joga e ordem do percurso no sentido vigente. Nenhum
 * jogador é escondido; nomes curtos quebram linha e longos abrem o nome completo
 * em diálogo.
 */
export function SeatRail({
  players,
  direction,
  currentPlayerId,
  selfId,
  participants,
  paused,
  roundFinished,
  variant,
  onAvatarActivate,
  reactions,
  animations = 'full',
}: SeatRailProps): ReactNode {
  const [consulted, setConsulted] = useState<SeatDialogData | null>(null);
  const [trigger] = useState<{ current: HTMLElement | null }>({ current: null });
  const detailsId = useId();

  const count = players.length;
  if (count === 0) return null;

  const positions = seatPositions(count);
  const selfIndex = selfId === null ? -1 : players.findIndex((player) => player.id === selfId);
  const origin = selfIndex >= 0 ? selfIndex : 0;
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const directionLabel = direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';

  const seats: readonly SeatViewData[] = players
    .map((player, index) => {
      const slot = (index - origin + count) % count;
      const position = positions[slot] ?? positions[0];
      if (position === undefined) throw new Error('posição de assento ausente');
      const participant = participantById.get(player.id);
      return {
        id: player.id,
        slot,
        position,
        nickname: participant?.nickname ?? '—',
        handCount: player.handCount,
        participant,
        avatar: participant?.avatar ?? null,
        isSelf: participant !== undefined && participant.id === selfId,
        isCurrent: !paused && !roundFinished && currentPlayerId !== null && player.id === currentPlayerId,
        isBot: participant?.kind === 'bot',
        isDisconnected: participant?.kind === 'human' && !participant.connected,
        isSubstitute: participant?.autoControlled === true,
        isLastCard: !paused && !roundFinished && player.handCount === 1,
      };
    })
    .sort((a, b) => a.slot - b.slot);

  const seatAt = (offset: number): SeatViewData | undefined => seats[((offset % count) + count) % count];
  const base = seatAt(0);
  const travel = Array.from({ length: count }, (_, position) =>
    direction === 'clockwise' ? seatAt(position) : seatAt(-position),
  ).filter((seat): seat is SeatViewData => seat !== undefined);
  const baseLabel = selfIndex >= 0 ? 'a partir da base onde você está' : 'a partir da base';
  const baseName = base === undefined ? '' : labelOf(base);
  const orderText = `Ordem dos assentos no circuito, ${baseLabel}: ${travel.map(labelOf).join(', ')}, de volta a ${baseName}. ${directionLabel} da rodada.`;

  const current = seats.find((seat) => seat.isCurrent);
  const pawn = current === undefined ? null : pawnPosition(current.position);

  return (
    <section
      className={`seat-circuit tv2-seat-circuit tv2-seat-circuit--${variant}`}
      data-testid="seat-circuit"
      aria-label="Ordem dos assentos e sentido da rodada"
      data-direction={direction}
      data-seat-count={count}
    >
      <p className="circuit-caption tv2-circuit-caption" data-testid="circuit-direction">
        Ordem dos assentos · {directionLabel}
        {paused ? ' · rodada pausada' : null}
      </p>
      <div className="tv2-seat-rail">
        <svg
          className="circuit-track tv2-rail-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          focusable="false"
          aria-hidden="true"
        >
          <rect className="tv2-rail-shadow" x="4" y="4" width="92" height="92" rx="9" />
          <rect className="tv2-rail-base" x="4" y="4" width="92" height="92" rx="9" />
          <rect className="tv2-rail-light" x="4.8" y="4.8" width="90.4" height="90.4" rx="8.5" />
        </svg>
        <ol className="seat-list tv2-seat-list">
          {seats.map((seat) => (
            <SeatPlate
              key={seat.id}
              seat={seat}
              variant={variant}
              onAvatarActivate={onAvatarActivate}
              onOpen={(nextSeat) => {
                setConsulted({
                  participant:
                    nextSeat.participant ?? {
                      id: nextSeat.id,
                      kind: 'human',
                      nickname: nextSeat.nickname,
                      avatar: nextSeat.avatar ?? 'lobo',
                      ready: true,
                      connected: !nextSeat.isDisconnected,
                      score: 0,
                      inRound: true,
                      isHost: false,
                      autoControlled: nextSeat.isSubstitute,
                      absentSince: null,
                    },
                  handCount: nextSeat.handCount,
                  isSelf: nextSeat.isSelf,
                  isCurrent: nextSeat.isCurrent,
                  isLastCard: nextSeat.isLastCard,
                });
              }}
              reactions={reactions}
              animations={animations}
              triggerRef={trigger}
            />
          ))}
        </ol>
        {pawn === null ? null : (
          <span
            className="tv2-pawn"
            data-testid="turn-pawn"
            style={{ left: `${String(pawn.left)}%`, top: `${String(pawn.top)}%` } as CSSProperties}
            aria-hidden="true"
          >
            <span className="tv2-pawn-top" />
            <span className="tv2-pawn-body" />
          </span>
        )}
      </div>
      <p className="visually-hidden tv2-sr-only" data-testid="circuit-order">
        {orderText}
      </p>
      <p className="visually-hidden tv2-sr-only" id={detailsId} data-testid="seat-details" hidden={consulted === null}>
        {consulted === null ? null : (
          <>
            Assento consultado: <strong>{consulted.participant.nickname}</strong> · {consulted.handCount} cartas
          </>
        )}
      </p>
      {consulted === null ? null : (
        <SeatDialog
          seat={consulted}
          triggerRef={trigger}
          onClose={() => {
            setConsulted(null);
            globalThis.requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      )}
    </section>
  );
}
