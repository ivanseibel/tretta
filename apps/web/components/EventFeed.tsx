'use client';

import type { ReactNode } from 'react';
import type { EventsMessage, LastRoundSummary, PublicParticipant } from '@tretta/protocol';
import { describeEvent } from '@/lib/labels';

export function EventFeed({
  events,
  participants,
  lastRound = null,
}: {
  events: EventsMessage[];
  participants: readonly PublicParticipant[];
  lastRound?: LastRoundSummary | null;
}): ReactNode {
  const nicknameOf = (playerId: string): string => {
    const participant = participants.find((entry) => entry.id === playerId);
    if (participant !== undefined) return participant.nickname;
    if (lastRound !== null && lastRound.winnerId === playerId && lastRound.winnerNickname !== null) {
      return lastRound.winnerNickname;
    }
    return '—';
  };
  const isSubstitute = (playerId: string): boolean => {
    const participant = participants.find((entry) => entry.id === playerId);
    if (participant !== undefined) return participant.autoControlled;
    return lastRound !== null && lastRound.winnerId === playerId && lastRound.substitute;
  };
  const lines = events.flatMap((message) =>
    message.events.map((event, index) => ({ key: `${message.version}-${index}`, text: describeEvent(event, { nicknameOf, isSubstitute }) })),
  );
  const visible = lines.slice(-14);
  return (
    <section className="event-feed" aria-label="Acontecimentos da rodada" data-testid="event-feed">
      <h2>Acontecimentos</h2>
      {visible.length === 0 ? (
        <p className="muted">A rodada ainda não começou.</p>
      ) : (
        <ul>
          {visible.map((line) => (
            <li key={line.key}>{line.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
