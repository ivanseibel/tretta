'use client';

import type { ReactNode } from 'react';
import type { ScoreboardEntry, StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { AvatarAction, AvatarBadge } from '@/components/ui';
import { Button, Chip, ScreenShell } from '@/components/chrome';
import { ReactionBadge } from '@/components/ReactionBadge';
import { RoomBar, RoomHeading, RoomTopBar } from '@/components/screens/RoomChrome';
import styles from '@/components/screens/room.module.css';

interface ResultRow {
  readonly entry: ScoreboardEntry;
  readonly participant: StateMessage['room']['participants'][number] | undefined;
}

function CrownIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.2l3.8 3 4.2-6 4.2 6 3.8-3-1.4 10H5.4z" />
      <path d="M5.8 20.4h12.4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.4l3.4 2" />
    </svg>
  );
}

/**
 * Resultado é tela dedicada, não sobreposição: o placar de até oito pessoas
 * ganha espaço e a volta à preparação continua sendo uma decisão do anfitrião.
 * Quem não é anfitrião aguarda; ninguém entra na próxima rodada em um toque.
 */
export function Results({
  state,
}: {
  readonly state: StateMessage;
  readonly events?: readonly unknown[];
}): ReactNode {
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

  const winnerRow = lastRound?.winnerId === null || lastRound?.winnerId === undefined
    ? undefined
    : rows.find((row) => row.entry.playerId === lastRound.winnerId);

  const winnerText =
    lastRound === null || lastRound.winnerId === null
      ? 'Rodada encerrada sem vencedor.'
      : lastRound.substitute
        ? `Substituto de ${lastRound.winnerNickname ?? '—'} venceu a rodada!`
        : lastRound.winnerKind === 'bot'
          ? `${lastRound.winnerNickname ?? '—'} (bot) venceu a rodada!`
          : `${lastRound.winnerNickname ?? '—'} venceu a rodada!`;

  const subTexto =
    lastRound === null || lastRound.winnerId === null
      ? 'A rodada foi encerrada antes do fim. O placar da sala continua valendo e a próxima rodada começa na preparação.'
      : `Primeira pessoa a ficar sem cartas na rodada ${lastRound.roundNumber}. ${
          winnerRow === undefined
            ? 'O placar da sala continua valendo.'
            : `${winnerRow.entry.wins} ${winnerRow.entry.wins === 1 ? 'vitória' : 'vitórias'} na sala até aqui.`
        }`;

  return (
    <ScreenShell
      className={`${styles.tela} ${styles.resultadoTela}`}
      largura="ampla"
      rolavel
      cabecalhoRolavel
      rotuloConteudo={`Resultado da sala ${state.room.roomCode}`}
      rotuloBarra="Conteúdo da sala"
      cabecalho={
        <>
          <RoomTopBar etapa={`Sala ${state.room.roomCode}`} mostrarSala mostrarSair />
          <RoomHeading
            sobretitulo={lastRound === null ? 'Fim da mesa' : `Rodada ${lastRound.roundNumber} encerrada`}
            titulo="Resultado"
            subtitulo="O placar de papel sobre a mesa. A próxima rodada começa na preparação, com a prontidão de todos."
          />
        </>
      }
      conteudo={
        <section className={styles.resultadoCena} aria-labelledby="resultado-titulo">
          <div className={styles.resultadoMoldura}>
            <div className={styles.resultadoFeltro}>
              <div className={styles.resultadoPapel}>
                <div className={styles.resultadoTopo}>
                  <span className={styles.resultadoIcone} aria-hidden="true">
                    {lastRound === null || lastRound.winnerId === null ? <ClockIcon /> : <CrownIcon />}
                  </span>
                  <p className={styles.resultadoRotulo}>
                    {lastRound === null ? 'Mesa encerrada' : `Rodada ${lastRound.roundNumber} encerrada`}
                  </p>
                  <h2
                    className={styles.resultadoTitulo}
                    id="resultado-titulo"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid="results-winner"
                  >
                    {winnerText}
                  </h2>
                  <p className={styles.resultadoSub}>{subTexto}</p>
                </div>

                <div>
                  <div className={styles.placarCabeca}>
                    <span>Rodadas vencidas</span>
                    <span>Total</span>
                  </div>
                  <ul className={styles.placarLista} aria-label="Placar da sala">
                    {rows.map(({ entry, participant }) => {
                      const self = entry.playerId === state.self.playerId;
                      const current = entry.current && participant !== undefined;
                      const winner = lastRound?.winnerId === entry.playerId;
                      return (
                        <li
                          key={entry.playerId}
                          className={`${styles.placarLinha}${winner ? ` ${styles.placarLinhaVencedor}` : ''}`}
                          data-testid={`score-${entry.nickname}`}
                          data-player-id={entry.playerId}
                          data-vencedor={winner ? 'true' : undefined}
                        >
                          <div className={styles.placarIdentidade}>
                            {self && current ? (
                              <AvatarAction
                                avatar={entry.avatar}
                                label={`Reagir como ${entry.nickname}`}
                                testId={`mood-avatar-${entry.playerId}`}
                                onActivate={(trigger) => room.openReactionMenu(trigger)}
                                size="small"
                              />
                            ) : (
                              <AvatarBadge avatar={entry.avatar} size="small" />
                            )}
                            <div className={styles.placarTextos}>
                              <span className={styles.placarNome}>{entry.nickname}</span>
                              <span className={styles.placarEtiquetas}>
                                {winner ? <Chip tone="latao">vencedor</Chip> : null}
                                {entry.kind === 'bot' ? <Chip tone="bot">bot</Chip> : null}
                                {self ? <Chip tone="creme">você</Chip> : null}
                                {entry.kind === 'human' && participant?.autoControlled ? (
                                  <Chip tone="substituto">substituto</Chip>
                                ) : null}
                                {entry.current ? null : <Chip tone="espera">saiu da sala</Chip>}
                                {current ? (
                                  <ReactionBadge
                                    reaction={room.activeReactions?.[entry.playerId]}
                                    animations={room.activeAnimations ?? 'full'}
                                    compact
                                  />
                                ) : null}
                              </span>
                            </div>
                          </div>
                          <span className={styles.placarTotal}>
                            {entry.wins} <span className={styles.placarLegenda}>rodada(s)</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <p className={styles.resultadoNota}>
                  A próxima rodada começa na preparação. Todos confirmam prontidão; ninguém entra em uma rodada por um
                  toque só.
                </p>
              </div>
            </div>
          </div>
        </section>
      }
      rodape={
        <div className={styles.rodapeAcao}>
          {isHost ? (
            <div className={styles.rodapeHost}>
              <p className={styles.rodapeTexto}>
                <strong>Anfitrião:</strong> volte à preparação para combinar a próxima rodada.
              </p>
              <Button
                variant="principal"
                size="principal"
                bloco
                disabled={!room.interactive}
                onClick={() => void room.returnToLobby()}
                data-testid="return-to-lobby-button"
              >
                Voltar à preparação
              </Button>
            </div>
          ) : (
            <p className={styles.rodapeTexto} data-testid="waiting-host">
              Aguardando o anfitrião voltar à preparação. A mesa não entra sozinha na próxima rodada.
            </p>
          )}
        </div>
      }
      barra={<RoomBar />}
    />
  );
}
