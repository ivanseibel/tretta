'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Ack,
  AutomaticEffect,
  ChatHistoryAck,
  ChatMessage,
  ChatSendAck,
  ClientCommand,
  CommandAck,
  CreateRoomAck,
  EffectVariant,
  EventsMessage,
  JoinRoomAck,
  ReactionEvent,
  ReactionSendAck,
  RemovedMessage,
  RetryInfo,
  SendLimitInfo,
  SimpleAck,
  StateMessage,
} from '@tretta/protocol';
import { CHAT_HISTORY_PAGE_SIZE, type Avatar, type ReactionType, type RoomMode } from '@tretta/protocol/shared';
import {
  clearIdentity,
  createSocket,
  loadIdentity,
  newIntentId,
  saveIdentity,
  type RoomSocket,
} from '@/lib/client';
import { loadMuted, saveMuted } from '@/lib/chatMute';
import {
  DEFAULT_PREFERENCES,
  effectiveAnimations,
  loadPreferences,
  savePreferences,
  watchSystemReducedMotion,
  type AnimationPreference,
  type MoodPreferences,
} from '@/lib/prefs';
import {
  PRESENTATION_DURATIONS,
  PresentationQueue,
  type Presentation,
} from '@/lib/presentationQueue';
import { MOOD_FEEDBACK_MS, REACTION_LABELS, REACTION_PRESENTATION_MS, reactionFeedback } from '@/lib/mood';
import { MoodLimitTracker, type MoodCategory } from '@/lib/moodTime';
import { playEffectSound, setSoundMuted, stopAllSounds } from '@/lib/sounds';
import { TurnNotifier } from '@/components/TurnNotifier';

export type RejoinResult =
  | 'ok'
  | 'not-found'
  | 'invalid'
  | 'none'
  | 'deadline'
  | 'cancelled'
  // Mesa de treino individual: recusa definitiva daquela tentativa; nenhum
  // ciclo automático volta a tentar e a identidade guardada fica isolada.
  | 'refused'
  // Estados históricos mantidos para consumidores antigos; o ciclo atual não os produz.
  | 'already'
  | 'error'
  | 'offline';

/**
 * Fase da retomada do contexto corrente. `exhausted` é terminal para o ciclo:
 * só a retomada explícita (`retryRecovery`) inicia outro.
 */
export type RecoveryPhase = 'idle' | 'recovering' | 'exhausted';
export type ConnectionState = 'live' | 'lost';

/** Posição do controle de origem para ancorar o menu no desktop. */
export interface MoodAnchor {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Menu de reação sem alvo. `trigger` é o controle de origem, para devolver o
 * foco no Escape.
 */
export interface MoodMenuState {
  readonly kind: 'reaction';
  /** Ordem de abertura: conclusões antigas não agem sobre o menu vigente. */
  readonly seq: number;
  readonly anchor: MoodAnchor;
  readonly trigger: HTMLElement | null;
}

/** Anúncio acessível de reação, uma vez por evento, sem depender do badge visual. */
export interface ReactionAnnouncement {
  readonly seq: number;
  readonly text: string;
}

export interface RoomContextValue {
  state: StateMessage | null;
  events: EventsMessage[];
  error: string | null;
  busy: boolean;
  connection: ConnectionState;
  reconnectedAt: number | null;
  removedMessage: string | null;
  roomGone: boolean;
  /**
   * Mesa de treino recusou a entrada deste contexto: recusa definitiva
   * daquela tentativa. Nada é apagado nem substituído e nenhum ciclo
   * automático volta a tentar; a página mostra a explicação própria.
   */
  trainingRefused: boolean;
  createRoom: (nickname: string, avatar: Avatar, mode?: RoomMode) => Promise<string | null>;
  joinRoom: (code: string, nickname: string, avatar: Avatar) => Promise<boolean>;
  /**
   * Retomada da identidade existente: inicia (ou coalesce no) ciclo corrente,
   * que repete com backoff até 60 s por tentativa de contexto. Devolve o
   * desfecho: `ok`, `not-found`, `invalid`, `none`, `deadline`, `refused`
   * ou `cancelled`.
   */
  rejoin: (code: string) => Promise<RejoinResult>;
  /** Retomada explícita após o prazo: inicia um novo ciclo do zero. */
  retryRecovery: (code: string) => Promise<RejoinResult>;
  /** Cancela o ciclo corrente (navegação, saída, mudança de contexto). */
  cancelRecovery: () => void;
  /** Fase da retomada do contexto corrente. */
  recoveryPhase: RecoveryPhase;
  setReady: (ready: boolean) => Promise<void>;
  startRound: () => Promise<void>;
  returnToLobby: () => Promise<void>;
  leaveRoom: () => Promise<boolean>;
  substituteAbsent: (targetId: string) => Promise<AckEnvelope>;
  continueRound: () => Promise<AckEnvelope>;
  endRoundWithoutWinner: () => Promise<AckEnvelope>;
  removeParticipant: (targetId: string) => Promise<AckEnvelope>;
  sendCommand: (command: ClientCommand) => Promise<CommandAck>;
  /**
   * Página do histórico, mesclada por `seq`; recarrega a cada vínculo novo
   * (`chatLinkEpoch`), inclusive montagem e reentrada autorizada.
   */
  loadChatHistory: (before?: number) => Promise<Ack<ChatHistoryAck>>;
  /** Envio ao chat; em recusa devolve a explicação sem limpar o texto digitado. */
  sendChat: (text: string) => Promise<AckEnvelope>;
  /**
   * Reação sem destinatário; mesmo gate de vínculo e mesma deduplicação do
   * ack/broadcast. O estado local apresenta 4 s por emissor e não toca som.
   */
  sendReaction: (type: ReactionType) => Promise<AckEnvelope>;
  /** Reações ativas por id do emissor; a mais nova substitui a anterior. */
  activeReactions: Readonly<Record<string, ReactionEvent>>;
  /** Último anúncio acessível de reação; não se repete no badge visual. */
  reactionAnnouncement: ReactionAnnouncement | null;
  /** Menu aberto (um por vez) e sua origem. */
  moodMenu: MoodMenuState | null;
  openReactionMenu: (trigger: HTMLElement) => void;
  closeMoodMenu: (restoreFocus?: boolean) => void;
  /** O menu de `seq` ainda é o vigente? Conclusões antigas não agem no novo. */
  isMoodMenuCurrent: (seq: number) => boolean;
  /** Feedback breve de envio aceito; some sozinho. */
  moodFeedback: string | null;
  /** Envio de humor em voo: nenhum acesso dispara outro. */
  moodPending: boolean;
  /** Restante do intervalo próprio (ms); 0 quando pode enviar. */
  moodRemaining: (category: MoodCategory) => number;
  /**
   * Efeito automático em apresentação na fila serial única; `null` quando
   * ociosa. Um por vez, na ordem de chegada — a fila nunca sobrepõe efeitos
   * maiores.
   */
  activePresentation: Presentation | null;
  /** Preferências de apresentação deste navegador; individuais, sem conta. */
  preferences: MoodPreferences;
  /** Preferências locais carregadas antes de permitir efeitos sonoros. */
  preferencesReady: boolean;
  /** Modo efetivo: `prefers-reduced-motion` limita "completa" a "reduced". */
  activeAnimations: AnimationPreference;
  /** Atualiza preferências parcialmente e persiste no storage local. */
  setPreferences: (patch: Partial<MoodPreferences>) => void;
  chatMessages: readonly ChatMessage[];
  chatHasMore: boolean;
  /**
   * Cursor para carregar anteriores: o menor seq da maior faixa contígua a
   * partir do topo. `null` quando o histórico está completo a partir da
   * mensagem 1 — recupera intervalos entre cache antigo e página recente.
   */
  chatHistoryFrontier: number | null;
  chatHistoryLoading: boolean;
  /** Geração do vínculo sala/identidade; respostas antigas não a alcançam. */
  chatLinkEpoch: number;
  /**
   * Disponibilidade do vínculo autorizado pertinente ao chat: só após
   * criação, entrada ou reentrada confirmada. Perde-se ao cair a conexão,
   * o vínculo ou a sala; transporte reconectado não restaura sozinho.
   */
  chatLinkReady: boolean;
  /**
   * Vínculo utilizável no contexto atual: transporte vivo **e** ack
   * autorizado (criação, entrada ou retomada confirmada). Controles mutáveis
   * e comandos usam este gate — transporte reconectado não basta.
   */
  interactive: boolean;
  mutedPlayerIds: readonly string[];
  muteAuthor: (playerId: string) => void;
  unmuteAuthor: (playerId: string) => void;
  clearError: () => void;
  clearRemoved: () => void;
}

interface AckEnvelope {
  ok: boolean;
  error?: { code: string; message: string; retry?: RetryInfo };
  limits?: SendLimitInfo;
}

/**
 * Intenção de reentrada de um ciclo de retomada: o payload exato enviado ao
 * servidor. Preservada entre ciclos quando o resultado fica incerto (o reenvio
 * recebe a resposta memorizada do dedupe do servidor) e descartada em qualquer
 * troca de contexto/sala/identidade.
 */
interface RejoinIntent {
  intentId: string;
  roomCode: string;
  nickname: string;
  avatar: Avatar;
  credential: string;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const value = useContext(RoomContext);
  if (value === null) throw new Error('useRoom requer RoomProvider.');
  return value;
}

const OFFLINE_ERROR = { code: 'OFFLINE', message: 'Sem conexão com o servidor. Aguarde a reconexão.' };
const LINK_PENDING_ERROR = {
  code: 'LINK_PENDING',
  message: 'Recuperando o vínculo com a sala. Aguarde a confirmação para enviar.',
};
const MOOD_PENDING_ERROR = {
  code: 'MOOD_PENDING',
  message: 'Aguarde a confirmação do envio anterior.',
};

/**
 * Espera máxima de um ciclo de retomada. Quando o servidor ainda considera a
 * identidade conectada (transporte antigo não reconhecido), o reconhecimento
 * pode levar dezenas de segundos — o ciclo cobre essa janela e para no prazo.
 */
const RECOVERY_DEADLINE_MS = 60_000;
/** Cadência moderada: recuo exponencial limitado, cancelável a cada passo. */
const RECOVERY_BACKOFF_START_MS = 500;
const RECOVERY_BACKOFF_FACTOR = 1.5;
const RECOVERY_BACKOFF_MAX_MS = 4_000;

function emitWithAck<T>(socket: RoomSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({ ok: false, error: OFFLINE_ERROR } as unknown as T);
      return;
    }
    const timer = setTimeout(() => {
      resolve({ ok: false, error: { code: 'TIMEOUT', message: 'Sem resposta do servidor. Verifique se ele está no ar.' } } as unknown as T);
    }, 6000);
    (socket as unknown as { emit: (event: string, payload: unknown, callback: (response: T) => void) => void }).emit(
      event,
      payload,
      (response: T) => {
        clearTimeout(timer);
        resolve(response);
      },
    );
  });
}

