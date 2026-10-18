'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRoom } from '@/app/providers';
import { TAUNT_NOTICE_MS } from '@/lib/mood';

/**
 * Aviso compacto da provocação recebida mais recente, perto da mesa. A janela
 * de 30 s começa na chegada; se o controle estiver com foco quando o prazo
 * vencer, o aviso permanece até o foco sair. Um menu aberto a partir daqui
 * continua válido após o aviso sumir.
 */
export function TauntResponseNotice(): ReactNode {
  const room = useRoom();
  const notice = room.moodNotice;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const expiredRef = useRef(false);
  const [awaitingBlur, setAwaitingBlur] = useState(false);

  useEffect(() => {
    expiredRef.current = false;
    setAwaitingBlur(false);
    if (notice === null) return;
    const elapsed = Math.max(0, Date.now() - notice.receivedAt);
    const remaining = Math.max(0, TAUNT_NOTICE_MS - elapsed);
    const timer = setTimeout(() => {
      const focused = containerRef.current?.contains(document.activeElement) ?? false;
      if (focused) {
        expiredRef.current = true;
        setAwaitingBlur(true);
        return;
      }
      room.clearMoodNotice();
    }, remaining);
    return () => clearTimeout(timer);
  }, [notice, room.clearMoodNotice]);

  if (notice === null) return null;

  return (
    <div
      ref={containerRef}
      className="taunt-notice"
      data-testid="taunt-notice"
      data-taunt-id={notice.taunt.id}
      data-expired={awaitingBlur ? 'true' : undefined}
      role="status"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next !== null && event.currentTarget.contains(next as Node)) return;
        if (expiredRef.current) room.clearMoodNotice();
      }}
    >
      <span className="taunt-notice-text">
        <strong>{notice.taunt.sender.nickname}</strong> provocou você
      </span>
      <button
        type="button"
        className="primary taunt-respond"
        data-testid="taunt-respond"
        onClick={(event) => room.openTauntMenu(notice.taunt.sender.playerId, event.currentTarget, 'respond')}
      >
        Responder
      </button>
    </div>
  );
}
