import {
  applyCommand,
  createClassicDeck,
  createRoundState,
  dealRound,
  MAX_PLAYERS,
  MIN_PLAYERS,
  projectForPlayer,
  projectPublicTable,
  startRound,
  type Card,
  type PublicTableView,
  type RandomSource,
  type RoundCommand,
  type RoundEvent,
  type RoundState,
} from '@tretta/rules';
import type {
  AbsentParticipant,
  Avatar,
  ChatBroadcast,
  ChatMessage,
  ClientCommand,
  ErrorCode,
  EventsMessage,
  EffectVariant,
  LastRoundSummary,
  ParticipantKind,
  PauseInfo,
  PublicParticipant,
  ReactionBroadcast,
  ReactionEvent,
  ReactionType,
  RemovedMessage,
  RetryInfo,
  RoomMode,
  RoomSnapshot,
  RoomStatus,
  ScoreboardEntry,
  SelfSnapshot,
  SendLimitInfo,
  StateMessage,
} from '@tretta/protocol';
import {
  AVATARS,
  chatCodePointLength,
  CHAT_HISTORY_PAGE_SIZE,
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_WINDOW_MS,
  EFFECT_VARIANTS,
  REACTION_SENDER_COOLDOWN_MS,
  ROOM_CAPACITY,
} from '@tretta/protocol/shared';
import { decideBotCommand } from './bot.js';
import { systemClock, type RoomClock, type TimerHandle } from './clock.js';
import { deriveAutomaticEffects } from './effects.js';
import {
  createBotId,
  createCredential,
  createEffectId,
  createPlayerId,
  createReactionId,
  createRoomCode,
  createRoundId,
} from './ids.js';

export const DEFAULT_PAUSE_GRACE_MS = 90_000;
export const DEFAULT_RETENTION_MS = 15 * 60_000;
export const DEFAULT_BOT_DELAY_MS = 700;

/**
 * Bots fixos da mesa de treino: três identidades distinguíveis, sempre prontas,
 * que jogam sozinhas com a política existente do substituto automático.
 */
const TRAINING_BOT_NICKNAMES = ['Tico', 'Lila', 'Nino'] as const;

export interface ServerErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
  /** Espera estruturada de recusas por limite de humor (intervalo/cota). */
  readonly retry?: RetryInfo;
}

export type RoomResult<T> = ({ readonly ok: true } & T) | { readonly ok: false; readonly error: ServerErrorBody };

export interface RoomTransport {
  toSocket: (socketId: string, message: StateMessage) => void;
  toRoom: (roomCode: string, message: EventsMessage) => void;
  /** Broadcast do chat na sala; canal separado da versão de jogo. */
  toRoomChat: (roomCode: string, message: ChatBroadcast) => void;
  /** Broadcast de reação transitória; mesma sala, sem alterar versão. */
  toRoomReaction: (roomCode: string, message: ReactionBroadcast) => void;
  /**
   * Associa a conexão ao canal da sala. Só é chamado como efeito da execução
   * autorizada de criação/entrada; replays memorizados nunca repetem o vínculo.
   */
  attach: (socketId: string, roomCode: string) => void;
  /** Desfaz o vínculo de transporte da conexão com a sala (sem notificar o cliente). */
  detach: (socketId: string, roomCode: string) => void;
  /** Desfaz o vínculo e avisa o cliente removido pelo anfitrião. */
  removed: (socketId: string, message: RemovedMessage) => void;
}

export interface Participant {
  readonly id: string;
  /** Pessoa real ou bot fixo da mesa de treino. */
  readonly kind: ParticipantKind;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly credential: string;
  readonly joinedAt: number;
  readonly roomCode: string;
  ready: boolean;
  connected: boolean;
  socketId: string | null;
  /** Início da conexão atual; null quando desconectado. Usado na transferência de anfitrião. */
  connectedSince: number | null;
  /** Vaga sob controle de substituto automático na rodada atual. */
  autoControlled: boolean;
  /** Início da ausência na rodada atual (desconectado, sem substituto ativo). */
  absentSince: number | null;
  /** Instantes (relógio da sala) dos envios de chat aceitos na janela móvel. */
  readonly chatSentAts: number[];
  /** Instante da última reação aceita desta identidade; janela de 5s do emissor. */
  reactionLastSentAt: number | null;
  readonly intents: Map<string, IntentEntry>;
}

/**
 * Histórico de vitórias da sala, independente da ocupação de vaga. Entradas
 * históricas não participam de capacidade, prontidão, controle ou autorização;
 * são descartadas quando a sala expira ou o servidor reinicia.
 */
export interface ScoreEntry {
  kind: ParticipantKind;
  nickname: string;
  avatar: Avatar;
  wins: number;
}

export interface IntentEntry {
  /** Assinatura da intenção: tipo de operação/evento mais payload validado. */
  readonly signature: string;
  readonly response: RoomResult<unknown>;
}

export interface RoundInfo {
  readonly id: string;
  readonly number: number;
  readonly seatIds: readonly string[];
  state: RoundState;
  scored: boolean;
}

export interface Room {
  readonly code: string;
  /** `classic` (padrão) ou `training`; decide bots fixos e recusa de entradas. */
  readonly mode: RoomMode;
  hostId: string;
  readonly order: string[];
  readonly participants: Map<string, Participant>;
  readonly random: RandomSource;
  status: RoomStatus;
  roundNumber: number;
  round: RoundInfo | null;
  version: number;
  nextDeck: Card[] | null;
  lastRound: LastRoundSummary | null;
  /**
   * Verdadeiro desde que a sala ficou sem pessoas conectadas até o anfitrião
   * continuar (ou a rodada terminar). Mantém a rodada pausada mesmo que todas
   * as ausências individuais já estejam resolvidas.
   */
  retentionHold: boolean;
  /** Instante em que a sala vazia expira; null quando há pessoas conectadas. */
  retainedUntil: number | null;
  retentionToken: number;
  retentionTimer: TimerHandle | null;
  /** Placar histórico da sala, por id de jogador (identidades distintas nunca se fundem). */
  readonly history: Map<string, ScoreEntry>;
  /**
   * Chat da sala em ordem de `seq`, com autoria congelada no aceite. Vive junto
   * com a sala: retenção preserva, expiração/reinício elimina.
   */
  readonly chatMessages: ChatMessage[];
  /** Próximo `seq` do chat; monotônico por sala. */
  chatNextSeq: number;
  /** Próximo número da reação; só ordena, não vira histórico. */
  reactionNextSeq: number;
  /**
   * RNG cosmético dos efeitos automáticos, separado do `random` de regras:
   * a mesma semente de jogo com outra variação mantém o resultado idêntico.
   */
  readonly effectRandom: RandomSource;
  /** Próximo `seq` de efeito desta sala; monotônico por sala, só ordena. */
  effectNextSeq: number;
  /** Ganchos de teste: variação fixa desta sala; null deixa o RNG escolher. */
  effectVariantOverride: EffectVariant | null;
  botTimer: TimerHandle | null;
  /** Versão da sala no agendamento do timer atual; estado diferente cancela a ação. */
  botTimerVersion: number;
  /** Geração monotônica do agendamento; callbacks antigos nunca alteram o timer atual. */
  botGeneration: number;
}

