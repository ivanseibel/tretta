import { z } from 'zod';
import { COLORS } from '@tretta/rules';
import type {
  CommandErrorCode,
  Direction,
  PlayerView,
  PublicTableView,
  RoundEvent,
} from '@tretta/rules';

export type { PublicTableView } from '@tretta/rules';
import {
  AVATARS,
  CHAT_HISTORY_MAX_LIMIT,
  EFFECT_VARIANT_IDS,
  NICKNAME_MAX_LENGTH,
  REACTION_TYPES,
  ROOM_CODE_PATTERN,
  ROOM_MODES,
  type Avatar,
  type EffectVariant,
  type ParticipantKind,
  type ReactionType,
  type RoomMode,
  type ServerErrorCode,
} from './shared.js';

export * from './shared.js';

export type ErrorCode = ServerErrorCode | CommandErrorCode;

export const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX_LENGTH);
export const avatarSchema = z.enum(AVATARS);
export const roomCodeSchema = z.string().regex(ROOM_CODE_PATTERN);
export const intentIdSchema = z.string().min(8).max(64);
export const credentialSchema = z.string().min(16).max(128);
export const colorSchema = z.enum(COLORS);

export const clientCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('play'),
    cardId: z.string().min(1).max(64),
    chosenColor: colorSchema.optional(),
    announceLastCard: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal('draw') }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('announceLastCard') }),
  z.strictObject({ type: z.literal('challengeLastCard'), targetId: z.string().min(1).max(64) }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;

/**
 * Criação da sala. `mode` ausente equivale a `classic`: payloads antigos
 * continuam criando a sala humana comum; `training` cria a mesa de treino com
 * a pessoa dona e exatamente três bots fixos.
 */
export const createRoomPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  nickname: nicknameSchema,
  avatar: avatarSchema,
  mode: z.enum(ROOM_MODES).optional(),
});

export const joinRoomPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roomCode: roomCodeSchema,
  nickname: nicknameSchema,
  avatar: avatarSchema,
  credential: credentialSchema.optional(),
});

export const setReadyPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  ready: z.boolean(),
});

export const startRoundPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
});

export const returnToLobbyPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
});

export const commandPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roundId: z.string().min(1).max(64),
  command: clientCommandSchema,
});

export const leaveRoomPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
});

export const substituteAbsentPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  targetId: z.string().min(1).max(64),
});

export const continueRoundPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
});

export const endRoundWithoutWinnerPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
});

export const removeParticipantPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  targetId: z.string().min(1).max(64),
});

/**
 * Envio de chat. O conteúdo é validado no servidor (vazio, tamanho em pontos de
 * código e limite por janela); campos como autor, id ou horário não existem no
 * payload e um campo desconhecido recusa a mensagem inteira.
 */
export const chatSendPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roomCode: roomCodeSchema,
  text: z.string(),
});

/** Consulta de histórico: página por cursor estável (`before` é exclusivo). */
export const chatHistoryPayloadSchema = z.strictObject({
  roomCode: roomCodeSchema,
  before: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(CHAT_HISTORY_MAX_LIMIT).optional(),
});

/**
 * Envio de reação sem destinatário, com um dos doze tipos aprovados. O emissor
 * deriva do vínculo da conexão; `sentAt`, identidade do evento e autor não
 * existem no payload, e qualquer campo desconhecido — em especial um
 * destinatário — recusa a intenção.
 */
export const reactionSendPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roomCode: roomCodeSchema,
  type: z.enum(REACTION_TYPES),
});

export const setNextDeckPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roomCode: roomCodeSchema,
  deck: z.array(z.string().min(1).max(64)).length(108),
});

/**
 * Test hook (testHooks habilitado apenas): fixa a variação dos próximos
 * efeitos automáticos derivados nesta sala; `null` libera a escolha por RNG.
 * Não fabrica efeito: continua derivando dos eventos do motor.
 */
export const setEffectVariantPayloadSchema = z.strictObject({
  intentId: intentIdSchema,
  roomCode: roomCodeSchema,
  variant: z.enum(EFFECT_VARIANT_IDS).nullable(),
});

