'use client';

import type { ReactNode } from 'react';
import type { Direction } from '@tretta/rules';
import type { PublicParticipant, ReactionEvent } from '@tretta/protocol';
import type { AnimationPreference } from '@/lib/prefs';
import { SeatRail, type SeatRailPlayer } from './table/SeatRail';
import './table/table.css';

/** Assento do trilho: id estável e contagem pública de cartas na ordem do servidor. */
export type SeatCircuitPlayer = SeatRailPlayer;

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

/**
 * Assentos da rodada no trilho contínuo. A apresentação vive em `SeatRail`;
 * este componente mantém o contrato público usado pela mesa e pela espera.
 */
export function SeatCircuit(props: SeatCircuitProps): ReactNode {
  return <SeatRail {...props} />;
}