export interface CreateRoomParams {
  readonly socketId: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  /** Ausente equivale a `classic`; `training` cria a mesa com três bots fixos. */
  readonly mode?: RoomMode | undefined;
}

export interface JoinRoomParams {
  readonly socketId: string;
  readonly roomCode: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly credential?: string | undefined;
}

export interface WinnerInfo {
  readonly playerId: string;
  readonly nickname: string;
  readonly substitute: boolean;
  readonly kind: ParticipantKind;
}

export interface RoomStoreOptions {
  readonly clock?: RoomClock;
  readonly pauseGraceMs?: number;
  readonly retentionMs?: number;
  readonly botDelayMs?: number;
  /** Intervalo do emissor de reação; só encurta em testes, nunca alonga a regra. */
  readonly reactionCooldownMs?: number;
  /**
   * Fábrica do RNG cosmético dos efeitos automáticos. Padrão: Math.random,
   * independente do `randomFactory` de regras (misturar os dois acopla
   * apresentação ao resultado do jogo).
   */
  readonly effectRandomFactory?: () => RandomSource;
}

export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly participantsById = new Map<string, Participant>();
  private readonly participantsBySocket = new Map<string, string>();
  private readonly socketIntents = new Map<string, Map<string, IntentEntry>>();
  private readonly clock: RoomClock;
  private readonly pauseGraceMs: number;
  private readonly retentionMs: number;
  private readonly botDelayMs: number;
  private readonly reactionCooldownMs: number;
  private readonly effectRandomFactory: () => RandomSource;

  constructor(
    private readonly transport: RoomTransport,
    private readonly randomFactory: () => RandomSource,
    options: RoomStoreOptions = {},
  ) {
    this.clock = options.clock ?? systemClock;
    this.pauseGraceMs = options.pauseGraceMs ?? DEFAULT_PAUSE_GRACE_MS;
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
    this.botDelayMs = options.botDelayMs ?? DEFAULT_BOT_DELAY_MS;
    this.reactionCooldownMs = options.reactionCooldownMs ?? REACTION_SENDER_COOLDOWN_MS;
    this.effectRandomFactory = options.effectRandomFactory ?? ((): RandomSource => Math.random);
  }

  createRoom(params: CreateRoomParams): RoomResult<{ room: Room; participant: Participant }> {
    if (this.participantsBySocket.has(params.socketId)) {
      return reject('ALREADY_IN_ROOM', 'Esta conexão já está em uma sala.');
    }
    const code = createRoomCode((candidate) => this.rooms.has(candidate));
    const now = this.clock.now();
    const participant: Participant = {
      id: createPlayerId(),
      kind: 'human',
      nickname: params.nickname,
      avatar: params.avatar,
      credential: createCredential(),
      joinedAt: now,
      roomCode: code,
      ready: false,
      connected: true,
      socketId: params.socketId,
      connectedSince: now,
      autoControlled: false,
      absentSince: null,
      chatSentAts: [],
      reactionLastSentAt: null,
      intents: new Map(),
    };
    const room: Room = {
      code,
      mode: params.mode ?? 'classic',
      hostId: participant.id,
      order: [participant.id],
      participants: new Map([[participant.id, participant]]),
      random: this.randomFactory(),
      status: 'lobby',
      roundNumber: 0,
      round: null,
      version: 0,
      nextDeck: null,
      lastRound: null,
      retentionHold: false,
      retainedUntil: null,
      retentionToken: 0,
      retentionTimer: null,
      history: new Map([
        [participant.id, { kind: 'human', nickname: participant.nickname, avatar: participant.avatar, wins: 0 }],
      ]),
      chatMessages: [],
      chatNextSeq: 1,
      reactionNextSeq: 1,
      effectRandom: this.effectRandomFactory(),
      effectNextSeq: 1,
      effectVariantOverride: null,
      botTimer: null,
      botTimerVersion: -1,
      botGeneration: 0,
    };
    this.rooms.set(code, room);
    this.participantsById.set(participant.id, participant);
    this.participantsBySocket.set(params.socketId, participant.id);
    if (room.mode === 'training') this.addTrainingBots(room, participant.avatar, now);
    // Associação de transporte é efeito da execução autorizada; replays não a repetem.
    this.transport.attach(params.socketId, room.code);
    this.bump(room);
    this.broadcastState(room);
    return { ok: true, room, participant };
  }

  /**
   * Cria os três bots fixos do treino: ids estáveis derivados do código da sala,
   * prontos desde a preparação, sem socket. Avatares são os primeiros da lista
   * que não colidem com o da pessoa; apelidos fixos e distinguíveis.
   */
  private addTrainingBots(room: Room, humanAvatar: Avatar, now: number): void {
    const avatars = AVATARS.filter((avatar) => avatar !== humanAvatar).slice(0, TRAINING_BOT_NICKNAMES.length);
    TRAINING_BOT_NICKNAMES.forEach((nickname, index) => {
      const avatar = avatars[index];
      // Impossível na prática: a lista de avatares tem 8 e o treino usa 3.
      if (avatar === undefined) return;
      const bot: Participant = {
        id: createBotId(room.code, index + 1),
        kind: 'bot',
        nickname,
        avatar,
        // Nunca exposta: identificação por credencial de bot é recusada na entrada.
        credential: createCredential(),
        joinedAt: now,
        roomCode: room.code,
        ready: true,
        connected: false,
        socketId: null,
        connectedSince: null,
        autoControlled: false,
        absentSince: null,
        chatSentAts: [],
        reactionLastSentAt: null,
        intents: new Map(),
      };
      room.participants.set(bot.id, bot);
      room.order.push(bot.id);
      room.history.set(bot.id, { kind: 'bot', nickname: bot.nickname, avatar: bot.avatar, wins: 0 });
      this.participantsById.set(bot.id, bot);
    });
  }

  joinRoom(params: JoinRoomParams): RoomResult<{ room: Room; participant: Participant; rejoined: boolean }> {
    if (this.participantsBySocket.has(params.socketId)) {
      return reject('ALREADY_IN_ROOM', 'Esta conexão já está em uma sala.');
    }
    const room = this.rooms.get(params.roomCode);
    if (room === undefined) {
      return reject('ROOM_NOT_FOUND', 'Sala não encontrada. Confira o link ou o código.');
    }

    if (params.credential !== undefined) {
      const existing = this.findByCredential(room, params.credential);
      if (existing === undefined) {
        if (room.mode === 'training') {
          return reject(
            'TRAINING_ROOM_ENTRY_REFUSED',
            'Esta mesa de treino é individual: retorne com a credencial original da pessoa dona.',
          );
        }
        return reject('CREDENTIAL_INVALID', 'Credencial inválida para esta sala. Entre como novo participante.');
      }
      if (existing.kind === 'bot') {
        return reject('TRAINING_ROOM_ENTRY_REFUSED', 'Os bots da mesa de treino não são identidades recuperáveis.');
      }
      if (existing.connected) {
        return reject('ALREADY_CONNECTED', 'Esta identidade já está conectada em outro dispositivo.');
      }
      const now = this.clock.now();
      existing.socketId = params.socketId;
      existing.connected = true;
      existing.connectedSince = now;
      // Retorno cancela a expiração daquela ausência total; nova ausência total
      // inicia um período novo mais tarde.
      this.cancelRetention(room);
      if (room.round !== null && room.round.seatIds.includes(existing.id)) {
        // Devolve o controle da mesma mão ao humano e invalida ações automáticas pendentes.
        existing.autoControlled = false;
        existing.absentSince = null;
      }
      this.participantsBySocket.set(params.socketId, existing.id);
      this.ensureHost(room);
      this.transport.attach(params.socketId, room.code);
      this.bump(room);
      this.syncPause(room);
      this.syncBot(room);
      this.broadcastState(room);
      return { ok: true, room, participant: existing, rejoined: true };
    }

    if (room.mode === 'training') {
      return reject('TRAINING_ROOM_ENTRY_REFUSED', 'Esta mesa de treino é individual; outras pessoas não entram.');
    }

    if (room.participants.size >= ROOM_CAPACITY) {
      return reject('ROOM_FULL', `Sala cheia: o limite é de ${ROOM_CAPACITY} participantes.`);
    }

    const now = this.clock.now();
    const participant: Participant = {
      id: createPlayerId(),
      kind: 'human',
      nickname: params.nickname,
      avatar: params.avatar,
      credential: createCredential(),
      joinedAt: now,
      roomCode: room.code,
      ready: false,
      connected: true,
      socketId: params.socketId,
      connectedSince: now,
      autoControlled: false,
      absentSince: null,
      chatSentAts: [],
      reactionLastSentAt: null,
      intents: new Map(),
    };
    room.participants.set(participant.id, participant);
    room.order.push(participant.id);
    room.history.set(participant.id, { kind: 'human', nickname: participant.nickname, avatar: participant.avatar, wins: 0 });
    this.participantsById.set(participant.id, participant);
    this.participantsBySocket.set(params.socketId, participant.id);
    this.cancelRetention(room);
    this.ensureHost(room);
    this.transport.attach(params.socketId, room.code);
    this.bump(room);
    // Entrada durante rodada ativa incrementa a versão: o agendamento vigente
    // precisa ser refeito para o substituto não parar na vez.
    this.syncBot(room);
    this.broadcastState(room);
    return { ok: true, room, participant, rejoined: false };
  }

  handleDisconnect(socketId: string): void {
    // O cache por conexão morre com a conexão mesmo que ela nunca tenha criado/entrado
    // em uma sala (ex.: entrada recusada). Os registros por participante têm vida útil
    // própria e continuam servindo à identidade recuperável.
    this.socketIntents.delete(socketId);
    const participant = this.participantOf(socketId);
    if (participant === undefined || participant.socketId !== socketId) return;
    participant.socketId = null;
    participant.connected = false;
    participant.connectedSince = null;
    this.participantsBySocket.delete(socketId);
    const room = this.rooms.get(participant.roomCode);
    if (room === undefined) return;

    const round = room.round;
    if (
      round !== null &&
      round.seatIds.includes(participant.id) &&
      !participant.autoControlled &&
      (room.status === 'playing' || room.status === 'paused') &&
      participant.absentSince === null
    ) {
      // Desconexão de participante da rodada pausa a rodada inteira, mesmo fora da vez.
      participant.absentSince = this.clock.now();
    }
    this.ensureHost(room);
    if (this.connectedCount(room) === 0) this.beginRetention(room);
    this.bump(room);
    this.syncPause(room);
    this.syncBot(room);
    this.broadcastState(room);
  }

  /** Saída explícita. Na rodada, substitui imediatamente; fora dela, libera a vaga. */
  leaveRoom(participant: Participant): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(participant);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    const inRound = room.round !== null && room.round.seatIds.includes(participant.id);
    const roundActive = room.status === 'playing' || room.status === 'paused';

    if (inRound && roundActive) {
      // Mão e vaga preservadas até o fim da rodada; substituto assume sem esperar o prazo.
      participant.autoControlled = true;
      participant.absentSince = null;
      this.severSocket(participant);
      this.ensureHost(room);
      if (this.connectedCount(room) === 0) this.beginRetention(room);
      this.bump(room);
      this.syncPause(room);
      this.syncBot(room);
      this.broadcastState(room);
      return { ok: true, room, version: room.version };
    }

    this.severSocket(participant);
    this.removeParticipantInternal(room, participant.id);
    this.ensureHost(room);
    if (this.connectedCount(room) === 0) this.beginRetention(room);
    this.bump(room);
    this.syncPause(room);
    this.syncBot(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  /** Host ativa o substituto de uma ausência elegível (>= prazo de 90 segundos). */
  substituteAbsent(actor: Participant, targetId: string): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status === 'lobby' || room.status === 'finished') {
      return reject('WRONG_ROOM_STATUS', 'Não há rodada em andamento.');
    }
    if (room.status !== 'paused') {
      return reject('NOT_PAUSED', 'A rodada não está pausada.');
    }
    if (room.hostId !== actor.id) return reject('NOT_HOST', 'Só o anfitrião decide a substituição.');

    const target = room.participants.get(targetId);
    if (target === undefined || room.round === null || !room.round.seatIds.includes(target.id)) {
      return reject('UNKNOWN_PARTICIPANT', 'Participante não encontrado nesta rodada.');
    }
    if (target.kind === 'bot') {
      return reject('SUBSTITUTE_NOT_ELIGIBLE', 'Os bots da mesa de treino jogam sozinhos: não há substituição a autorizar.');
    }
    if (target.connected || target.autoControlled || target.absentSince === null) {
      return reject('SUBSTITUTE_NOT_ELIGIBLE', 'Esta pessoa não está ausente sem substituto.');
    }
    if (this.clock.now() < target.absentSince + this.pauseGraceMs) {
      return reject('SUBSTITUTE_TOO_EARLY', 'O prazo de 90 segundos ainda não terminou.');
    }

    target.autoControlled = true;
    target.absentSince = null;
    this.bump(room);
    this.syncPause(room);
    this.syncBot(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  /**
   * Anfitrião libera a rodada pausada: substitui todas as ausências elegíveis e
   * encerra a retenção. Causas ainda não elegíveis mantêm a pausa.
   */
  continueRound(actor: Participant): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status === 'lobby' || room.status === 'finished') {
      return reject('WRONG_ROOM_STATUS', 'Não há rodada em andamento.');
    }
    if (room.status !== 'paused') return reject('NOT_PAUSED', 'A rodada não está pausada.');
    if (room.hostId !== actor.id) return reject('NOT_HOST', 'Só o anfitrião continua a rodada.');

    const now = this.clock.now();
    for (const cause of this.absenceCauses(room)) {
      if (cause.absentSince !== null && now >= cause.absentSince + this.pauseGraceMs) {
        cause.autoControlled = true;
        cause.absentSince = null;
      }
    }
    room.retentionHold = false;
    this.bump(room);
    this.syncPause(room);
    this.syncBot(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  /** Anfitrião encerra a rodada sem vencedor para reorganizar o grupo. */
  endRoundWithoutWinner(actor: Participant): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status !== 'playing' && room.status !== 'paused') {
      return reject('WRONG_ROOM_STATUS', 'Não há rodada em andamento.');
    }
    if (room.hostId !== actor.id) return reject('NOT_HOST', 'Só o anfitrião encerra a rodada.');

    this.finishRound(room, null);
    this.bump(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  /** Anfitrião remove um participante no lobby ou entre rodadas. */
  removeParticipant(actor: Participant, targetId: string): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status !== 'lobby' && room.status !== 'finished') {
      return reject('WRONG_ROOM_STATUS', 'Só é possível remover participantes entre rodadas.');
    }
    if (room.hostId !== actor.id) return reject('NOT_HOST', 'Só o anfitrião remove participantes.');
    if (targetId === actor.id) return reject('CANNOT_REMOVE_SELF', 'Use a saída da sala para deixar o grupo.');

    const target = room.participants.get(targetId);
    if (target === undefined) return reject('UNKNOWN_PARTICIPANT', 'Participante não encontrado nesta sala.');
    if (target.kind === 'bot') {
      return reject('CANNOT_REMOVE_BOT', 'Os três bots do treino fazem parte da mesa e não podem ser removidos.');
    }

    if (target.socketId !== null) {
      const socketId = target.socketId;
      this.participantsBySocket.delete(socketId);
      this.transport.removed(socketId, { roomCode: room.code, reason: 'removed' });
      target.socketId = null;
    }
    target.connected = false;
    target.connectedSince = null;
    this.removeParticipantInternal(room, target.id);
    this.ensureHost(room);
    this.bump(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  participantOf(socketId: string): Participant | undefined {
    const id = this.participantsBySocket.get(socketId);
    return id === undefined ? undefined : this.participantsById.get(id);
  }

  roomOf(participant: Participant): Room | undefined {
    return this.rooms.get(participant.roomCode);
  }

  setReady(participant: Participant, ready: boolean): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(participant);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status !== 'lobby') {
      return reject('WRONG_ROOM_STATUS', 'Só é possível ficar pronto na preparação, entre rodadas.');
    }
    participant.ready = ready;
    this.bump(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  startRound(participant: Participant): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(participant);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status !== 'lobby') {
      return reject('WRONG_ROOM_STATUS', 'A rodada atual ainda não terminou.');
    }
    if (room.hostId !== participant.id) {
      return reject('NOT_HOST', 'Só o anfitrião inicia a rodada.');
    }
    // Bots de treino entram por identidade, sem conexão; pessoas entram conectadas.
    const seated = room.order
      .map((id) => room.participants.get(id))
      .filter(
        (candidate): candidate is Participant =>
          candidate !== undefined && (candidate.connected || candidate.kind === 'bot'),
      );
    if (seated.length < MIN_PLAYERS) {
      return reject('NOT_ENOUGH_PLAYERS', `São necessários pelo menos ${MIN_PLAYERS} participantes conectados.`);
    }
    if (seated.length > MAX_PLAYERS) {
      return reject('TOO_MANY_PLAYERS', `A mesa aceita no máximo ${MAX_PLAYERS} participantes por rodada.`);
    }
    if (seated.some((candidate) => !candidate.ready)) {
      return reject('NOT_ALL_READY', 'Todos os participantes precisam estar prontos.');
    }

    const playerIds = seated.map((candidate) => candidate.id);
    const opening =
      room.nextDeck === null
        ? startRound({ playerIds, random: room.random })
        : dealRound({ playerIds, random: room.random, deck: room.nextDeck });
    room.roundNumber += 1;
    room.round = {
      id: createRoundId(),
      number: room.roundNumber,
      seatIds: playerIds,
      state: createRoundState(opening),
      scored: false,
    };
    room.status = 'playing';
    room.retentionHold = false;
    room.nextDeck = null;
    for (const candidate of room.participants.values()) {
      // Bots do treino permanecem prontos; pessoas confirmam de novo a cada rodada.
      candidate.ready = candidate.kind === 'bot';
      candidate.autoControlled = false;
      candidate.absentSince = null;
    }
    this.bump(room);
    this.broadcastState(room);
    this.syncBot(room);
    return { ok: true, room, version: room.version };
  }

  returnToLobby(participant: Participant): RoomResult<{ room: Room; version: number }> {
    const room = this.roomOf(participant);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (room.status !== 'finished') {
      return reject('WRONG_ROOM_STATUS', 'A rodada ainda não terminou.');
    }
    if (room.hostId !== participant.id) {
      return reject('NOT_HOST', 'Só o anfitrião volta à preparação.');
    }
    room.status = 'lobby';
    room.round = null;
    room.retentionHold = false;
    for (const candidate of room.participants.values()) {
      // Bots do treino voltam prontos para a próxima rodada; pessoas não.
      candidate.ready = candidate.kind === 'bot';
      candidate.autoControlled = false;
      candidate.absentSince = null;
    }
    this.bump(room);
    this.broadcastState(room);
    return { ok: true, room, version: room.version };
  }

  applyRoundCommand(
    participant: Participant,
    roundId: string,
    command: ClientCommand,
  ): RoomResult<{ room: Room; version: number; finished: boolean }> {
    const room = this.roomOf(participant);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    const round = room.round;
    if (round === null) {
      return reject('WRONG_ROOM_STATUS', 'Não há rodada em andamento.');
    }
    if (round.id !== roundId) {
      return reject('STALE_ROUND', 'A rodada mudou desde a última atualização. Atualize a tela e tente de novo.');
    }
    if (room.status === 'finished') {
      return reject('ROUND_FINISHED', 'A rodada já terminou; comandos posteriores são recusados.');
    }
    if (room.status === 'paused') {
      return reject('ROUND_PAUSED', 'A rodada está pausada e não aceita jogadas até ser retomada.');
    }
    if (room.status !== 'playing') {
      return reject('WRONG_ROOM_STATUS', 'Não há rodada em andamento.');
    }
    if (!round.seatIds.includes(participant.id)) {
      return reject('WAITING_FOR_NEXT_ROUND', 'Você entra na próxima rodada; nesta, só é possível assistir.');
    }

    const result = applyCommand(round.state, toEngineCommand(participant.id, command), room.random);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message } };
    }

    round.state = result.state;
    this.bump(room);
    this.emitRoundEvents(room, round, result.events);
    const finished = this.settleIfFinished(room, round);
    if (!finished) {
      this.syncBot(room);
    }
    this.broadcastState(room);
    return { ok: true, room, version: room.version, finished };
  }

  /**
   * Envio de chat da sala. O ator deriva da conexão; `roomCode` no payload amarra
   * a intenção à sala de origem. Não altera `version`, motor nem agendamento do
   * bot: chat e jogo usam canais e contadores separados.
   */
  sendChat(actor: Participant, roomCode: string, text: string): RoomResult<{ message: ChatMessage }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (actor.roomCode !== roomCode) {
      return reject('NOT_IN_ROOM', 'Esta conexão pertence a outra sala. Atualize a tela e tente de novo.');
    }
    const length = chatCodePointLength(text);
    if (text.trim().length === 0) {
      return reject('CHAT_EMPTY', 'Escreva uma mensagem antes de enviar.');
    }
    if (length > CHAT_MESSAGE_MAX_LENGTH) {
      return reject('CHAT_TOO_LONG', `Mensagem muito longa: o limite é de ${CHAT_MESSAGE_MAX_LENGTH} caracteres.`);
    }

    const now = this.clock.now();
    // Janela móvel por identidade: reentrar com a mesma credencial preserva a cota.
    const windowStart = now - CHAT_RATE_WINDOW_MS;
    while (actor.chatSentAts.length > 0 && (actor.chatSentAts[0] ?? 0) <= windowStart) {
      actor.chatSentAts.shift();
    }
    if (actor.chatSentAts.length >= CHAT_RATE_LIMIT_COUNT) {
      const oldest = actor.chatSentAts[0] ?? now;
      const retryMs = Math.max(0, oldest + CHAT_RATE_WINDOW_MS - now);
      const retrySeconds = Math.max(1, Math.ceil(retryMs / 1000));
      return reject(
        'CHAT_RATE_LIMITED',
        `Muitas mensagens em pouco tempo. Tente de novo em ${retrySeconds}s.`,
      );
    }
    actor.chatSentAts.push(now);

    // Autoria congelada no aceite: permanece legível após saída/remoção e
    // distingue identidades com o mesmo apelido pelo playerId.
    const message: ChatMessage = Object.freeze({
      seq: room.chatNextSeq,
      author: Object.freeze({
        playerId: actor.id,
        nickname: actor.nickname,
        avatar: actor.avatar,
      }),
      text,
      sentAt: now,
    });
    room.chatNextSeq += 1;
    room.chatMessages.push(message);
    this.transport.toRoomChat(room.code, { roomCode: room.code, message });
    return { ok: true, message };
  }

  /** Página do histórico por cursor estável: `before` é exclusivo, ordem crescente. */
  chatHistory(
    actor: Participant,
    roomCode: string,
    before?: number,
    limit = CHAT_HISTORY_PAGE_SIZE,
  ): RoomResult<{ messages: readonly ChatMessage[]; hasMore: boolean }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (actor.roomCode !== roomCode) {
      return reject('NOT_IN_ROOM', 'Esta conexão pertence à outra sala.');
    }
    const eligible = before === undefined ? room.chatMessages : room.chatMessages.filter((entry) => entry.seq < before);
    const page = eligible.slice(Math.max(0, eligible.length - limit));
    const hasMore = eligible.length > page.length;
    return { ok: true, messages: Object.freeze([...page]), hasMore };
  }

  /**
   * Reação sem destinatário, com um dos doze tipos aprovados. O ator deriva do
   * vínculo da conexão e a sala do payload; bot nenhum envia, pois não tem
   * conexão. Cada reação aceita vai a todos os participantes conectados da
   * sala (incluindo quem aguarda) e vale só para o instante: sem histórico,
   * sem replays, sem alvo, sem áudio e sem tocar `version`/motor/bot. O
   * intervalo próprio de 5s é por emissor.
   */
  sendReaction(actor: Participant, roomCode: string, type: ReactionType): RoomResult<{ reaction: ReactionEvent; limits: SendLimitInfo }> {
    const room = this.roomOf(actor);
    if (room === undefined) return reject('NOT_IN_ROOM', 'Você não está em uma sala.');
    if (actor.roomCode !== roomCode) {
      return reject('NOT_IN_ROOM', 'Esta conexão pertence a outra sala. Atualize a tela e tente de novo.');
    }
    const now = this.clock.now();
    // Intervalo próprio: espaçamento entre reações aceitas, qualquer tipo e fase.
    if (actor.reactionLastSentAt !== null && now < actor.reactionLastSentAt + this.reactionCooldownMs) {
      const retryAt = actor.reactionLastSentAt + this.reactionCooldownMs;
      const retrySeconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
      return rejectRetry('REACTION_SENDER_COOLDOWN', `Calma um pouco! Você pode reagir de novo em ${retrySeconds}s.`, {
        serverTime: now,
        retryAt,
        scope: 'sender',
      });
    }
    actor.reactionLastSentAt = now;
    const reaction: ReactionEvent = Object.freeze({
      id: createReactionId(),
      type,
      sender: Object.freeze({ playerId: actor.id, nickname: actor.nickname, avatar: actor.avatar }),
      sentAt: now,
    });
    room.reactionNextSeq += 1;
    this.transport.toRoomReaction(room.code, { roomCode: room.code, reaction });
    return { ok: true, reaction, limits: { serverTime: now, nextSendAt: now + this.reactionCooldownMs } };
  }

  setNextDeck(room: Room, deckIds: readonly string[]): RoomResult<{ version: number }> {
    const byId = new Map(createClassicDeck().map((card) => [card.id, card]));
    const cards: Card[] = [];
    for (const id of deckIds) {
      const card = byId.get(id);
      if (card === undefined) {
        return reject('INVALID_PAYLOAD', `Carta desconhecida no baralho de teste: ${id}.`);
      }
      if (cards.some((candidate) => candidate.id === id)) {
        return reject('INVALID_PAYLOAD', `Carta repetida no baralho de teste: ${id}.`);
      }
      cards.push(card);
    }
    room.nextDeck = cards;
    return { ok: true, version: room.version };
  }

  /**
   * Ganchos de teste: fixa a variação dos próximos efeitos derivados da sala
   * (null volta ao RNG cosmético). Só viés de apresentação — a derivação
   * continua amarrada aos eventos do motor.
   */
  setEffectVariant(room: Room, variant: EffectVariant | null): RoomResult<{ version: number }> {
    room.effectVariantOverride = variant;
    return { ok: true, version: room.version };
  }

  dedupeSocket<T>(socketId: string, intentId: string, signature: string, compute: () => RoomResult<T>): RoomResult<T> {
    let store = this.socketIntents.get(socketId);
    if (store === undefined) {
      store = new Map();
      this.socketIntents.set(socketId, store);
    }
    return dedupe(store, intentId, signature, compute);
  }

  static dedupe<T>(store: Map<string, IntentEntry>, intentId: string, signature: string, compute: () => RoomResult<T>): RoomResult<T> {
    return dedupe(store, intentId, signature, compute);
  }

  debugRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  findParticipantByCredential(code: string, credential: string): Participant | undefined {
    const room = this.rooms.get(code);
    return room === undefined ? undefined : this.findByCredential(room, credential);
  }

  get roomCodes(): string[] {
    return [...this.rooms.keys()];
  }

  shutdown(): void {
    for (const room of this.rooms.values()) {
      this.cancelBot(room);
      this.clearRetentionTimer(room);
    }
  }

  /** Encerra a rodada: registra o resultado, retira substitutos e libera vagas. */
  private finishRound(room: Room, winner: WinnerInfo | null): void {
    this.cancelBot(room);
    room.status = 'finished';
    room.retentionHold = false;
    room.lastRound = {
      roundNumber: room.round?.number ?? room.roundNumber,
      winnerId: winner?.playerId ?? null,
      winnerNickname: winner?.nickname ?? null,
      substitute: winner?.substitute ?? false,
      winnerKind: winner?.kind ?? null,
    };
    const removed: string[] = [];
    if (room.round !== null) {
      for (const seatId of room.round.seatIds) {
        const seated = room.participants.get(seatId);
        if (seated !== undefined && !seated.connected && seated.autoControlled) removed.push(seated.id);
      }
    }
    for (const id of removed) this.removeParticipantInternal(room, id);
    for (const candidate of room.participants.values()) {
      candidate.autoControlled = false;
      candidate.absentSince = null;
    }
  }

  /** Detecta fim de rodada pelo estado do motor e registra o resultado uma única vez. */
  private settleIfFinished(room: Room, round: RoundInfo): boolean {
    if (round.state.status !== 'finished' || round.scored) return false;
    round.scored = true;
    const winnerId = round.state.winnerId;
    const winner = winnerId === null ? undefined : room.participants.get(winnerId);
    if (winner === undefined) {
      this.finishRound(room, null);
      return true;
    }
    const substitute = winner.autoControlled;
    if (!substitute) this.addWin(room, winner.id);
    this.finishRound(room, { playerId: winner.id, nickname: winner.nickname, substitute, kind: winner.kind });
    return true;
  }

  /** Registra a vitória no histórico da sala, independente da vaga ocupada. */
  private addWin(room: Room, playerId: string): void {
    const entry = room.history.get(playerId);
    if (entry !== undefined) {
      entry.wins += 1;
      return;
    }
    const winner = room.participants.get(playerId);
    if (winner !== undefined) {
      room.history.set(playerId, { kind: winner.kind, nickname: winner.nickname, avatar: winner.avatar, wins: 1 });
    }
  }

  private removeParticipantInternal(room: Room, participantId: string): void {
    const participant = room.participants.get(participantId);
    if (participant === undefined) return;
    room.participants.delete(participantId);
    const index = room.order.indexOf(participantId);
    if (index >= 0) room.order.splice(index, 1);
    this.participantsById.delete(participantId);
    if (participant.socketId !== null) this.participantsBySocket.delete(participant.socketId);
  }

  private severSocket(participant: Participant): void {
    const socketId = participant.socketId;
    participant.socketId = null;
    participant.connected = false;
    participant.connectedSince = null;
    if (socketId !== null) {
      this.participantsBySocket.delete(socketId);
      this.transport.detach(socketId, participant.roomCode);
    }
  }

  /** Anfitrião passa ao participante conectado há mais tempo; empate pela ordem de entrada. */
  private ensureHost(room: Room): void {
    const current = room.participants.get(room.hostId);
    if (current !== undefined && current.connected) return;
    const candidates = [...room.participants.values()].filter(
      (candidate): candidate is Participant & { connectedSince: number } =>
        candidate.connected && candidate.connectedSince !== null,
    );
    if (candidates.length === 0) return;
    const orderIndex = (id: string): number => {
      const index = room.order.indexOf(id);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    candidates.sort(
      (left, right) =>
        left.connectedSince - right.connectedSince ||
        orderIndex(left.id) - orderIndex(right.id) ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
    room.hostId = candidates[0]?.id ?? room.hostId;
  }

  private connectedCount(room: Room): number {
    let count = 0;
    for (const participant of room.participants.values()) {
      if (participant.connected) count += 1;
    }
    return count;
  }

  private absenceCauses(room: Room): Participant[] {
    if (room.round === null) return [];
    const causes: Participant[] = [];
    for (const seatId of room.round.seatIds) {
      const seated = room.participants.get(seatId);
      // Bots fixos do treino nunca são causa de ausência: não se conectam nem são substituídos.
      if (seated !== undefined && seated.kind === 'human' && !seated.connected && !seated.autoControlled) {
        causes.push(seated);
      }
    }
    return causes;
  }

  private syncPause(room: Room): void {
    if (room.status !== 'playing' && room.status !== 'paused') return;
    room.status = room.retentionHold || this.absenceCauses(room).length > 0 ? 'paused' : 'playing';
  }

  private beginRetention(room: Room): void {
    const now = this.clock.now();
    room.retentionHold = true;
    room.retainedUntil = now + this.retentionMs;
    room.retentionToken += 1;
    const token = room.retentionToken;
    this.clearRetentionTimer(room);
    room.retentionTimer = this.clock.setTimer(this.retentionMs, () => {
      this.expireRoom(room.code, token);
    });
  }

  private cancelRetention(room: Room): void {
    room.retentionToken += 1;
    this.clearRetentionTimer(room);
    room.retainedUntil = null;
  }

  private clearRetentionTimer(room: Room): void {
    if (room.retentionTimer !== null) {
      this.clock.clearTimer(room.retentionTimer);
      room.retentionTimer = null;
    }
  }

  private expireRoom(code: string, token: number): void {
    const room = this.rooms.get(code);
    // Callback antigo nunca apaga uma sala que voltou a ter pessoas nem opera outra rodada.
    if (room === undefined || room.retentionToken !== token) return;
    if (this.connectedCount(room) > 0) return;
    room.retentionTimer = null;
    this.cancelBot(room);
    for (const participant of room.participants.values()) {
      this.participantsById.delete(participant.id);
      if (participant.socketId !== null) this.participantsBySocket.delete(participant.socketId);
    }
    this.rooms.delete(code);
  }

  /** Assento que um bot deve comandar agora: substituto humano ou bot fixo do treino. */
  private botTarget(room: Room): { roundId: string; seatId: string } | null {
    if (room.status !== 'playing' || room.round === null) return null;
    // Sem pessoas conectadas o jogo congela, mesmo com bots fixos na mesa.
    if (room.retentionHold || this.connectedCount(room) === 0) return null;
    const round = room.round;
    if (round.state.status !== 'playing') return null;
    const seatId = round.seatIds[round.state.currentIndex];
    if (seatId === undefined) return null;
    const seated = room.participants.get(seatId);
    if (seated === undefined || (!seated.autoControlled && seated.kind !== 'bot')) return null;
    return { roundId: round.id, seatId };
  }

  private syncBot(room: Room): void {
    const target = this.botTarget(room);
    if (target === null) {
      this.cancelBot(room);
      return;
    }
    if (room.botTimer !== null && room.botTimerVersion === room.version) return;
    this.cancelBot(room);
    room.botTimerVersion = room.version;
    // Geração e versão são capturadas no agendamento: o callback só age se a sala
    // continuar exatamente como estava aqui, mesmo que já estivesse na fila.
    const generation = room.botGeneration;
    const version = room.version;
    room.botTimer = this.clock.setTimer(this.botDelayMs, () => {
      this.runBot(room.code, generation, version, target.roundId, target.seatId);
    });
  }

  private cancelBot(room: Room): void {
    // Nova geração invalida callbacks antigos já entregues à fila antes do cancelamento.
    room.botGeneration += 1;
    if (room.botTimer !== null) {
      this.clock.clearTimer(room.botTimer);
      room.botTimer = null;
    }
  }

  private runBot(code: string, generation: number, version: number, roundId: string, seatId: string): void {
    const room = this.rooms.get(code);
    // Callback obsoleto retorna antes de alterar referência de timer, motor, versão
    // ou emitir eventos; a ação do substituto cede a qualquer mudança desde o agendamento.
    if (room === undefined || room.botGeneration !== generation || room.version !== version) return;
    room.botTimer = null;
    const target = this.botTarget(room);
    const round = room.round;
    if (round === null || target === null || target.roundId !== roundId || target.seatId !== seatId || round.id !== roundId) {
      this.syncBot(room);
      return;
    }
    const decision = decideBotCommand(projectForPlayer(round.state, seatId));
    if (decision === null) return;
    const result = applyCommand(round.state, toEngineCommand(seatId, decision), room.random);
    if (!result.ok) {
      this.syncBot(room);
      return;
    }
    round.state = result.state;
    this.bump(room);
    this.emitRoundEvents(room, round, result.events);
    if (!this.settleIfFinished(room, round)) {
      this.syncBot(room);
    }
    this.broadcastState(room);
  }

  private findByCredential(room: Room, credential: string): Participant | undefined {
    for (const participant of room.participants.values()) {
      if (participant.credential === credential) return participant;
    }
    return undefined;
  }

  private bump(room: Room): void {
    room.version += 1;
  }

  /**
   * Transports an event batch with its derived automatic effects in the same
   * `server:events` message: order and atomicity of the batch are preserved and
   * the client dedupes by effect `id`. Runs before `settleIfFinished` so the
   * substitute flag and nicknames are still frozen from the live participants.
   */
  private emitRoundEvents(room: Room, round: RoundInfo, events: readonly RoundEvent[]): void {
    if (events.length === 0) return;
    const effects = deriveAutomaticEffects(events, {
      roundId: round.id,
      firstSeq: room.effectNextSeq,
      pickVariant: (category) => {
        const override = room.effectVariantOverride;
        // Um hook pedido para outra categoria não veste efeito errado: o RNG
        // cosmético escolhe desta vez.
        if (override !== null && (EFFECT_VARIANTS[category] as readonly string[]).includes(override)) {
          return override;
        }
        const variants = EFFECT_VARIANTS[category];
        return room.effectRandom() < 0.5 ? variants[0] : variants[1];
      },
      nextId: createEffectId,
      nicknameOf: (playerId) => room.participants.get(playerId)?.nickname ?? null,
      isSubstitute: (playerId) => room.participants.get(playerId)?.autoControlled ?? false,
    });
    room.effectNextSeq += effects.length;
    const message: EventsMessage = {
      roomCode: room.code,
      roundId: round.id,
      version: room.version,
      events,
      effects,
    };
    this.transport.toRoom(room.code, message);
  }

  private broadcastState(room: Room): void {
    for (const participant of room.participants.values()) {
      if (!participant.connected || participant.socketId === null) continue;
      this.transport.toSocket(participant.socketId, this.stateMessage(room, participant));
    }
  }

  private stateMessage(room: Room, participant: Participant): StateMessage {
    const now = this.clock.now();
    return {
      room: snapshotOf(room, now, this.pauseGraceMs),
      self: selfSnapshotOf(room, participant, {
        now,
        reactionCooldownMs: this.reactionCooldownMs,
      }),
      table: publicTableOf(room),
    };
  }
}

/** Mesa pública enquanto a sala tem rodada preparada; null na preparação. */
export function publicTableOf(room: Room): PublicTableView | null {
  if (room.round === null) return null;
  const view = projectPublicTable(room.round.state);
  if (room.status === 'finished' && view.status !== 'finished') {
    return { ...view, status: 'finished' };
  }
  return view;
}

export function snapshotOf(room: Room, now: number, pauseGraceMs: number): RoomSnapshot {
  const participants: PublicParticipant[] = room.order
    .map((id) => room.participants.get(id))
    .filter((candidate): candidate is Participant => candidate !== undefined)
    .map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      nickname: candidate.nickname,
      avatar: candidate.avatar,
      ready: candidate.ready,
      connected: candidate.connected,
      score: room.history.get(candidate.id)?.wins ?? 0,
      inRound: room.round !== null && room.round.seatIds.includes(candidate.id),
      isHost: room.hostId === candidate.id,
      autoControlled: candidate.autoControlled,
      absentSince: candidate.absentSince,
    }));
  const scoreboard: ScoreboardEntry[] = [];
  for (const [playerId, entry] of room.history) {
    const current = room.participants.has(playerId);
    // Histórico sem vitória não ocupa o placar depois que a pessoa deixa a sala.
    if (!current && entry.wins === 0) continue;
    scoreboard.push({ playerId, kind: entry.kind, nickname: entry.nickname, avatar: entry.avatar, wins: entry.wins, current });
  }
  return {
    roomCode: room.code,
    mode: room.mode,
    hostId: room.hostId,
    status: room.status,
    roundNumber: room.roundNumber,
    roundId: room.round?.id ?? null,
    lastRound: room.lastRound,
    participants,
    scoreboard,
    pause: room.status === 'paused' ? pauseInfoOf(room, now, pauseGraceMs) : null,
    retainedUntil: room.retainedUntil,
    serverTime: now,
    version: room.version,
  };
}

