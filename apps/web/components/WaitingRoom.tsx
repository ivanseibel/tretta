'use client';

import type { ReactNode } from 'react';
import type { StateMessage } from '@tretta/protocol';
import { COLOR_LABELS, cardLabel } from '@/lib/labels';
import { useRoom } from '@/app/providers';
import { Button, TableShell } from '@/components/chrome';
import { ColorSymbol } from '@/components/ui';
import { PausePanel } from '@/components/PausePanel';
import { ReactionBadge } from '@/components/ReactionBadge';
import { SeatCircuit } from '@/components/SeatCircuit';
import { CardFace } from '@/components/table/CardFace';
import { RoomBar, RoomTopBar } from '@/components/screens/RoomChrome';
import styles from '@/components/screens/room.module.css';

/**
 * Espera / observador: a mesa pública real, sem mão e sem assento inventado
 * para quem observa. A vez, o sentido e as reações ficam na casca da mesa; o
 * histórico e a conversa vivem na gaveta aberta pela barra inferior.
 */
export function WaitingRoom({
  state,
}: {
  readonly state: StateMessage;
  readonly events?: readonly unknown[];
}): ReactNode {
  const room = useRoom();
  const table = state.table;
  const paused = state.room.status === 'paused';
  const nicknameOf = (playerId: string): string =>
    state.room.participants.find((participant) => participant.id === playerId)?.nickname ?? '—';

  if (table === null) {
    return (
      <main className={`${styles.esperaTela} tv2-table-root`}>
        <TableShell
          rotuloMesa="Mesa pública"
          rotuloBarra="Conteúdo da sala"
          topo={
            <div className={styles.esperaTopo}>
              <RoomTopBar etapa={`Sala ${state.room.roomCode}`} mostrarSala mostrarSair />
              <div className={styles.esperaTopoTexto}>
                <h1 className={styles.vez} data-focus-target tabIndex={-1}>
                  Esperando a mesa
                </h1>
                <p className={styles.sentido}>Aguardando a próxima rodada.</p>
              </div>
            </div>
          }
          mesa={<p className={styles.painelTexto}>A mesa ainda não está pronta.</p>}
          barra={<RoomBar />}
        />
      </main>
    );
  }

  const directionLabel = table.direction === 'clockwise' ? 'Sentido horário' : 'Sentido anti-horário';
  const turnText =
    table.status === 'finished'
      ? 'Rodada encerrada'
      : `Vez de ${nicknameOf(table.currentPlayerId ?? '')}`;
  const lastCard = table.lastCardWindow;
  const selfReaction = room.activeReactions?.[state.self.playerId];

  return (
    <main className={`${styles.esperaTela} tv2-table-root`}>
      <TableShell
        rotuloMesa="Mesa pública"
        rotuloAcoes="Sua espera e reações"
        rotuloBarra="Conteúdo da sala"
        topo={
          <div className={styles.esperaTopo}>
            <RoomTopBar etapa={`Sala ${state.room.roomCode}`} mostrarSala mostrarSair />
            <div className={styles.esperaTopoTexto}>
              <p className={styles.esperaSala}>Você observa · sem assento nesta rodada</p>
              <h1
                className={styles.vez}
                data-testid="public-table-status"
                data-tv2-turn
                data-focus-target
                tabIndex={-1}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {turnText}
              </h1>
              <p className={styles.sentido} data-testid="table-direction">
                <strong>{directionLabel}</strong>
              </p>
            </div>
          </div>
        }
        mesa={
          <div className={styles.esperaPalco} data-testid="public-table" role="group" aria-label="Mesa pública">
            <div className={styles.esperaMesa}>
              <SeatCircuit
                players={table.players}
                direction={table.direction}
                currentPlayerId={table.currentPlayerId}
                selfId={null}
                participants={state.room.participants}
                paused={paused}
                roundFinished={table.status === 'finished'}
                variant="public"
                reactions={room.activeReactions ?? {}}
                animations={room.activeAnimations ?? 'full'}
              />

              <div className={styles.esperaCentro}>
                <div
                  className={styles.montePublico}
                  role="img"
                  aria-label={`Pilha de compra com ${table.drawPileCount} cartas`}
                  data-testid="public-draw-pile"
                >
                  <span className={styles.monteCarta} aria-hidden="true">
                    T
                  </span>
                  <strong className={styles.monteNumero}>{table.drawPileCount}</strong>
                  <span className={styles.monteRotulo}>cartas</span>
                </div>

                <div
                  className={`playing-card tv2-card tv2-card--discard ${styles.descartePublico} card-${
                    table.discardTop.kind === 'wild' ? 'wild' : table.discardTop.color
                  }`}
                  role="img"
                  aria-label={`Descarte: ${cardLabel(table.discardTop)}`}
                  data-testid="public-discard-top"
                  data-card-id={table.discardTop.id}
                  title={cardLabel(table.discardTop)}
                >
                  <CardFace card={table.discardTop} size="discard" />
                </div>

                <span className={styles.corPublica} data-testid="public-active-color">
                  <span className={styles.corRotulo}>cor</span>
                  <ColorSymbol color={table.activeColor} />
                  <strong>{COLOR_LABELS[table.activeColor]}</strong>
                </span>
              </div>

              {paused ? (
                <div className="tv2-pause-overlay">
                  <PausePanel state={state} />
                </div>
              ) : null}
            </div>
          </div>
        }
        acoes={
          <>
            <div className={styles.esperaBanner}>
              <span className={styles.olho} aria-hidden="true">
                👁
              </span>
              <p className={styles.esperaBannerTexto} data-testid="waiting-banner">
                {paused ? (
                  <>
                    <strong>Rodada pausada.</strong> Você continua de fora e entra automaticamente na próxima rodada.
                  </>
                ) : (
                  <>
                    <strong>Você observa.</strong> A mesa tem {table.players.length}{' '}
                    {table.players.length === 1 ? 'jogador' : 'jogadores'}. Você entra automaticamente na próxima rodada.
                  </>
                )}
              </p>
              <ReactionBadge reaction={selfReaction} animations={room.activeAnimations ?? 'full'} compact />
              <Button
                variant="secundario"
                disabled={!room.interactive}
                aria-label={`Reagir como ${state.self.nickname}`}
                data-testid="self-reaction-button"
                onClick={(event) => room.openReactionMenu(event.currentTarget)}
              >
                Reagir
              </Button>
            </div>
            {lastCard === null ? null : (
              <p className={styles.esperaBannerTexto} data-testid="public-last-card">
                {lastCard.announced
                  ? `${nicknameOf(lastCard.playerId)} avisou "Última carta!".`
                  : `${nicknameOf(lastCard.playerId)} está com a última carta.`}
              </p>
            )}
          </>
        }
        barra={<RoomBar />}
      />
    </main>
  );
}
