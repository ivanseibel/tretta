import type { EventsMessage, StateMessage } from '@tretta/protocol';

interface TurnMarker {
  readonly roomCode: string;
  readonly roundId: string | null;
  readonly selfPlayerId: string;
  readonly currentPlayerId: string | null;
  readonly authorizedInRound: boolean;
}

export interface TurnNotificationTracker {
  lastMarker: TurnMarker | null;
  lastNotifiedKey: string | null;
}

export function createTurnNotificationTracker(): TurnNotificationTracker {
  return { lastMarker: null, lastNotifiedKey: null };
}

/**
 * Returns a stable key only when an authorized snapshot starts this player's
 * turn. turnSkipped is the engine's public signal for a new same-player turn
 * in a two-player round; ordinary version changes (draw, announcement,
 * challenge, replay) do not count by themselves.
 */
export function observeOwnTurnStart(
  state: StateMessage,
  eventBatches: readonly EventsMessage[],
  tracker: TurnNotificationTracker,
): string | null {
  const selfPlayerId = state.self.playerId;
  const currentPlayerId = state.self.view?.currentPlayerId ?? state.table?.currentPlayerId ?? null;
  const authorizedInRound = state.self.inRound && state.self.view !== null;
  const marker: TurnMarker = {
    roomCode: state.room.roomCode,
    roundId: state.room.roundId,
    selfPlayerId,
    currentPlayerId,
    authorizedInRound,
  };
  const previous = tracker.lastMarker;
  const roomOrRoundChanged =
    previous === null ||
    previous.roomCode !== marker.roomCode ||
    previous.roundId !== marker.roundId ||
    previous.selfPlayerId !== marker.selfPlayerId;
  const playerChanged = previous !== null && previous.currentPlayerId !== currentPlayerId;
  const authorizedEntry = previous !== null && !previous.authorizedInRound && authorizedInRound;
  const skippedIntoSameTurn =
    previous !== null &&
    previous.roomCode === marker.roomCode &&
    previous.roundId === marker.roundId &&
    previous.selfPlayerId === selfPlayerId &&
    previous.currentPlayerId === selfPlayerId &&
    currentPlayerId === selfPlayerId &&
    eventBatches.some(
      (batch) =>
        batch.roomCode === marker.roomCode &&
        batch.roundId === marker.roundId &&
        batch.version === state.room.version &&
        batch.events.some((event) => event.type === 'turnSkipped'),
    );

  tracker.lastMarker = marker;

  const view = state.self.view;
  const isOwnActiveTurn =
    state.room.status === 'playing' &&
    state.room.pause === null &&
    state.room.roundId !== null &&
    authorizedInRound &&
    view !== null &&
    view.status === 'playing' &&
    view.phase === 'play' &&
    view.currentPlayerId === selfPlayerId;
  if (!isOwnActiveTurn || !(roomOrRoundChanged || playerChanged || authorizedEntry || skippedIntoSameTurn)) return null;

  const key = `${marker.roomCode}:${marker.roundId}:${state.room.version}:${selfPlayerId}`;
  if (tracker.lastNotifiedKey === key) return null;
  tracker.lastNotifiedKey = key;
  return key;
}