export function selfSnapshotOf(
  room: Room,
  participant: Participant,
  limits: { now: number; reactionCooldownMs: number },
): SelfSnapshot {
  const inRound = room.round !== null && room.round.seatIds.includes(participant.id);
  const roundActive = room.status === 'playing' || room.status === 'paused';
  return {
    playerId: participant.id,
    nickname: participant.nickname,
    avatar: participant.avatar,
    ready: participant.ready,
    inRound,
    waiting: roundActive && room.round !== null && !inRound,
    view: inRound && room.round !== null ? projectForPlayer(room.round.state, participant.id) : null,
    reactionNextSendAt: nextSendAtOf(participant.reactionLastSentAt, limits.reactionCooldownMs, limits.now),
  };
}

/** Instante em que a janela do emissor libera; null quando não há janela ativa. */
function nextSendAtOf(lastSentAt: number | null, cooldownMs: number, now: number): number | null {
  if (lastSentAt === null) return null;
  const next = lastSentAt + cooldownMs;
  return next > now ? next : null;
}

function pauseInfoOf(room: Room, now: number, pauseGraceMs: number): PauseInfo {
  const absent: AbsentParticipant[] = [];
  if (room.round !== null) {
    for (const seatId of room.round.seatIds) {
      const seated = room.participants.get(seatId);
      if (seated === undefined || seated.connected || seated.autoControlled || seated.absentSince === null) continue;
      absent.push({
        playerId: seated.id,
        absentSince: seated.absentSince,
        eligibleAt: seated.absentSince + pauseGraceMs,
        eligible: now >= seated.absentSince + pauseGraceMs,
      });
    }
  }
  return { retention: room.retentionHold, absent };
}

