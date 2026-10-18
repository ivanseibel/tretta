'use client';

import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { Direction } from '@tretta/rules';
import type { PublicParticipant, ReactionEvent } from '@tretta/protocol';
import { AvatarAction, AvatarBadge } from '@/components/ui';
import { ReactionBadge } from '@/components/ReactionBadge';
import type { AnimationPreference } from '@/lib/prefs';

/** Assento do circuito: id estável e contagem pública de cartas na ordem do servidor. */
export interface SeatCircuitPlayer {
  readonly id: string;
  readonly handCount: number;
}

interface SeatCircuitProps {
  /** Assentos na ordem da projeção: índices crescentes percorrem o sentido horário. */
  readonly players: readonly SeatCircuitPlayer[];
  readonly direction: Direction;
  readonly currentPlayerId: string | null;
  /** Assento da própria pessoa na base; null na mesa pública, onde o observador fica de fora. */
  readonly selfId: string | null;
  readonly participants: readonly PublicParticipant[];
  readonly paused: boolean;
  readonly roundFinished: boolean;
  /** `table` preserva os identificadores históricos da mesa privada. */
  readonly variant: 'table' | 'public';
  /** Abre o menu de humor do assento (provocação para outros, reação para si). */
  readonly onAvatarActivate?: (playerId: string, trigger: HTMLElement) => void;
  /** Reações ativas por id; a mesa não depende do provider para desenhá-las. */
  readonly reactions?: Readonly<Record<string, ReactionEvent>>;
  readonly animations?: AnimationPreference;
}

const RING_RX = 33;
const RING_RY = 34;
/**
 * Trilho e setas ficam num anel um pouco maior que a órbita dos assentos: os
 * chips crescem com nome e badges e, sem essa margem, cobririam as setas.
 */
const TRACK_SCALE = 1.3;

/** Ponto no oval em percentuais do contêiner: ângulo 0° aponta para a direita e cresce no sentido horário da tela. */
function ringPoint(angleDeg: number, radiusScale = 1): { readonly left: number; readonly top: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    left: 50 + RING_RX * radiusScale * Math.cos(radians),
    top: 50 + RING_RY * radiusScale * Math.sin(radians),
  };
}

/**
 * Rotação da seta (0° aponta para cima) para o movimento entre assentos no sentido dado.
 * O sentido horário percorre índices crescentes; a orientação do ciclo nunca é espelhada.
 */
