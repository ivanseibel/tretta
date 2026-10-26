'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Card, Color } from '@tretta/rules';
import { COLORS } from '@tretta/rules';
import type { EventsMessage, StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { PausePanel } from '@/components/PausePanel';
import { AvatarBadge, ColorSymbol } from '@/components/ui';
import { Chip, TableShell } from '@/components/chrome';
import { SeatCircuit } from '@/components/SeatCircuit';
import { COLOR_LABELS, cardLabel } from '@/lib/labels';
import { CardFace } from './table/CardFace';
import { TableActions } from './table/TableActions';
import { TableBarNav } from './drawer/TableBarNav';
import { TableCenter } from './table/TableCenter';
import './table/table.css';

interface FocusAfterAck {
  readonly selector: string;
  ackVersion: number | null;
}

function CardView({
  card,
  selected,
  playable,
  drawn,
  tabIndex,
  onClick,
  onFocus,
  onKeyDown,
}: {
  card: Card;
  selected: boolean;
  playable: boolean;
  drawn: boolean;
  tabIndex: 0 | -1;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}): ReactNode {
  const color = card.kind === 'wild' ? 'wild' : card.color;
  return (
    <button
      type="button"
      className={`playing-card tv2-card card-${color}${selected ? ' card-selected tv2-card--selected' : ''}${playable ? ' card-playable tv2-card--playable' : ''}${drawn ? ' tv2-card--drawn' : ''}`}
      data-testid={`card-${card.id}`}
      data-card-id={card.id}
      data-color={color}
      data-playable={playable ? 'true' : 'false'}
      data-drawn={drawn ? 'true' : 'false'}
      aria-label={`${cardLabel(card)}${playable ? ', jogável' : ', não jogável neste turno'}${drawn ? ', carta comprada' : ''}`}
      aria-pressed={selected}
      aria-disabled={!playable}
      tabIndex={tabIndex}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      title={cardLabel(card)}
    >
      <CardFace card={card} />
    </button>
  );
}

/** Sulco do trilho desenhado no palco; a geometria dos assentos vem de `SeatCircuit`. */
function RailSlot({ children }: { children: ReactNode }): ReactNode {
  return <div className="tv2-table-stage">{children}</div>;
}

export function GameTable({ state, events }: { state: StateMessage; events: EventsMessage[] }): ReactNode {
  const room = useRoom();
  void events;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choosingColor, setChoosingColor] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [playPending, setPlayPending] = useState(false);
  const [handMore, setHandMore] = useState(false);
  const handRef = useRef<HTMLDivElement | null>(null);
  const firstColorRef = useRef<HTMLButtonElement | null>(null);
  const colorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusAfterStateRef = useRef<FocusAfterAck | null>(null);
  const stateVersionRef = useRef(state.room.version);
  stateVersionRef.current = state.room.version;
  const previousStatusRef = useRef(state.room.status);

  const view = state.self.view;
  const paused = state.room.status === 'paused';
  const live = room.interactive;

  const participants = state.room.participants;
  const nicknameOf = (playerId: string): string => participants.find((participant) => participant.id === playerId)?.nickname ?? '—';
  const myTurn = view !== null && !paused && live && view.status === 'playing' && view.currentPlayerId === state.self.playerId;
  const selectedCard = view?.hand.find((card) => card.id === selectedId) ?? null;
  const canSelect = myTurn && (view?.playableCardIds.includes(selectedId ?? '') ?? false);
  const firstHandCardId = view?.hand[0]?.id ?? null;
  const leavesOneCard = (view?.hand.length ?? 0) - 1 === 1 && selectedCard !== null;
  const seatedPlayerIds = new Set((view?.players ?? []).map((player) => player.id));
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
    if (focusedCardId === null) return;
    if (view === null || !view.hand.some((card) => card.id === focusedCardId)) {
      if (document.activeElement === document.body) handRef.current?.focus({ preventScroll: true });
      setFocusedCardId(firstHandCardId);
    }
  }, [firstHandCardId, focusedCardId, view]);

  useEffect(() => {
    const element = handRef.current;
    if (element === null) return;
    const update = (): void => {
      setHandMore(element.scrollHeight - element.scrollTop - element.clientHeight > 4);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [view?.hand.length]);

  if (view === null) return null;

  // Bots nunca "caem": conexão é conceito de pessoa; ausência de bot não pausa.
  const currentParticipant =
    view.currentPlayerId === null ? undefined : participants.find((participant) => participant.id === view.currentPlayerId);
  const currentPlayerDisconnected =
    currentParticipant !== undefined && currentParticipant.kind === 'human' && currentParticipant.connected === false;
  const currentIsBot = currentParticipant?.kind === 'bot';

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
    if (view === null) return;
    const desktop =
      typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(min-width: 900px)').matches;
    const columns = view.hand.length > 8 ? 1 : desktop ? 8 : 4;
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    const handIds = view.hand.map((card) => card.id);
    const currentIndex = handIds.indexOf(cardId);
    if (currentIndex < 0 || handIds.length < 2) return;
    event.preventDefault();
    const nextId = handIds[(currentIndex + offset + handIds.length * 2) % handIds.length];
    if (nextId === undefined) return;
    setFocusedCardId(nextId);
    const buttons = handRef.current?.querySelectorAll<HTMLButtonElement>('[data-card-id]');
    const nextCard = Array.from(buttons ?? []).find((button) => button.dataset.cardId === nextId);
    nextCard?.focus();
    nextCard?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  const turnText =
    view.status === 'finished'
      ? 'Rodada encerrada'
      : paused
        ? 'Rodada pausada'
        : myTurn
          ? 'Sua vez'
          : `Vez de ${nicknameOf(view.currentPlayerId ?? '')}${currentIsBot ? ' (bot)' : ''}`;
  const directionLabel = view.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';
  const currentIndex = view.currentPlayerId === null ? -1 : view.players.findIndex((player) => player.id === view.currentPlayerId);
  const step = view.direction === 'clockwise' ? 1 : -1;
  const nextPlayer = currentIndex < 0 ? undefined : view.players[(currentIndex + step + view.players.length) % view.players.length];
  const nextParticipant = nextPlayer === undefined ? undefined : participants.find((participant) => participant.id === nextPlayer.id);
  const nextName = nextPlayer === undefined
    ? null
    : nextPlayer.id === state.self.playerId
      ? 'você'
      : nextParticipant?.nickname ?? nicknameOf(nextPlayer.id);
  const showNext = nextName !== null && !paused && view.status === 'playing';
  const liveSummary = `Cor ativa ${COLOR_LABELS[view.activeColor]}. Descarte ${cardLabel(view.discardTop)}. ${directionLabel}.`;

  return (
    <div className="screen table tv2-table-root" data-direction={view.direction} data-seat-count={view.players.length}>
      <TableShell
        rotuloMesa="Mesa de jogo"
        rotuloAcoes="Ações da rodada"
        rotuloMao="Sua mão"
        rotuloBarra="Conteúdo da sala"
        topo={
          <>
            <div className="tv2-top-vez">
              <div className="tv2-top-line">
                <span
                  className="turn-indicator tv2-turn"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  tabIndex={-1}
                  data-focus-target
                  data-testid="turn-indicator"
                >
                  {turnText}
                </span>
                {myTurn ? <Chip tone="latao">na vez</Chip> : null}
                {state.room.mode === 'training' ? <Chip tone="creme">treino</Chip> : null}
              </div>
              <div className="tv2-direction" data-testid="table-direction">
                <DirectionArrow reversed={view.direction === 'counterclockwise'} />
                <strong>{directionLabel}</strong>
                {showNext ? (
                  <span className="tv2-next">
                    · próximo na ordem: <span className="tv2-next-name">{nextName}{nextParticipant?.kind === 'bot' ? ' (bot)' : ''}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </>
        }
        mesa={
          <RailSlot>
            <SeatCircuit
              players={view.players}
              direction={view.direction}
              currentPlayerId={view.currentPlayerId}
              selfId={state.self.playerId}
              participants={participants}
              paused={paused}
              roundFinished={view.status === 'finished'}
              variant="table"
              reactions={room.activeReactions ?? {}}
              animations={room.activeAnimations ?? 'full'}
            />
            <TableCenter
              drawPileCount={view.drawPileCount}
              discardTop={view.discardTop}
              activeColor={view.activeColor}
            />
            <div className="tv2-corner-stack">
              {!paused && currentPlayerDisconnected ? (
                <p className="tv2-corner-banner" data-testid="disconnected-banner">
                  {nicknameOf(view.currentPlayerId ?? '')} caiu. A rodada espera o retorno ou a decisão do anfitrião.
                </p>
              ) : null}
              {waitingParticipants.length > 0 ? (
                <section className="waiting-participants tv2-waiting" aria-label="Aguardam a próxima rodada" data-testid="waiting-participants">
                  {waitingParticipants.slice(0, 2).map((participant) => (
                    <div
                      key={participant.id}
                      className="waiting-participant tv2-waiting-item"
                      data-testid={`waiting-participant-${participant.nickname}`}
                      data-player-id={participant.id}
                    >
                      <AvatarBadge avatar={participant.avatar} size="small" />
                      <span className="participant-name">{participant.nickname}</span>
                      <span className="tv2-waiting-label">aguarda próxima rodada</span>
                    </div>
                  ))}
                  {waitingParticipants.length > 2 ? (
                    <span className="tv2-waiting-more">+{waitingParticipants.length - 2}</span>
                  ) : null}
                </section>
              ) : null}
            </div>
            {paused ? (
              <div className="tv2-pause-overlay">
                <PausePanel state={state} />
              </div>
            ) : null}
            <p className="tv2-sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="table-live-summary">
              {liveSummary}
            </p>
          </RailSlot>
        }
        acoes={
          <TableActions
            view={view}
            myTurn={myTurn}
            paused={paused}
            live={live}
            selfId={state.self.playerId}
            nicknameOf={nicknameOf}
            sendAction={sendAction}
          />
        }
        mao={
          <div className={`tv2-hand-zone${myTurn ? ' tv2-hand-zone--turn' : ''}`}>
            <div className="tv2-hand-head">
              <h2>Sua mão</h2>
              <span className="tv2-hand-count">
                <strong>{view.hand.length}</strong> cartas
                {handMore ? <span className="tv2-hand-more-cue" aria-hidden="true">▾</span> : null}
              </span>
            </div>
            <p className="tv2-sr-only" id="hand-help">
              Cartas jogáveis recebem destaque. Use as setas para percorrer a mão e Enter ou Espaço para selecionar.
            </p>
            <div
              className="hand tv2-hand-cards"
              ref={handRef}
              aria-label="Sua mão"
              aria-describedby="hand-help"
              data-testid="my-hand"
              tabIndex={-1}
            >
              {view.hand.map((card) => {
                const playable = myTurn && !playPending && view.playableCardIds.includes(card.id);
                const tabIndex = focusedCardId === card.id || (focusedCardId === null && card.id === firstHandCardId) ? 0 : -1;
                return (
                  <CardView
                    key={card.id}
                    card={card}
                    selected={selectedId === card.id}
                    playable={playable}
                    drawn={view.drawnCardId === card.id}
                    tabIndex={tabIndex}
                    onClick={() => pickCard(card)}
                    onFocus={() => setFocusedCardId(card.id)}
                    onKeyDown={(event) => handleCardKeyDown(event, card.id)}
                  />
                );
              })}
            </div>
            {!paused && selectedCard !== null && canSelect ? (
              <section
                className="play-strip tv2-play-strip"
                aria-label="Confirmar jogada"
                data-testid="play-strip"
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  event.preventDefault();
                  if (choosingColor) closeColorChooser();
                  else cancelCardSelection();
                }}
              >
                <span className="tv2-play-label">
                  <small>{selectedCard.id === view.drawnCardId ? 'Carta comprada' : 'Jogar'}</small>
                  <strong>{cardLabel(selectedCard)}</strong>
                </span>
                {leavesOneCard ? (
                  <label className="announce-label tv2-announce">
                    <input
                      type="checkbox"
                      checked={announce}
                      onChange={(event) => setAnnounce(event.target.checked)}
                      data-testid="last-card-checkbox"
                    />
                    Avisar última
                  </label>
                ) : null}
                {selectedCard.kind === 'wild' && choosingColor ? (
                  <span
                    className="color-options tv2-color-options"
                    role="group"
                    aria-label="Escolha a cor do coringa"
                    data-testid="color-chooser"
                  >
                    {COLORS.map((color, index) => (
                      <button
                        key={color}
                        ref={index === 0 ? firstColorRef : undefined}
                        type="button"
                        className={`color-button chip-${color} tv2-color-button`}
                        aria-label={COLOR_LABELS[color]}
                        onClick={() => void sendPlay(color)}
                        data-testid={`color-option-${color}`}
                      >
                        <ColorSymbol color={color} />
                        <span className="tv2-color-name">{COLOR_LABELS[color]}</span>
                      </button>
                    ))}
                  </span>
                ) : (
                  <button
                    ref={selectedCard.kind === 'wild' ? colorTriggerRef : undefined}
                    type="button"
                    className="primary tv2-btn tv2-btn--principal"
                    disabled={playPending || !live}
                    onClick={() => (selectedCard.kind === 'wild' ? setChoosingColor(true) : void sendPlay())}
                    data-testid="play-button"
                  >
                    {playPending ? 'Aguardando…' : 'Jogar'}
                  </button>
                )}
                <button
                  type="button"
                  className="secondary tv2-btn tv2-btn--secundario"
                  onClick={cancelCardSelection}
                  data-testid="cancel-play"
                >
                  Cancelar
                </button>
              </section>
            ) : null}
          </div>
        }
        barra={<TableBarNav />}
      />
    </div>
  );
}

/** Seta do sentido: para a direita no horário e para a esquerda no anti-horário. */
function DirectionArrow({ reversed }: { reversed: boolean }): ReactNode {
  return (
    <svg
      className={`tv2-direction-arrow${reversed ? ' tv2-direction-arrow--reversed' : ''}`}
      viewBox="0 0 24 24"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M4 12h16M14 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
