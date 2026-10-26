'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useRoom } from '@/app/providers';
import { Button, DrawerFrame, type DrawerTab } from '@/components/chrome';
import { ChatPanel } from '@/components/ChatPanel';
import { EventFeed } from '@/components/EventFeed';
import { MoodSettings } from '@/components/MoodSettings';
import { useTableDrawer, type TableDrawerTab } from './TableDrawerProvider';
import './drawer.css';

interface Confirmacao {
  readonly tipo: 'sair' | 'remover';
  readonly playerId?: string;
  readonly nickname?: string;
}

const TITULOS: Record<TableDrawerTab, string> = {
  conversa: 'Conversa',
  historico: 'Histórico',
  sala: 'Sala',
};

const ABAS: readonly DrawerTab[] = [
  { id: 'conversa', label: 'Conversa', icon: <span aria-hidden="true">💬</span> },
  { id: 'historico', label: 'Histórico', icon: <span aria-hidden="true">📜</span> },
  { id: 'sala', label: 'Sala', icon: <span aria-hidden="true">🪑</span> },
];

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Gaveta única da sala, em sobreposição fixa: abrir e fechar não altera a
 * altura da mesa. Prende o foco, fecha com Escape e devolve o foco ao
 * controle de origem. A barra da mesa pede a aba; o conteúdo é o real do
 * provedor (chat, eventos, preferências, anfitrião e silêncio).
 */
