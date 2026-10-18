'use client';

import type { ReactNode } from 'react';
import { useRoom } from '@/app/providers';

/** Confirmação breve do envio aceito; também vale com reações ocultas. */
export function MoodFeedback(): ReactNode {
  const { moodFeedback } = useRoom();
  if (moodFeedback === null) return null;
  return (
    <p className="mood-feedback" role="status" data-testid="mood-feedback">
      {moodFeedback}
    </p>
  );
}

/**
 * Anúncio acessível de reação, uma vez por evento. O badge visual não é uma
 * região viva, então cada reação é lida aqui sem duplicação.
 */
export function MoodAnnouncer(): ReactNode {
  const { reactionAnnouncement } = useRoom();
  return (
    <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="reaction-announcer">
      {reactionAnnouncement === null ? null : <span key={reactionAnnouncement.seq}>{reactionAnnouncement.text}</span>}
    </p>
  );
}
