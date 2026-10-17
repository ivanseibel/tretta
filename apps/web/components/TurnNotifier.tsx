'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { EventsMessage, StateMessage } from '@tretta/protocol';
import type { MoodPreferences } from '@/lib/prefs';
import {
  createTurnNotificationTracker,
  observeOwnTurnStart,
} from '@/lib/turnNotifications';
import { playTurnNotificationSound, prepareSoundPlayback } from '@/lib/sounds';

interface TurnNotifierProps {
  readonly state: StateMessage | null;
  readonly events: readonly EventsMessage[];
  readonly connection: 'live' | 'lost';
  readonly chatLinkReady: boolean;
  readonly preferencesReady: boolean;
  readonly preferences: MoodPreferences;
}

/** Side-effect-only monitor; audio stays best-effort and never affects the game. */
export function TurnNotifier({
  state,
  events,
  connection,
  chatLinkReady,
  preferencesReady,
  preferences,
}: TurnNotifierProps): ReactNode {
  const trackerRef = useRef(createTurnNotificationTracker());

  useEffect(() => {
    const prepare = (): void => prepareSoundPlayback();
    window.addEventListener('pointerdown', prepare, { capture: true, passive: true });
    window.addEventListener('keydown', prepare, true);
    return () => {
      window.removeEventListener('pointerdown', prepare, true);
      window.removeEventListener('keydown', prepare, true);
    };
  }, []);

  useEffect(() => {
    // Do not consume a turn transition while the room link is unauthorised or
    // disconnected: the same current turn may become eligible once the server
    // confirms the link. Keeping the last authorised marker also avoids a
    // replay after reconnecting into that same turn.
    if (!preferencesReady || !chatLinkReady || connection !== 'live' || state === null) return;
    const turnKey = observeOwnTurnStart(state, events, trackerRef.current);
    if (
      turnKey === null ||
      !preferences.turnNotificationEnabled ||
      preferences.soundMuted
    ) {
      return;
    }
    try {
      playTurnNotificationSound();
    } catch {
      // Sound is optional; failure never changes the room or game state.
    }
  }, [
    chatLinkReady,
    connection,
    events,
    preferences.soundMuted,
    preferences.turnNotificationEnabled,
    preferencesReady,
    state,
  ]);

  return null;
}
