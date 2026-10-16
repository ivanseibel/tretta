'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Card, Color } from '@tretta/rules';
import { COLORS } from '@tretta/rules';
import type { EventsMessage, StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { AvatarBadge, ColorSymbol, LeaveButton } from '@/components/ui';
import { EventFeed } from '@/components/EventFeed';
import { PausePanel } from '@/components/PausePanel';
import { COLOR_LABELS, cardLabel, cardShort } from '@/lib/labels';

interface FocusAfterAck {
  readonly selector: string;
  ackVersion: number | null;
}

function CardView({
  card,
  selected,
  playable,
  tabIndex,
  onClick,
  onFocus,
  onKeyDown,
}: {
  card: Card;
  selected: boolean;
  playable: boolean;
  tabIndex: 0 | -1;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}): ReactNode {
  const color = card.kind === 'wild' ? 'wild' : card.color;
  const short = cardShort(card);
  return (
    <button
      type="button"
      className={`playing-card card-${color}${selected ? ' card-selected' : ''}${playable ? ' card-playable' : ''}`}
      data-testid={`card-${card.id}`}
      data-card-id={card.id}
      data-color={color}
      aria-label={`${cardLabel(card)}${playable ? ', jogável' : ', não jogável neste turno'}`}
      aria-pressed={selected}
      aria-disabled={!playable}
      tabIndex={tabIndex}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      title={cardLabel(card)}
    >
      <span className="card-symbol" aria-hidden="true">
        {card.kind === 'wild' ? <span className="color-symbol color-symbol-wild">✦</span> : <ColorSymbol color={card.color} />}
      </span>
      <span className="card-value" data-long={short.length > 4 ? 'true' : undefined} aria-hidden="true">
        {short}
      </span>
      <span className="card-name" aria-hidden="true">{cardLabel(card)}</span>
    </button>
  );
}

export function GameTable({ state, events }: { state: StateMessage; events: EventsMessage[] }): ReactNode {
  const room = useRoom();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choosingColor, setChoosingColor] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [playPending, setPlayPending] = useState(false);
  const handRef = useRef<HTMLElement | null>(null);
  const firstColorRef = useRef<HTMLButtonElement | null>(null);
  const colorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusAfterStateRef = useRef<FocusAfterAck | null>(null);
  const stateVersionRef = useRef(state.room.version);
  stateVersionRef.current = state.room.version;
  const previousStatusRef = useRef(state.room.status);

  const view = state.self.view;
  const paused = state.room.status === 'paused';
  const live = room.connection === 'live';
  const isHost = state.room.hostId === state.self.playerId;

  const participants = state.room.participants;
  const nicknameOf = (playerId: string): string => participants.find((participant) => participant.id === playerId)?.nickname ?? '—';
  const myTurn = view !== null && !paused && live && view.status === 'playing' && view.currentPlayerId === state.self.playerId;
  const selectedCard = view?.hand.find((card) => card.id === selectedId) ?? null;
  const canSelect = myTurn && (view?.playableCardIds.includes(selectedId ?? '') ?? false);
  const firstHandCardId = view?.hand[0]?.id ?? null;
  const leavesOneCard = (view?.hand.length ?? 0) - 1 === 1 && selectedCard !== null;
  const seatedPlayerIds = new Set((view?.players ?? []).map((player) => player.id));
  const opponents = participants.filter((participant) => participant.id !== state.self.playerId && seatedPlayerIds.has(participant.id));
  const waitingParticipants = participants.filter((participant) => participant.id !== state.self.playerId && !seatedPlayerIds.has(participant.id));

  const applyFocusAfterAck = (): void => {
    const request = focusAfterStateRef.current;
    if (request === null || request.ackVersion === null || stateVersionRef.current < request.ackVersion) return;
    focusAfterStateRef.current = null;
    if (document.activeElement !== document.body) return;
    globalThis.requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.querySelector<HTMLElement>(request.selector)?.focus();
      }
    });
  };

  useEffect(() => {
    if (choosingColor) firstColorRef.current?.focus();
  }, [choosingColor]);

  useEffect(() => {
    const changedStage = previousStatusRef.current !== state.room.status;
    previousStatusRef.current = state.room.status;
    if (changedStage) {
      focusAfterStateRef.current = null;
      return;
    }
    applyFocusAfterAck();
  }, [state]);

  useEffect(() => {
    if (selectedId !== null && (view === null || !view.hand.some((card) => card.id === selectedId) || !myTurn)) {
      setSelectedId(null);
      setChoosingColor(false);
      setAnnounce(false);
    }
  }, [myTurn, selectedId, view]);

  useEffect(() => {
    if (focusedCardId !== null && (view === null || !view.hand.some((card) => card.id === focusedCardId))) {
      setFocusedCardId(firstHandCardId);
    }
  }, [firstHandCardId, focusedCardId, view]);

  useEffect(() => {
    if (focusedCardId !== null && (view === null || !view.hand.some((card) => card.id === focusedCardId))) {
      if (document.activeElement === document.body) handRef.current?.focus({ preventScroll: true });
      setFocusedCardId(firstHandCardId);
    }
  }, [firstHandCardId, focusedCardId, view]);

  if (view === null) return null;

  const lastCardWindow = view.lastCardWindow;
  const currentPlayerDisconnected =
    view.currentPlayerId !== null &&
    participants.find((participant) => participant.id === view.currentPlayerId)?.connected === false;

  const pickCard = (card: Card): void => {
    if (!myTurn || playPending || !view.playableCardIds.includes(card.id)) return;
    setSelectedId(selectedId === card.id ? null : card.id);
    setAnnounce(false);
    setChoosingColor(false);
  };

  async function sendAction(command: Parameters<typeof room.sendCommand>[0], fallback: string): Promise<void> {
    const request: FocusAfterAck = { selector: fallback, ackVersion: null };
    focusAfterStateRef.current = request;
    const result = await room.sendCommand(command);
    if (focusAfterStateRef.current !== request) return;
    if (!result.ok) {
      focusAfterStateRef.current = null;
      return;
    }
    request.ackVersion = result.version;
    applyFocusAfterAck();
  }

  async function sendPlay(color?: Color): Promise<void> {
    if (selectedCard === null || playPending) return;
    const command = {
      type: 'play' as const,
      cardId: selectedCard.id,
      ...(color === undefined ? {} : { chosenColor: color }),
      ...(announce ? { announceLastCard: true } : {}),
    };
    setPlayPending(true);
    const request: FocusAfterAck = { selector: '[data-testid="my-hand"]', ackVersion: null };
    focusAfterStateRef.current = request;
    const result = await room.sendCommand(command);
    setPlayPending(false);
    if (!result.ok) {
      if (focusAfterStateRef.current === request) focusAfterStateRef.current = null;
      return;
    }
    if (focusAfterStateRef.current === request) {
      request.ackVersion = result.version;
      applyFocusAfterAck();
    }
    setSelectedId(null);
    setChoosingColor(false);
    setAnnounce(false);
  }

  function closeColorChooser(): void {
    setChoosingColor(false);
    globalThis.requestAnimationFrame(() => colorTriggerRef.current?.focus());
  }

  function cancelCardSelection(): void {
    if (choosingColor) {
      closeColorChooser();
      return;
    }
    const cardId = selectedId;
    setSelectedId(null);
    setAnnounce(false);
    if (cardId === null) return;
    globalThis.requestAnimationFrame(() => {
      const buttons = handRef.current?.querySelectorAll<HTMLButtonElement>('[data-card-id]');
      Array.from(buttons ?? []).find((button) => button.dataset.cardId === cardId)?.focus();
    });
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, cardId: string): void {
    if (event.key === 'Escape' && selectedId === cardId) {
      event.preventDefault();
      cancelCardSelection();
      return;
    }
    if (view === null || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    const handIds = view.hand.map((card) => card.id);
    const currentIndex = handIds.indexOf(cardId);
    if (currentIndex < 0 || handIds.length < 2) return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextId = handIds[(currentIndex + offset + handIds.length) % handIds.length];
    if (nextId === undefined) return;
    setFocusedCardId(nextId);
    const buttons = handRef.current?.querySelectorAll<HTMLButtonElement>('[data-card-id]');
    const nextCard = Array.from(buttons ?? []).find((button) => button.dataset.cardId === nextId);
    nextCard?.focus();
    nextCard?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return (
    <div className="screen table">
      <header className="table-header">
        <h1 className="room-tag" data-focus-target tabIndex={-1}>Sala {state.room.roomCode}</h1>
        <span className="turn-indicator" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} data-testid="turn-indicator">
          {view.status === 'finished' ? 'Rodada encerrada' : paused ? 'Rodada pausada' : myTurn ? 'Sua vez' : `Vez de ${nicknameOf(view.currentPlayerId ?? '')}`}
        </span>
        <span className="direction">{view.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário'}</span>
        <LeaveButton />
      </header>

      {paused ? <PausePanel state={state} /> : null}

      {!paused && currentPlayerDisconnected ? (
        <p className="waiting-banner" data-testid="disconnected-banner">
          {nicknameOf(view.currentPlayerId ?? '')} caiu. A rodada pausa por até 90 segundos para o retorno; depois disso o
          anfitrião decide entre substituto ou encerrar sem vencedor.
        </p>
      ) : null}

      {!paused && isHost && view.status === 'playing' ? (
        <section className="host-controls" aria-label="Controles do anfitrião">
          <button
            type="button"
            className="danger"
            data-testid="end-round-button"
            disabled={!live}
            onClick={() => void room.endRoundWithoutWinner()}
          >
            Encerrar rodada sem vencedor
          </button>
        </section>
      ) : null}

      <section className="opponents" aria-label="Adversários">
        {opponents.map((participant) => (
          <div
            key={participant.id}
            className={`opponent${view.currentPlayerId === participant.id ? ' opponent-current' : ''}`}
            data-testid={`opponent-${participant.nickname}`}
          >
            <AvatarBadge avatar={participant.avatar} size="small" />
            <span className="participant-name">{participant.nickname}</span>
            {participant.connected ? null : <span className="status disconnected">desconectado</span>}
            {participant.autoControlled ? <span className="tag tag-substitute">substituto</span> : null}
            <span className="hand-count" data-testid={`hand-count-${participant.nickname}`}>
              {view.players.find((player) => player.id === participant.id)?.handCount ?? 0} cartas
            </span>
            {view.currentPlayerId === participant.id ? <span className="tag tag-turn">vez</span> : null}
          </div>
        ))}
      </section>

      {waitingParticipants.length > 0 ? (
        <section className="opponents waiting-participants" aria-label="Aguardam a próxima rodada">
          {waitingParticipants.map((participant) => (
            <div
              key={participant.id}
              className="opponent waiting-participant"
              data-testid={`waiting-participant-${participant.nickname}`}
            >
              <AvatarBadge avatar={participant.avatar} size="small" />
              <span className="participant-name">{participant.nickname}</span>
              {participant.connected ? null : <span className="status disconnected">desconectado</span>}
              <span className="waiting-participant-label">aguarda próxima rodada</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="table-center" aria-label="Mesa">
        <div className="pile">
          <span className="pile-label">Compra ({view.drawPileCount})</span>
          <div className="playing-card card-back" role="img" aria-label={`Pilha de compra com ${view.drawPileCount} cartas`} data-testid="draw-pile">
            <span className="card-value" aria-hidden="true">?</span>
          </div>
        </div>
        <div className="pile">
          <span className="pile-label">Descarte</span>
          <div
            className={`playing-card card-${view.discardTop.kind === 'wild' ? 'wild' : view.discardTop.color}`}
            role="img"
            aria-label={`Descarte: ${cardLabel(view.discardTop)}`}
            data-testid="discard-top"
            data-card-id={view.discardTop.id}
            title={cardLabel(view.discardTop)}
          >
            <span className="card-symbol" aria-hidden="true">
              {view.discardTop.kind === 'wild' ? <span className="color-symbol color-symbol-wild">✦</span> : <ColorSymbol color={view.discardTop.color} />}
            </span>
            <span className="card-value" aria-hidden="true">{cardShort(view.discardTop)}</span>
            <span className="card-name" aria-hidden="true">{cardLabel(view.discardTop)}</span>
          </div>
        </div>
        <div className="active-color">
          <span className="pile-label">Cor ativa</span>
          <span className={`color-chip chip-${view.activeColor}`} data-testid="active-color">
            <ColorSymbol color={view.activeColor} />
            {COLOR_LABELS[view.activeColor]}
          </span>
        </div>
      </section>

      {!paused ? (
        <section className="actions" aria-label="Ações">
          {myTurn && view.phase === 'play' ? (
            <button type="button" className="primary" onClick={() => void sendAction({ type: 'draw' }, '[data-testid="pass-button"]')} data-testid="draw-button">
              Comprar carta
            </button>
          ) : null}
          {myTurn && view.phase === 'after-draw' ? (
            <>
              <p className="muted" data-testid="after-draw-hint">
                Você comprou. Pode descartar a carta comprada ou passar.
              </p>
              <button type="button" className="secondary" onClick={() => void sendAction({ type: 'pass' }, '[data-testid="turn-indicator"]')} data-focus-after-state data-testid="pass-button">
                Passar a vez
              </button>
            </>
          ) : null}
          {lastCardWindow !== null && lastCardWindow.playerId === state.self.playerId && !lastCardWindow.announced ? (
            <button type="button" className="secondary" onClick={() => void sendAction({ type: 'announceLastCard' }, '[data-testid="turn-indicator"]')} data-testid="announce-button">
              Avisar "Última carta!"
            </button>
          ) : null}
          {lastCardWindow !== null && lastCardWindow.playerId !== state.self.playerId && !lastCardWindow.announced ? (
            <button
              type="button"
              className="danger"
              onClick={() => void sendAction({ type: 'challengeLastCard', targetId: lastCardWindow.playerId }, '[data-testid="turn-indicator"]')}
              data-testid="challenge-button"
            >
              Denunciar {nicknameOf(lastCardWindow.playerId)}
            </button>
          ) : null}
          {lastCardWindow !== null && lastCardWindow.announced ? (
            <p className="muted" data-testid="last-card-note">
              {nicknameOf(lastCardWindow.playerId)} avisou a última carta.
            </p>
          ) : null}
        </section>
      ) : null}

      <p className="hand-help" id="hand-help">
        Cartas jogáveis recebem destaque. Use as setas para percorrer a mão e Enter ou Espaço para selecionar.
      </p>
      <section className="hand" ref={handRef} aria-label="Sua mão" aria-describedby="hand-help" data-testid="my-hand" tabIndex={-1}>
        {view.hand.map((card) => {
          const playable = myTurn && !playPending && view.playableCardIds.includes(card.id);
          const tabIndex = focusedCardId === card.id || (focusedCardId === null && card.id === firstHandCardId) ? 0 : -1;
          return (
          <CardView
            key={card.id}
            card={card}
            selected={selectedId === card.id}
            playable={playable}
            tabIndex={tabIndex}
            onClick={() => pickCard(card)}
            onFocus={() => setFocusedCardId(card.id)}
            onKeyDown={(event) => handleCardKeyDown(event, card.id)}
          />
          );
        })}
      </section>

      {!paused && selectedCard !== null && canSelect ? (
        <section className="play-strip" aria-label="Confirmar jogada" data-testid="play-strip" onKeyDown={(event) => {
          if (event.key === 'Escape' && choosingColor) {
            event.preventDefault();
            closeColorChooser();
          }
        }}>
          <span className="muted">
            {selectedCard.id === view.drawnCardId ? 'Carta comprada: ' : 'Jogar: '}
            {cardLabel(selectedCard)}
          </span>
          {leavesOneCard ? (
            <label className="announce-label">
              <input type="checkbox" checked={announce} onChange={(event) => setAnnounce(event.target.checked)} data-testid="last-card-checkbox" />
              Avisar "Última carta!"
            </label>
          ) : null}
          {selectedCard.kind === 'wild' && choosingColor ? (
            <span className="color-options" role="group" aria-label="Escolha a cor do coringa" data-testid="color-chooser">
              {COLORS.map((color, index) => (
                <button
                  key={color}
                  ref={index === 0 ? firstColorRef : undefined}
                  type="button"
                  className={`color-button chip-${color}`}
                  aria-label={COLOR_LABELS[color]}
                  onClick={() => void sendPlay(color)}
                  data-testid={`color-option-${color}`}
                >
                  <ColorSymbol color={color} />
                  {COLOR_LABELS[color]}
                </button>
              ))}
            </span>
          ) : (
            <button
              ref={selectedCard.kind === 'wild' ? colorTriggerRef : undefined}
              type="button"
              className="primary"
              disabled={playPending}
              onClick={() => (selectedCard.kind === 'wild' ? setChoosingColor(true) : void sendPlay())}
              data-testid="play-button"
            >
              {playPending ? 'Aguardando a confirmação…' : 'Jogar'}
            </button>
          )}
          <button type="button" className="secondary" onClick={cancelCardSelection} data-testid="cancel-play">
            {choosingColor ? 'Cancelar escolha de cor' : 'Cancelar'}
          </button>
        </section>
      ) : null}

      <EventFeed events={events} participants={participants} lastRound={state.room.lastRound} />
    </div>
  );
}
