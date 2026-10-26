'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';
import { AvatarAction, AvatarBadge } from '@/components/ui';
import { Button, Chip, ScreenShell } from '@/components/chrome';
import { ReactionBadge } from '@/components/ReactionBadge';
import { RoomBar, RoomHeading, RoomTopBar } from '@/components/screens/RoomChrome';
import styles from '@/components/screens/room.module.css';

/**
 * Preparação: a mesa posta com os assentos reais, prontidão, convite e os
 * controles do anfitrião. A ação principal fica no rodapé fixo da casca; o
 * conteúdo pode rolar em 360×640 sem esconder o início da rodada.
 */
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
  const notReady = seated.filter((participant) => !participant.ready);
  const readyCount = seated.filter((participant) => participant.ready).length;
  const everyoneReady = seated.length >= 2 && seated.every((participant) => participant.ready);
  const isHost = state.room.hostId === me.playerId;
  const canStart = isHost && everyoneReady && seated.length <= 8;
  // Vitórias de quem já deixou a vaga continuam no placar da sala.
  const historical = state.room.scoreboard.filter((entry) => !entry.current);

  async function copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  const subtitulo = training
    ? 'Você e três bots. Marque pronto para abrir a rodada quando quiser.'
    : isHost
      ? 'Você é o anfitrião. Chame as pessoas, confirme a prontidão e inicie quando todos estiverem prontos.'
      : 'Marque pronto. O anfitrião inicia quando todo mundo estiver pronto; quem chega depois entra na próxima rodada.';

  return (
    <ScreenShell
      className={styles.tela}
      largura="ampla"
      rolavel
      cabecalhoRolavel
      rotuloConteudo={`Preparação da sala ${state.room.roomCode}`}
      rotuloBarra="Conteúdo da sala"
      cabecalho={
        <>
          <RoomTopBar etapa={`Sala ${state.room.roomCode}`} mostrarSala mostrarSair />
          <RoomHeading
            sobretitulo="Mesa posta"
            titulo="Preparação"
            subtitulo={subtitulo}
            meta={
              <>
                <Chip tone={isHost ? 'latao' : 'creme'}>{isHost ? 'Anfitrião' : 'Convidado'}</Chip>
                <Chip tone={everyoneReady ? 'pronto' : 'espera'}>
                  {readyCount}/{seated.length} prontos
                </Chip>
              </>
            }
          />
        </>
      }
      conteudo={
        <div className={styles.preparacao}>
          <section className={styles.mesaCena} aria-labelledby="prep-mesa-titulo">
            <div className={styles.mesaMoldura}>
              <div className={styles.mesaFeltro}>
                <header className={styles.mesaCabeca}>
                  <div>
                    <p className={styles.mesaSobre}>Na mesa</p>
                    <h2 className={styles.mesaTitulo} id="prep-mesa-titulo">
                      {seated.length} {seated.length === 1 ? 'assento ocupado' : 'assentos ocupados'}
                    </h2>
                  </div>
                  <span className={styles.mesaResumo}>
                    {everyoneReady ? 'Todos prontos' : `${notReady.length} aguardando`}
                  </span>
                </header>

                <div className={styles.centroMesa}>
                  <p className={styles.centroRotulo}>Código da sala</p>
                  <strong className={styles.centroCodigo}>{state.room.roomCode}</strong>
                  {training ? (
                    <p className={styles.centroTexto}>
                      Treino individual contra três bots. O anfitrião é você.
                    </p>
                  ) : (
                    <>
                      <a className={styles.centroLink} href={inviteUrl} data-testid="invite-link">
                        {inviteUrl}
                      </a>
                      <p className={styles.centroTexto}>
                        Compartilhe o link. Quem entrar durante a rodada senta automaticamente na próxima.
                      </p>
                      <div className={styles.centroAcoes}>
                        <Button
                          variant="secundario"
                          className={styles.botaoPapel}
                          onClick={() => void copyInvite()}
                          data-testid="copy-invite"
                        >
                          <span aria-hidden="true">🔗</span>
                          {copied ? 'Copiado!' : 'Copiar convite'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <ul className={styles.assentos} aria-label="Assentos da mesa">
                  {state.room.participants.map((participant) => {
                    const self = participant.id === me.playerId;
                    const isBot = participant.kind === 'bot';
                    const offline = participant.kind === 'human' && !participant.connected;
                    const classes = [styles.assento];
                    if (self) classes.push(styles.assentoVoce);
                    if (offline) classes.push(styles.assentoOffline);
                    return (
                      <li
                        key={participant.id}
                        className={classes.join(' ')}
                        data-testid="lobby-participant"
                        data-tv2-seat=""
                        data-player-id={participant.id}
                        data-ready={participant.ready ? 'true' : 'false'}
                      >
                        <div className={styles.assentoPrincipal}>
                          {self ? (
                            <AvatarAction
                              avatar={participant.avatar}
                              label={`Reagir como ${participant.nickname}`}
                              testId={`mood-avatar-${participant.id}`}
                              onActivate={(trigger) => room.openReactionMenu(trigger)}
                              size="small"
                            />
                          ) : (
                            <AvatarBadge avatar={participant.avatar} size="small" />
                          )}
                          <div className={styles.assentoTextos}>
                            <span className={styles.assentoNome} data-tv2-seat-name>
                              {participant.nickname}
                            </span>
                            <span className={styles.assentoEtiquetas}>
                              {participant.isHost ? <Chip tone="latao">anfitrião</Chip> : null}
                              {self ? <Chip tone="creme">você</Chip> : null}
                              {isBot ? <Chip tone="bot">bot</Chip> : null}
                              {participant.autoControlled ? <Chip tone="substituto">substituto</Chip> : null}
                              {offline ? (
                                <Chip tone="offline">desconectado</Chip>
                              ) : (
                                <Chip tone={participant.ready ? 'pronto' : 'espera'}>
                                  {participant.ready ? 'pronto' : 'não pronto'}
                                </Chip>
                              )}
                              {!participant.ready && !offline ? <span className="tv2-sr-only">aguardando</span> : null}
                              <ReactionBadge
                                reaction={room.activeReactions?.[participant.id]}
                                animations={room.activeAnimations ?? 'full'}
                                compact
                              />
                            </span>
                          </div>
                        </div>
                        <div className={styles.assentoRodape}>
                          <span className={styles.assentoPontos} title="Rodadas vencidas">
                            {participant.score} v.
                          </span>
                          <span className={styles.assentoAcoes}>
                            {isHost && !training && !self ? (
                              <Button
                                variant="perigo"
                                disabled={!room.interactive}
                                aria-label={`Remover ${participant.nickname} da sala`}
                                data-testid={`remove-${participant.nickname}`}
                                onClick={() => void room.removeParticipant(participant.id)}
                              >
                                Remover
                              </Button>
                            ) : null}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          {training ? (
            <section className={styles.painelSecao} aria-label="Mesa de treino">
              <h2 className={styles.painelTitulo}>Treino individual</h2>
              <p className={styles.painelTexto} data-testid="training-note">
                Mesa de treino: você joga sozinho contra três bots simples, com as regras do Clássico. A partida roda no
                servidor, como nas salas entre amigos.
              </p>
            </section>
          ) : null}

          <section className={styles.painelSecao} aria-label="Aguardando prontidão">
            <h2 className={styles.painelTitulo}>
              {notReady.length === 0 ? 'Todos prontos' : `Aguardando ${notReady.length} ${notReady.length === 1 ? 'pessoa' : 'pessoas'}`}
            </h2>
            {notReady.length === 0 ? (
              <p className={styles.painelTexto}>
                O anfitrião já pode abrir a rodada. Quem estava fora entra automaticamente na próxima — sem fila.
              </p>
            ) : (
              <>
                <p className={styles.painelTexto}>A rodada abre quando todo mundo confirmar.</p>
                <ul className={styles.listaEspera} data-testid="awaiting-participants">
                  {notReady.map((participant) => (
                    <li key={participant.id} className={styles.esperaItem} data-player-id={participant.id}>
                      <AvatarBadge avatar={participant.avatar} size="small" />
                      <span className={styles.esperaItemNome}>{participant.nickname}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className={styles.painelTexto}>
              Quem entra durante a rodada aguarda aqui e senta automaticamente na próxima. Não existe fila para entrar.
            </p>
          </section>

          {historical.length > 0 ? (
            <section className={styles.painelSecao} aria-label="Placar da sala">
              <h2 className={styles.painelTitulo}>Placar da sala</h2>
              <ul className={styles.historicoLista} data-testid="scoreboard-history">
                {historical.map((entry) => (
                  <li key={entry.playerId} className={styles.historicoItem} data-testid={`history-${entry.nickname}`}>
                    <AvatarBadge avatar={entry.avatar} size="small" />
                    <span className={styles.historicoNome}>{entry.nickname}</span>
                    <Chip tone="espera">saiu da sala</Chip>
                    <span className={styles.historicoPontos}>{entry.wins} v.</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      }
      rodape={
        <div className={styles.rodapeAcao}>
          <p className={styles.rodapeTexto}>
            {everyoneReady ? (
              <>
                <strong>Todos prontos.</strong> A mesa pode começar.
              </>
            ) : (
              <>
                <strong>
                  {readyCount} de {seated.length} prontos.
                </strong>{' '}
                Aguardando o restante.
              </>
            )}
          </p>
          <div className={isHost ? styles.rodapeBotoes : styles.rodapeBotoesUnico}>
            <Button
              variant={isHost ? 'secundario' : 'principal'}
              size={isHost ? 'normal' : 'principal'}
              bloco
              disabled={!room.interactive}
              aria-pressed={me.ready}
              onClick={() => void room.setReady(!me.ready)}
              data-testid="ready-toggle"
            >
              {me.ready ? 'Cancelar prontidão' : 'Estou pronto'}
            </Button>
            {isHost ? (
              <Button
                variant="principal"
                size="principal"
                bloco
                disabled={!canStart || !room.interactive}
                onClick={() => void room.startRound()}
                data-testid="start-round-button"
              >
                Iniciar rodada
              </Button>
            ) : null}
          </div>
          {isHost && !canStart ? (
            <p className={styles.rodapeHostTexto} data-testid="start-hint">
              {training
                ? 'Confirme que você está pronto para iniciar.'
                : connected.length < 2
                  ? 'São necessários pelo menos 2 participantes conectados.'
                  : 'Todos precisam estar prontos.'}
            </p>
          ) : null}
          {!isHost ? <p className={styles.rodapeHostTexto}>Aguardando o anfitrião iniciar.</p> : null}
        </div>
      }
      barra={<RoomBar />}
    />
  );
}
