'use client';

import { useId, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { Avatar } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { Button, ScreenShell } from '@/components/chrome';
import { AvatarPicker } from '@/components/ui';
import { RoomHeading, RoomTopBar } from './RoomChrome';
import styles from './room.module.css';

type StatusIconKind = 'conexao' | 'relogio' | 'link' | 'olho' | 'saida' | 'treino';

function StatusIcon({ kind }: { readonly kind: StatusIconKind }): ReactNode {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'conexao':
      return (
        <svg {...common}>
          <path d="M8 3v5M16 3v5M6.5 8h11v2.5a5.5 5.5 0 0 1-11 0zM12 16v5" />
        </svg>
      );
    case 'relogio':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5.4l3.4 2" />
        </svg>
      );
    case 'link':
      return (
        <svg {...common}>
          <path d="M9.5 14.5 14.5 9.5M7.2 16.8l-1.4 1.4a3.5 3.5 0 0 1-5-5l3.3-3.3a3.5 3.5 0 0 1 5 0M16.8 7.2l1.4-1.4a3.5 3.5 0 0 1 5 5l-3.3 3.3a3.5 3.5 0 0 1-5 0" />
        </svg>
      );
    case 'olho':
      return (
        <svg {...common}>
          <path d="M2.8 12S6.4 5.8 12 5.8 21.2 12 21.2 12 17.6 18.2 12 18.2 2.8 12 2.8 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'saida':
      return (
        <svg {...common}>
          <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14.5 8l4 4-4 4M9 12h9" />
        </svg>
      );
    case 'treino':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
        </svg>
      );
  }
}

function StatusScreen({
  etapa,
  kind,
  rotulo,
  titulo,
  texto,
  dica,
  testId,
  role,
  children,
}: {
  readonly etapa: string;
  readonly kind: StatusIconKind;
  readonly rotulo: string;
  readonly titulo: string;
  readonly texto: ReactNode;
  readonly dica?: ReactNode;
  readonly testId: string;
  readonly role?: 'status' | 'alert';
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <main className={styles.appMain}>
      <ScreenShell
        className={`${styles.tela} ${styles.statusTela}`}
        largura="leitura"
        rolavel
        rotuloConteudo={titulo}
        cabecalho={<RoomTopBar etapa={etapa} />}
        conteudo={
          <div className={styles.statusCena}>
            <div className={styles.statusMoldura}>
              <div className={styles.statusFeltro}>
                <section className={styles.statusPapel} data-testid={testId} role={role}>
                  <span className={styles.statusIcone}>
                    <StatusIcon kind={kind} />
                  </span>
                  <p className={styles.statusRotulo}>{rotulo}</p>
                  <h1 className={styles.statusTitulo} data-focus-target tabIndex={-1}>
                    {titulo}
                  </h1>
                  <p className={styles.statusTexto}>{texto}</p>
                  {children}
                  {dica === undefined ? null : <p className={styles.statusDica}>{dica}</p>}
                </section>
              </div>
            </div>
          </div>
        }
      />
    </main>
  );
}

/** Entrada da sala enquanto o estado ainda não chegou. */
export function ConnectingScreen({ connection }: { readonly connection: 'live' | 'lost' }): ReactNode {
  return (
    <StatusScreen
      etapa="Sala"
      kind="conexao"
      rotulo="Conexão"
      titulo={connection === 'lost' ? 'Conexão perdida' : 'Conectando à mesa'}
      texto={
        connection === 'lost'
          ? 'O navegador perdeu o contato com o servidor. A reconexão é automática e sua identidade nesta sala continua guardada.'
          : 'Buscando a sala e conferindo sua sessão neste navegador.'
      }
      dica={
        connection === 'lost'
          ? 'Você pode continuar nesta tela: a mesa volta sozinha quando a conexão retornar.'
          : 'Isso costuma levar menos de um segundo.'
      }
      testId="connecting"
      role="status"
    >
      <p className={styles.statusInline}>
        <span className={styles.spinner} aria-hidden="true" />
        {connection === 'lost' ? 'Tentando reconectar automaticamente…' : 'Conectando…'}
      </p>
    </StatusScreen>
  );
}

/** Retomada em andamento, sem formulário e sem criar identidade nova. */
export function RecoveringScreen(): ReactNode {
  return (
    <StatusScreen
      etapa="Recuperação"
      kind="relogio"
      rotulo="Recuperação"
      titulo="Retomando sua sessão"
      texto="Estamos devolvendo sua vaga e sua mão nesta sala. A credencial continua neste navegador."
      dica="Se demorar, você poderá tentar de novo sem perder a identidade."
      testId="recovering"
      role="status"
    >
      <p className={styles.statusInline}>
        <span className={styles.spinner} aria-hidden="true" />
        Retomando…
      </p>
    </StatusScreen>
  );
}