export type CreateRoomPayload = z.infer<typeof createRoomPayloadSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomPayloadSchema>;
export type SetReadyPayload = z.infer<typeof setReadyPayloadSchema>;
export type StartRoundPayload = z.infer<typeof startRoundPayloadSchema>;
export type ReturnToLobbyPayload = z.infer<typeof returnToLobbyPayloadSchema>;
export type CommandPayload = z.infer<typeof commandPayloadSchema>;
export type LeaveRoomPayload = z.infer<typeof leaveRoomPayloadSchema>;
export type SubstituteAbsentPayload = z.infer<typeof substituteAbsentPayloadSchema>;
export type ContinueRoundPayload = z.infer<typeof continueRoundPayloadSchema>;
export type EndRoundWithoutWinnerPayload = z.infer<typeof endRoundWithoutWinnerPayloadSchema>;
export type RemoveParticipantPayload = z.infer<typeof removeParticipantPayloadSchema>;
export type ChatSendPayload = z.infer<typeof chatSendPayloadSchema>;
export type ChatHistoryPayload = z.infer<typeof chatHistoryPayloadSchema>;
export type ReactionSendPayload = z.infer<typeof reactionSendPayloadSchema>;
export type SetNextDeckPayload = z.infer<typeof setNextDeckPayloadSchema>;
export type SetEffectVariantPayload = z.infer<typeof setEffectVariantPayloadSchema>;

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface PublicParticipant {
  readonly id: string;
  /** Pessoa real ou bot fixo da mesa de treino; não se deduz pelo apelido. */
  readonly kind: ParticipantKind;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly score: number;
  readonly inRound: boolean;
  readonly isHost: boolean;
  /** Vaga sob controle de substituto automático na rodada atual. */
  readonly autoControlled: boolean;
  /** Início da ausência na rodada atual (desconectado sem substituto); null fora disso. */
  readonly absentSince: number | null;
}

export interface AbsentParticipant {
  readonly playerId: string;
  readonly absentSince: number;
  /** Instante (epoch ms do servidor) em que a substituição fica elegível. */
  readonly eligibleAt: number;
  readonly eligible: boolean;
}

export interface PauseInfo {
  /** Pausa por ausência total: aguarda o anfitrião decidir continuar. */
  readonly retention: boolean;
  readonly absent: readonly AbsentParticipant[];
}

export interface LastRoundSummary {
  readonly roundNumber: number;
  /** Vencedor, ou null quando a rodada foi encerrada sem vencedor. */
  readonly winnerId: string | null;
  readonly winnerNickname: string | null;
  /** Controle no momento da vitória: true quando quem venceu era um substituto. */
  readonly substitute: boolean;
  /** Identidade do vencedor (pessoa, substituto de pessoa ou bot fixo); null sem vencedor. */
  readonly winnerKind: ParticipantKind | null;
}

/**
 * Linha do placar da sala, separada da ocupação de vagas: preserva as vitórias
 * humanas mesmo depois de saída, remoção ou retirada de substituto, enquanto a
 * sala existir. Entradas históricas não ocupam vaga, não exigem prontidão e não
 * concedem autoridade nem retorno por credencial.
 */
export interface ScoreboardEntry {
  readonly playerId: string;
  readonly kind: ParticipantKind;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly wins: number;
  /** true quando a identidade ainda ocupa uma vaga de participante. */
  readonly current: boolean;
}

export interface RoomSnapshot {
  readonly roomCode: string;
  /** `classic` ou `training`; orienta o cliente sem inferência por apelido. */
  readonly mode: RoomMode;
  readonly hostId: string;
  readonly status: RoomStatus;
  readonly roundNumber: number;
  readonly roundId: string | null;
  readonly lastRound: LastRoundSummary | null;
  readonly participants: readonly PublicParticipant[];
  /** Histórico de vitórias da sala; inclui quem já saiu, sem ocupar vaga. */
  readonly scoreboard: readonly ScoreboardEntry[];
  readonly pause: PauseInfo | null;
  /** Epoch ms do servidor em que a sala vazia expira; null com pessoas conectadas. */
  readonly retainedUntil: number | null;
  /** Relógio do servidor, para contagens locais de prazo sem confundir com o do navegador. */
  readonly serverTime: number;
  readonly version: number;
}