function arrowRotation(angleDeg: number, direction: Direction): number {
  const radians = (angleDeg * Math.PI) / 180;
  const sign = direction === 'clockwise' ? 1 : -1;
  const dx = sign * -RING_RX * Math.sin(radians);
  const dy = sign * RING_RY * Math.cos(radians);
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

interface SeatView {
  readonly id: string;
  readonly slot: number;
  readonly nickname: string;
  readonly handCount: number;
  readonly avatar: PublicParticipant['avatar'] | null;
  readonly isSelf: boolean;
  readonly isCurrent: boolean;
  readonly isBot: boolean;
  readonly isDisconnected: boolean;
  readonly isSubstitute: boolean;
  readonly point: { readonly left: number; readonly top: number };
}

/** Nome com os rótulos públicos usados no resumo acessível. */
function seatLabel(seat: SeatView): string {
  if (seat.isSelf) return `Você (${seat.nickname})`;
  return seat.isBot ? `${seat.nickname} (bot)` : seat.nickname;
}

/** Rótulos visíveis e consultáveis do assento, na mesma ordem dos badges do chip. */
function seatTags(seat: SeatView): readonly string[] {
  const tags: string[] = [];
  if (seat.isSelf) tags.push('Você');
  if (seat.isBot) tags.push('bot');
  if (seat.isDisconnected) tags.push('desconectado');
  if (seat.isSubstitute) tags.push('substituto');
  if (seat.isCurrent) tags.push('na vez');
  return tags;
}

/**
 * Circuito dos assentos da rodada: a própria pessoa (ou o primeiro assento público)
 * fica na base e os demais seguem o percurso fechado. Setas e texto derivam apenas do
 * estado recebido, então a inversão do sentido aparece de imediato, sem depender da
 * fila de animações; com dois assentos o motor não muda o sentido e nada é anunciado.
 * O resumo acessível descreve o percurso no sentido vigente, com retorno à base; nomes
 * truncados no chip continuam completos no botão do assento e na consulta em texto.
 */
export function SeatCircuit({
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
}: SeatCircuitProps): ReactNode {
  const [consultedId, setConsultedId] = useState<string | null>(null);
  const detailsId = useId();

  const count = players.length;
  if (count === 0) return null;

  const step = 360 / count;
  const selfIndex = selfId === null ? -1 : players.findIndex((player) => player.id === selfId);
  const origin = selfIndex >= 0 ? selfIndex : 0;
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const directionLabel = direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';

  const seats: readonly SeatView[] = players
    .map((player, index) => {
      const slot = (index - origin + count) % count;
      const participant = participantById.get(player.id);
      return {
        id: player.id,
        slot,
        nickname: participant?.nickname ?? '—',
        handCount: player.handCount,
        avatar: participant?.avatar ?? null,
        isSelf: participant !== undefined && participant.id === selfId,
        isCurrent: !paused && !roundFinished && currentPlayerId !== null && player.id === currentPlayerId,
        isBot: participant?.kind === 'bot',
        isDisconnected: participant?.kind === 'human' && !participant.connected,
        isSubstitute: participant?.autoControlled === true,
        point: ringPoint(90 + slot * step),
      };
    })
    .sort((a, b) => a.slot - b.slot);

  const arrows = Array.from({ length: count }, (_, slot) => {
    const angle = 90 + (slot + 0.5) * step;
    const rotation = arrowRotation(angle, direction);
    return { slot, rotation, point: ringPoint(angle, TRACK_SCALE) };
  });

  const seatAt = (offset: number): SeatView | undefined => seats[((offset % count) + count) % count];
  const base = seatAt(0);
  // No sentido anti-horário o percurso desce os índices; o resumo precisa acompanhar o sentido vigente.
  const travel = Array.from({ length: count }, (_, position) =>
    direction === 'clockwise' ? seatAt(position) : seatAt(-position),
  ).filter((seat): seat is SeatView => seat !== undefined);
  const orderNames = travel.map(seatLabel);
  const baseLabel = selfIndex >= 0 ? 'a partir da base onde você está' : 'a partir da base';
  const baseName = base === undefined ? '' : seatLabel(base);
  const orderText = `Ordem dos assentos no circuito, ${baseLabel}: ${orderNames.join(', ')}, de volta a ${baseName}. ${directionLabel} da rodada.`;

  const consulted = seats.find((seat) => seat.id === consultedId);
  const consultedTags = consulted === undefined ? [] : seatTags(consulted);

  return (
    <section className="seat-circuit" data-testid="seat-circuit" aria-label="Ordem dos assentos e sentido da rodada">
      <p className="circuit-caption" data-testid="circuit-direction">
        Ordem dos assentos · {directionLabel}
        {paused ? ' · rodada pausada' : null}
      </p>
      <div className="seat-ring" data-direction={direction}>
        <svg className="circuit-track" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" aria-hidden="true">
          <ellipse cx="50" cy="50" rx={RING_RX * TRACK_SCALE} ry={RING_RY * TRACK_SCALE} />
        </svg>
        {arrows.map((arrow) => (
          <span
            key={arrow.slot}
            className="seat-arrow"
            style={
              {
                left: `${arrow.point.left}%`,
                top: `${arrow.point.top}%`,
                '--rotation': `${arrow.rotation.toFixed(1)}deg`,
              } as CSSProperties
            }
            data-testid={`seat-arrow-${arrow.slot}`}
            data-rotation={arrow.rotation.toFixed(1)}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" focusable="false" aria-hidden="true">
              <path d="M6 0.6 10.6 7.4 6 5.4 1.4 7.4Z" />
            </svg>
          </span>
        ))}
        <ol className="seat-list">
          {seats.map((seat) => (
            <li
              key={seat.id}
              className={`seat${seat.isCurrent ? ' seat-current' : ''}${seat.isSelf ? ' seat-self' : ''}`}
              style={{ left: `${seat.point.left}%`, top: `${seat.point.top}%` }}
              data-testid={`seat-${seat.nickname}`}
              data-player-id={seat.id}
              data-ring-index={seat.slot}
              data-self={seat.isSelf ? 'true' : 'false'}
              data-current={seat.isCurrent ? 'true' : 'false'}
            >
              <span className="seat-avatar">
                {seat.avatar === null ? null : onAvatarActivate === undefined ? (
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
              <button
                type="button"
                className="seat-name"
                aria-expanded={consultedId === seat.id}
                aria-controls={detailsId}
                data-testid={`seat-name-${seat.slot}`}
                onClick={() => {
                  setConsultedId((current) => (current === seat.id ? null : seat.id));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setConsultedId(null);
                }}
              >
                <span className="participant-name" title={seat.nickname}>
                  {seat.nickname}
                </span>
              </button>
              <span className="seat-badges">
                {seat.isSelf ? <span className="tag tag-me">Você</span> : null}
                {seat.isBot ? <span className="tag tag-bot">bot</span> : null}
                {seat.isDisconnected ? <span className="status disconnected">desconectado</span> : null}
                {seat.isSubstitute ? <span className="tag tag-substitute">substituto</span> : null}
                {seat.isCurrent ? <span className="tag tag-turn">na vez</span> : null}
              </span>
              <span
                className="hand-count"
                data-testid={variant === 'table' ? `hand-count-${seat.nickname}` : `public-hand-count-${seat.nickname}`}
              >
                {seat.handCount} cartas
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="seat-details" id={detailsId} data-testid="seat-details" hidden={consulted === undefined}>
        {consulted === undefined ? null : (
          <>
            Assento consultado: <strong>{consulted.nickname}</strong>
            {consultedTags.length > 0 ? ` · ${consultedTags.join(' · ')}` : null} · {consulted.handCount} cartas
          </>
        )}
      </p>
      <p className="visually-hidden" data-testid="circuit-order">
        {orderText}
      </p>
    </section>
  );
}