/**
 * Resposta memorizada por id de intenção no escopo do participante (ou da conexão,
 * em criação/entrada). Os registros vivem enquanto o escopo viver: nada é expulso,
 * então repetir uma intenção antiga nunca a reinterpreta como nova. A assinatura
 * inclui o tipo de operação/evento, de modo que o mesmo id em outra operação ou
 * com outro payload é recusado em vez de devolver o sucesso memorizado.
 */
function dedupe<T>(store: Map<string, IntentEntry>, intentId: string, signature: string, compute: () => RoomResult<T>): RoomResult<T> {
  const existing = store.get(intentId);
  if (existing !== undefined) {
    if (existing.signature !== signature) {
      return reject('INTENT_REUSED', 'Este identificador de intenção já foi usado com outro conteúdo.');
    }
    return existing.response as RoomResult<T>;
  }
  const response = compute();
  store.set(intentId, { signature, response: response as RoomResult<unknown> });
  return response;
}

function toEngineCommand(playerId: string, command: ClientCommand): RoundCommand {
  switch (command.type) {
    case 'play':
      return {
        type: 'play',
        playerId,
        cardId: command.cardId,
        ...(command.chosenColor === undefined ? {} : { chosenColor: command.chosenColor }),
        ...(command.announceLastCard === undefined ? {} : { announceLastCard: command.announceLastCard }),
      };
    case 'draw':
      return { type: 'draw', playerId };
    case 'pass':
      return { type: 'pass', playerId };
    case 'announceLastCard':
      return { type: 'announceLastCard', playerId };
    case 'challengeLastCard':
      return { type: 'challengeLastCard', playerId, targetId: command.targetId };
  }
}

function reject(code: ErrorCode, message: string): { ok: false; error: ServerErrorBody } {
  return { ok: false, error: { code, message } };
}

/** Recusa de limite com espera estruturada (intervalo do emissor ou cota do alvo). */
function rejectRetry(
  code: ErrorCode,
  message: string,
  retry: RetryInfo,
): { ok: false; error: ServerErrorBody } {
  return { ok: false, error: { code, message, retry } };
}
