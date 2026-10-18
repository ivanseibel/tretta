'use client';

import type { ReactNode } from 'react';
import type { EventsMessage, ScoreboardEntry, StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { AvatarAction, AvatarBadge, LeaveButton } from '@/components/ui';
import { EventFeed } from '@/components/EventFeed';
import { ReactionBadge } from '@/components/ReactionBadge';

interface ResultRow {
  readonly entry: ScoreboardEntry;
  readonly participant: StateMessage['room']['participants'][number] | undefined;
}

export function Results({ state, events }: { state: StateMessage; events: EventsMessage[] }): ReactNode {
  const room = useRoom();
  const lastRound = state.room.lastRound;
  const isHost = state.room.hostId === state.self.playerId;
  // Placar histórico da sala: vitórias sobrevivem à saída/remoção da vaga.
  const sorted = [...state.room.scoreboard].sort((left, right) => right.wins - left.wins);
  const rows: ResultRow[] = sorted.map((entry) => ({
    entry,
    participant: state.room.participants.find((candidate) => candidate.id === entry.playerId),
  }));
  // Representação da própria pessoa mesmo quando o placar ainda não tem entrada.
  if (!rows.some((row) => row.entry.playerId === state.self.playerId)) {
    const participant = state.room.participants.find((candidate) => candidate.id === state.self.playerId);
    rows.push({
      entry: {
        playerId: state.self.playerId,
        kind: participant?.kind ?? 'human',
        nickname: state.self.nickname,
        avatar: state.self.avatar,
        wins: 0,
        current: true,
      },
      participant,
    });
  }

  function activateAvatar(playerId: string, trigger: HTMLButtonElement): void {
    if (playerId === state.self.playerId) room.openReactionMenu(trigger);
    else room.openTauntMenu(playerId, trigger);
  }

  const winnerText =
    lastRound === null || lastRound.winnerId === null
      ? 'Rodada encerrada sem vencedor.'
      : lastRound.substitute
        ? `Substituto de ${lastRound.winnerNickname ?? '—'} venceu a rodada!`
        : lastRound.winnerKind === 'bot'
          ? `${lastRound.winnerNickname ?? '—'} (bot) venceu a rodada!`
          : `${lastRound.winnerNickname ?? '—'} venceu a rodada!`;

  return (
    <div className="screen results">
      <header className="screen-header">
        <h1 data-focus-target tabIndex={-1}>Rodada {lastRound?.roundNumber ?? state.room.roundNumber} concluída</h1>
        <LeaveButton />
      </header>

      <p className="winner-banner" role="status" aria-live="polite" aria-atomic="true" data-testid="results-winner">
        {winnerText}
      </p>

      <section aria-label="Placar">
        <h2>Placar</h2>
        <ul className="participant-list">
          {rows.map(({ entry, participant }) => {
            const interactive = entry.current && participant !== undefined;
            return (
              <li key={entry.playerId} className="participant-row" data-testid={`score-${entry.nickname}`} data-player-id={entry.playerId}>
                {interactive ? (
                  <AvatarAction
                    avatar={entry.avatar}
                    label={entry.playerId === state.self.playerId ? `Reagir como ${entry.nickname}` : `Provocar ${entry.nickname}`}
                    testId={`mood-avatar-${entry.playerId}`}
                    onActivate={(trigger) => activateAvatar(entry.playerId, trigger)}
                  />
                ) : (
                  <AvatarBadge avatar={entry.avatar} />
                )}
                <span className="participant-name">{entry.nickname}</span>
                {entry.current ? (
                  <ReactionBadge reaction={room.activeReactions?.[entry.playerId]} animations={room.activeAnimations ?? 'full'} />
                ) : null}
                {entry.kind === 'bot' ? <span className="tag tag-bot">bot</span> : null}
                {entry.playerId === state.self.playerId ? <span className="tag tag-me">você</span> : null}
                {entry.kind === 'human' && participant?.autoControlled ? <span className="tag tag-substitute">substituto</span> : null}
                {entry.current ? null : <span className="tag">saiu da sala</span>}
                <span className="score">{entry.wins} rodada(s)</span>
                {entry.playerId === state.self.playerId ? (
                  <button
                    type="button"
                    className="secondary small"
                    data-testid="self-reaction-button"
                    onClick={(event) => room.openReactionMenu(event.currentTarget)}
                  >
                    Reagir
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {isHost ? (
        <button
          type="button"
          className="primary"
          disabled={!room.interactive}
          onClick={() => void room.returnToLobby()}
          data-testid="return-to-lobby-button"
        >
          Voltar à preparação
        </button>
      ) : (
        <p className="muted" data-testid="waiting-host">
          Aguardando o anfitrião voltar à preparação.
        </p>
      )}

      <EventFeed events={events} participants={state.room.participants} lastRound={state.room.lastRound} />
    </div>
  );
}
