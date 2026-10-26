'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StateMessage } from '@tretta/protocol';
import { useRoom } from '@/app/providers';

/**
 * Painel de pausa compartilhado entre quem joga e quem aguarda: durante a
 * pausa de retenção o anfitrião que aguarda mantém os mesmos controles
 * administrativos (substituir, continuar, encerrar) vistos na mesa.
 */
export function PausePanel({ state }: { state: StateMessage }): ReactNode {
  const room = useRoom();
  const [clockNow, setClockNow] = useState(() => Date.now());
  const receivedAtRef = useRef(Date.now());

  useEffect(() => {
    receivedAtRef.current = Date.now();
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pause = state.room.pause;
  const training = state.room.mode === 'training';
  const isHost = state.room.hostId === state.self.playerId;
  // Relógio do servidor projetado no navegador para a contagem local dos prazos.
  const serverNow = state.room.serverTime + (clockNow - receivedAtRef.current);
  const eligibleAbsences = pause?.absent.filter((absent) => serverNow >= absent.eligibleAt) ?? [];
  const blockedAbsences = pause?.absent.filter((absent) => serverNow < absent.eligibleAt) ?? [];
  const participants = state.room.participants;
  const nicknameOf = (playerId: string): string => participants.find((participant) => participant.id === playerId)?.nickname ?? '—';
  const live = room.interactive;

  return (
    <section className="pause-panel" aria-label="Pausa" data-testid="pause-panel">
      <h2>Rodada pausada</h2>
      {pause?.retention ? (
        <p data-testid="pause-retention">
          {training
            ? 'Os bots esperam por você. A mesa está reservada; retome quando quiser.'
            : 'Ninguém está conectado. A sala fica reservada por tempo limitado; quem chegar primeiro assume como anfitrião.'}
        </p>
      ) : null}
      {blockedAbsences.map((absent) => (
        <p key={absent.playerId} data-testid={`pause-absent-${nicknameOf(absent.playerId)}`}>
          {nicknameOf(absent.playerId)} caiu. A rodada inteira espera: essa pessoa pode voltar a qualquer momento e a substituição é
          liberada em {Math.max(1, Math.ceil((absent.eligibleAt - serverNow) / 1000))}s.
        </p>
      ))}
      {eligibleAbsences.map((absent) => (
        <p key={absent.playerId} data-testid={`pause-eligible-${nicknameOf(absent.playerId)}`}>
          {nicknameOf(absent.playerId)} passou do prazo de 90 segundos. Pode voltar ou ser substituído pelo anfitrião.
        </p>
      ))}
      {isHost ? (
        <div className="pause-actions">
          {eligibleAbsences.map((absent) => (
            <button
              key={absent.playerId}
              type="button"
              className="secondary"
              data-testid={`substitute-${nicknameOf(absent.playerId)}`}
              disabled={!live}
              onClick={() => void room.substituteAbsent(absent.playerId)}
            >
              Substituir {nicknameOf(absent.playerId)}
            </button>
          ))}
          <button
            type="button"
            className="primary"
            data-testid="continue-round-button"
            disabled={!live}
            onClick={() => void room.continueRound()}
          >
            Continuar rodada
          </button>
          <button
            type="button"
            className="danger"
            data-testid="end-round-button"
            disabled={!live}
            onClick={() => void room.endRoundWithoutWinner()}
          >
            Encerrar sem vencedor
          </button>
        </div>
      ) : (
        <p className="muted" data-testid="pause-waiting-host">
          Aguardando a decisão do anfitrião: retomar com substituto ou encerrar sem vencedor.
        </p>
      )}
    </section>
  );
}