export interface SelfSnapshot {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly ready: boolean;
  readonly inRound: boolean;
  readonly waiting: boolean;
  readonly view: PlayerView | null;
  /**
   * Instante (epoch ms do servidor) em que nova reação desta identidade volta
   * a ser aceita; null quando não há janela ativa. Calculado no momento do
   * envio do estado: após recuperar a mesma identidade, o cliente recalcula o
   * restante a partir de `serverTime`, sem confiar no relógio do navegador.
   */
  readonly reactionNextSendAt: number | null;
}

/**
 * Autoria de mensagem de chat, capturada no aceite: permanece no histórico após
 * saída/remoção e distingue identidades com o mesmo apelido pelo `playerId`.
 */
export interface ChatAuthor {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: Avatar;
}

/** Mensagem aceita pelo servidor: `seq` é a ordenação e o id autoritativos. */
export interface ChatMessage {
  readonly seq: number;
  readonly author: ChatAuthor;
  readonly text: string;
  /** Epoch ms do servidor. */
  readonly sentAt: number;
}

export interface ChatBroadcast {
  readonly roomCode: string;
  readonly message: ChatMessage;
}

export interface ChatSendAck {
  readonly message: ChatMessage;
}

export interface ChatHistoryAck {
  /** Página em ordem crescente de `seq`; a mais recente quando `before` ausente. */
  readonly messages: readonly ChatMessage[];
  /** true quando existem mensagens mais antigas além da primeira desta página. */
  readonly hasMore: boolean;
}

/**
 * Identidade pública de humor (reação), congelada no aceite como no chat:
 * distingue pessoas com o mesmo apelido pelo `playerId`.
 */
export interface ReactionActor {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: Avatar;
}

/**
 * Reação aceita pelo servidor, sem destinatário, com um dos doze tipos. `id` e
 * `sentAt` são autoritativos; tipo e emissor são os mesmos para todos.
 * Transitória: sem histórico e sem reprodução ao reconectar.
 */
export interface ReactionEvent {
  readonly id: string;
  readonly type: ReactionType;
  readonly sender: ReactionActor;
  /** Epoch ms do servidor. */
  readonly sentAt: number;
}

export interface ReactionBroadcast {
  readonly roomCode: string;
  readonly reaction: ReactionEvent;
}

/**
 * Referência de tempo estruturada de um envio de humor aceito. Todos os
 * instantes são epoch ms do relógio do servidor. O restante do intervalo
 * próprio é `nextSendAt - serverTime` (a resposta e o evento compartilham o
 * mesmo instante), sem interpretar mensagens em português nem usar o relógio
 * do navegador. Um replay devolve este mesmo objeto: repetir o ack não renova
 * o prazo.
 */
export interface SendLimitInfo {
  /** Relógio do servidor no instante em que a ação foi aceita. */
  readonly serverTime: number;
  /** Instante em que este emissor pode enviar de novo nesta categoria. */
  readonly nextSendAt: number;
}

/**
 * Espera estruturada de uma recusa por limite do próprio emissor. `retryAt` é
 * epoch ms do servidor: o restante é `retryAt - serverTime`.
 */
export interface RetryInfo {
  readonly serverTime: number;
  readonly retryAt: number;
  readonly scope: 'sender';
}

export interface ReactionSendAck {
  readonly reaction: ReactionEvent;
  readonly limits: SendLimitInfo;
}

export interface StateMessage {
  readonly room: RoomSnapshot;
  readonly self: SelfSnapshot;
  /** Mesa pública enquanto houver rodada na sala; null na preparação. */
  readonly table: PublicTableView | null;
}

/**
 * Efeito automático derivado no servidor de um evento público da rodada.
 * Congela os dados públicos necessários no instante do lote (apelido,
 * substituição, quantidade comprada, sentido); nada de mãos ou pilha. `id` é
 * único para dedupe no cliente, `eventIndex` aponta para a posição no lote de
 * `events` que o originou. A escolha de `variant` é cosmética e não altera
 * regras.
 */
