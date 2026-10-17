'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Avatar } from '@tretta/protocol/shared';
import { useRoom } from './providers';
import { AvatarPicker, ErrorBanner } from '@/components/ui';

export default function HomePage(): ReactNode {
  const room = useRoom();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<Avatar>('raposa');
  const [code, setCode] = useState('');

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    const createdCode = await room.createRoom(nickname.trim(), avatar);
    if (createdCode !== null) router.push(`/sala/${createdCode}`);
  }

  async function handleTrain(): Promise<void> {
    const createdCode = await room.createRoom(nickname.trim(), avatar, 'training');
    if (createdCode !== null) router.push(`/sala/${createdCode}`);
  }

  function handleJoin(event: FormEvent): void {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized.length > 0) router.push(`/sala/${normalized}`);
  }

  return (
    <main className="screen home">
      <header className="screen-header">
        <h1>Tretta</h1>
        <p className="muted">Jogo de cartas para amigos e família. Crie uma sala e convide todo mundo por link.</p>
      </header>

      {room.error !== null ? <ErrorBanner message={room.error} onDismiss={room.clearError} /> : null}

      <form className="panel" onSubmit={(event) => void handleCreate(event)}>
        <h2>Criar sala</h2>
        <label>
          Seu apelido
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={24}
            placeholder="Ex.: Ana"
            data-testid="nickname-input"
          />
        </label>
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <button type="submit" className="primary" disabled={nickname.trim().length === 0 || room.busy} data-testid="create-room-button">
          Criar sala
        </button>
        <button
          type="button"
          className="secondary"
          disabled={nickname.trim().length === 0 || room.busy}
          data-testid="train-solo-button"
          onClick={() => void handleTrain()}
        >
          Treinar sozinho
        </button>
        <p className="muted">
          Treinar sozinho abre uma mesa individual contra três bots simples, com as regras do Clássico. A partida roda no
          servidor, como nas salas entre amigos.
        </p>
      </form>

      <form className="panel" onSubmit={handleJoin}>
        <h2>Entrar com código</h2>
        <label>
          Código da sala
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            placeholder="Ex.: ABC234"
            data-testid="room-code-input"
          />
        </label>
        <button type="submit" className="secondary" disabled={code.trim().length === 0} data-testid="enter-code-button">
          Entrar
        </button>
      </form>
    </main>
  );
}
