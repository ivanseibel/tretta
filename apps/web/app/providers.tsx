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
  RemovedMessage,
  SimpleAck,
  StateMessage,
  TauntEvent,
  TauntSendAck,
  TauntType,
} from '@tretta/protocol';
import { CHAT_HISTORY_PAGE_SIZE, type Avatar } from '@tretta/protocol/shared';
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
import { playEffectSound, playTauntSound, setSoundMuted, stopAllSounds } from '@/lib/sounds';

export type RejoinResult = 'ok' | 'not-found' | 'invalid' | 'already' | 'none' | 'error' | 'offline';
export type ConnectionState = 'live' | 'lost';

export interface RoomContextValue {
  state: StateMessage | null;
  events: EventsMessage[];
  error: string | null;
  busy: boolean;
  connection: ConnectionState;
  reconnectedAt: number | null;
  removedMessage: string | null;
  roomGone: boolean;
  createRoom: (nickname: string, avatar: Avatar) => Promise<string | null>;
  joinRoom: (code: string, nickname: string, avatar: Avatar) => Promise<boolean>;
  rejoin: (code: string) => Promise<RejoinResult>;
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
   * Provocação manual compartilhada; mesmo gate do chat (vínculo confirmado)
   * e mesma disciplina de geração. O servidor autoriza e limita; o cliente só
   * apresenta o evento aceito uma vez (ack e broadcast compartilham o id).
   */
  sendTaunt: (type: TauntType, targetId: string) => Promise<AckEnvelope>;
  /**
   * Item em apresentação na fila serial única (efeito automático ou
   * provocação); `null` quando ociosa. Um por vez, na ordem de chegada —
   * a fila nunca sobrepõe efeitos maiores.
   */
  activePresentation: Presentation | null;
  /** Preferências de apresentação deste navegador; individuais, sem conta. */
  preferences: MoodPreferences;
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
  mutedPlayerIds: readonly string[];
  muteAuthor: (playerId: string) => void;
  unmuteAuthor: (playerId: string) => void;
  clearError: () => void;
  clearRemoved: () => void;
}

