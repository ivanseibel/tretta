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

type Mode = 'checking' | 'join' | 'room' | 'not-found';

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
      else if (result === 'offline') setMode('checking');
      else setMode('join');
    })();
    return () => {
      cancelled = true;
    };
  }, [code, stateMatches, room.rejoin, room.connection, room.removedMessage, room.roomGone]);

  useEffect(() => {
    if (previousFocusStage.current === focusStage) return;
    previousFocusStage.current = focusStage;
    if (focusStage === 'checking' || document.activeElement !== document.body) return;
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

  if (mode === 'checking') {
    return (
      <main className="screen">
        <p className="muted" data-testid="connecting">
          Conectando…
        </p>
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
      {room.connection === 'live' && room.reconnectedAt !== null ? (
        <p className="connection-banner recovered" role="status" data-testid="connection-recovered">
          Conexão recuperada.
        </p>
      ) : null}
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
