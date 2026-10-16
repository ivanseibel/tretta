import { expect } from 'vitest';
import {
  type ActionKind,
  applyCommand,
  type Card,
  type Color,
  type CommandResult,
  type Direction,
  type LastCardWindow,
  type NumberValue,
  type RandomSource,
  type RoundCommand,
  type RoundEvent,
  type RoundState,
  type TurnPhase,
  type WildVariant,
} from '../src/index.js';

export function num(id: string, color: Color, value: NumberValue): Card {
  return { id, kind: 'number', color, value };
}

export function act(id: string, color: Color, action: ActionKind): Card {
  return { id, kind: 'action', color, action };
}

export function wild(id: string, variant: WildVariant): Card {
  return { id, kind: 'wild', variant };
}

export interface FixtureInit {
  /** Ordem das chaves é a ordem dos assentos e dos turnos. */
  readonly hands: Readonly<Record<string, readonly Card[]>>;
  /** Topo do descarte no último índice. */
  readonly discard: readonly Card[];
  readonly drawPile?: readonly Card[];
  readonly current?: string;
  readonly direction?: Direction;
  readonly activeColor?: Color;
  readonly phase?: TurnPhase;
  readonly drawnCardId?: string | null;
  readonly lastCard?: LastCardWindow | null;
}

/** Estado controlado para cenários determinísticos; não é API de produção. */
export function makeState(init: FixtureInit): RoundState {
  const ids = Object.keys(init.hands);
  const top = init.discard[init.discard.length - 1];
  if (top === undefined) throw new Error('fixture sem descarte');
  const current = init.current ?? ids[0];
  const currentIndex = ids.indexOf(current ?? '');
  if (currentIndex < 0) throw new Error(`fixture sem jogador ${String(current)}`);
  return {
    status: 'playing',
    seats: ids.map((id) => ({ id, hand: [...(init.hands[id] ?? [])] })),
    drawPile: [...(init.drawPile ?? [])],
    discardPile: [...init.discard],
    currentIndex,
    direction: init.direction ?? 'clockwise',
    activeColor: init.activeColor ?? (top.kind === 'wild' ? 'red' : top.color),
    phase: init.phase ?? 'play',
    drawnCardId: init.drawnCardId ?? null,
    lastCard: init.lastCard ?? null,
    winnerId: null,
  };
}

/** Fonte constante: útil para embaralhamentos determinísticos sem laço. */
export const zeroRandom: RandomSource = () => 0;

export function run(state: RoundState, command: RoundCommand, random: RandomSource = zeroRandom): CommandResult {
  return applyCommand(state, command, random);
}

/** Aplica e exige sucesso; devolve estado e eventos. */
export function expectOk(result: CommandResult): { state: RoundState; events: readonly RoundEvent[] } {
  if (!result.ok) {
    throw new Error(`comando recusado: ${result.error.code} — ${result.error.message}`);
  }
  return { state: result.state, events: result.events };
}

/** Exige rejeição com o código informado e mensagem explicativa. */
export function expectRejected(result: CommandResult, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message.length).toBeGreaterThan(0);
}

export function snapshot(state: RoundState): string {
  return JSON.stringify(state);
}

export function allCardIds(state: RoundState): string[] {
  return [...state.seats.flatMap((seat) => seat.hand), ...state.drawPile, ...state.discardPile].map((card) => card.id);
}

export function handIds(state: RoundState, playerId: string): string[] {
  return state.seats.find((seat) => seat.id === playerId)?.hand.map((card) => card.id) ?? [];
}

export function currentId(state: RoundState): string | undefined {
  return state.seats[state.currentIndex]?.id;
}
