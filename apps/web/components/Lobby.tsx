'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { PublicParticipant, StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { AvatarAction, AvatarBadge, LeaveButton } from '@/components/ui';
import { ReactionBadge } from '@/components/ReactionBadge';

export function Lobby({ state }: { state: StateMessage }): ReactNode {
  const room = useRoom();
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/sala/${state.room.roomCode}`);
  }, [state.room.roomCode]);

  const me = state.self;
  const training = state.room.mode === 'training';
  // No treino os bots ocupam assento e contam para prontidão/limite, mesmo sem
  // conexão própria; nas salas comuns só pessoas conectadas contam.
  const seated = state.room.participants.filter((participant) => participant.connected || participant.kind === 'bot');
  const connected = state.room.participants.filter((participant) => participant.connected);
  const everyoneReady = seated.length >= 2 && seated.every((participant) => participant.ready);
  const isHost = state.room.hostId === me.playerId;
  const canStart = isHost && everyoneReady && seated.length <= 8;
  // Vitórias de quem já deixou a vaga continuam no placar da sala.
  const historical = state.room.scoreboard.filter((entry) => !entry.current);

  function activateAvatar(participant: PublicParticipant, trigger: HTMLButtonElement): void {
    if (participant.id === me.playerId) room.openReactionMenu(trigger);
    else room.openTauntMenu(participant.id, trigger);
  }

  async function copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="screen lobby">
      <header className="screen-header">
        <h1 data-focus-target tabIndex={-1}>Sala {state.room.roomCode}</h1>
        {training ? (
          <p className="muted" data-testid="training-note">
            Mesa de treino: você joga sozinho contra três bots simples, com as regras do Clássico. A partida roda no
            servidor, como nas salas entre amigos.
          </p>
        ) : (
          <p className="muted">Compartilhe o link para convidar. O anfitrião inicia quando todos estiverem prontos.</p>
        )}
        <LeaveButton />
      </header>

      {!training ? (
        <section className="invite" aria-label="Convite">
          <a href={inviteUrl} data-testid="invite-link">
            {inviteUrl}
          </a>
          <button type="button" onClick={() => void copyInvite()} data-testid="copy-invite">
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
        </section>
      ) : null}

      <section aria-label="Participantes">
        <h2>Participantes</h2>
        <ul className="participant-list" data-testid="lobby-participants">
          {state.room.participants.map((participant) => (
            <li key={participant.id} data-testid="lobby-participant" data-player-id={participant.id} className="participant-row">
              <AvatarAction
                avatar={participant.avatar}
                label={participant.id === me.playerId ? `Reagir como ${participant.nickname}` : `Provocar ${participant.nickname}`}
                testId={`mood-avatar-${participant.id}`}
                onActivate={(trigger) => activateAvatar(participant, trigger)}
              />
              <span className="participant-name">{participant.nickname}</span>
              <ReactionBadge reaction={room.activeReactions?.[participant.id]} animations={room.activeAnimations ?? 'full'} />
              {participant.isHost ? <span className="tag">anfitrião</span> : null}
              {participant.kind === 'bot' ? <span className="tag tag-bot">bot</span> : null}
              {participant.id === me.playerId ? <span className="tag tag-me">você</span> : null}
              {participant.kind === 'bot' ? (
                <span className="status connected">{participant.ready ? 'pronto' : 'aguardando'}</span>
              ) : (
                <span className={participant.connected ? 'status connected' : 'status disconnected'}>
                  {participant.connected ? (participant.ready ? 'pronto' : 'aguardando') : 'desconectado'}
                </span>
              )}
              <span className="score" title="Rodadas vencidas">
                {participant.score} v.
              </span>
              {participant.id === me.playerId ? (
                <button
                  type="button"
                  className="secondary small"
                  data-testid="self-reaction-button"
                  onClick={(event) => room.openReactionMenu(event.currentTarget)}
                >
                  Reagir
                </button>
              ) : null}
              {isHost && !training && participant.id !== me.playerId ? (
                <button
                  type="button"
                  className="danger small"
                  data-testid={`remove-${participant.nickname}`}
                  disabled={!room.interactive}
                  onClick={() => void room.removeParticipant(participant.id)}
                >
                  Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {historical.length > 0 ? (
        <section aria-label="Placar da sala">
          <h2>Placar da sala</h2>
          <ul className="participant-list" data-testid="scoreboard-history">
            {historical.map((entry) => (
              <li key={entry.playerId} className="participant-row" data-testid={`history-${entry.nickname}`}>
                <AvatarBadge avatar={entry.avatar} />
                <span className="participant-name">{entry.nickname}</span>
                <span className="tag">saiu da sala</span>
                <span className="score">{entry.wins} v.</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="lobby-actions" aria-label="Preparação">
        <button
          type="button"
          className={me.ready ? 'secondary' : 'primary'}
          disabled={!room.interactive}
          onClick={() => void room.setReady(!me.ready)}
          data-testid="ready-toggle"
        >
          {me.ready ? 'Cancelar prontidão' : 'Estou pronto'}
        </button>
        {isHost ? (
          <button
            type="button"
            className="primary"
            disabled={!canStart || !room.interactive}
            onClick={() => void room.startRound()}
            data-testid="start-round-button"
          >
            Iniciar rodada
          </button>
        ) : (
          <p className="muted">Aguardando o anfitrião iniciar.</p>
        )}
      </section>
      {isHost && !canStart ? (
        <p className="muted" data-testid="start-hint">
          {training
            ? 'Confirme que você está pronto para iniciar.'
            : connected.length < 2
              ? 'São necessários pelo menos 2 participantes conectados.'
              : 'Todos precisam estar prontos.'}
        </p>
      ) : null}
    </div>
  );
}
