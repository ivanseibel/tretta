'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import type { Avatar } from '@tretta/protocol/shared';
import { ROOM_CODE_LENGTH } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { GameTable } from '@/components/GameTable';
import { Lobby } from '@/components/Lobby';
import { MoodFeedback, MoodAnnouncer } from '@/components/MoodFeedback';
import { TableDrawer } from '@/components/drawer/TableDrawer';
import { TableDrawerProvider } from '@/components/drawer/TableDrawerProvider';
import { EffectOverlay } from '@/components/reactions/EffectOverlay';
import { ReactionOverlay } from '@/components/reactions/ReactionOverlay';
import { ReactionTray } from '@/components/reactions/ReactionTray';
import { Results } from '@/components/Results';
import { WaitingRoom } from '@/components/WaitingRoom';
import {
  ConnectingScreen,
  JoinRoomScreen,
  RecoveringScreen,
  RecoveryExhaustedScreen,
  RemovedScreen,
  RoomGoneScreen,
  RoomNotices,
  TrainingRefusedScreen,
} from '@/components/screens/StatusScreens';
import styles from '@/components/screens/room.module.css';

type Mode = 'checking' | 'recovering' | 'exhausted' | 'invalid' | 'join' | 'room' | 'not-found';

/**
 * Página da sala: decide somente qual das telas reais está no ar e mantém a
 * recuperação/reconexão que já existia. A composição visual mora em Lobby,
 * WaitingRoom, Results e nas telas de entrada/erro; a gaveta e a bandeja de
 * reações são montadas uma vez para todas as fases.
 */
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
    // Código truncado/colado errado não chega ao servidor: o convite tem
    // exatamente seis caracteres. Salas válidas porém inexistentes seguem
    // para a entrada normal, que explica o erro ao tentar entrar.
    if (code.length !== ROOM_CODE_LENGTH) {
      setMode('invalid');
      return;
    }
    if (stateMatches && room.recoveryPhase !== 'exhausted') {
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
      else if (result === 'invalid') setMode('invalid');
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
    if (focusStage === 'checking' || focusStage === 'recovering') return;
    if (document.activeElement !== document.body) return;
    globalThis.requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        document.querySelector<HTMLElement>('[data-focus-target]')?.focus({ preventScroll: true });
      }
    });
  }, [focusStage]);

  async function handleJoin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const joined = await room.joinRoom(code, nickname.trim(), avatar);
    if (joined) setMode('room');
  }

  if (room.removedMessage !== null) {
    return (
      <RemovedScreen
        code={code}
        message={room.removedMessage}
        onClear={() => {
          room.clearRemoved();
        }}
      />
    );
  }

  if (room.trainingRefused) {
    return <TrainingRefusedScreen />;
  }

  if (mode === 'checking') {
    return <ConnectingScreen connection={room.connection} />;
  }

  if (mode === 'recovering') {
    return <RecoveringScreen />;
  }

  if (mode === 'exhausted') {
    return <RecoveryExhaustedScreen code={code} />;
  }

  if (mode === 'invalid') {
    return <RoomGoneScreen code={code} tipo="invalida" />;
  }

  if (mode === 'not-found') {
    return <RoomGoneScreen code={code} tipo="expirada" />;
  }

  if (mode === 'join') {
    return (
      <JoinRoomScreen
        code={code}
        nickname={nickname}
        avatar={avatar}
        busy={room.busy}
        error={room.error}
        onNickname={setNickname}
        onAvatar={setAvatar}
        onDismissError={room.clearError}
        onSubmit={(event) => void handleJoin(event)}
      />
    );
  }

  if (room.state === null || room.state.room.roomCode !== code) {
    return <ConnectingScreen connection={room.connection} />;
  }

  const status = room.state.room.status;
  const waiting = room.state.self.view === null;

  return (
    <TableDrawerProvider>
      <main className={styles.appMain}>
        <RoomNotices
          connection={room.connection}
          recoveryPhase={room.recoveryPhase}
          reconnectedAt={room.reconnectedAt}
          error={room.error}
          onDismissError={room.clearError}
        />
        {status === 'lobby' ? <Lobby state={room.state} /> : null}
        {(status === 'playing' || status === 'paused') && waiting ? (
          <WaitingRoom state={room.state} events={room.events} />
        ) : null}
        {(status === 'playing' || status === 'paused') && !waiting ? (
          <GameTable state={room.state} events={room.events} />
        ) : null}
        {status === 'finished' ? <Results state={room.state} events={room.events} /> : null}
        <MoodFeedback />
        <MoodAnnouncer />
      </main>
      <TableDrawer />
      <ReactionTray />
      <ReactionOverlay />
      <EffectOverlay />
    </TableDrawerProvider>
  );
}