export function TableDrawer(): ReactNode {
  const room = useRoom();
  const router = useRouter();
  const { aberta, aba, fechar, selecionarAba, gatilho } = useTableDrawer();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  const estado = room.state;
  const roomCode = estado?.room.roomCode ?? null;

  useEffect(() => {
    if (roomCode === null) {
      setInviteUrl('');
      return;
    }
    setInviteUrl(`${window.location.origin}/sala/${roomCode}`);
  }, [roomCode]);

  // Foco inicial e retorno ao gatilho. Roda só na abertura/fechamento, não a
  // cada troca de aba ou confirmação.
  useEffect(() => {
    if (!aberta) return;
    const origem = gatilho;
    const camada = layerRef.current;
    const primeiro = camada?.querySelector<HTMLElement>(FOCAVEIS);
    primeiro?.focus({ preventScroll: true });
    return () => {
      setConfirmacao(null);
      setCopiado(false);
      if (origem !== null && origem.isConnected) {
        globalThis.requestAnimationFrame(() => origem.focus({ preventScroll: true }));
      }
    };
  }, [aberta, gatilho]);

  // Ao fechar a confirmação, o botão que tinha o foco sai do DOM; devolve o
  // foco para dentro da gaveta em vez de deixá-lo cair no body.
  useEffect(() => {
    if (!aberta || confirmacao !== null) return;
    const camada = layerRef.current;
    if (camada === null || camada.contains(document.activeElement)) return;
    camada.querySelector<HTMLElement>(FOCAVEIS)?.focus({ preventScroll: true });
  }, [aberta, confirmacao]);

  // Escape fecha (ou cancela a confirmação) e Tab circula dentro da gaveta.
  useEffect(() => {
    if (!aberta) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirmacao !== null) {
          setConfirmacao(null);
          return;
        }
        fechar();
        return;
      }
      if (event.key !== 'Tab') return;
      const camada = layerRef.current;
      if (camada === null) return;
      const focusables = Array.from(camada.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (focusables.length === 0) return;
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (!camada.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [aberta, confirmacao, fechar]);

  if (!aberta || estado === null) return null;

  const view = estado.self.view;
  const jogadoresDaMesa = view?.players ?? estado.table?.players ?? [];
  const handCountOf = (playerId: string): number | null =>
    jogadoresDaMesa.find((player) => player.id === playerId)?.handCount ?? null;
  const isHost = estado.room.hostId === estado.self.playerId;
  const training = estado.room.mode === 'training';
  const participantesConectados = estado.room.participants.filter(
    (participant) => participant.connected || participant.kind === 'bot',
  );
  const todosProntos =
    participantesConectados.length >= 2 && participantesConectados.every((participant) => participant.ready);
  const status = estado.room.status;

  async function copiarConvite(): Promise<void> {
    if (inviteUrl === '') return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiado(true);
      globalThis.setTimeout(() => setCopiado(false), 2_000);
    } catch {
      setCopiado(false);
    }
  }

  async function confirmar(): Promise<void> {
    if (confirmacao === null) return;
    if (confirmacao.tipo === 'sair') {
      if (saindo) return;
      setSaindo(true);
      const saiu = await room.leaveRoom();
      if (saiu) router.push('/');
      setSaindo(false);
      return;
    }
    if (confirmacao.playerId !== undefined) await room.removeParticipant(confirmacao.playerId);
    setConfirmacao(null);
  }

  function onTabListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const teclas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key !== 'Home' && event.key !== 'End' && teclas[event.key] === undefined) return;
    const alvoTab = (event.target as HTMLElement | null)?.closest<HTMLElement>('[role="tab"]');
    if (alvoTab === null || alvoTab === undefined) return;
    event.preventDefault();
    const lista = alvoTab.closest('[role="tablist"]');
    if (lista === null) return;
    const abas = Array.from(lista.querySelectorAll<HTMLElement>('[role="tab"]'));
    const atual = abas.findIndex((element) => element.id === `table-drawer-aba-${aba}`);
    if (atual < 0) return;
    const indice =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? abas.length - 1
          : (atual + (teclas[event.key] ?? 0) + abas.length) % abas.length;
    const alvo = abas[indice];
    if (alvo === undefined) return;
    const id = alvo.id.replace('table-drawer-aba-', '') as TableDrawerTab;
    selecionarAba(id);
    alvo.focus();
  }

  const conteudo =
    aba === 'conversa' ? (
      <ChatPanel />
    ) : aba === 'historico' ? (
      <EventFeed events={room.events} participants={estado.room.participants} lastRound={estado.room.lastRound} />
    ) : (
      <div className="tv2-sala">
        <section className="tv2-sala-secao" id="tv2-secao-sala" aria-labelledby="tv2-sala-titulo">
          <h3 id="tv2-sala-titulo">Sala</h3>
          <div className="tv2-sala-codigo">
            <div>
              <span className="tv2-sala-rotulo">Código da sala</span>
              <strong data-testid="drawer-room-code">{estado.room.roomCode}</strong>
            </div>
            <Button variant="secundario" onClick={() => void copiarConvite()} data-testid="drawer-copy-invite">
              {copiado ? 'Copiado!' : 'Copiar convite'}
            </Button>
          </div>
          <p className="tv2-sala-convite">
            Convite:{' '}
            <a
              href={inviteUrl === '' ? `/sala/${estado.room.roomCode}` : inviteUrl}
              data-testid="drawer-invite"
            >
              {inviteUrl === '' ? `/sala/${estado.room.roomCode}` : inviteUrl}
            </a>
            {estado.room.roundNumber > 0 ? ` · rodada ${estado.room.roundNumber}` : null}
          </p>
          <details className="tv2-sala-regras" data-testid="drawer-rules">
            <summary>
              <span className="tv2-sala-regras-titulo">Resumo das regras</span>
              <span className="tv2-sala-regras-previa">Cor, número ou símbolo; última carta; compras.</span>
              <span className="tv2-sala-regras-seta" aria-hidden="true" />
            </summary>
            <p>
              Combine por <strong>cor, número ou símbolo</strong>. Bloqueio pula a pessoa seguinte. Inversão troca o
              sentido. Compra 2 e Compra 4 fazem a pessoa seguinte comprar e perder a vez. Coringa escolhe a cor. Quem
              fica sem cartas vence a rodada.
            </p>
            <p>
              Antes do descarte que deixa uma carta, avise <strong>Última</strong>. Quem não avisar pode ser denunciado
              e compra duas.
            </p>
          </details>
        </section>

        <section className="tv2-sala-secao" id="tv2-secao-jogadores" aria-labelledby="tv2-jogadores-titulo">
          <h3 id="tv2-jogadores-titulo">Jogadores</h3>
          <p className="tv2-sala-dica">Nome completo, cartas, presença e controles do anfitrião.</p>
          <ul className="tv2-jogadores-lista" data-testid="drawer-players">
            {estado.room.participants.map((participant) => {
              const silenciado = room.mutedPlayerIds.includes(participant.id);
              const cartas = handCountOf(participant.id);
              const podeSilenciar = participant.id !== estado.self.playerId;
              const podeRemover =
                isHost && !training && status === 'lobby' && participant.id !== estado.self.playerId;
              const estadoTexto =
                participant.kind === 'bot'
                  ? 'bot'
                  : participant.autoControlled
                    ? 'substituto'
                    : participant.connected
                      ? participant.inRound
                        ? 'em rodada'
                        : 'conectado'
                      : 'desconectado';
              return (
                <li key={participant.id} className="tv2-jogador" data-testid={`drawer-player-${participant.nickname}`}>
                  <span className="tv2-jogador-avatar" aria-hidden="true">
                    {participant.nickname.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="tv2-jogador-corpo">
                    <span className="tv2-jogador-nome">
                      {participant.nickname}
                      {participant.id === estado.self.playerId ? ' · você' : ''}
                    </span>
                    <span className="tv2-jogador-meta">
                      {participant.isHost ? <span className="tv2-chip tv2-chip--latao">anfitrião</span> : null}
                      <span>
                        {cartas === null ? 'aguarda a próxima rodada' : `${String(cartas)} ${cartas === 1 ? 'carta' : 'cartas'}`}
                      </span>
                      <span className={`tv2-jogador-presenca${participant.connected || participant.kind === 'bot' ? '' : ' tv2-jogador-presenca--off'}`}>
                        {estadoTexto}
                      </span>
                      {participant.kind === 'bot' ? <span className="tv2-chip tv2-chip--bot">bot</span> : null}
                      {participant.autoControlled ? (
                        <span className="tv2-chip tv2-chip--substituto">substituto</span>
                      ) : null}
                      {silenciado ? <span className="tv2-chip tv2-chip--espera">silenciado</span> : null}
                    </span>
                  </span>
                  <span className="tv2-jogador-acoes">
                    {podeSilenciar ? (
                      <Button
                        variant="fantasma"
                        size="icone"
                        aria-pressed={silenciado}
                        aria-label={`${silenciado ? 'Voltar a ouvir' : 'Silenciar'} ${participant.nickname}`}
                        data-testid={`drawer-mute-${participant.nickname}`}
                        onClick={() =>
                          silenciado ? room.unmuteAuthor(participant.id) : room.muteAuthor(participant.id)
                        }
                      >
                        <span aria-hidden="true">{silenciado ? '🔇' : '🔊'}</span>
                      </Button>
                    ) : null}
                    {podeRemover ? (
                      <Button
                        variant="fantasma"
                        size="icone"
                        aria-label={`Remover ${participant.nickname} da sala`}
                        data-testid={`drawer-remove-${participant.nickname}`}
                        onClick={() => setConfirmacao({ tipo: 'remover', playerId: participant.id, nickname: participant.nickname })}
                      >
                        <span aria-hidden="true">🗑️</span>
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="tv2-sala-secao" id="tv2-secao-apresentacao" aria-labelledby="tv2-apresentacao-titulo">
          <h3 id="tv2-apresentacao-titulo">Apresentação</h3>
          <MoodSettings semTitulo />
        </section>

        <section className="tv2-sala-secao" id="tv2-secao-anfitriao" aria-labelledby="tv2-anfitriao-titulo">
          <h3 id="tv2-anfitriao-titulo">Anfitrião</h3>
          {isHost ? (
            status === 'lobby' ? (
              <>
                <p className="tv2-sala-dica">
                  {todosProntos ? 'Todos prontos. A rodada pode começar.' : 'Aguarde todos marcarem pronto.'}
                </p>
                <Button
                  variant="principal"
                  disabled={!room.interactive || !todosProntos || participantesConectados.length > 8}
                  onClick={() => void room.startRound()}
                  data-testid="drawer-start-round"
                >
                  Iniciar rodada
                </Button>
              </>
            ) : status === 'playing' ? (
              <>
                <p className="tv2-sala-dica">Encerrar sem vencedor mantém o placar e devolve todos à preparação.</p>
                <Button
                  variant="perigo"
                  disabled={!room.interactive}
                  onClick={() => void room.endRoundWithoutWinner()}
                  data-testid="drawer-end-round"
                >
                  Encerrar sem vencedor
                </Button>
              </>
            ) : status === 'paused' ? (
              <p className="tv2-sala-dica">Use a pausa para continuar, substituir ou encerrar a rodada.</p>
            ) : (
              <p className="tv2-sala-dica">A rodada terminou. Use a tela de resultado para voltar à preparação.</p>
            )
          ) : (
            <p className="tv2-sala-dica">Só o anfitrião inicia ou encerra a rodada.</p>
          )}
        </section>

        <div className="tv2-sala-sair">
          <p className="tv2-sala-dica">Sair da sala não encerra a mesa para as outras pessoas.</p>
          <Button variant="perigo" onClick={() => setConfirmacao({ tipo: 'sair' })} data-testid="drawer-leave">
            Sair da sala
          </Button>
        </div>

        {confirmacao !== null ? (
          <div
            className="tv2-sala-confirmacao"
            role="alertdialog"
            aria-labelledby="tv2-confirmacao-titulo"
            data-testid="drawer-confirm"
          >
            <h4 id="tv2-confirmacao-titulo">
              {confirmacao.tipo === 'sair' ? 'Sair da sala?' : `Remover ${confirmacao.nickname ?? 'esta pessoa'}?`}
            </h4>
            <p>
              {confirmacao.tipo === 'sair'
                ? 'Você pode voltar pelo convite enquanto a sala existir.'
                : 'A pessoa perde a vaga; as vitórias já registradas continuam no placar.'}
            </p>
            <div className="tv2-sala-confirmacao-acoes">
              <Button
                variant="perigo"
                disabled={saindo}
                onClick={() => void confirmar()}
                data-testid="drawer-confirm-action"
              >
                {confirmacao.tipo === 'sair' ? (saindo ? 'Saindo…' : 'Sair da sala') : 'Remover'}
              </Button>
              <Button variant="secundario" onClick={() => setConfirmacao(null)} data-testid="drawer-cancel" autoFocus>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );

  return createPortal(
    <div
      className="tv2-drawer-layer"
      ref={layerRef}
      data-testid="table-drawer-layer"
      onKeyDown={onTabListKeyDown}
    >
      <div className="tv2-drawer-scrim" aria-hidden="true" onClick={fechar} data-testid="table-drawer-scrim" />
      <DrawerFrame
        id="table-drawer"
        titulo={TITULOS[aba]}
        sobretitulo={`Sala ${estado.room.roomCode}`}
        abas={ABAS}
        abaAtiva={aba}
        onSelecionarAba={(proxima) => selecionarAba(proxima as TableDrawerTab)}
        onFechar={fechar}
      >
        {conteudo}
      </DrawerFrame>
    </div>,
    document.body,
  );
}
