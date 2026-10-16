'use client';

import type { ReactNode } from 'react';
import type { PublicTableView, StateMessage } from '@tretta/protocol';
import { COLOR_LABELS, cardLabel, cardShort } from '@/lib/labels';
import { AvatarBadge, ColorSymbol, LeaveButton } from '@/components/ui';
import { EventFeed } from '@/components/EventFeed';
import { PausePanel } from '@/components/PausePanel';

function PublicTableSection({ table, nicknameOf }: { table: PublicTableView; nicknameOf: (playerId: string) => string }): ReactNode {
  return (
    <section className="public-table" aria-label="Mesa pública" data-testid="public-table">
      <h2>Mesa pública</h2>
      <p className="muted">Você acompanha a rodada atual de fora e entra na próxima.</p>
      <div className="table-center">
        <div className="pile">
          <span className="pile-label">Compra ({table.drawPileCount})</span>
          <div className="playing-card card-back" role="img" aria-label={`Pilha de compra com ${table.drawPileCount} cartas`} data-testid="public-draw-pile">
            <span className="card-value" aria-hidden="true">?</span>
          </div>
        </div>
        <div className="pile">
          <span className="pile-label">Descarte</span>
          <div
            className={`playing-card card-${table.discardTop.kind === 'wild' ? 'wild' : table.discardTop.color}`}
            role="img"
            aria-label={`Descarte: ${cardLabel(table.discardTop)}`}
            data-testid="public-discard-top"
            data-card-id={table.discardTop.id}
            title={cardLabel(table.discardTop)}
          >
            <span className="card-symbol" aria-hidden="true">
              {table.discardTop.kind === 'wild' ? <span className="color-symbol color-symbol-wild">✦</span> : <ColorSymbol color={table.discardTop.color} />}
            </span>
            <span className="card-value" data-long={cardShort(table.discardTop).length > 4 ? 'true' : undefined} aria-hidden="true">
              {cardShort(table.discardTop)}
            </span>
            <span className="card-name" aria-hidden="true">{cardLabel(table.discardTop)}</span>
          </div>
        </div>
        <div className="active-color">
          <span className="pile-label">Cor ativa</span>
          <span className={`color-chip chip-${table.activeColor}`} data-testid="public-active-color">
            <ColorSymbol color={table.activeColor} />
            {COLOR_LABELS[table.activeColor]}
          </span>
        </div>
      </div>
      <p className="public-table-status" data-testid="public-table-status">
        {table.status === 'finished'
          ? 'Rodada encerrada.'
          : `${table.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário'} · Vez de ${nicknameOf(table.currentPlayerId ?? '')}`}
      </p>
      <ul className="participant-list" data-testid="public-hand-counts">
        {table.players.map((player) => (
          <li key={player.id} className="participant-row">
            <span className="participant-name">{nicknameOf(player.id)}</span>
            <span className="hand-count" data-testid={`public-hand-count-${nicknameOf(player.id)}`}>
              {player.handCount} cartas
            </span>
          </li>
        ))}
      </ul>
      {table.lastCardWindow !== null ? (
        <p className="muted" data-testid="public-last-card">
          {table.lastCardWindow.announced
            ? `${nicknameOf(table.lastCardWindow.playerId)} avisou "Última carta!".`
            : `${nicknameOf(table.lastCardWindow.playerId)} está com a última carta.`}
        </p>
      ) : null}
    </section>
  );
}

export function WaitingRoom({ state, events }: { state: StateMessage; events: Parameters<typeof EventFeed>[0]['events'] }): ReactNode {
  const paused = state.room.status === 'paused';
  const nicknameOf = (playerId: string): string =>
    state.room.participants.find((participant) => participant.id === playerId)?.nickname ?? '—';
  return (
    <div className="screen waiting">
      <header className="screen-header">
        <h1 data-focus-target tabIndex={-1}>Sala {state.room.roomCode}</h1>
        <LeaveButton />
      </header>
      <p className="waiting-banner" data-testid="waiting-banner">
        {paused
          ? 'A rodada está pausada e você entra na próxima — aguarde aqui no lobby.'
          : 'A rodada está em andamento. Você entra na próxima — aguarde aqui no lobby.'}
      </p>

      <section aria-label="Participantes">
        <h2>Na sala</h2>
        <ul className="participant-list">
          {state.room.participants.map((participant) => (
            <li key={participant.id} className="participant-row">
              <AvatarBadge avatar={participant.avatar} />
              <span className="participant-name">{participant.nickname}</span>
              {participant.isHost ? <span className="tag">anfitrião</span> : null}
              <span className={participant.connected ? 'status connected' : 'status disconnected'}>
                {participant.connected ? (participant.inRound ? 'em rodada' : 'no lobby') : 'desconectado'}
              </span>
              {participant.autoControlled ? <span className="tag tag-substitute">substituto</span> : null}
              <span className="score">{participant.score} v.</span>
            </li>
          ))}
        </ul>
      </section>

      {paused ? <PausePanel state={state} /> : null}

      {state.table !== null ? <PublicTableSection table={state.table} nicknameOf={nicknameOf} /> : null}

      <EventFeed events={events} participants={state.room.participants} lastRound={state.room.lastRound} />
    </div>
  );
}
