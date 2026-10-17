'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Avatar } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { AvatarPicker, ErrorBanner } from '@/components/ui';
import { ChatPanel } from '@/components/ChatPanel';
import { GameTable } from '@/components/GameTable';
import { Lobby } from '@/components/Lobby';
import { MoodSettings } from '@/components/MoodSettings';
import { Results } from '@/components/Results';
import { TauntOverlay } from '@/components/TauntOverlay';
import { TauntPanel } from '@/components/TauntPanel';
import { WaitingRoom } from '@/components/WaitingRoom';

type Mode = 'checking' | 'recovering' | 'exhausted' | 'join' | 'room' | 'not-found';

/**
 * Recusa definitiva da mesa de treino: só a pessoa dona retorna com a
 * credencial original. Não há retry automático, criação de identidade nem
 * troca de credencial aqui.
 */
function TrainingEntryRefused(): ReactNode {
  return (
    <section className="panel" aria-label="Entrada recusada" data-testid="training-entry-refused">
      <p>
        Esta mesa é de treino e é individual: só a pessoa que a criou pode jogar nela. Os três adversários da mesa são
        bots e outras pessoas não entram.
      </p>
      <p className="muted">Para jogar com amigos, crie ou entre em uma sala comum pela página inicial.</p>
      <Link className="button-link" href="/" data-testid="back-home">
        Voltar ao início
      </Link>
    </section>
  );
}

/**
 * Prazo esgotado sem confirmação: mensagem neutra (a sessão pode estar viva em
 * outra aba/dispositivo), sem entrar como pessoa nova e sem expulsar ninguém.
 * A credencial guardada permanece; "Tentar novamente" inicia um ciclo novo.
 */