/** Prazo de retomada esgotado: nova tentativa explícita, credencial preservada. */
export function RecoveryExhaustedScreen({ code }: { readonly code: string }): ReactNode {
  const room = useRoom();
  return (
    <StatusScreen
      etapa={`Sala ${code}`}
      kind="relogio"
      rotulo="Recuperação pendente"
      titulo="Sessão não retomada"
      texto="Não foi possível retomar sua sessão automaticamente. Ela pode ainda estar ativa em outra aba ou dispositivo — a credencial desta sala continua guardada neste navegador."
      dica="Tentar novamente inicia um ciclo novo sem criar outra identidade."
      testId="recovery-exhausted"
    >
      <div className={styles.statusAcoes}>
        <Button
          variant="principal"
          type="button"
          data-testid="retry-recovery-button"
          onClick={() => void room.retryRecovery(code)}
        >
          Tentar novamente
        </Button>
        <Link className={`tv2-btn tv2-btn--secundario ${styles.botaoPapel}`} href="/" data-testid="back-home">
          Voltar ao início
        </Link>
      </div>
    </StatusScreen>
  );
}

/** Sala encerrada ou endereço que nunca foi um convite válido. */
export function RoomGoneScreen({
  code,
  tipo,
}: {
  readonly code: string;
  readonly tipo: 'expirada' | 'invalida';
}): ReactNode {
  const invalida = tipo === 'invalida';
  return (
    <StatusScreen
      etapa={`Sala ${code}`}
      kind={invalida ? 'link' : 'relogio'}
      rotulo={invalida ? 'Link inválido' : 'Sala expirada'}
      titulo={invalida ? 'Este link não abre uma sala' : 'Esta sala expirou'}
      texto={
        invalida
          ? `O endereço /sala/${code} não corresponde a um convite do Tretta. Confira o link ou peça o código para quem criou a mesa.`
          : `A sala ${code} não existe mais ou ficou aberta tempo demais sem jogadas. Salas encerradas não podem ser retomadas.`
      }
      dica={
        invalida
          ? 'O código tem seis letras e números, sem espaços. Ele aparece na gaveta Sala e no convite.'
          : 'Crie uma nova sala ou entre com um convite novo. O placar de uma sala encerrada não volta.'
      }
      testId="room-not-found"
    >
      <div className={styles.statusAcoes}>
        <Link className="tv2-btn tv2-btn--principal" href="/" data-testid="back-home">
          Voltar ao início
        </Link>
      </div>
    </StatusScreen>
  );
}

/** Pessoa removida pelo anfitrião: mensagem própria, sem formulário de entrada. */
export function RemovedScreen({
  code,
  message,
  onClear,
}: {
  readonly code: string;
  readonly message: string;
  readonly onClear: () => void;
}): ReactNode {
  return (
    <StatusScreen
      etapa={`Sala ${code}`}
      kind="saida"
      rotulo="Vaga encerrada"
      titulo="Você saiu desta mesa"
      texto={message}
      dica="Para voltar, peça um novo convite a quem ficou na sala."
      testId="removed-message"
    >
      <div className={styles.statusAcoes}>
        <Link className="tv2-btn tv2-btn--principal" href="/" data-testid="back-home" onClick={onClear}>
          Voltar ao início
        </Link>
      </div>
    </StatusScreen>
  );
}

/** Mesa de treino é individual: recusa definitiva, sem retry nem identidade nova. */
export function TrainingRefusedScreen(): ReactNode {
  return (
    <StatusScreen
      etapa="Mesa de treino"
      kind="treino"
      rotulo="Entrada recusada"
      titulo="Mesa de treino individual"
      texto="Esta mesa é de treino e é individual: só a pessoa que a criou pode jogar nela. Os três adversários da mesa são bots e outras pessoas não entram."
      dica="Para jogar com amigos, crie ou entre em uma sala comum pela página inicial."
      testId="training-entry-refused"
    >
      <div className={styles.statusAcoes}>
        <Link className="tv2-btn tv2-btn--principal" href="/" data-testid="back-home">
          Voltar ao início
        </Link>
      </div>
    </StatusScreen>
  );
}

/** Erro de sala em linha, com os mesmos testids da base antiga. */
export function RoomErrorBanner({ message, onDismiss }: { readonly message: string; readonly onDismiss: () => void }): ReactNode {
  return (
    <div className={styles.errorBanner} role="alert" data-testid="error-banner">
      <span className={styles.errorTexto}>{message}</span>
      <button type="button" className={styles.errorFechar} onClick={onDismiss} data-testid="error-dismiss">
        Fechar
      </button>
    </div>
  );
}