interface AckEnvelope {
  ok: boolean;
  error?: { code: string; message: string };
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatLinkEpoch, setChatLinkEpoch] = useState(0);
  const [chatLinkReady, setChatLinkReadyState] = useState(false);
  const [activePresentation, setActivePresentation] = useState<Presentation | null>(null);
  const [preferences, setPreferencesState] = useState<MoodPreferences>(DEFAULT_PREFERENCES);
  const [systemReduced, setSystemReduced] = useState(false);
  const [mutedPlayerIds, setMutedPlayerIds] = useState<readonly string[]>([]);
  const socketRef = useRef<RoomSocket | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const lastRoomRef = useRef<string | null>(null);
  const lastChatRoomRef = useRef<string | null>(null);
  const lastVersionRef = useRef(-1);
  const hadDisconnectRef = useRef(false);
  const recoveredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Geração do vínculo sala/identidade: cada limpeza ou novo vínculo autorizado
  // avança o contador e respostas assíncronas antigas deixam de ter efeito.
  const chatLinkRef = useRef(0);
  // Disponibilidade do vínculo autorizado: espelho em ref para o envio decidir
  // sem re-render e sem capturar estado desatualizado no callback.
  const chatLinkReadyRef = useRef(false);
  // Provocações já apresentadas nesta sala nesta aba: ack e broadcast
  // compartilham o id; replays antigos nunca reapresentam o efeito. A
  // proteção sobrevive à recuperação do vínculo da mesma sala e só morre na
  // troca/saída/remoção — o servidor nunca retransmite efeitos antigos, então
  // um reload zera a memória local sem risco de reapresentação.
  const seenTauntIdsRef = useRef<Set<string>>(new Set());
  // Efeitos automáticos: proteção por id até a troca/saída/remoção da sala,
  // como as provocações; replay do mesmo lote não apresenta nem toca duas vezes.
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

  /** Janela do item entrando agora, pelo modo efetivo no instante da entrada. */
  const durationFor = useCallback((kind: 'effect' | 'taunt'): number => {
    const mode = effectiveAnimations(preferencesRef.current.animations, systemReducedRef.current);
    return PRESENTATION_DURATIONS[kind][mode];
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
            if (item.kind === 'taunt') playTauntSound(item.taunt.type);
            else playEffectSound(item.effect);
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

  /** Provocação entra na fila uma vez por id; ocultar descarta sem som. */
  const presentTaunt = useCallback(
    (taunt: TauntEvent) => {
      if (seenTauntIdsRef.current.has(taunt.id)) return;
      seenTauntIdsRef.current.add(taunt.id);
      if (preferencesRef.current.hideTaunts) return;
      getQueue().enqueue({ kind: 'taunt', id: taunt.id, durationMs: durationFor('taunt'), taunt });
    },
    [durationFor, getQueue],
  );

  /** Efeito autoritativo entra uma vez por id, na ordem do lote recebido. */
  const presentEffect = useCallback(
    (effect: AutomaticEffect) => {
      if (seenEffectIdsRef.current.has(effect.id)) return;
      seenEffectIdsRef.current.add(effect.id);
      getQueue().enqueue({
        kind: 'effect',
        id: effect.id,
        durationMs: durationFor('effect'),
        effect,
      });
    },
    [durationFor, getQueue],
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

  const clearRoomState = useCallback(() => {
    activeRoomRef.current = null;
    lastRoomRef.current = null;
    lastVersionRef.current = -1;
    lastChatRoomRef.current = null;
    seenTauntIdsRef.current.clear();
    seenEffectIdsRef.current.clear();
    lastRoundRef.current = null;
    bumpChatLink();
    stopAllSounds();
    setChatLinkReady(false);
    setState(null);
    setEvents([]);
    setChatMessages([]);
    setChatHistoryLoading(false);
    setMutedPlayerIds([]);
  }, [bumpChatLink, setChatLinkReady]);

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
    socket.on('server:taunt', (message) => {
      if (message.roomCode !== lastRoomRef.current) return;
      presentTaunt(message.taunt);
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
      setConnection('lost');
      // Conexão caiu: o vínculo autorizado deixa de valer até nova confirmação.
      setChatLinkReady(false);
    });
    socket.on('connect', () => {
      setConnection('live');
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
  }, [cancelPresentations, clearRoomState, presentEffect, presentTaunt, setChatLinkReady]);

  const resetRoomState = useCallback((code: string) => {
    const previousRoom = lastRoomRef.current;
    activeRoomRef.current = code;
    lastRoomRef.current = code;
    lastVersionRef.current = -1;
    // Reentrada na mesma sala preserva os ids apresentados (replay não
    // reapresenta); troca de sala descarta a proteção da sala anterior.
    if (previousRoom !== code) {
      seenTauntIdsRef.current.clear();
      seenEffectIdsRef.current.clear();
    }
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
  }, [bumpChatLink, setChatLinkReady]);

  const waitForConnection = useCallback(
    (timeoutMs = 8000): Promise<boolean> => {
      const socket = ensureSocket();
      if (socket.connected) return Promise.resolve(true);
      // Numa carga de página o socket ainda está conectando: espera em vez de falhar.
      return new Promise((resolve) => {
        const onConnect = (): void => {
          clearTimeout(timer);
          resolve(true);
        };
        const timer = setTimeout(() => {
          socket.off('connect', onConnect);
          resolve(false);
        }, timeoutMs);
        socket.once('connect', onConnect);
      });
    },
    [ensureSocket],
  );

  const rejoinInternal = useCallback(
    async (code: string): Promise<RejoinResult> => {
      const leaving = leavingRef.current;
      if (leaving !== null && leaving.code === code && Date.now() < leaving.until) return 'none';
      const identity = loadIdentity(code);
      if (identity === null) {
        clearRoomState();
        return 'none';
      }
      if (!(await waitForConnection())) return 'offline';
      const socket = ensureSocket();
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await emitWithAck<Ack<JoinRoomAck>>(socket, 'client:joinRoom', {
          intentId: newIntentId(),
          roomCode: code,
          nickname: identity.nickname,
          avatar: identity.avatar,
          credential: identity.credential,
        });
        if (response.ok) {
          resetRoomState(code);
          saveIdentity(code, { ...identity, playerId: response.playerId, credential: response.credential });
          return 'ok';
        }
        if (response.error.code === 'ALREADY_CONNECTED' && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }
        if (response.error.code === 'CREDENTIAL_INVALID') {
          clearIdentity(code);
          clearRoomState();
          return 'invalid';
        }
        if (response.error.code === 'ROOM_NOT_FOUND') {
          clearRoomState();
          setRoomGone(true);
          return 'not-found';
        }
        if (response.error.code === 'ALREADY_CONNECTED') {
          setError('Esta identidade já está conectada em outra aba ou dispositivo.');
          return 'already';
        }
        setError(response.error.message);
        return 'error';
      }
      return 'error';
    },
    [clearRoomState, ensureSocket, resetRoomState, waitForConnection],
  );
  const rejoinRef = useRef(rejoinInternal);
  rejoinRef.current = rejoinInternal;

  useEffect(() => {
    ensureSocket();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (recoveredTimerRef.current !== null) clearTimeout(recoveredTimerRef.current);
      // Desmontagem: fila, timers e áudio da sala não sobrevivem.
      getQueue().cancelAll();
      stopAllSounds();
    };
  }, [ensureSocket, getQueue]);

  // Preferências persistidas + mídia do sistema (mudanças ao vivo são
  // consideradas; "completa" é limitada a "reduced" enquanto a mídia valer).
  useEffect(() => {
    const stored = loadPreferences();
    preferencesRef.current = stored;
    setPreferencesState(stored);
    return watchSystemReducedMotion((reduced) => {
      systemReducedRef.current = reduced;
      setSystemReduced(reduced);
    });
  }, []);

  // Silenciar corta o som em andamento e impede os seguintes.
  useEffect(() => {
    setSoundMuted(preferences.soundMuted);
  }, [preferences.soundMuted]);

  // Ocultar descarta provocações na fila e a ativa; reativar não despeja as
  // suprimidas (elas nunca entraram na fila nem tocaram som).
  useEffect(() => {
    if (!preferences.hideTaunts) return;
    const queue = getQueue();
    // Corte o som enquanto a provocação ainda é ativa, antes de avançar para
    // um automático que pode começar a tocar neste mesmo ciclo.
    if (queue.active?.kind === 'taunt') stopAllSounds();
    queue.remove((item) => item.kind === 'taunt');
  }, [getQueue, preferences.hideTaunts]);

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
    async (nickname: string, avatar: Avatar): Promise<string | null> => {
      setBusy(true);
      const response = await emitWithAck<Ack<CreateRoomAck>>(ensureSocket(), 'client:createRoom', {
        intentId: newIntentId(),
        nickname,
        avatar,
      });
      setBusy(false);
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
      setBusy(true);
      const response = await emitWithAck<Ack<JoinRoomAck>>(ensureSocket(), 'client:joinRoom', {
        intentId: newIntentId(),
        roomCode: code,
        nickname,
        avatar,
      });
      setBusy(false);
      if (!response.ok) {
        setError(response.error.message);
        return false;
      }
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

  const sendTaunt = useCallback(
    async (type: TauntType, targetId: string): Promise<AckEnvelope> => {
      const code = activeRoomRef.current;
      if (code === null) {
        return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Você não está em uma sala.' } };
      }
      // Mesmo gate do chat: sem vínculo autorizado confirmado não emite.
      if (!chatLinkReadyRef.current) return { ok: false, error: LINK_PENDING_ERROR };
      const generation = chatLinkRef.current;
      const response = await emitWithAck<Ack<TauntSendAck>>(ensureSocket(), 'client:tauntSend', {
        intentId: newIntentId(),
        roomCode: code,
        type,
        targetId,
      });
      if (generation !== chatLinkRef.current) {
        return {
          ok: false,
          error: { code: 'STALE_CONTEXT', message: 'A sala mudou antes da confirmação; envie de novo.' },
        };
      }
      if (!response.ok) return { ok: false, error: response.error };
      // Ack e broadcast chegam com o mesmo id; a apresentação deduplica.
      presentTaunt(response.taunt);
      return { ok: true };
    },
    [ensureSocket, presentTaunt],
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
      createRoom,
      joinRoom,
      rejoin: rejoinInternal,
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
      sendTaunt,
      activePresentation,
      preferences,
      activeAnimations,
      setPreferences,
      chatMessages,
      chatHasMore: chatFrontier !== null,
      chatHistoryFrontier: chatFrontier,
      chatHistoryLoading,
      chatLinkEpoch,
      chatLinkReady,
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
      createRoom,
      joinRoom,
      rejoinInternal,
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
      sendTaunt,
      activePresentation,
      preferences,
      activeAnimations,
      setPreferences,
      chatMessages,
      chatFrontier,
      chatHistoryLoading,
      chatLinkEpoch,
      chatLinkReady,
      mutedPlayerIds,
      muteAuthor,
      unmuteAuthor,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
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
