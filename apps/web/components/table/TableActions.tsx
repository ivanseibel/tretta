'use client';

import type { ReactNode } from 'react';
import type { PlayerView } from '@tretta/rules';
import { Button } from '@/components/chrome';
import type { RoomContextValue } from '@/app/providers';

/** Ações da vez: comprar, passar, avisar última e denunciar, conforme a janela real. */
export function TableActions({
  view,
  myTurn,
  paused,
  live,
  selfId,
  nicknameOf,
  sendAction,
}: {
  view: PlayerView;
  myTurn: boolean;
  paused: boolean;
  live: boolean;
  selfId: string;
  nicknameOf: (playerId: string) => string;
  sendAction: (command: Parameters<RoomContextValue['sendCommand']>[0], fallback: string) => Promise<void>;
}): ReactNode {
  const lastCardWindow = view.lastCardWindow;
  const windowMine = lastCardWindow !== null && lastCardWindow.playerId === selfId && !lastCardWindow.announced;
  const windowOther = lastCardWindow !== null && lastCardWindow.playerId !== selfId && !lastCardWindow.announced;

  let status: ReactNode;
  let statusTestId: string | undefined;
  if (paused) {
    status = 'Rodada pausada';
  } else if (view.status === 'finished') {
    status = 'Rodada encerrada';
  } else if (myTurn && view.phase === 'after-draw') {
    status = 'Comprou. Jogue a carta comprada ou passe.';
    statusTestId = 'after-draw-hint';
  } else if (lastCardWindow !== null && lastCardWindow.announced) {
    status = `${nicknameOf(lastCardWindow.playerId)} avisou a última carta.`;
    statusTestId = 'last-card-note';
  } else if (myTurn) {
    status = 'Sua vez';
  } else {
    status = `Vez de ${nicknameOf(view.currentPlayerId ?? '')}`;
  }

  return (
    <div className="tv2-actions-row">
      <p className="tv2-actions-status" data-testid={statusTestId}>
        {status}
      </p>
      <div className="tv2-actions-buttons">
        {!paused && myTurn && view.phase === 'play' ? (
          <Button
            variant="principal"
            onClick={() => void sendAction({ type: 'draw' }, '[data-testid="pass-button"]')}
            data-testid="draw-button"
          >
            Comprar
          </Button>
        ) : null}
        {!paused && myTurn && view.phase === 'after-draw' ? (
          <Button
            variant="secundario"
            data-focus-after-state
            onClick={() => void sendAction({ type: 'pass' }, '[data-testid="turn-indicator"]')}
            data-testid="pass-button"
          >
            Passar
          </Button>
        ) : null}
        {!paused && windowMine ? (
          <Button
            variant="atencao"
            onClick={() => void sendAction({ type: 'announceLastCard' }, '[data-testid="turn-indicator"]')}
            data-testid="announce-button"
            aria-label='Avisar "Última carta!"'
          >
            Avisar última
          </Button>
        ) : null}
        {!paused && windowOther ? (
          <Button
            variant="atencao"
            disabled={!live}
            onClick={() =>
              void sendAction(
                { type: 'challengeLastCard', targetId: lastCardWindow.playerId },
                '[data-testid="turn-indicator"]',
              )
            }
            data-testid="challenge-button"
            aria-label={`Denunciar ${nicknameOf(lastCardWindow.playerId)} por não avisar a última carta`}
          >
            Denunciar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
