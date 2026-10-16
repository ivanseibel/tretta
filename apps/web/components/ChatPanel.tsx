'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChatMessage } from '@tretta/protocol';
import { CHAT_MESSAGE_MAX_LENGTH, chatCodePointLength } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { AvatarBadge } from '@/components/ui';

function formatTime(sentAt: number): string {
  return new Date(sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Chat da sala: disponível em preparação, jogo, pausa, espera e resultado.
 * Ordem e autoria vêm do servidor (`seq`); o texto renderiza literalmente.
 * Silenciar vale por identidade e só neste navegador.
 */
export function ChatPanel(): ReactNode {
  const room = useRoom();
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const stickRef = useRef(true);
  const roomCode = room.state?.room.roomCode ?? null;
  const loadHistory = room.loadChatHistory;

  // Página inicial do histórico a cada vínculo autorizado (montagem, troca de
  // sala e reentrada após reconexão); a mesclagem por seq preserva o que já
  // estava na tela e a fronteira derivada recupera intervalos perdidos.
  useEffect(() => {
    if (roomCode === null) return;
    void loadHistory();
  }, [roomCode, loadHistory, room.chatLinkEpoch]);

  const messages = room.chatMessages;

  const onScroll = (): void => {
    const element = listRef.current;
    if (element === null) return;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
  };

  useEffect(() => {
    const element = listRef.current;
    if (element === null || !stickRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  if (roomCode === null) return null;

  const codePoints = chatCodePointLength(draft);
  const tooLong = codePoints > CHAT_MESSAGE_MAX_LENGTH;
  const empty = draft.trim().length === 0;
  const offline = room.connection !== 'live';
  // Sem vínculo autorizado confirmado o envio fica bloqueado, mesmo com o
  // transporte de volta: a reentrada (ou nova entrada) é que reabilita.
  const linkPending = !room.chatLinkReady;
  const placeholder = offline
    ? 'Conecte-se para enviar'
    : linkPending
      ? 'Recuperando a conexão com a sala…'
      : 'Escreva uma mensagem';
  const canSend = !empty && !tooLong && !sending && !offline && !linkPending;

  async function handleSend(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    const result = await room.sendChat(draft);
    setSending(false);
    if (result.ok) {
      setDraft('');
      setChatError(null);
      stickRef.current = true;
      return;
    }
    // Recusa com explicação; o texto digitado permanece para tentar de novo.
    setChatError(result.error?.message ?? 'Não foi possível enviar a mensagem.');
  }

  return (
    <section className="chat-panel" aria-label="Chat da sala" data-testid="chat-panel">
      <header className="chat-header">
        <h2>Chat da sala</h2>
        {room.chatHasMore ? (
          <button
            type="button"
            className="secondary small"
            data-testid="chat-load-older"
            disabled={room.chatHistoryLoading}
            onClick={() => {
              // Cursor da fronteira da maior faixa contígua no topo, não o
              // menor seq global: um cache destacado não fecha a paginação.
              const frontier = room.chatHistoryFrontier;
              if (frontier === null) return;
              stickRef.current = false;
              void room.loadChatHistory(frontier);
            }}
          >
            Carregar mensagens anteriores
          </button>
        ) : null}
      </header>

      <ul className="chat-messages" ref={listRef} onScroll={onScroll} data-testid="chat-messages">
        {messages.length === 0 ? (
          <li className="muted chat-empty" data-testid="chat-empty">
            Ainda não há mensagens. Diga oi!
          </li>
        ) : null}
        {messages.map((message: ChatMessage) => {
          const muted = room.mutedPlayerIds.includes(message.author.playerId);
          const mine = message.author.playerId === room.state?.self.playerId;
          return (
            <li
              key={message.seq}
              className={`chat-message${muted ? ' chat-message-muted' : ''}`}
              data-testid={`chat-message-${message.seq}`}
              data-author-player-id={message.author.playerId}
            >
              {muted ? (
                <>
                  <span className="muted" data-testid={`chat-hidden-${message.seq}`}>
                    Mensagem oculta de {message.author.nickname}.
                  </span>
                  <button
                    type="button"
                    className="secondary small"
                    data-testid={`unmute-${message.seq}`}
                    onClick={() => room.unmuteAuthor(message.author.playerId)}
                  >
                    Mostrar mensagens de {message.author.nickname}
                  </button>
                </>
              ) : (
                <>
                  <AvatarBadge avatar={message.author.avatar} size="small" />
                  <span className="chat-author">{message.author.nickname}</span>
                  <span className="chat-time">{formatTime(message.sentAt)}</span>
                  <span className="chat-text" data-testid={`chat-text-${message.seq}`}>
                    {message.text}
                  </span>
                  {mine ? null : (
                    <button
                      type="button"
                      className="secondary small"
                      data-testid={`mute-${message.seq}`}
                      onClick={() => room.muteAuthor(message.author.playerId)}
                    >
                      Silenciar {message.author.nickname}
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <form className="chat-form" onSubmit={(event) => void handleSend(event)}>
        <label className="chat-label" htmlFor="chat-input">
          Mensagem para a sala
        </label>
        <div className="chat-input-row">
          <input
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            data-testid="chat-input"
            disabled={offline}
          />
          <span className={`chat-counter${tooLong ? ' chat-counter-over' : ''}`} data-testid="chat-counter">
            {codePoints}/{CHAT_MESSAGE_MAX_LENGTH}
          </span>
          <button type="submit" className="primary" disabled={!canSend} data-testid="chat-send">
            Enviar
          </button>
        </div>
      </form>
      {chatError !== null ? (
        <p className="chat-error" role="alert" data-testid="chat-error">
          {chatError}
        </p>
      ) : null}
      {tooLong ? (
        <p className="chat-error" data-testid="chat-too-long">
          Mensagem acima de {CHAT_MESSAGE_MAX_LENGTH} caracteres. Aperte para encurtar — o texto continua aqui.
        </p>
      ) : null}
    </section>
  );
}