interface AutomaticEffectBase {
  readonly id: string;
  readonly variant: EffectVariant;
  readonly roundId: string;
  /** Ordem de emissão na sala, para ordenação estável no cliente. */
  readonly seq: number;
  /** Índice em `events` do lote `server:events` que gerou este efeito. */
  readonly eventIndex: number;
}

export type AutomaticEffect =
  | (AutomaticEffectBase & {
      readonly category: 'penaltyDraw';
      readonly targetId: string;
      readonly targetNickname: string;
      /** Quantidade realmente entregue; 0 quando a pilha esgotou. */
      readonly drawn: number;
      readonly requested: number;
      readonly reason: 'penalty' | 'challenge';
    })
  | (AutomaticEffectBase & {
      readonly category: 'blocked';
      readonly playerId: string;
      readonly playerNickname: string;
    })
  | (AutomaticEffectBase & {
      readonly category: 'directionReversed';
      readonly direction: Direction;
    })
  | (AutomaticEffectBase & {
      readonly category: 'victory';
      readonly winnerId: string;
      readonly winnerNickname: string;
      /** Congelado antes da retirada do substituto: venceu sob controle de bot. */
      readonly substitute: boolean;
    });

export interface EventsMessage {
  readonly roomCode: string;
  readonly roundId: string;
  readonly version: number;
  readonly events: readonly RoundEvent[];
  /**
   * Efeitos derivados deste lote, na mesma ordem dos eventos que os originaram.
   * Presente sempre (array vazio quando nenhum evento gera efeito); entregue no
   * mesmo transporte de `server:events` para preservar ordem e atomicidade.
   * Repetição do lote não duplica efeitos: o cliente deduplica por `id`.
   */
  readonly effects: readonly AutomaticEffect[];
}

export interface AckErrorBody {
  readonly code: ErrorCode;
  readonly message: string;
  /** Presente quando a recusa impõe uma espera calculável (limites de humor). */
  readonly retry?: RetryInfo;
}

export interface AckError {
  readonly ok: false;
  readonly error: AckErrorBody;
}

export type Ack<T extends object = Record<never, never>> = ({ readonly ok: true } & T) | AckError;

export interface CreateRoomAck {
  readonly roomCode: string;
  readonly playerId: string;
  readonly credential: string;
  readonly version: number;
}

export interface JoinRoomAck {
  readonly roomCode: string;
  readonly playerId: string;
  readonly credential: string;
  readonly version: number;
  readonly rejoined: boolean;
}

export interface VersionAck {
  readonly version: number;
}

export type SimpleAck = Ack<VersionAck>;
export type CommandAck = Ack<VersionAck>;

export interface RemovedMessage {
  readonly roomCode: string;
  readonly reason: 'removed';
}

export interface ClientToServerEvents {
  'client:createRoom': (payload: unknown, ack: (response: Ack<CreateRoomAck>) => void) => void;
  'client:joinRoom': (payload: unknown, ack: (response: Ack<JoinRoomAck>) => void) => void;
  'client:setReady': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:startRound': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:command': (payload: unknown, ack: (response: CommandAck) => void) => void;
  'client:returnToLobby': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:leaveRoom': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:substituteAbsent': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:continueRound': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:endRoundWithoutWinner': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:removeParticipant': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'client:chatSend': (payload: unknown, ack: (response: Ack<ChatSendAck>) => void) => void;
  'client:chatHistory': (payload: unknown, ack: (response: Ack<ChatHistoryAck>) => void) => void;
  'client:reactionSend': (payload: unknown, ack: (response: Ack<ReactionSendAck>) => void) => void;
  'test:setNextDeck': (payload: unknown, ack: (response: SimpleAck) => void) => void;
  'test:setEffectVariant': (payload: unknown, ack: (response: SimpleAck) => void) => void;
}

export interface ServerToClientEvents {
  'server:state': (message: StateMessage) => void;
  'server:events': (message: EventsMessage) => void;
  'server:chat': (message: ChatBroadcast) => void;
  'server:reaction': (message: ReactionBroadcast) => void;
  'server:removed': (message: RemovedMessage) => void;
}
