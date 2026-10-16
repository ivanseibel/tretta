import { expect } from 'vitest';
import { type RoundState } from '../src/index.js';

/** Ids de carta: cor ou coringa seguido de hífen e sufixo, entre aspas em JSON. */
const CARD_ID = /"((?:red|yellow|green|blue|wild)-[^"]+)"/g;

export function cardIdsInJson(json: string): Set<string> {
  return new Set([...json.matchAll(CARD_ID)].map((match) => match[1] ?? ''));
}

export function handOf(state: RoundState, playerId: string): string[] {
  return state.seats.find((seat) => seat.id === playerId)?.hand.map((card) => card.id) ?? [];
}

/** Ids que nenhum adversário pode ver: pilha de compra e mãos de outros jogadores. */
export function hiddenIdsFor(state: RoundState, viewerId: string): string[] {
  const own = new Set(handOf(state, viewerId));
  const top = state.discardPile[state.discardPile.length - 1]?.id;
  return [...state.seats.flatMap((seat) => seat.hand), ...state.drawPile]
    .map((card) => card.id)
    .filter((id) => !own.has(id) && id !== top);
}

/**
 * Confere que a representação JSON de uma saída destinada a `viewerId` contém apenas
 * a própria mão e o topo do descarte, e nenhum id oculto.
 */
export function expectOnlyPublicAndOwn(json: string, state: RoundState, viewerId: string): void {
  const ids = cardIdsInJson(json);
  const allowed = new Set([...handOf(state, viewerId), state.discardPile[state.discardPile.length - 1]?.id ?? '']);
  for (const id of ids) {
    expect(allowed.has(id), `id ${id} visível para ${viewerId} sem permissão`).toBe(true);
  }
  for (const hidden of hiddenIdsFor(state, viewerId)) {
    expect(json).not.toContain(`"${hidden}"`);
  }
}
