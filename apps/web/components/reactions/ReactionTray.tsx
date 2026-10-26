'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ReactionType } from '@tretta/protocol/shared';
import { REACTION_TYPES } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import { REACTION_EMOJI, REACTION_LABELS } from '@/lib/mood';
import { useSecondTick } from '@/lib/useSecondTick';
import './reactions.css';

const FOCAVEIS = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bandeja das doze reações: individual, sem destinatário, sem campo de texto
 * e sem escolha de alvo. Abre pela barra "Reagir" (mesa, preparação, espera e
 * resultado) e fecha com Escape devolvendo o foco à origem. O limite de 5 s e
 * a aceitação vêm do servidor; aqui a espera é apenas apresentada.
 */
export function ReactionTray(): ReactNode {
  const room = useRoom();
  const menu = room.moodMenu;
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const enviandoRef = useRef(false);

  const aberta = menu?.kind === 'reaction';
  const espera = room.moodRemaining('reaction');
  const esperaSegundos = Math.ceil(espera / 1_000);
  useSecondTick(aberta && espera > 0);

  useEffect(() => {
    if (!aberta) return;
    setErro(null);
    setEnviando(false);
    enviandoRef.current = false;
    const primeiro = layerRef.current?.querySelector<HTMLElement>('[data-testid^="reaction-option-"]');
    globalThis.requestAnimationFrame(() => primeiro?.focus({ preventScroll: true }));
    return () => {
      setErro(null);
      setEnviando(false);
      enviandoRef.current = false;
    };
  }, [aberta]);

  // Escape e a armadilha de Tab valem mesmo se o foco escapou da bandeja:
  // o diálogo modal não pode deixar a pessoa presa sem saída de teclado.
  useEffect(() => {
    if (!aberta) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        room.closeMoodMenu(true);
        return;
      }
      if (event.key !== 'Tab') return;
      const layer = layerRef.current;
      if (layer === null) return;
      const focusables = Array.from(layer.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (element) => element.getClientRects().length > 0,
      );
      if (focusables.length === 0) return;
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      if (!layer.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [aberta, room]);


  if (menu === null || menu.kind !== 'reaction') return null;

  const offline = room.connection !== 'live';
  const linkPendente = !room.chatLinkReady;
  const ocupado = enviando || room.moodPending;
  const bloqueado = offline || linkPendente || ocupado || espera > 0;
  const dica = offline
    ? 'Sem conexão com o servidor. Aguarde a reconexão para enviar.'
    : linkPendente
      ? 'Recuperando o vínculo com a sala. Aguarde a confirmação para enviar.'
      : null;

  async function escolher(tipo: ReactionType): Promise<void> {
    if (bloqueado || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const seq = menu?.seq ?? -1;
    const resultado = await room.sendReaction(tipo);
    if (!room.isMoodMenuCurrent(seq)) return;
    enviandoRef.current = false;
    setEnviando(false);
    if (resultado.ok) {
      room.closeMoodMenu(true);
      return;
    }
    setErro(resultado.error?.message ?? 'Não foi possível enviar a reação.');
  }

  return createPortal(
    <div
      className="tv2-reaction-layer"
      ref={layerRef}
      data-testid="reaction-layer"
    >
      <div
        className="tv2-reaction-scrim"
        aria-hidden="true"
        data-testid="reaction-backdrop"
        onClick={() => room.closeMoodMenu(true)}
      />
      <section
        className="tv2-reaction-tray"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv2-reaction-titulo"
        data-testid="reaction-tray"
      >
        <div className="tv2-reaction-puxador" aria-hidden="true" />
        <header className="tv2-reaction-topo">
          <div>
            <p className="tv2-reaction-sobretitulo">Sua expressão</p>
            <h2 id="tv2-reaction-titulo">Reagir</h2>
          </div>
          <button
            type="button"
            className="tv2-reaction-fechar"
            aria-label="Fechar reações"
            onClick={() => room.closeMoodMenu(true)}
            data-testid="reaction-close"
          >
            ×
          </button>
        </header>
        <div className="tv2-reaction-grade" role="group" aria-label="Doze reações">
          {REACTION_TYPES.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className="tv2-reaction-option"
              aria-label={`Reagir: ${REACTION_LABELS[tipo]}`}
              aria-disabled={bloqueado}
              data-testid={`reaction-option-${tipo}`}
              onClick={() => void escolher(tipo)}
            >
              <span className="tv2-reaction-glifo" aria-hidden="true">
                {REACTION_EMOJI[tipo]}
              </span>
              <span className="tv2-reaction-rotulo">{REACTION_LABELS[tipo]}</span>
            </button>
          ))}
        </div>
        <p className="tv2-reaction-dica">Todos na mesa veem · individual, sem destinatário · some sozinho</p>
        {dica !== null ? (
          <p className="tv2-reaction-aviso" data-testid="reaction-hint">
            {dica}
          </p>
        ) : null}
        {espera > 0 ? (
          <p className="tv2-reaction-espera" data-testid="reaction-countdown">
            Aguarde {esperaSegundos}s para reagir de novo.
          </p>
        ) : null}
        {ocupado ? (
          <p className="tv2-reaction-aviso" role="status" data-testid="reaction-pending">
            Enviando…
          </p>
        ) : null}
        {erro !== null ? (
          <p className="tv2-reaction-erro" role="alert" data-testid="reaction-error">
            {erro}
          </p>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
