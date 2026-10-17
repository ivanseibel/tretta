import type { Server } from 'socket.io';
import type { ZodError } from 'zod';
import {
  CLIENT_EVENTS,
  chatHistoryPayloadSchema,
  chatSendPayloadSchema,
  commandPayloadSchema,
  continueRoundPayloadSchema,
  createRoomPayloadSchema,
  endRoundWithoutWinnerPayloadSchema,
  joinRoomPayloadSchema,
  leaveRoomPayloadSchema,
  removeParticipantPayloadSchema,
  returnToLobbyPayloadSchema,
  setEffectVariantPayloadSchema,
  setNextDeckPayloadSchema,
  setReadyPayloadSchema,
  startRoundPayloadSchema,
  substituteAbsentPayloadSchema,
  tauntSendPayloadSchema,
  type Ack,
  type ChatHistoryAck,
  type ChatSendAck,
  type ClientToServerEvents,
  type CommandAck,
  type CreateRoomAck,
  type JoinRoomAck,
  type ServerToClientEvents,
  type SimpleAck,
  type TauntSendAck,
} from '@tretta/protocol';
import { RoomStore, type RoomResult, type ServerErrorBody } from './rooms.js';

export interface HandlerOptions {
  readonly testHooks: boolean;
}

/** Assinatura da intenção: o evento entra nela, então o mesmo id em outra operação é recusado. */
function intentSignature(event: string, payload: unknown): string {
  return JSON.stringify({ event, payload });
}

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  store: RoomStore,
  options: HandlerOptions,
): void {
  io.on('connection', (socket) => {
    socket.on(CLIENT_EVENTS.createRoom, (payload: unknown, ack: (response: Ack<CreateRoomAck>) => void) => {
      if (!isAck(ack)) return;
      const parsed = createRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const { intentId, nickname, avatar, mode } = parsed.data;
      const response = store.dedupeSocket(
        socket.id,
        intentId,
        intentSignature(CLIENT_EVENTS.createRoom, parsed.data),
        (): RoomResult<CreateRoomAck> => {
          const created = store.createRoom({
            socketId: socket.id,
            nickname,
            avatar,
            ...(mode === undefined ? {} : { mode }),
          });
          if (!created.ok) return created;
          // Campos imutáveis capturados na primeira execução: o replay devolve
          // exatamente este ack, sem ler referências mutáveis da sala.
          return {
            ok: true,
            roomCode: created.room.code,
            playerId: created.participant.id,
            credential: created.participant.credential,
            version: created.room.version,
          };
        },
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack(response);
    });

    socket.on(CLIENT_EVENTS.joinRoom, (payload: unknown, ack: (response: Ack<JoinRoomAck>) => void) => {
      if (!isAck(ack)) return;
      const parsed = joinRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const { intentId, roomCode, nickname, avatar, credential } = parsed.data;
      const response = store.dedupeSocket(
        socket.id,
        intentId,
        intentSignature(CLIENT_EVENTS.joinRoom, parsed.data),
        (): RoomResult<JoinRoomAck> => {
          const joined = store.joinRoom({ socketId: socket.id, roomCode, nickname, avatar, credential });
          if (!joined.ok) return joined;
          return {
            ok: true,
            roomCode: joined.room.code,
            playerId: joined.participant.id,
            credential: joined.participant.credential,
            version: joined.room.version,
            rejoined: joined.rejoined,
          };
        },
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack(response);
    });

    socket.on(CLIENT_EVENTS.setReady, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = setReadyPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(participant.intents, parsed.data.intentId, intentSignature(CLIENT_EVENTS.setReady, parsed.data), () =>
        store.setReady(participant, parsed.data.ready),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.startRound, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = startRoundPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(participant.intents, parsed.data.intentId, intentSignature(CLIENT_EVENTS.startRound, parsed.data), () =>
        store.startRound(participant),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.command, (payload: unknown, ack: (response: CommandAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = commandPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { intentId, roundId, command } = parsed.data;
      const response = RoomStore.dedupe(participant.intents, intentId, intentSignature(CLIENT_EVENTS.command, { roundId, command }), () =>
        store.applyRoundCommand(participant, roundId, command),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.returnToLobby, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = returnToLobbyPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(participant.intents, parsed.data.intentId, intentSignature(CLIENT_EVENTS.returnToLobby, parsed.data), () =>
        store.returnToLobby(participant),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.leaveRoom, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = leaveRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      // Escopo da conexão e resposta pública imutável: o replay devolve o ack
      // original sem exigir vínculo atual e sem guardar referências da sala.
      const response = store.dedupeSocket(
        socket.id,
        parsed.data.intentId,
        intentSignature(CLIENT_EVENTS.leaveRoom, parsed.data),
        (): RoomResult<{ version: number }> => {
          const participant = store.participantOf(socket.id);
          if (participant === undefined) return notInRoom();
          const left = store.leaveRoom(participant);
          if (!left.ok) return left;
          return { ok: true, version: left.version };
        },
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.substituteAbsent, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = substituteAbsentPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(
        participant.intents,
        parsed.data.intentId,
        intentSignature(CLIENT_EVENTS.substituteAbsent, parsed.data),
        () => store.substituteAbsent(participant, parsed.data.targetId),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.continueRound, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = continueRoundPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(participant.intents, parsed.data.intentId, intentSignature(CLIENT_EVENTS.continueRound, parsed.data), () =>
        store.continueRound(participant),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.endRoundWithoutWinner, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = endRoundWithoutWinnerPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(
        participant.intents,
        parsed.data.intentId,
        intentSignature(CLIENT_EVENTS.endRoundWithoutWinner, parsed.data),
        () => store.endRoundWithoutWinner(participant),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.removeParticipant, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      const parsed = removeParticipantPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const response = RoomStore.dedupe(
        participant.intents,
        parsed.data.intentId,
        intentSignature(CLIENT_EVENTS.removeParticipant, parsed.data),
        () => store.removeParticipant(participant, parsed.data.targetId),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.chatSend, (payload: unknown, ack: (response: Ack<ChatSendAck>) => void) => {
      if (!isAck(ack)) return;
      const parsed = chatSendPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { intentId, roomCode, text } = parsed.data;
      // Escopo do participante: replay devolve a resposta original sem reexecutar,
      // sem retransmitir e sem consumir a cota de novo.
      const response = RoomStore.dedupe(
        participant.intents,
        intentId,
        intentSignature(CLIENT_EVENTS.chatSend, parsed.data),
        () => store.sendChat(participant, roomCode, text),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, message: response.message });
    });

    socket.on(CLIENT_EVENTS.chatHistory, (payload: unknown, ack: (response: Ack<ChatHistoryAck>) => void) => {
      if (!isAck(ack)) return;
      const parsed = chatHistoryPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { roomCode, before, limit } = parsed.data;
      const response = store.chatHistory(participant, roomCode, before, limit);
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, messages: response.messages, hasMore: response.hasMore });
    });

    socket.on(CLIENT_EVENTS.tauntSend, (payload: unknown, ack: (response: Ack<TauntSendAck>) => void) => {
      if (!isAck(ack)) return;
      const parsed = tauntSendPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { intentId, roomCode, type, targetId } = parsed.data;
      // Mesmo escopo do chat: replay devolve o evento original sem reexecutar nem retransmitir.
      const response = RoomStore.dedupe(
        participant.intents,
        intentId,
        intentSignature(CLIENT_EVENTS.tauntSend, parsed.data),
        () => store.sendTaunt(participant, roomCode, type, targetId),
      );
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, taunt: response.taunt });
    });

    socket.on(CLIENT_EVENTS.setNextDeck, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      if (!options.testHooks) {
        return ack({ ok: false, error: { code: 'TEST_HOOKS_DISABLED', message: 'Ganchos de teste desativados neste servidor.' } });
      }
      const parsed = setNextDeckPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { intentId, roomCode, deck } = parsed.data;
      const response = RoomStore.dedupe(participant.intents, intentId, intentSignature(CLIENT_EVENTS.setNextDeck, parsed.data), () => {
        if (participant.roomCode !== roomCode) {
          return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Esta conexão não pertence à sala indicada.' } };
        }
        const room = store.debugRoom(roomCode);
        if (room === undefined) {
          return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Sala não encontrada.' } };
        }
        if (room.hostId !== participant.id) {
          return { ok: false, error: { code: 'NOT_HOST', message: 'Só o anfitrião pode definir o baralho de teste.' } };
        }
        return store.setNextDeck(room, deck);
      });
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on(CLIENT_EVENTS.setEffectVariant, (payload: unknown, ack: (response: SimpleAck) => void) => {
      if (!isAck(ack)) return;
      if (!options.testHooks) {
        return ack({ ok: false, error: { code: 'TEST_HOOKS_DISABLED', message: 'Ganchos de teste desativados neste servidor.' } });
      }
      const parsed = setEffectVariantPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(invalidPayload(parsed.error));
      const participant = store.participantOf(socket.id);
      if (participant === undefined) return ack(notInRoom());
      const { intentId, roomCode, variant } = parsed.data;
      const response = RoomStore.dedupe(participant.intents, intentId, intentSignature(CLIENT_EVENTS.setEffectVariant, parsed.data), () => {
        if (participant.roomCode !== roomCode) {
          return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Esta conexão não pertence à sala indicada.' } };
        }
        const room = store.debugRoom(roomCode);
        if (room === undefined) {
          return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'Sala não encontrada.' } };
        }
        if (room.hostId !== participant.id) {
          return { ok: false, error: { code: 'NOT_HOST', message: 'Só o anfitrião pode definir a variação de teste.' } };
        }
        return store.setEffectVariant(room, variant);
      });
      if (!response.ok) return ack({ ok: false, error: response.error });
      ack({ ok: true, version: response.version });
    });

    socket.on('disconnect', () => {
      store.handleDisconnect(socket.id);
    });
  });
}

function isAck(ack: unknown): ack is (...args: never[]) => void {
  return typeof ack === 'function';
}

function invalidPayload(error: ZodError): { ok: false; error: ServerErrorBody } {
  const issue = error.issues[0];
  const path = issue === undefined || issue.path.length === 0 ? null : issue.path.join('.');
  return {
    ok: false,
    error: { code: 'INVALID_PAYLOAD', message: path === null ? 'Payload inválido.' : `Payload inválido em "${path}".` },
  };
}

function notInRoom(): { ok: false; error: ServerErrorBody } {
  return { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Entre em uma sala antes de agir.' } };
}