function RecoveryExhausted({ code }: { code: string }): ReactNode {
  const room = useRoom();
  return (
    <section className="panel" aria-label="Retomada pendente" data-testid="recovery-exhausted">
      <p>
        Não foi possível retomar sua sessão automaticamente. Ela pode ainda estar ativa em outra aba ou dispositivo — a
        credencial desta sala continua guardada neste navegador.
      </p>
      <div className="recovery-actions">
        <button
          type="button"
          className="primary"
          data-testid="retry-recovery-button"
          onClick={() => void room.retryRecovery(code)}
        >
          Tentar novamente
        </button>
        <Link className="button-link" href="/" data-testid="back-home">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}

export default function RoomPage(): ReactNode {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const room = useRoom();
  const [mode, setMode] = useState<Mode>('checking');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<Avatar>('lobo');

  const stateMatches = room.state?.room.roomCode === code;
  const roomStage =
    room.state === null || room.state.room.roomCode !== code
      ? 'checking'
      : room.state.room.status === 'lobby'
        ? 'lobby'
        : room.state.room.status === 'finished'
          ? 'results'
          : room.state.self.view === null
            ? 'waiting'
            : room.state.room.status === 'paused'
              ? 'paused'
              : 'game';
  const focusStage = room.removedMessage !== null ? 'removed' : mode === 'room' ? roomStage : mode;
  const previousFocusStage = useRef(focusStage);

  useEffect(() => {
    if (room.removedMessage !== null) return;
    if (stateMatches) {
      setMode('room');
      return;
    }
    if (room.roomGone) {
      setMode('not-found');
      return;
    }
    if (room.recoveryPhase === 'recovering') {
      setMode('recovering');
      return;
    }
    if (room.recoveryPhase === 'exhausted') {
      setMode('exhausted');
      return;
    }
    if (room.connection !== 'live') {
      setMode('checking');
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await room.rejoin(code);
      if (cancelled) return;
      if (result === 'ok') setMode('room');
      else if (result === 'not-found') setMode('not-found');
      else if (result === 'deadline') setMode('exhausted');
      else if (result === 'offline' || result === 'cancelled' || result === 'refused') setMode('checking');
      else setMode('join');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    code,
    stateMatches,
    room.rejoin,
    room.connection,
    room.removedMessage,
    room.roomGone,
    room.recoveryPhase,
  ]);

  // Sair da página (outra sala, início ou desmontagem) cancela a retomada:
  // nenhuma resposta antiga pode tocar um contexto que não existe mais.
  useEffect(() => {
    return () => {
      room.cancelRecovery();
    };
  }, [code, room.cancelRecovery]);

  useEffect(() => {
    if (previousFocusStage.current === focusStage) return;
    previousFocusStage.current = focusStage;
    if (focusStage === 'checking' || focusStage === 'recovering' || document.activeElement !== document.body) return;
    globalThis.requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.querySelector<HTMLElement>('[data-focus-target]')?.focus({ preventScroll: true });
      }
    });
  }, [focusStage]);

  async function handleJoin(event: FormEvent): Promise<void> {
    event.preventDefault();
    const joined = await room.joinRoom(code, nickname.trim(), avatar);
    if (joined) setMode('room');
  }

  if (room.removedMessage !== null) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 data-focus-target tabIndex={-1}>Sala {code}</h1>
          <p className="muted" data-testid="removed-message">
            {room.removedMessage}
          </p>
        </header>
        <Link
          className="button-link"
          href="/"
          data-testid="back-home"
          onClick={() => {
            room.clearRemoved();
          }}
        >
          Voltar ao início
        </Link>
      </main>
    );
  }

  if (room.trainingRefused) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 data-focus-target tabIndex={-1}>Mesa de treino individual</h1>
        </header>
        <TrainingEntryRefused />
      </main>
    );
  }

  if (mode === 'checking') {
    return (
      <main className="screen">
        <p className="muted" data-testid="connecting">
          Conectando…
        </p>
      </main>
    );
  }

  if (mode === 'recovering') {
    return (
      <main className="screen">
        <p className="muted" role="status" data-testid="recovering">
          Retomando sua sessão…
        </p>
        <p className="muted">
          Esta pode levar alguns segundos. Se demorar, você poderá tentar de novo sem perder a identidade.
        </p>
      </main>
    );
  }

  if (mode === 'exhausted') {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 data-focus-target tabIndex={-1}>
            Sessão não retomada
          </h1>
        </header>
        <RecoveryExhausted code={code} />
      </main>
    );
  }

  if (mode === 'not-found') {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 data-focus-target tabIndex={-1}>Sala não encontrada</h1>
          <p className="muted" data-testid="room-not-found">
            A sala {code} não existe ou já foi encerrada. Confira o link com quem convidou.
          </p>
        </header>
        <Link className="button-link" href="/" data-testid="back-home">
          Voltar ao início
        </Link>
      </main>
    );
  }

  if (mode === 'join') {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1 data-focus-target tabIndex={-1}>Entrar na sala {code}</h1>
          <p className="muted">Escolha um apelido e um avatar. Sem cadastro.</p>
        </header>
        {room.error !== null ? <ErrorBanner message={room.error} onDismiss={room.clearError} /> : null}
        <form className="panel" onSubmit={(event) => void handleJoin(event)}>
          <label>
            Seu apelido
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              placeholder="Ex.: Bia"
              data-testid="join-name-input"
            />
          </label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
          <button type="submit" className="primary" disabled={nickname.trim().length === 0 || room.busy} data-testid="join-room-button">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  if (room.state === null || room.state.room.roomCode !== code) {
    return (
      <main className="screen">
        <p className="muted">Conectando…</p>
      </main>
    );
  }

  return (
    <main className="screen">
      {room.connection !== 'live' ? (
        <p className="connection-banner" role="status" data-testid="connection-lost">
          Conexão perdida. Tentando reconectar — os envios ficam bloqueados até voltar.
        </p>
      ) : null}
      {room.connection === 'live' && room.recoveryPhase === 'recovering' ? (
        <p className="connection-banner" role="status" data-testid="recovering-banner">
          Retomando sua sessão… os envios ficam bloqueados até a confirmação.
        </p>
      ) : null}
      {room.connection === 'live' && room.reconnectedAt !== null ? (
        <p className="connection-banner recovered" role="status" data-testid="connection-recovered">
          Conexão recuperada.
        </p>
      ) : null}
      {room.recoveryPhase === 'exhausted' ? <RecoveryExhausted code={code} /> : null}
      {room.error !== null ? <ErrorBanner message={room.error} onDismiss={room.clearError} /> : null}
      {room.state.room.status === 'lobby' ? <Lobby state={room.state} /> : null}
      {room.state.room.status === 'playing' && room.state.self.view === null ? (
        <WaitingRoom state={room.state} events={room.events} />
      ) : null}
      {room.state.room.status === 'paused' && room.state.self.view === null ? (
        <WaitingRoom state={room.state} events={room.events} />
      ) : null}
      {(room.state.room.status === 'playing' || room.state.room.status === 'paused') && room.state.self.view !== null ? (
        <GameTable state={room.state} events={room.events} />
      ) : null}
      {room.state.room.status === 'finished' ? <Results state={room.state} events={room.events} /> : null}
      <TauntPanel />
      <MoodSettings />
      <ChatPanel />
      <TauntOverlay />
    </main>
  );
}
