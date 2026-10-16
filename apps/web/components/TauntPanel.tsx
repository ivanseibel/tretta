'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { TauntType } from '@tretta/protocol/shared';
import { TAUNT_TYPES } from '@tretta/protocol/shared';
import { useRoom } from '@/app/providers';

export const TAUNT_LABELS: Record<TauntType, string> = {
  tomate: 'Tomate voador',
  torta: 'Torta na cara',
  risadas: 'Chuva de risadas',
  choro: 'Choro dramático',
};

interface TargetOption {
  playerId: string;
  label: string;
}

/**
 * Rótulo do alvo: apelido puro; com apelidos repetidos na sala, acrescenta o
 * avatar e um trecho do id para as duas identidades não virarem a mesma opção.
 */
function targetOptions(
  participants: readonly { id: string; nickname: string; avatar: string }[],
): TargetOption[] {
  const counts = new Map<string, number>();
  for (const entry of participants) counts.set(entry.nickname, (counts.get(entry.nickname) ?? 0) + 1);
  return participants.map((entry) => {
    const repeated = (counts.get(entry.nickname) ?? 0) > 1;
    const suffix = repeated ? ` · ${entry.avatar} (${entry.id.slice(-4)})` : '';
    return { playerId: entry.id, label: `${entry.nickname}${suffix}` };
  });
}

/**
 * Provocações manuais: escolha de tipo e alvo entre as identidades atuais da
 * sala, em preparação, mesa/pausa, espera e resultado. O servidor autoriza,
 * limita e distribui; aqui só se escolhe e se envia — sem efeito nas regras.
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
  const options = targetOptions(participants);
  const selfPlayerId = room.state?.self.playerId ?? null;

  // Alvo padrão: primeira pessoa que não sou eu; se só eu existo, eu mesmo.
  useEffect(() => {
    if (options.length === 0) return;
    if (options.some((option) => option.playerId === targetId)) return;
    const other = options.find((option) => option.playerId !== selfPlayerId);
    setTargetId((other ?? options[0] ?? { playerId: '' }).playerId);
  }, [options, targetId, selfPlayerId]);

  if (roomCode === null || options.length === 0) return null;

  const offline = room.connection !== 'live';
  const linkPending = !room.chatLinkReady;
  const placeholder = offline
    ? 'Conecte-se para provocar'
    : linkPending
      ? 'Recuperando a conexão com a sala…'
      : 'Escolha a provocação';
  const canSend = !sending && !offline && !linkPending && targetId !== '';

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
    // Recusa com explicação; tipo e alvo permanecem escolhidos para tentar de novo.
    setTauntError(result.error?.message ?? 'Não foi possível enviar a provocação.');
  }

  return (
    <section className="taunt-panel" aria-label="Provocações" data-testid="taunt-panel">
      <header className="taunt-header">
        <h2>Provocar alguém</h2>
        <p className="muted taunt-hint">Só de brincadeira: não muda as regras da rodada.</p>
      </header>
      <form className="taunt-form" onSubmit={(event) => void handleSend(event)}>
        <label className="taunt-label" htmlFor="taunt-type">
          Provocação
        </label>
        <select
          id="taunt-type"
          value={type}
          onChange={(event) => setType(event.target.value as TauntType)}
          data-testid="taunt-type"
          disabled={offline}
        >
          {TAUNT_TYPES.map((tauntType) => (
            <option key={tauntType} value={tauntType}>
              {TAUNT_LABELS[tauntType]}
            </option>
          ))}
        </select>
        <label className="taunt-label" htmlFor="taunt-target">
          Alvo
        </label>
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
        <button type="submit" className="primary" disabled={!canSend} data-testid="taunt-send">
          Enviar provocação
        </button>
      </form>
      {tauntError !== null ? (
        <p className="chat-error" role="alert" data-testid="taunt-error">
          {tauntError}
        </p>
      ) : null}
      {offline || linkPending ? <p className="muted" data-testid="taunt-disabled-hint">{placeholder}</p> : null}
    </section>
  );
}
