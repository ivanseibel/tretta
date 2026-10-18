'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { PublicParticipant } from '@tretta/protocol';
import type { TauntType } from '@tretta/protocol/shared';
import { TAUNT_TYPES } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';
import {
  TAUNT_EMOJI,
  TAUNT_LABELS,
  canReceiveTaunt,
  nicknameCounts,
  targetLabel,
  unavailableReason,
} from '@/lib/mood';
import { useSecondTick } from '@/lib/useSecondTick';

interface TargetOption {
  playerId: string;
  label: string;
  available: boolean;
}

/** Alvos atuais com apelido, desempate por avatar/id e disponibilidade visível. */
function targetOptions(
  participants: readonly PublicParticipant[],
  selfPlayerId: string | null,
): TargetOption[] {
  const counts = nicknameCounts(participants);
  return participants
    .filter((participant) => participant.id !== selfPlayerId || participants.length === 1)
    .map((participant) => {
      const repeated = (counts.get(participant.nickname) ?? 0) > 1;
      const availability = canReceiveTaunt(participant) ? '' : ' · desconectado';
      return {
        playerId: participant.id,
        label: `${targetLabel(participant, repeated)}${availability}`,
        available: canReceiveTaunt(participant),
      };
    });
}

/**
 * Painel alternativo às ações por avatar: recolhido em "Mais opções de
 * provocação", com os mesmos tipos, limites e regras de disponibilidade. As
 * opções de risada/choro aqui são provocações direcionadas; reações sem
 * destinatário ficam no próprio avatar/botão "Reagir".
 */
export function TauntPanel(): ReactNode {
  const room = useRoom();
  const [type, setType] = useState<TauntType>('tomate');
  const [targetId, setTargetId] = useState('');
  const [tauntError, setTauntError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Operação em voo: cada envio avança o contador e a mudança do vínculo
  // invalida tudo que estiver pendente. Conclusão antiga só age se ainda for
  // a operação corrente — loading e erro pertencem ao vínculo atual.
  const sendOpRef = useRef(0);

  useEffect(() => {
    sendOpRef.current += 1;
    setSending(false);
    setTauntError(null);
  }, [room.chatLinkEpoch]);
  const roomCode = room.state?.room.roomCode ?? null;
  const participants = room.state?.room.participants ?? [];
  const selfPlayerId = room.state?.self.playerId ?? null;
  const options = targetOptions(participants, selfPlayerId);
  const selected = options.find((option) => option.playerId === targetId);
  const targetParticipant = participants.find((participant) => participant.id === targetId);
  const targetReason = targetParticipant === undefined ? null : unavailableReason(targetParticipant);

  // Alvo padrão: primeira pessoa que não sou eu; se só eu existo, eu mesmo.
  useEffect(() => {
    if (options.length === 0) return;
    if (options.some((option) => option.playerId === targetId)) return;
    setTargetId((options[0] ?? { playerId: '' }).playerId);
  }, [options, targetId]);

  const senderRemaining = room.moodRemaining('taunt');
  const targetRemaining = targetId === '' ? 0 : room.moodTargetRemaining(targetId);
  const waitingMs = senderRemaining > 0 ? senderRemaining : targetRemaining;
  const waitingFromTarget = senderRemaining <= 0 && targetRemaining > 0;
  const waitingSeconds = Math.ceil(waitingMs / 1_000);
  useSecondTick(waitingMs > 0);

  if (roomCode === null || options.length === 0) return null;

  const offline = room.connection !== 'live';
  const linkPending = !room.chatLinkReady;
  const pending = sending || room.moodPending;
  const placeholder = offline
    ? 'Conecte-se para provocar'
    : linkPending
      ? 'Recuperando a conexão com a sala…'
      : 'Escolha a provocação';
  const canSend =
    !pending && !offline && !linkPending && targetId !== '' && selected?.available === true && waitingMs <= 0;

  async function handleSend(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSend) return;
    const operation = ++sendOpRef.current;
    setSending(true);
    const result = await room.sendTaunt(type, targetId);
    // Conclusão antiga (vínculo trocado ou envio substituído) não toca o
    // loading nem o erro da operação corrente do contexto atual.
    if (operation !== sendOpRef.current) return;
    setSending(false);
    if (result.ok) {
      setTauntError(null);
      return;
    }
    // Contexto invalidado (queda/rodada nova) descarta a conclusão antiga; o
    // painel do contexto novo não herda o erro de uma operação que não é dele.
    if (result.error?.code === 'STALE_CONTEXT') return;
    // Recusa com explicação; tipo e alvo permanecem escolhidos para tentar de novo.
    setTauntError(result.error?.message ?? 'Não foi possível enviar a provocação.');
  }

  return (
    <details className="taunt-panel" data-testid="taunt-panel">
      <summary className="taunt-summary" data-testid="taunt-panel-toggle">
        Mais opções de provocação
      </summary>
      <div className="taunt-panel-body">
        <header className="taunt-header">
          <h2>Provocar alguém</h2>
          <p className="muted taunt-hint">
            Escolha um alvo. Risadas e choro aqui são provocações direcionadas; para expressar sua própria emoção,
            use seu avatar ou o botão “Reagir”.
          </p>
        </header>
        <form className="taunt-form" onSubmit={(event) => void handleSend(event)}>
          <label className="taunt-field" htmlFor="taunt-type">
            <span className="taunt-label">Provocação</span>
            <select
              id="taunt-type"
              value={type}
              onChange={(event) => setType(event.target.value as TauntType)}
              data-testid="taunt-type"
              disabled={offline}
            >
              {TAUNT_TYPES.map((tauntType) => (
                <option key={tauntType} value={tauntType}>
                  {TAUNT_EMOJI[tauntType]} {TAUNT_LABELS[tauntType]}
                </option>
              ))}
            </select>
          </label>
          <label className="taunt-field" htmlFor="taunt-target">
            <span className="taunt-label">Alvo</span>
            <select
              id="taunt-target"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              data-testid="taunt-target"
              disabled={offline}
            >
              {options.map((option) => (
                <option key={option.playerId} value={option.playerId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary" disabled={!canSend} data-testid="taunt-send">
            {pending ? 'Enviando…' : 'Enviar provocação'}
          </button>
        </form>
        {waitingMs > 0 ? (
          <p className="mood-wait" data-testid="taunt-countdown" data-wait-scope={waitingFromTarget ? 'target' : 'sender'}>
            {waitingFromTarget
              ? `Este alvo já recebeu provocações demais. Tente de novo em ${waitingSeconds}s.`
              : `Aguarde ${waitingSeconds}s para provocar de novo.`}
          </p>
        ) : null}
        {targetReason !== null && waitingMs <= 0 ? (
          <p className="muted" data-testid="taunt-target-unavailable">
            {targetReason}
          </p>
        ) : null}
        {tauntError !== null ? (
          <p className="chat-error" role="alert" data-testid="taunt-error">
            {tauntError}
          </p>
        ) : null}
        {offline || linkPending ? <p className="muted" data-testid="taunt-disabled-hint">{placeholder}</p> : null}
      </div>
    </details>
  );
}
