import { expect } from 'vitest';
import {
  applyCommand,
  type Card,
  type Color,
  COLORS,
  createRoundState,
  createSeededRandom,
  projectForPlayer,
  type RoundCommand,
  type RoundEvent,
  type RoundState,
  startRound,
} from '../src/index.js';
import { cardIdsInJson } from './helpers-privacy.js';
import { playerIdsOf } from './helpers.js';

function totalCardsFor(state: RoundState): number {
  return state.seats.reduce((sum, seat) => sum + seat.hand.length, 0) + state.drawPile.length + state.discardPile.length;
}

/** Guarda externa do teste: detecta falta de progresso sem limitar o motor nem as regras. */
export const MAX_COMMANDS_PER_ROUND = 20_000;

export interface SimulationSummary {
  readonly playerCount: number;
  readonly seed: number;
  readonly winnerId: string;
  readonly commands: number;
  readonly events: Record<string, number>;
  readonly finalCards: number;
}

/**
 * Robô de teste: usa somente a API pública de comandos e as projeções. Joga a primeira
 * carta jogável, compra quando não há jogada, passa após compra sem jogada, avisa
 * última carta e denuncia de forma oportunista. Nunca compra fora das regras.
 */
export function chooseCommand(state: RoundState, botRandom: () => number): RoundCommand {
  const window = state.lastCard;
  if (window !== null && !window.announced) {
    const roll = botRandom();
    if (roll < 0.3) {
      const others = state.seats.filter((seat) => seat.id !== window.playerId);
      const challenger = others[Math.floor(botRandom() * others.length)];
      if (challenger !== undefined) {
        return { type: 'challengeLastCard', playerId: challenger.id, targetId: window.playerId };
      }
    }
    if (roll < 0.6) {
      return { type: 'announceLastCard', playerId: window.playerId };
    }
  }

  const current = state.seats[state.currentIndex];
  if (current === undefined) throw new Error('sem jogador da vez');
  const view = projectForPlayer(state, current.id);

  if (view.phase === 'after-draw') {
    const drawn = view.hand.find((card) => card.id === view.drawnCardId);
    if (drawn !== undefined && view.playableCardIds.includes(drawn.id)) {
      return playCommand(current.id, view.hand, drawn, botRandom);
    }
    return { type: 'pass', playerId: current.id };
  }

  const playableId = view.playableCardIds[Math.floor(botRandom() * view.playableCardIds.length)];
  const card = view.hand.find((candidate) => candidate.id === playableId);
  if (card !== undefined) {
    return playCommand(current.id, view.hand, card, botRandom);
  }
  return { type: 'draw', playerId: current.id };
}

function playCommand(playerId: string, hand: readonly Card[], card: Card, botRandom: () => number): RoundCommand {
  const leavesOne = hand.length - 1 === 1;
  const announceLastCard = leavesOne ? botRandom() < 0.5 : false;
  if (card.kind === 'wild') {
    return { type: 'play', playerId, cardId: card.id, chosenColor: mostCommonColor(hand, botRandom), announceLastCard };
  }
  return { type: 'play', playerId, cardId: card.id, announceLastCard };
}

function mostCommonColor(hand: readonly Card[], botRandom: () => number): Color {
  const counts = new Map<Color, number>();
  for (const card of hand) {
    if (card.kind !== 'wild') counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }
  let best: Color | undefined;
  let bestCount = -1;
  for (const color of COLORS) {
    const count = counts.get(color) ?? 0;
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best ?? COLORS[Math.floor(botRandom() * COLORS.length)] ?? 'red';
}

/**
 * Executa uma rodada completa com aleatoriedade controlada. Em cada passo confere a vez,
 * a quantidade de cartas e a privacidade das projeções e dos eventos.
 */
export function simulateRound(playerCount: number, seed: number): SimulationSummary & { readonly trace: string[] } {
  const playerIds = playerIdsOf(playerCount);
  const gameRandom = createSeededRandom(seed);
  const botRandom = createSeededRandom(seed * 7919 + playerCount);
  let state = createRoundState(startRound({ playerIds, random: gameRandom }));
  const events: Record<string, number> = {};
  const trace: string[] = [];
  let commands = 0;

  while (state.status === 'playing') {
    if (commands >= MAX_COMMANDS_PER_ROUND) {
      throw new Error(`sem progresso após ${commands} comandos (${playerCount} jogadores, semente ${seed})`);
    }
    const command = chooseCommand(state, botRandom);
    const result = applyCommand(state, command, gameRandom);
    if (!result.ok) {
      throw new Error(`robô recebeu recusa ${result.error.code}: ${result.error.message} (semente ${seed})`);
    }
    if ('playerId' in command && (command.type === 'play' || command.type === 'draw' || command.type === 'pass')) {
      expect(command.playerId).toBe(state.seats[state.currentIndex]?.id);
    }
    state = result.state;
    commands++;
    trace.push(describeCommand(command));

    expect(totalCardsFor(state)).toBe(108);
    checkPrivacy(state, result.events);
    for (const event of result.events) {
      events[event.type] = (events[event.type] ?? 0) + 1;
      if (event.type === 'drew' && event.drawn < event.requested) events.partialDraw = (events.partialDraw ?? 0) + 1;
      if (event.type === 'played' && event.card.kind === 'wild') events.wildPlayed = (events.wildPlayed ?? 0) + 1;
      if (event.type === 'played' && event.card.kind === 'action') {
        const key = `action:${event.card.action}`;
        events[key] = (events[key] ?? 0) + 1;
      }
    }
  }

  return {
    playerCount,
    seed,
    winnerId: state.winnerId ?? '',
    commands,
    events,
    finalCards: totalCardsFor(state),
    trace,
  };
}

/** Confere que cada projeção e os eventos contêm somente ids públicos ou da própria mão. */
function checkPrivacy(state: RoundState, events: readonly RoundEvent[]): void {
  const top = state.discardPile[state.discardPile.length - 1]?.id ?? '';
  for (const seat of state.seats) {
    const view = projectForPlayer(state, seat.id);
    const json = JSON.stringify(view);
    expect(json).not.toContain('returnedDuringOpening');
    const allowed = new Set([...seat.hand.map((card) => card.id), top]);
    for (const id of cardIdsInJson(json)) {
      expect(allowed.has(id), `id ${id} vazado para ${seat.id}`).toBe(true);
    }
  }
  const eventIds = cardIdsInJson(JSON.stringify(events));
  for (const id of eventIds) {
    expect(id).toBe(top);
  }
}

function describeCommand(command: RoundCommand): string {
  switch (command.type) {
    case 'play':
      return `${command.playerId}:play:${command.cardId}${command.chosenColor ? `:${command.chosenColor}` : ''}${command.announceLastCard ? ':aviso' : ''}`;
    case 'challengeLastCard':
      return `${command.playerId}:denuncia:${command.targetId}`;
    default:
      return `${command.playerId}:${command.type}`;
  }
}