function anchorOf(trigger: HTMLElement): MoodAnchor {
  const rect = trigger.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Mesclagem por `seq`: entrada ao vivo durante a recuperação do histórico não
 * duplica nem regride a ordem; mensagens já conhecidas mantêm referência.
 */
function mergeMessages(previous: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return previous as ChatMessage[];
  const merged = new Map<number, ChatMessage>();
  for (const message of previous) merged.set(message.seq, message);
  let changed = false;
  for (const message of incoming) {
    if (merged.has(message.seq)) continue;
    merged.set(message.seq, message);
    changed = true;
  }
  if (!changed) return previous as ChatMessage[];
  return [...merged.values()].sort((left, right) => left.seq - right.seq);
}

/**
 * Fronteira de paginação derivada do próprio conjunto: o menor `seq` da maior
 * faixa contígua ancorada no topo conhecido. `null` quando tudo a partir da
 * mensagem 1 está presente. Diferencia a fronteira da página recente do menor
 * seq global: um cache antigo destacado (ex.: só a mensagem 1) não pode ser
 * usado como cursor, senão o intervalo entre ele e a página recente fica
 * inacessível.
 */
function chatHistoryFrontierOf(messages: readonly ChatMessage[]): number | null {
  if (messages.length === 0) return null;
  const seqs = new Set(messages.map((message) => message.seq));
  const highest = messages[messages.length - 1]?.seq;
  if (highest === undefined) return null;
  let frontier = highest;
  while (frontier > 1 && seqs.has(frontier - 1)) frontier -= 1;
  return frontier === 1 ? null : frontier;
}

export function RoomProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState<StateMessage | null>(null);
  const [events, setEvents] = useState<EventsMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('live');
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);
  const [removedMessage, setRemovedMessage] = useState<string | null>(null);
  const [roomGone, setRoomGone] = useState(false);
  const [trainingRefused, setTrainingRefused] = useState(false);
  const [recoveryPhase, setRecoveryPhaseState] = useState<RecoveryPhase>('idle');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatLinkEpoch, setChatLinkEpoch] = useState(0);
  const [chatLinkReady, setChatLinkReadyState] = useState(false);
  const [activePresentation, setActivePresentation] = useState<Presentation | null>(null);
  const [preferences, setPreferencesState] = useState<MoodPreferences>(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [mutedPlayerIds, setMutedPlayerIds] = useState<readonly string[]>([]);
  const [activeReactions, setActiveReactions] = useState<Record<string, ReactionEvent>>({});
  const [reactionAnnouncement, setReactionAnnouncement] = useState<ReactionAnnouncement | null>(null);
  const [moodMenu, setMoodMenu] = useState<MoodMenuState | null>(null);
  const [moodFeedback, setMoodFeedback] = useState<string | null>(null);
  const [moodPending, setMoodPending] = useState(false);
  const socketRef = useRef<RoomSocket | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const lastRoomRef = useRef<string | null>(null);
  const lastChatRoomRef = useRef<string | null>(null);
  const lastVersionRef = useRef(-1);
  const hadDisconnectRef = useRef(false);
  const recoveredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ciclo de retomada corrente (um por sala): coalesce gatilhos concorrentes
  // da página, do `connect` do socket e da retomada manual.
  const recoveryRef = useRef<{ code: string; token: number; promise: Promise<RejoinResult> } | null>(null);
  // Geração do ciclo: cancelamento/mudança de contexto avança o contador e
  // respostas antigas (ack, timer, sleep) deixam de ter efeito.
  const recoveryTokenRef = useRef(0);
  // Sala cujo ciclo terminou no prazo: novos ciclos só por retomada explícita.
  const exhaustedCodeRef = useRef<string | null>(null);
  // Sala de treino cuja entrada foi recusada: recusa definitiva daquele
  // contexto — nenhum gatilho automático volta a tentar enquanto ele viver.
  const refusedCodeRef = useRef<string | null>(null);
  // Ação de criação em voo: clique repetido não emite outra criação.
  const busyRef = useRef(false);
  // Geração da entrada manual (formulário/código): cada tentativa nova e cada
  // invalidação de contexto (navegação/limpeza da página, saída, vínculo novo)
  // avança o contador; respostas de tentativas antigas deixam de ter efeito.
  const joinAttemptRef = useRef(0);
  // Intenção cujo resultado ficou incerto no vencimento: guardada para o próximo
  // ciclo explícito confirmá-la com o reenvio exato do payload (replay do dedupe
  // do servidor) antes de tentar ids novos. Nunca cruza contexto: a adoção
  // exige sala e identidade iguais e qualquer limpeza descarta o registro.
  const uncertainIntentRef = useRef<{ roomCode: string; attempt: RejoinIntent } | null>(null);
  // Espelho da fase para callbacks de socket decidirem sem estado capturado.
  const recoveryPhaseRef = useRef<RecoveryPhase>('idle');
  // Geração do transporte: cada queda avança o contador e respostas presas ao
  // transporte caído deixam de valer para o vínculo no transporte vigente.
  const transportEpochRef = useRef(0);
  // Esperas do ciclo de retomada (ack e cadência) acordadas por eventos de
  // transporte: a queda invalida a tentativa em voo; a reconexão retoma logo.
  const transportWaitersRef = useRef(new Set<() => void>());
  // Geração do vínculo sala/identidade: cada limpeza ou novo vínculo autorizado
  // avança o contador e respostas assíncronas antigas deixam de ter efeito.
  const chatLinkRef = useRef(0);
  // Disponibilidade do vínculo autorizado: espelho em ref para o envio decidir
  // sem re-render e sem capturar estado desatualizado no callback.
  const chatLinkReadyRef = useRef(false);
  // Efeitos automáticos: proteção por id até a troca/saída/remoção da sala;
  // replay do mesmo lote não apresenta nem toca duas vezes.
  const seenEffectIdsRef = useRef<Set<string>>(new Set());
  // Rodada atualmente refletida na fila: cancela o passado só em troca real
  // (finished da mesma rodada preserva a sequência final).
  const lastRoundRef = useRef<string | null>(null);
  // Espelhos das preferências para os callbacks de socket/fila decidirem sem
  // re-render e sem capturar estado desatualizado.
  const preferencesRef = useRef<MoodPreferences>(DEFAULT_PREFERENCES);
  const systemReducedRef = useRef(false);
  // Impede que a limpeza de estado da saída voluntária dispare uma reentrada
  // automática antes de a navegação para o início concluir.
  const leavingRef = useRef<{ code: string; until: number } | null>(null);
  // Reações já apresentadas nesta sala: ack e broadcast compartilham o id;
  // replay/repetição não prolonga nem duplica os quatro segundos.
  const seenReactionIdsRef = useRef<Set<string>>(new Set());
  const reactionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Geração da apresentação: limpeza de contexto invalida callbacks em voo.
  const reactionEpochRef = useRef(0);
  const reactionAnnouncementSeqRef = useRef(0);
  // Ocultação espelhada para os callbacks do socket.
  const hideReactionsRef = useRef(false);
  const moodFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Intervalos autoritativos traduzidos para tempo local relativo.
  const moodTrackerRef = useRef(new MoodLimitTracker());
  // Envio de humor em voo: token evita que resposta antiga libere o novo vínculo.
  const moodPendingRef = useRef(false);
  const moodPendingTokenRef = useRef(0);
  // Rodada cujo estado já foi refletido: só uma rodada NOVA limpa humor transitório.
  const moodRoundRef = useRef<string | null>(null);
  const moodMenuRef = useRef<MoodMenuState | null>(null);
  // Ordem de abertura dos menus: uma conclusão só age se ainda for o vigente.
  const moodMenuSeqRef = useRef(0);
  hideReactionsRef.current = preferences.hideReactions;

  /** Janela do item entrando agora, pelo modo efetivo no instante da entrada. */
  const durationFor = useCallback((): number => {
    const mode = effectiveAnimations(preferencesRef.current.animations, systemReducedRef.current);
    return PRESENTATION_DURATIONS.effect[mode];
  }, []);

  /**
   * Fila serial única de apresentações. O encerramento é por timer (nunca
   * `animationend`); ativação toca o som uma vez, salvo silenciado.
   */
  const queueRef = useRef<PresentationQueue<Presentation> | null>(null);
  const getQueue = useCallback((): PresentationQueue<Presentation> => {
    if (queueRef.current === null) {
      queueRef.current = new PresentationQueue<Presentation>({
        onActiveChange: (item) => {
          setActivePresentation(item);
          if (item === null || preferencesRef.current.soundMuted) return;
          try {
            playEffectSound(item.effect);
          } catch {
            // Áudio é opcional: falha nunca trava a fila nem a sala.
          }
        },
      });
    }
    return queueRef.current;
  }, []);

  /** Cancela fila/timers; `withAudio` também corta som em andamento. */
  const cancelPresentations = useCallback(
    (withAudio: boolean) => {
      getQueue().cancelAll();
      if (withAudio) stopAllSounds();
    },
    [getQueue],
  );

  /** Efeito autoritativo entra uma vez por id, na ordem do lote recebido. */
  const presentEffect = useCallback(
    (effect: AutomaticEffect) => {
      if (seenEffectIdsRef.current.has(effect.id)) return;
      seenEffectIdsRef.current.add(effect.id);
      getQueue().enqueue({
        kind: 'effect',
        id: effect.id,
        durationMs: durationFor(),
        effect,
      });
    },
    [durationFor, getQueue],
  );

  /** Cancela timers das reações sem tocar no estado (desmontagem). */
  const disposeReactionTimers = useCallback(() => {
    reactionEpochRef.current += 1;
    for (const timer of reactionTimersRef.current.values()) clearTimeout(timer);
    reactionTimersRef.current.clear();
  }, []);

  /** Remove imediatamente todas as apresentações locais de reação. */
  const clearReactions = useCallback(() => {
    disposeReactionTimers();
    setActiveReactions({});
    setReactionAnnouncement(null);
  }, [disposeReactionTimers]);

  /**
   * Reação aceita: uma vez por id, quatro segundos por emissor, sem fila
   * central e sem som. Uma reação nova do mesmo emissor substitui a anterior.
   * Ocultar descarta a apresentação local (o evento continua deduplicado).
   */
  const presentReaction = useCallback((reaction: ReactionEvent) => {
    if (seenReactionIdsRef.current.has(reaction.id)) return;
    seenReactionIdsRef.current.add(reaction.id);
    if (hideReactionsRef.current) return;
    const senderId = reaction.sender.playerId;
    const existing = reactionTimersRef.current.get(senderId);
    if (existing !== undefined) clearTimeout(existing);
    setActiveReactions((previous) => ({ ...previous, [senderId]: reaction }));
    reactionAnnouncementSeqRef.current += 1;
    setReactionAnnouncement({
      seq: reactionAnnouncementSeqRef.current,
      text: `${reaction.sender.nickname}: ${REACTION_LABELS[reaction.type]}`,
    });
    const epoch = reactionEpochRef.current;
    const timer = setTimeout(() => {
      reactionTimersRef.current.delete(senderId);
      if (reactionEpochRef.current !== epoch) return;
      setActiveReactions((previous) => {
        if (previous[senderId]?.id !== reaction.id) return previous;
        const next = { ...previous };
        delete next[senderId];
        return next;
      });
    }, REACTION_PRESENTATION_MS);
    reactionTimersRef.current.set(senderId, timer);
  }, []);

  const showMoodFeedback = useCallback((message: string) => {
    if (moodFeedbackTimerRef.current !== null) clearTimeout(moodFeedbackTimerRef.current);
    setMoodFeedback(message);
    moodFeedbackTimerRef.current = setTimeout(() => {
      moodFeedbackTimerRef.current = null;
      setMoodFeedback(null);
    }, MOOD_FEEDBACK_MS);
  }, []);

  const openReactionMenu = useCallback((trigger: HTMLElement) => {
    const menu: MoodMenuState = { kind: 'reaction', seq: ++moodMenuSeqRef.current, anchor: anchorOf(trigger), trigger };
    moodMenuRef.current = menu;
    setMoodMenu(menu);
  }, []);

  const closeMoodMenu = useCallback((restoreFocus = false) => {
    const current = moodMenuRef.current;
    moodMenuRef.current = null;
    setMoodMenu(null);
    if (!restoreFocus || current?.trigger == null) return;
    const trigger = current.trigger;
    globalThis.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
  }, []);

  const isMoodMenuCurrent = useCallback((seq: number): boolean => moodMenuRef.current?.seq === seq, []);

  /** Limpa elementos transitórios de humor; não reinicia intervalos autoritativos. */
  const clearMoodTemporary = useCallback(() => {
    clearReactions();
    moodMenuRef.current = null;
    setMoodMenu(null);
    setMoodFeedback(null);
    if (moodFeedbackTimerRef.current !== null) {
      clearTimeout(moodFeedbackTimerRef.current);
      moodFeedbackTimerRef.current = null;
    }
    // Resposta antiga não libera o estado pendente de um vínculo novo.
    moodPendingTokenRef.current += 1;
    moodPendingRef.current = false;
    setMoodPending(false);
  }, [clearReactions]);

  const moodRemaining = useCallback(
    (category: MoodCategory): number => moodTrackerRef.current.remainingSender(category),
    [],
  );

  const bumpChatLink = useCallback(() => {
    chatLinkRef.current += 1;
    setChatLinkEpoch(chatLinkRef.current);
    // Recuperação do vínculo limpa a fila e mantém as proteções por id.
    cancelPresentations(false);
  }, [cancelPresentations]);

  const setChatLinkReady = useCallback((ready: boolean) => {
    chatLinkReadyRef.current = ready;
    setChatLinkReadyState(ready);
  }, []);

  const applyRecoveryPhase = useCallback((phase: RecoveryPhase) => {
    recoveryPhaseRef.current = phase;
    setRecoveryPhaseState(phase);
  }, []);

  /** Acorda as esperas do ciclo de retomada (queda, reconexão, cancelamento). */
  const wakeTransport = useCallback(() => {
    const waiters = transportWaitersRef.current;
    transportWaitersRef.current = new Set();
    for (const resolve of waiters) resolve();
  }, []);

  /**
   * Espera cancelável por um evento de transporte. `dispose` remove o
   * resolvedor para nenhuma promessa de retomada sobreviver à tentativa/ciclo.
   */
  const waitTransport = useCallback((): { promise: Promise<'transport'>; dispose: () => void } => {
    let resolve!: () => void;
    const promise = new Promise<'transport'>((settle) => {
      resolve = () => settle('transport');
    });
    transportWaitersRef.current.add(resolve);
    return {
      promise,
      dispose: () => {
        transportWaitersRef.current.delete(resolve);
      },
    };
  }, []);

  /** Encerra o ciclo corrente sem aplicar nenhuma resposta pendente. */
  const cancelRecovery = useCallback(() => {
    recoveryTokenRef.current += 1;
    // Contexto invalidado: entradas manuais pendentes perdem validade e o
    // `busy` do formulário que as originou não pode ficar preso sem dono.
    joinAttemptRef.current += 1;
    setBusy(false);
    recoveryRef.current = null;
    exhaustedCodeRef.current = null;
    refusedCodeRef.current = null;
    setTrainingRefused(false);
    // Limpeza de contexto/identidade: nenhuma intenção incerta sobrevive.
    uncertainIntentRef.current = null;
    wakeTransport();
    applyRecoveryPhase('idle');
  }, [applyRecoveryPhase, wakeTransport]);

  const clearRoomState = useCallback(() => {
    cancelRecovery();
    activeRoomRef.current = null;
    lastRoomRef.current = null;
    lastVersionRef.current = -1;
    lastChatRoomRef.current = null;
    seenEffectIdsRef.current.clear();
    seenReactionIdsRef.current.clear();
    lastRoundRef.current = null;
    moodRoundRef.current = null;
    // Intervalos pertencem à identidade/sala: contexto novo começa sem amostras.
    moodTrackerRef.current.clear();
    clearMoodTemporary();
    bumpChatLink();
    stopAllSounds();
    setChatLinkReady(false);
    setState(null);
    setEvents([]);
    setChatMessages([]);
    setChatHistoryLoading(false);
    setMutedPlayerIds([]);
  }, [bumpChatLink, cancelRecovery, clearMoodTemporary, setChatLinkReady]);

  const ensureSocket = useCallback((): RoomSocket => {
    if (socketRef.current !== null) return socketRef.current;
    const socket = createSocket();
    socket.on('server:state', (message) => {
      const knownRoom = lastRoomRef.current;
      if (knownRoom !== null && message.room.roomCode !== knownRoom) return;
      if (message.room.roomCode === knownRoom && message.room.version <= lastVersionRef.current) return;
      lastRoomRef.current = message.room.roomCode;
      lastVersionRef.current = message.room.version;
      // Troca de rodada cancela apresentações/timers/áudio do passado:
      // preparação e nova rodada não herdam vitória antiga. Finished da mesma
      // rodada não entra aqui e preserva a sequência final dos resultados.
      if (message.room.roundId !== lastRoundRef.current) {
        lastRoundRef.current = message.room.roundId;
        seenEffectIdsRef.current.clear();
        setEvents([]);
        cancelPresentations(true);
      }
      // Rodada NOVA (id diferente, inclusive vindo da preparação) limpa reações e
      // avisos; pausa, resultado e volta à preparação preservam até o prazo.
      if (message.room.roundId !== null && message.room.roundId !== moodRoundRef.current) {
        moodRoundRef.current = message.room.roundId;
        clearMoodTemporary();
      }
      // Snapshot autoritativo dos dois intervalos do próprio; um snapshot velho
      // não sobrescreve dados mais novos (o rastreador descarta pela referência).
      moodTrackerRef.current.noteState(
        message.room.serverTime,
        message.self.reactionNextSendAt ?? null,
      );
      setState(message);
    });
    socket.on('server:events', (message) => {
      if (message.roomCode !== lastRoomRef.current || message.roundId !== lastRoundRef.current) return;
      setEvents((previous) => [...previous, message].slice(-200));
      // Efeitos viajam no mesmo lote, na ordem dos eventos que os originaram;
      // dedupe por id torna repetição/broadcast idempotente.
      for (const effect of message.effects ?? []) presentEffect(effect);
    });
    socket.on('server:chat', (message) => {
      if (message.roomCode !== lastRoomRef.current) return;
      setChatMessages((previous) => mergeMessages(previous, [message.message]));
    });
    socket.on('server:reaction', (message) => {
      if (message.roomCode !== lastRoomRef.current) return;
      presentReaction(message.reaction);
    });
    socket.on('server:removed', (message: RemovedMessage) => {
      clearRoomState();
      setRoomGone(false);
      setRemovedMessage(
        message.reason === 'removed'
          ? 'Você foi removido da sala pelo anfitrião.'
          : 'Você não está mais nesta sala.',
      );
    });
    socket.on('disconnect', () => {
      hadDisconnectRef.current = true;
      // Queda de transporte: respostas em voo deixam de valer para o vínculo
      // (o ack preso a este transporte não confirma o próximo) e as esperas do
      // ciclo são acordadas para reter/reavaliar a tentativa.
      transportEpochRef.current += 1;
      wakeTransport();
      setConnection('lost');
      // Conexão caiu: o vínculo autorizado deixa de valer até nova confirmação.
      setChatLinkReady(false);
      // Elementos transitórios de humor não sobrevivem à perda de conexão.
      clearMoodTemporary();
    });
    socket.on('connect', () => {
      setConnection('live');
      wakeTransport();
      if (!hadDisconnectRef.current) return;
      hadDisconnectRef.current = false;
      const code = activeRoomRef.current;
      if (code === null) return;
      void rejoinRef.current(code).then((result) => {
        if (result !== 'ok') return;
        setReconnectedAt(Date.now());
        if (recoveredTimerRef.current !== null) clearTimeout(recoveredTimerRef.current);
        recoveredTimerRef.current = setTimeout(() => setReconnectedAt(null), 4000);
      });
    });
    socketRef.current = socket;
    return socket;
  }, [
    cancelPresentations,
    clearMoodTemporary,
    clearRoomState,
    presentEffect,
    presentReaction,
    setChatLinkReady,
    wakeTransport,
  ]);

  const resetRoomState = useCallback((code: string) => {
    const previousRoom = lastRoomRef.current;
    // Vínculo novo confirmado substitui o contexto: entradas manuais antigas
    // não podem mais aplicar efeitos sobre ele.
    joinAttemptRef.current += 1;
    setBusy(false);
    activeRoomRef.current = code;
    lastRoomRef.current = code;
    lastVersionRef.current = -1;
    // Vínculo autorizado confirmado: não há mais recusa pendente deste contexto.
    refusedCodeRef.current = null;
    setTrainingRefused(false);
    // Reentrada na mesma sala preserva os ids apresentados (replay não
    // reapresenta); troca de sala descarta a proteção da sala anterior.
    if (previousRoom !== code) {
      seenEffectIdsRef.current.clear();
      seenReactionIdsRef.current.clear();
      moodTrackerRef.current.clear();
      moodRoundRef.current = null;
    }
    // Vínculo novo: menus, avisos e reações do contexto anterior não sobrevivem.
    clearMoodTemporary();
    bumpChatLink();
    // Chamado só após ack de criação/entrada/reentrada: é a confirmação que
    // restabelece a disponibilidade do vínculo para o envio do chat.
    setChatLinkReady(true);
    // Troca de sala zera o chat; retorno à mesma sala preserva e o histórico
    // recarrega depois (efeito do painel por chatLinkEpoch) para preencher lacunas.
    if (lastChatRoomRef.current !== code) {
      lastChatRoomRef.current = code;
      setChatMessages([]);
    }
    setChatHistoryLoading(false);
    setMutedPlayerIds(loadMuted(code));
    setEvents([]);
    setError(null);
    setRemovedMessage(null);
    setRoomGone(false);
  }, [bumpChatLink, clearMoodTemporary, setChatLinkReady]);

  /**
   * Ciclo de retomada da identidade existente. Um por sala: disparos
   * concorrentes (efeito da página, `connect` do socket, retomada manual)
   * coalescem nesta promessa. O ciclo tem prazo efetivo de 60 s (vencimento
   * próprio, mesmo com ack ou cadência em voo) e cada tentativa fica presa ao
   * transporte que a enviou: resposta de um transporte caído não habilita o
   * vínculo nem sobrescreve contexto/identidade. Recusa conhecida (resposta do
   * servidor no transporte vigente) consome a intenção e a próxima usa um
   * `intentId` novo; resultado incerto (timeout local, offline, transporte
   * caído) preserva o payload exato — o reenvio da mesma intenção recebe a
   * resposta memorizada do dedupe do servidor. Só a falta de identidade, a
   * credencial inválida e a sala inexistente são definitivas. O sucesso passa
   * pelo `resetRoomState`, que confirma o vínculo e preserva a
   * credencial/identidade. Entre ciclos, o vencimento com resultado incerto
   * preserva a intenção exata: a próxima retomada explícita a confirma com o
   * reenvio do mesmo payload (replay do dedupe) antes de tentar ids novos;
   * troca de sala/identidade ou limpeza de contexto descarta o registro.
   */
  const startRecovery = useCallback(
    (code: string, explicit = false): Promise<RejoinResult> => {
      const active = recoveryRef.current;
      if (active !== null && active.code === code) return active.promise;
      const leaving = leavingRef.current;
      if (leaving !== null && leaving.code === code && Date.now() < leaving.until) {
        return Promise.resolve('none');
      }
      // Vínculo autorizado e vivo: nada a retomar (corrida comum logo após o ack).
      if (chatLinkReadyRef.current && activeRoomRef.current === code) return Promise.resolve('ok');
      // Depois do prazo, nenhum gatilho automático reinicia: só retomada explícita.
      if (!explicit && exhaustedCodeRef.current === code) return Promise.resolve('deadline');
      // Treino recusado é definitivo: nenhum gatilho automático reabre a tentativa.
      if (!explicit && refusedCodeRef.current === code) return Promise.resolve('refused');
      const identity = loadIdentity(code);
      if (identity === null) {
        clearRoomState();
        return Promise.resolve('none');
      }
      const token = ++recoveryTokenRef.current;
      exhaustedCodeRef.current = null;
      applyRecoveryPhase('recovering');
      const promise = (async (): Promise<RejoinResult> => {
        const deadlineAt = Date.now() + RECOVERY_DEADLINE_MS;
        // Vencimento do ciclo: resolve no prazo mesmo com ack/cadência em voo.
        let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
        const deadlinePromise = new Promise<'deadline'>((resolve) => {
          deadlineTimer = setTimeout(resolve, RECOVERY_DEADLINE_MS, 'deadline');
        });
        try {
          let waitMs = RECOVERY_BACKOFF_START_MS;
          // Intenção corrente: recusas conhecidas a consomem; resultados
          // incertos preservam o payload para o replay do dedupe do servidor.
          let attempt: RejoinIntent | null = null;
          // Vencimento do ciclo: preserva a intenção sem desfecho para a
          // retomada explícita seguinte; tentativa consumida não guarda nada.
          const finishDeadline = (): 'deadline' => {
            if (attempt !== null) uncertainIntentRef.current = { roomCode: code, attempt };
            return 'deadline';
          };
          for (;;) {
            if (recoveryTokenRef.current !== token) return 'cancelled';
            if (chatLinkReadyRef.current && activeRoomRef.current === code) return 'ok';
            if (Date.now() >= deadlineAt) return finishDeadline();
            const current = loadIdentity(code);
            if (current === null) {
              clearRoomState();
              return 'none';
            }
            if (attempt === null) {
              const stored = uncertainIntentRef.current;
              if (
                stored !== null &&
                stored.roomCode === code &&
                stored.attempt.credential === current.credential &&
                stored.attempt.nickname === current.nickname &&
                stored.attempt.avatar === current.avatar
              ) {
                // Confirmação segura entre ciclos: reenvia a MESMA intenção
                // (o dedupe devolve a resposta memorizada) e o registro passa
                // a pertencer a este ciclo.
                attempt = stored.attempt;
                uncertainIntentRef.current = null;
              } else {
                if (stored !== null && stored.roomCode === code) {
                  // Mesma sala com identidade diferente: contexto trocado.
                  uncertainIntentRef.current = null;
                }
                attempt = {
                  intentId: newIntentId(),
                  roomCode: code,
                  nickname: current.nickname,
                  avatar: current.avatar,
                  credential: current.credential,
                };
              }
            }
            const generation = transportEpochRef.current;
            const wake = waitTransport();
            const outcome = await Promise.race([
              emitWithAck<Ack<JoinRoomAck>>(ensureSocket(), 'client:joinRoom', attempt),
              wake.promise,
              deadlinePromise,
            ]);
            wake.dispose();
            if (recoveryTokenRef.current !== token) return 'cancelled';
            if (outcome === 'deadline' || Date.now() >= deadlineAt) return finishDeadline();
            if (outcome !== 'transport') {
              const response = outcome;
              const staleTransport = generation !== transportEpochRef.current;
              // Códigos locais (TIMEOUT/OFFLINE) não estão na união do protocolo.
              const errorCode: string | null = response.ok ? null : String(response.error.code);
              // Decisão definitiva do servidor sobre identidade/sala vale mesmo
              // quando a resposta chega de um transporte que caiu em seguida.
              if (errorCode === 'CREDENTIAL_INVALID') {
                clearIdentity(code);
                clearRoomState();
                return 'invalid';
              }
              if (errorCode === 'ROOM_NOT_FOUND') {
                clearRoomState();
                setRoomGone(true);
                return 'not-found';
              }
              if (errorCode === 'TRAINING_ROOM_ENTRY_REFUSED') {
                // Mesa de treino individual: recusa definitiva daquela
                // tentativa. A identidade guardada permanece isolada — nada é
                // apagado nem substituído — e nenhum ciclo automático volta a
                // tentar enquanto o contexto viver.
                refusedCodeRef.current = code;
                setTrainingRefused(true);
                uncertainIntentRef.current = null;
                return 'refused';
              }
              if (response.ok && !staleTransport) {
                // Vínculo confirmado: nenhum resultado incerto segue pendente.
                uncertainIntentRef.current = null;
                resetRoomState(code);
                saveIdentity(code, { ...current, playerId: response.playerId, credential: response.credential });
                return 'ok';
              }
              if (!response.ok && !staleTransport && errorCode !== 'TIMEOUT' && errorCode !== 'OFFLINE') {
                // Recusa conhecida no transporte vigente: id novo na próxima.
                attempt = null;
              }
              // Sucesso de transporte caído, timeout local e offline são
              // incertos: nada é aplicado e a intenção é preservada.
            }
            const now = Date.now();
            if (now >= deadlineAt) return finishDeadline();
            const wait = waitTransport();
            let resolveStep!: (value: 'step') => void;
            const step = new Promise<'step'>((resolve) => {
              resolveStep = resolve;
            });
            const stepTimer = setTimeout(() => resolveStep('step'), Math.min(waitMs, deadlineAt - now));
            const waited = await Promise.race([step, wait.promise, deadlinePromise]);
            wait.dispose();
            clearTimeout(stepTimer);
            if (waited === 'deadline') return finishDeadline();
            waitMs = Math.min(Math.round(waitMs * RECOVERY_BACKOFF_FACTOR), RECOVERY_BACKOFF_MAX_MS);
          }
        } finally {
          // Vencimento/cancelamento não deixam timer de prazo pendurado.
          if (deadlineTimer !== null) clearTimeout(deadlineTimer);
        }
      })().then((result) => {
        if (recoveryTokenRef.current !== token) return result;
        recoveryRef.current = null;
        if (result === 'deadline') {
          exhaustedCodeRef.current = code;
          applyRecoveryPhase('exhausted');
        } else {
          applyRecoveryPhase('idle');
        }
        return result;
      });
      recoveryRef.current = { code, token, promise };
      return promise;
    },
    [applyRecoveryPhase, clearRoomState, ensureSocket, resetRoomState, waitTransport],
  );

  const retryRecovery = useCallback(
    (code: string): Promise<RejoinResult> => {
      exhaustedCodeRef.current = null;
      refusedCodeRef.current = null;
      setTrainingRefused(false);
      return startRecovery(code, true);
    },
    [startRecovery],
  );

  const rejoinRef = useRef(startRecovery);
  rejoinRef.current = startRecovery;

  useEffect(() => {
    ensureSocket();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      // Desmontagem: nenhum ciclo nem timer de retomada sobrevive ao provedor.
      recoveryTokenRef.current += 1;
      recoveryRef.current = null;
      uncertainIntentRef.current = null;
      wakeTransport();
      if (recoveredTimerRef.current !== null) clearTimeout(recoveredTimerRef.current);
      // Desmontagem: fila, timers e áudio da sala não sobrevivem.
      getQueue().cancelAll();
      disposeReactionTimers();
      if (moodFeedbackTimerRef.current !== null) clearTimeout(moodFeedbackTimerRef.current);
      stopAllSounds();
    };
  }, [disposeReactionTimers, ensureSocket, getQueue, wakeTransport]);

  // Preferências persistidas + mídia do sistema (mudanças ao vivo são
  // consideradas; "completa" é limitada a "reduced" enquanto a mídia valer).
  useEffect(() => {
    const stored = loadPreferences();
    preferencesRef.current = stored;
    setPreferencesState(stored);
    setPreferencesReady(true);
    return watchSystemReducedMotion((reduced) => {
      systemReducedRef.current = reduced;
      setSystemReduced(reduced);
    });
  }, []);

  // Silenciar corta o som em andamento e impede os seguintes.
  useEffect(() => {
    setSoundMuted(preferences.soundMuted);
  }, [preferences.soundMuted]);

  // Ocultar reações remove as apresentações imediatamente, inclusive as
  // próprias; reativar deixa o palco vazio e só novas reações aparecem.
  useEffect(() => {
    if (!preferences.hideReactions) return;
    clearReactions();
  }, [clearReactions, preferences.hideReactions]);

  // Reação de quem saiu não fica pendurada junto à identificação.
  useEffect(() => {
    const participants = state?.room.participants;
    if (participants === undefined) return;
    const present = new Set(participants.map((participant) => participant.id));
    setActiveReactions((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const playerId of Object.keys(next)) {
        if (present.has(playerId)) continue;
        delete next[playerId];
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [state?.room.participants]);

  // Mudanças de fase, conexão ou vínculo fecham o menu aberto sem devolver o
  // foco: o controle de origem pode nem existir mais no novo contexto.
  useEffect(() => {
    closeMoodMenu(false);
  }, [chatLinkReady, closeMoodMenu, connection, state?.room.roomCode, state?.room.roundId, state?.room.status]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_HOOKS !== '1') return;
    window.__trettaTest = {
      setNextDeck: async (deck: string[]) => {
        const code = activeRoomRef.current;
        if (code === null) {
          return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Entre em uma sala antes.' } };
        }
        return emitWithAck<SimpleAck>(ensureSocket(), 'test:setNextDeck', { intentId: newIntentId(), roomCode: code, deck });
      },
      // Viesa a variação cosmética do servidor (mantém a matriz das oito
      // apresentações exercitável sem depender da sorte).
      setEffectVariant: async (variant: EffectVariant | null) => {
        const code = activeRoomRef.current;
        if (code === null) {
          return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Entre em uma sala antes.' } };
        }
        return emitWithAck<SimpleAck>(ensureSocket(), 'test:setEffectVariant', {
          intentId: newIntentId(),
          roomCode: code,
          variant,
        });
      },
      // Simula perda e recuperação de conexão sem depender do emulador de rede.
      disconnect: () => {
        socketRef.current?.disconnect();
      },
      connect: () => {
        socketRef.current?.connect();
      },
    };
    return () => {
      delete window.__trettaTest;
    };
  }, [ensureSocket]);

  const createRoom = useCallback(
    async (nickname: string, avatar: Avatar, mode?: RoomMode): Promise<string | null> => {
      // Ação pendente não emite outra criação: clique repetido no formulário
      // não cria salas duplicadas nem navega antes da confirmação.
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      let response: Ack<CreateRoomAck>;
      try {
        response = await emitWithAck<Ack<CreateRoomAck>>(ensureSocket(), 'client:createRoom', {
          intentId: newIntentId(),
          nickname,
          avatar,
          // `classic` é o default do protocolo e continua implícito; o treino é explícito.
          ...(mode === undefined ? {} : { mode }),
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      if (!response.ok) {
        setError(response.error.message);
        return null;
      }
      resetRoomState(response.roomCode);
      saveIdentity(response.roomCode, {
        playerId: response.playerId,
        credential: response.credential,
        nickname,
        avatar,
      });
      return response.roomCode;
    },
    [ensureSocket, resetRoomState],
  );

  const joinRoom = useCallback(
    async (code: string, nickname: string, avatar: Avatar): Promise<boolean> => {
      // Recusa definitiva do treino já conhecida neste contexto: nada a emitir.
      if (refusedCodeRef.current === code) return false;
      // Retomada pendente ou esgotada da mesma sala: entrar de novo criaria
      // outro participante e sobrescreveria a credencial da sessão existente.
      // A invalidação definitiva (credencial revogada) limpa a identidade e
      // libera o formulário de novo.
      const recoveryPending = recoveryRef.current?.code === code || exhaustedCodeRef.current === code;
      if (recoveryPending) {
        setError('Esta sala já tem uma sessão em retomada neste navegador. Aguarde a retomada ou use "Tentar novamente".');
        return false;
      }
      setBusy(true);
      // Tentativa manual presa ao contexto que a originou: navegação/limpeza,
      // saída, vínculo novo ou outra entrada mais recente avançam a geração e
      // esta resposta deixa de ter efeito — recusa, busy/erro, vínculo ou
      // identidade — mesmo ao sair e voltar ao MESMO código com tentativa nova.
      const attempt = ++joinAttemptRef.current;
      const transport = transportEpochRef.current;
      const response = await emitWithAck<Ack<JoinRoomAck>>(ensureSocket(), 'client:joinRoom', {
        intentId: newIntentId(),
        roomCode: code,
        nickname,
        avatar,
      });
      if (attempt !== joinAttemptRef.current) return false;
      setBusy(false);
      // Resposta de um transporte que caiu não confirma vínculo novo; a
      // decisão definitiva do servidor (recusa do treino) vale mesmo assim.
      const staleTransport = transport !== transportEpochRef.current;
      if (!response.ok) {
        if (String(response.error.code) === 'TRAINING_ROOM_ENTRY_REFUSED') {
          // Recusa definitiva do treino: nenhuma identidade nova é criada,
          // nenhuma credencial é trocada e nenhum retry automático reinicia;
          // a página mostra a explicação própria.
          refusedCodeRef.current = code;
          setTrainingRefused(true);
          return false;
        }
        if (!staleTransport) {
          setError(response.error.message);
        }
        return false;
      }
      if (staleTransport) return false;
      resetRoomState(code);
      saveIdentity(code, {
        playerId: response.playerId,
        credential: response.credential,
        nickname,
        avatar,
      });
      return true;
    },
    [ensureSocket, resetRoomState],
  );

  const runSimple = useCallback(
    async (event: string, payload: Record<string, unknown>): Promise<AckEnvelope> => {
      // Controles mutáveis da sala só valem com o vínculo autorizado no
      // contexto atual; transporte reconectado não basta.
      if (!chatLinkReadyRef.current) return { ok: false, error: LINK_PENDING_ERROR };
      const response = await emitWithAck<AckEnvelope>(ensureSocket(), event, payload);
      if (!response.ok && response.error !== undefined) setError(response.error.message);
      return response;
    },
    [ensureSocket],
  );

  const setReady = useCallback(
    async (ready: boolean): Promise<void> => {
      await runSimple('client:setReady', { intentId: newIntentId(), ready });
    },
    [runSimple],
  );

  const startRound = useCallback(async (): Promise<void> => {
    await runSimple('client:startRound', { intentId: newIntentId() });
  }, [runSimple]);

  const returnToLobby = useCallback(async (): Promise<void> => {
    await runSimple('client:returnToLobby', { intentId: newIntentId() });
  }, [runSimple]);

  const leaveRoom = useCallback(async (): Promise<boolean> => {
    const code = activeRoomRef.current;
    // Sair exige vínculo confirmado; sem ele o servidor nem sabe desta conexão.
    if (!chatLinkReadyRef.current) return false;
    const response = await emitWithAck<AckEnvelope>(ensureSocket(), 'client:leaveRoom', { intentId: newIntentId() });
    if (!response.ok) {
      if (response.error !== undefined) setError(response.error.message);
      return false;
    }
    if (code !== null) leavingRef.current = { code, until: Date.now() + 2000 };
    clearRoomState();
    return true;
  }, [clearRoomState, ensureSocket]);

  const substituteAbsent = useCallback(
    (targetId: string): Promise<AckEnvelope> => runSimple('client:substituteAbsent', { intentId: newIntentId(), targetId }),
    [runSimple],
  );

  const continueRound = useCallback(
    (): Promise<AckEnvelope> => runSimple('client:continueRound', { intentId: newIntentId() }),
    [runSimple],
  );

  const endRoundWithoutWinner = useCallback(
    (): Promise<AckEnvelope> => runSimple('client:endRoundWithoutWinner', { intentId: newIntentId() }),
    [runSimple],
  );

  const removeParticipant = useCallback(
    (targetId: string): Promise<AckEnvelope> => runSimple('client:removeParticipant', { intentId: newIntentId(), targetId }),
    [runSimple],
  );

  const sendCommand = useCallback(
    async (command: ClientCommand): Promise<CommandAck> => {
      // Sem vínculo autorizado confirmado o comando não é emitido: um estado
      // antigo retido na tela não autoriza envio. `LINK_PENDING` é um código
      // local do cliente (não existe no protocolo do servidor).
      if (!chatLinkReadyRef.current) return { ok: false, error: LINK_PENDING_ERROR } as CommandAck;
      const roundId = state?.room.roundId ?? null;
      if (roundId === null) {
        return { ok: false, error: { code: 'STALE_ROUND', message: 'Nenhuma rodada em andamento.' } };
      }
      const response = await emitWithAck<CommandAck>(ensureSocket(), 'client:command', {
        intentId: newIntentId(),
        roundId,
        command,
      });
      if (!response.ok) setError(response.error.message);
      return response;
    },
    [ensureSocket, state?.room.roundId],
  );

  const loadChatHistory = useCallback(
    async (before?: number): Promise<Ack<ChatHistoryAck>> => {
      const code = activeRoomRef.current;
      if (code === null) {
        return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Você não está em uma sala.' } };
      }
      const generation = chatLinkRef.current;
      setChatHistoryLoading(true);
      const response = await emitWithAck<Ack<ChatHistoryAck>>(ensureSocket(), 'client:chatHistory', {
        roomCode: code,
        ...(before === undefined ? {} : { before }),
        limit: CHAT_HISTORY_PAGE_SIZE,
      });
      // O vínculo mudou durante a consulta: a resposta não toca mensagens,
      // paginação nem o indicador de carregamento do contexto novo.
      if (generation !== chatLinkRef.current) {
        return {
          ok: false,
          error: { code: 'STALE_CONTEXT', message: 'A sala mudou durante a consulta; tente de novo.' },
        } as unknown as Ack<ChatHistoryAck>;
      }
      setChatHistoryLoading(false);
      if (response.ok) {
        setChatMessages((previous) => mergeMessages(previous, response.messages));
      }
      return response;
    },
    [ensureSocket],
  );

  const sendChat = useCallback(
    async (text: string): Promise<AckEnvelope> => {
      const code = activeRoomRef.current;
      if (code === null) {
        return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Você não está em uma sala.' } };
      }
      // Vínculo autorizado não confirmado (reentrada pendente, falha ou perda
      // de conexão): a chamada não emite; o servidor não é consultado.
      if (!chatLinkReadyRef.current) return { ok: false, error: LINK_PENDING_ERROR };
      const generation = chatLinkRef.current;
      const response = await emitWithAck<Ack<ChatSendAck>>(ensureSocket(), 'client:chatSend', {
        intentId: newIntentId(),
        roomCode: code,
        text,
      });
      // Ack antigo de outro vínculo não mescla mensagem nem autoriza limpar o
      // rascunho do contexto atual.
      if (generation !== chatLinkRef.current) {
        return {
          ok: false,
          error: { code: 'STALE_CONTEXT', message: 'A sala mudou antes da confirmação; envie de novo.' },
        };
      }
      if (!response.ok) return { ok: false, error: response.error };
      // O ack traz a mensagem aceita; o broadcast chega em seguida e a mesclagem
      // por seq evita duplicata. Replay devolve ack idêntico sem nova cópia.
      setChatMessages((previous) => mergeMessages(previous, [response.message]));
      return { ok: true };
    },
    [ensureSocket],
  );

  const sendReaction = useCallback(
    async (type: ReactionType): Promise<AckEnvelope> => {
      const code = activeRoomRef.current;
      if (code === null) {
        return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Você não está em uma sala.' } };
      }
      if (!chatLinkReadyRef.current) return { ok: false, error: LINK_PENDING_ERROR };
      if (moodPendingRef.current) return { ok: false, error: MOOD_PENDING_ERROR };
      const token = ++moodPendingTokenRef.current;
      moodPendingRef.current = true;
      setMoodPending(true);
      const generation = chatLinkRef.current;
      try {
        const response = await emitWithAck<Ack<ReactionSendAck>>(ensureSocket(), 'client:reactionSend', {
          intentId: newIntentId(),
          roomCode: code,
          type,
        });
        const linkChanged = generation !== chatLinkRef.current;
        const superseded = linkChanged || moodPendingTokenRef.current !== token;
        if (!response.ok) {
          if (!linkChanged) moodTrackerRef.current.noteRetry('reaction', response.error.retry);
          if (superseded) {
            return {
              ok: false,
              error: { code: 'STALE_CONTEXT', message: 'A sala mudou antes da confirmação; o envio foi descartado.' },
            };
          }
          return { ok: false, error: response.error };
        }
        if (!linkChanged) moodTrackerRef.current.noteSender('reaction', response.limits);
        // Contexto invalidado limpa reações/feedback; a conclusão antiga não os
        // restaura (os limites autoritativos já foram anotados acima).
        if (superseded) {
          return {
            ok: false,
            error: { code: 'STALE_CONTEXT', message: 'A sala mudou antes da confirmação; o envio foi descartado.' },
          };
        }
        // Ack e broadcast compartilham o id; a apresentação deduplica por id.
        presentReaction(response.reaction);
        // Confirmação textual vale também com reações ocultas.
        showMoodFeedback(reactionFeedback(type));
        return { ok: true, limits: response.limits };
      } finally {
        if (moodPendingTokenRef.current === token) {
          moodPendingRef.current = false;
          setMoodPending(false);
        }
      }
    },
    [ensureSocket, presentReaction, showMoodFeedback],
  );

  const muteAuthor = useCallback((playerId: string): void => {
    const code = activeRoomRef.current;
    if (code === null) return;
    setMutedPlayerIds((previous) => {
      if (previous.includes(playerId)) return previous;
      const next = [...previous, playerId];
      saveMuted(code, next);
      return next;
    });
  }, []);

  const unmuteAuthor = useCallback((playerId: string): void => {
    const code = activeRoomRef.current;
    if (code === null) return;
    setMutedPlayerIds((previous) => {
      if (!previous.includes(playerId)) return previous;
      const next = previous.filter((entry) => entry !== playerId);
      saveMuted(code, next);
      return next;
    });
  }, []);

  const setPreferences = useCallback((patch: Partial<MoodPreferences>) => {
    const next: MoodPreferences = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferencesState(next);
    savePreferences(next);
  }, []);

  const chatFrontier = useMemo(() => chatHistoryFrontierOf(chatMessages), [chatMessages]);

  const activeAnimations = effectiveAnimations(preferences.animations, systemReduced);

  const interactive = connection === 'live' && chatLinkReady;

  const value = useMemo<RoomContextValue>(
    () => ({
      state,
      events,
      error,
      busy,
      connection,
      reconnectedAt,
      removedMessage,
      roomGone,
      trainingRefused,
      createRoom,
      joinRoom,
      rejoin: startRecovery,
      retryRecovery,
      cancelRecovery,
      recoveryPhase,
      setReady,
      startRound,
      returnToLobby,
      leaveRoom,
      substituteAbsent,
      continueRound,
      endRoundWithoutWinner,
      removeParticipant,
      sendCommand,
      loadChatHistory,
      sendChat,
      sendReaction,
      activeReactions,
      reactionAnnouncement,
      moodMenu,
      openReactionMenu,
      closeMoodMenu,
      isMoodMenuCurrent,
      moodFeedback,
      moodPending,
      moodRemaining,
      activePresentation,
      preferences,
      preferencesReady,
      activeAnimations,
      setPreferences,
      chatMessages,
      chatHasMore: chatFrontier !== null,
      chatHistoryFrontier: chatFrontier,
      chatHistoryLoading,
      chatLinkEpoch,
      chatLinkReady,
      interactive,
      mutedPlayerIds,
      muteAuthor,
      unmuteAuthor,
      clearError: () => setError(null),
      clearRemoved: () => setRemovedMessage(null),
    }),
    [
      state,
      events,
      error,
      busy,
      connection,
      reconnectedAt,
      removedMessage,
      roomGone,
      trainingRefused,
      createRoom,
      joinRoom,
      startRecovery,
      retryRecovery,
      cancelRecovery,
      recoveryPhase,
      setReady,
      startRound,
      returnToLobby,
      leaveRoom,
      substituteAbsent,
      continueRound,
      endRoundWithoutWinner,
      removeParticipant,
      sendCommand,
      loadChatHistory,
      sendChat,
      sendReaction,
      activeReactions,
      reactionAnnouncement,
      moodMenu,
      openReactionMenu,
      closeMoodMenu,
      isMoodMenuCurrent,
      moodFeedback,
      moodPending,
      moodRemaining,
      activePresentation,
      preferences,
      preferencesReady,
      activeAnimations,
      setPreferences,
      chatMessages,
      chatFrontier,
      chatHistoryLoading,
      chatLinkEpoch,
      chatLinkReady,
      interactive,
      mutedPlayerIds,
      muteAuthor,
      unmuteAuthor,
    ],
  );

  return (
    <RoomContext.Provider value={value}>
      <TurnNotifier
        state={state}
        events={events}
        connection={connection}
        chatLinkReady={chatLinkReady}
        preferencesReady={preferencesReady}
        preferences={preferences}
      />
      {children}
    </RoomContext.Provider>
  );
}

declare global {
  interface Window {
    __trettaTest?: {
      setNextDeck: (deck: string[]) => Promise<SimpleAck>;
      setEffectVariant: (variant: EffectVariant | null) => Promise<SimpleAck>;
      disconnect: () => void;
      connect: () => void;
    };
  }
}