/** Avisos fixos de conexão e erro; não mudam a altura da tela. */
export function RoomNotices({
  connection,
  recoveryPhase,
  reconnectedAt,
  error,
  onDismissError,
}: {
  readonly connection: 'live' | 'lost';
  readonly recoveryPhase: 'idle' | 'recovering' | 'exhausted';
  readonly reconnectedAt: number | null;
  readonly error: string | null;
  readonly onDismissError: () => void;
}): ReactNode {
  const avisos = connection !== 'live' || (connection === 'live' && recoveryPhase === 'recovering') || (connection === 'live' && reconnectedAt !== null) || error !== null;
  if (!avisos) return null;
  return (
    <div className={styles.noticeLayer} aria-live="polite" aria-atomic="false">
      {connection !== 'live' ? (
        <p className={`${styles.notice} ${styles.noticeLost}`} role="status" data-testid="connection-lost">
          Conexão perdida. Tentando reconectar — os envios ficam bloqueados até voltar.
        </p>
      ) : null}
      {connection === 'live' && recoveryPhase === 'recovering' ? (
        <p className={styles.notice} role="status" data-testid="recovering-banner">
          Retomando sua sessão… os envios ficam bloqueados até a confirmação.
        </p>
      ) : null}
      {connection === 'live' && reconnectedAt !== null ? (
        <p className={`${styles.notice} ${styles.noticeRecovered}`} role="status" data-testid="connection-recovered">
          Conexão recuperada.
        </p>
      ) : null}
      {error !== null ? <RoomErrorBanner message={error} onDismiss={onDismissError} /> : null}
    </div>
  );
}

/** Entrada por convite: apelido, avatar e retorno claro para o início. */
export function JoinRoomScreen({
  code,
  nickname,
  avatar,
  busy,
  error,
  onNickname,
  onAvatar,
  onDismissError,
  onSubmit,
}: {
  readonly code: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onNickname: (value: string) => void;
  readonly onAvatar: (value: Avatar) => void;
  readonly onDismissError: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactNode {
  const formId = useId();
  return (
    <main className={styles.appMain}>
      <ScreenShell
        className={`${styles.tela} ${styles.statusTela}`}
        largura="leitura"
        rolavel
        rotuloConteudo={`Entrar na sala ${code}`}
        cabecalho={
          <>
            <RoomTopBar etapa={`Sala ${code}`} />
            <RoomHeading
              sobretitulo="Convite"
              titulo="Entrar na mesa"
              subtitulo="Escolha como quer aparecer. Sem cadastro, sem instalação."
            />
          </>
        }
        conteudo={
          <div className={`${styles.statusCena} ${styles.entradaCena}`}>
            <div className={styles.statusMoldura}>
              <div className={styles.statusFeltro}>
                <section className={styles.statusPapel} aria-label="Seus dados na mesa">
                  {error === null ? null : <RoomErrorBanner message={error} onDismiss={onDismissError} />}
                  <form
                    id={formId}
                    className={styles.entradaForm}
                    aria-label="Entrar na sala"
                    aria-busy={busy}
                    onSubmit={onSubmit}
                  >
                    <div className={styles.campo}>
                      <label className={styles.rotulo} htmlFor={`${formId}-apelido`}>
                        Seu apelido
                      </label>
                      <input
                        id={`${formId}-apelido`}
                        className={styles.input}
                        value={nickname}
                        onChange={(event) => onNickname(event.target.value)}
                        maxLength={24}
                        autoComplete="nickname"
                        placeholder="Ex.: Bia"
                        data-testid="join-name-input"
                      />
                    </div>
                    <div className={styles.campo}>
                      <span className={styles.rotulo}>Seu avatar</span>
                      <div className={styles.entradaAvatares}>
                        <AvatarPicker value={avatar} onChange={onAvatar} />
                      </div>
                    </div>
                    <p className={styles.entradaDica}>
                      Seu apelido aparece para a mesa e pode ser visto por quem já está na sala.
                    </p>
                  </form>
                </section>
              </div>
            </div>
          </div>
        }
        rodape={
          <div className={styles.rodapeAcao}>
            <div className={styles.rodapeBotoesUnico}>
              <Button
                variant="principal"
                size="principal"
                bloco
                type="submit"
                form={formId}
                disabled={nickname.trim().length === 0 || busy}
                data-testid="join-room-button"
              >
                {busy ? 'Entrando…' : 'Entrar na sala'}
              </Button>
            </div>
          </div>
        }
      />
    </main>
  );
}
