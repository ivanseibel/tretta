'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, NICKNAME_MAX_LENGTH, type Avatar } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { Button, Chip, Panel, ScreenShell } from '@/components/chrome';
import { AVATAR_LABELS, AvatarBadge, ColorSymbol } from '@/components/ui';
import type { Color } from '@tretta/rules';
import styles from './Home.module.css';

interface DecorativeCard {
  readonly color: Color;
  readonly value: string;
  readonly tone: 'vermelho' | 'amarelo' | 'coringa';
}

const DECORATIVE_CARDS: readonly DecorativeCard[] = [
  { color: 'red', value: '7', tone: 'vermelho' },
  { color: 'yellow', value: '4', tone: 'amarelo' },
  { color: 'green', value: '★', tone: 'coringa' },
];

const TONE_CLASS = {
  vermelho: styles.cartaVermelha,
  amarelo: styles.cartaAmarela,
  coringa: styles.cartaCoringa,
} as const;

/**
 * Entrada do jogo: o convite sobre a mesa. Mantém as três entradas reais —
 * criar sala, entrar por código e treinar — e todo o estado de transporte no
 * `RoomProvider`; aqui só vivem o formulário, o foco e a apresentação.
 */
export function HomeScreen(): ReactNode {
  const room = useRoom();
  const router = useRouter();
  const nicknameId = useId();
  const codeId = useId();
  const createFormId = useId();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<Avatar>('raposa');
  const [code, setCode] = useState('');
  const typedNickname = nickname.trim();

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (typedNickname.length === 0) return;
    const createdCode = await room.createRoom(typedNickname, avatar);
    if (createdCode !== null) router.push(`/sala/${createdCode}`);
  }

  async function handleTrain(): Promise<void> {
    if (typedNickname.length === 0) return;
    const createdCode = await room.createRoom(typedNickname, avatar, 'training');
    if (createdCode !== null) router.push(`/sala/${createdCode}`);
  }

  function handleJoin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length > 0) router.push(`/sala/${normalized}`);
  }

  return (
    <ScreenShell
      className={styles.home}
      largura="ampla"
      rolavel
      rotuloConteudo="Entrada na mesa"
      conteudo={
        <div className={styles.cena}>
          <section className={styles.feltro} aria-labelledby="home-titulo">
            <div className={styles.texto}>
              <p className={styles.sobretitulo}>Jogo de cartas para família e amigos</p>
              <h1 className={styles.titulo} id="home-titulo">
                Tretta
              </h1>
              <p className={styles.chamada}>A mesa está posta. Sente-se, escolha um apelido e chame quem você gosta.</p>
            </div>
            <div className={styles.cartas} aria-hidden="true">
              {DECORATIVE_CARDS.map((card) => (
                <span className={`${styles.carta} ${TONE_CLASS[card.tone]}`} key={card.tone}>
                  <span className={styles.cartaCor}>{card.tone === 'coringa' ? 'Coringa' : card.color === 'red' ? 'Vermelho' : 'Amarelo'}</span>
                  <span className={styles.cartaValor}>{card.value}</span>
                  <span className={styles.cartaSimbolo}>
                    {card.tone === 'coringa' ? (
                      <>
                        <ColorSymbol color="red" />
                        <ColorSymbol color="yellow" />
                        <ColorSymbol color="green" />
                        <ColorSymbol color="blue" />
                      </>
                    ) : (
                      <ColorSymbol color={card.color} />
                    )}
                  </span>
                </span>
              ))}
            </div>
            <span className={styles.peao} aria-hidden="true" />
          </section>

          <Panel
            tone="papel"
            className={styles.papel}
            titulo="Entre na mesa"
            sobretitulo="Convite"
            acoes={<Chip tone="latao">Sem login</Chip>}
          >
            <p className={styles.dica}>Sem login, sem instalação. Só a mesa e as pessoas.</p>

            {room.error !== null ? (
              <div className={styles.erro} role="alert" data-testid="error-banner">
                <p className={styles.erroTexto}>{room.error}</p>
                <button type="button" className={styles.erroFechar} onClick={room.clearError} data-testid="error-dismiss">
                  Fechar
                </button>
              </div>
            ) : null}

            <form
              id={createFormId}
              className={styles.formulario}
              aria-label="Criar sala"
              aria-busy={room.busy}
              onSubmit={(event) => void handleCreate(event)}
            >
              <div className={styles.campo}>
                <label className={styles.rotulo} htmlFor={nicknameId}>
                  Seu apelido
                </label>
                <input
                  id={nicknameId}
                  className={styles.input}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={NICKNAME_MAX_LENGTH}
                  autoComplete="nickname"
                  placeholder="Como quer ser chamado?"
                  data-testid="nickname-input"
                />
              </div>

              <fieldset className={styles.avatares}>
                <legend className={styles.rotulo}>Seu avatar</legend>
                <div className={styles.avatarGrade}>
                  {AVATARS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={styles.avatarOpcao}
                      aria-pressed={avatar === option}
                      aria-label={`Avatar ${AVATAR_LABELS[option]}`}
                      data-testid={`avatar-option-${option}`}
                      onClick={() => setAvatar(option)}
                    >
                      <AvatarBadge avatar={option} />
                      <span className={styles.avatarNome}>{AVATAR_LABELS[option]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </form>

            <div className={styles.ou} aria-hidden="true">
              <span>ou</span>
            </div>

            <form className={styles.entrarForm} aria-label="Entrar com código" onSubmit={handleJoin}>
              <div className={styles.campo}>
                <label className={styles.rotulo} htmlFor={codeId}>
                  Código do convite
                </label>
                <input
                  id={codeId}
                  className={styles.input}
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  autoComplete="off"
                  placeholder="Ex.: ABC234"
                  data-testid="room-code-input"
                />
              </div>
              <Button
                variant="secundario"
                type="submit"
                className={styles.entrarBotao}
                disabled={code.trim().length === 0}
                data-testid="enter-code-button"
              >
                Entrar
              </Button>
            </form>

            <Button
              variant="fantasma"
              type="button"
              bloco
              className={styles.treino}
              disabled={typedNickname.length === 0 || room.busy}
              data-testid="train-solo-button"
              onClick={() => void handleTrain()}
            >
              Treinar sozinho
            </Button>

            <p className={styles.nota}>
              Mesa contra três bots. Você pode sair quando quiser.
            </p>

            <div className={styles.rodape}>
              <Button
                variant="principal"
                size="principal"
                bloco
                type="submit"
                form={createFormId}
                disabled={typedNickname.length === 0 || room.busy}
                data-testid="create-room-button"
              >
                Criar sala
              </Button>
            </div>
          </Panel>
        </div>
      }
    />
  );
}

export default HomeScreen;
