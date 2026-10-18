import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type {
  Ack,
  ChatBroadcast,
  ChatHistoryAck,
  ChatSendAck,
  ClientToServerEvents,
  CommandAck,
  CreateRoomAck,
  EffectVariant,
  EventsMessage,
  JoinRoomAck,
  ReactionBroadcast,
  ReactionSendAck,
  ReactionType,
  ServerToClientEvents,
  SimpleAck,
  StateMessage,
  TauntBroadcast,
  TauntSendAck,
  TauntType,
} from '@tretta/protocol';
import type { Avatar } from '@tretta/protocol/shared';
import { createSeededRandom, type RandomSource } from '@tretta/rules';
import type { RoomClock, TimerHandle } from '../src/clock.js';
import { createTrettaServer, type TrettaServer } from '../src/server.js';

export type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

export const SCENARIO_SEED = 7;

/**
 * Relógio controlável: `now` avança apenas via `advance`, que executa os
 * temporizadores vencidos em ordem determinística. Separado dos heartbeats do
 * Socket.IO, que continuam no relógio real.
 */
export class FakeClock implements RoomClock {
  private current: number;
  private readonly timers = new Map<number, { at: number; callback: () => void }>();
  /** Todo callback já agendado, mesmo cancelado: simula trabalho já entregue à fila. */
  private readonly archived = new Map<number, { at: number; callback: () => void }>();
  private nextId = 1;

  constructor(start = 1_700_000_000_000) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  setTimer(delayMs: number, callback: () => void): number {
    const id = this.nextId++;
    const timer = { at: this.current + delayMs, callback };
    this.timers.set(id, timer);
    this.archived.set(id, timer);
    return id;
  }

  clearTimer(handle: TimerHandle): void {
    this.timers.delete(handle as number);
  }

  /** Entrega um callback cancelado como se já estivesse na fila, sem avançar o relógio. */
  deliver(handle: TimerHandle): boolean {
    const id = handle as number;
    const timer = this.archived.get(id);
    if (timer === undefined) return false;
    this.timers.delete(id);
    timer.callback();
    return true;
  }

  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      let dueId: number | null = null;
      let dueAt = Number.POSITIVE_INFINITY;
      for (const [id, timer] of this.timers) {
        if (timer.at <= target && timer.at < dueAt) {
          dueId = id;
          dueAt = timer.at;
        }
      }
      if (dueId === null) break;
      const timer = this.timers.get(dueId);
      if (timer === undefined) break;
      this.timers.delete(dueId);
      this.current = timer.at;
      timer.callback();
    }
    this.current = target;
  }

  pendingTimers(): number {
    return this.timers.size;
  }
}

export interface TestServerOptions {
  readonly seed?: number;
  /** RNG cosmético dos efeitos automáticos; padrão Math.random, fora do de regras. */
  readonly effectRandomFactory?: () => RandomSource;
  readonly testHooks?: boolean;
  readonly clock?: RoomClock;
  readonly pauseGraceMs?: number;
  readonly retentionMs?: number;
  readonly botDelayMs?: number;
  readonly tauntCooldownMs?: number;
  readonly reactionCooldownMs?: number;
}

export interface TestServer {
  readonly server: TrettaServer;
  readonly url: string;
  close(): Promise<void>;
}

export async function startTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const server = createTrettaServer({
    webOrigin: 'http://localhost:3000',
    testHooks: options.testHooks ?? false,
    randomFactory: () => createSeededRandom(options.seed ?? SCENARIO_SEED),
    ...(options.effectRandomFactory === undefined ? {} : { effectRandomFactory: options.effectRandomFactory }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.pauseGraceMs === undefined ? {} : { pauseGraceMs: options.pauseGraceMs }),
    ...(options.retentionMs === undefined ? {} : { retentionMs: options.retentionMs }),
    ...(options.botDelayMs === undefined ? {} : { botDelayMs: options.botDelayMs }),
    ...(options.tauntCooldownMs === undefined ? {} : { tauntCooldownMs: options.tauntCooldownMs }),
    ...(options.reactionCooldownMs === undefined ? {} : { reactionCooldownMs: options.reactionCooldownMs }),
  });
  const port = await server.listen(0);
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      await server.close();
    },
  };
}

export async function connect(url: string): Promise<TestClient> {
  const socket: TestClient = ioc(url, { transports: ['websocket'], forceNew: true });
  if (socket.connected) return socket;
  await new Promise<void>((resolve) => {
    socket.once('connect', () => resolve());
  });
  return socket;
}

export interface Recorder {
  readonly states: StateMessage[];
  readonly events: EventsMessage[];
  readonly chat: ChatBroadcast[];
  readonly taunts: TauntBroadcast[];
  readonly reactions: ReactionBroadcast[];
  readonly packets: unknown[];
}

export function record(socket: TestClient): Recorder {
  const recorder: Recorder = { states: [], events: [], chat: [], taunts: [], reactions: [], packets: [] };
  socket.onAny((event, ...args) => {
    recorder.packets.push({ event, args });
  });
  socket.on('server:state', (message) => {
    recorder.states.push(message);
  });
  socket.on('server:events', (message) => {
    recorder.events.push(message);
  });
  socket.on('server:chat', (message) => {
    recorder.chat.push(message);
  });
  socket.on('server:taunt', (message) => {
    recorder.taunts.push(message);
  });
  socket.on('server:reaction', (message) => {
    recorder.reactions.push(message);
  });
  return recorder;
}

export function latestState(recorder: Recorder): StateMessage {
  const state = recorder.states[recorder.states.length - 1];
  if (state === undefined) throw new Error('Nenhum estado recebido.');
  return state;
}

export function transcript(recorder: Recorder): string {
  return JSON.stringify(recorder.packets);
}

export function intent(): string {
  return `intent_${randomUUID()}`;
}

export function request<Res>(socket: TestClient, event: string, payload: unknown): Promise<Res> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sem resposta para ${event}`)), 5000);
    (socket as unknown as { emit: (event: string, payload: unknown, callback: (response: Res) => void) => void }).emit(
      event,
      payload,
      (response: Res) => {
        clearTimeout(timer);
        resolve(response);
      },
    );
  });
}

export async function createRoom(
  socket: TestClient,
  nickname = 'Ana',
  avatar: Avatar = 'raposa',
): Promise<Ack<CreateRoomAck>> {
  const ack = await request<Ack<CreateRoomAck>>(socket, 'client:createRoom', { intentId: intent(), nickname, avatar });
  expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
  return ack;
}

export async function joinRoom(
  socket: TestClient,
  roomCode: string,
  nickname: string,
  avatar: Avatar = 'lobo',
  credential?: string,
): Promise<Ack<JoinRoomAck>> {
  const payload = { intentId: intent(), roomCode, nickname, avatar, ...(credential === undefined ? {} : { credential }) };
  return request<Ack<JoinRoomAck>>(socket, 'client:joinRoom', payload);
}

export async function joinOrFail(
  socket: TestClient,
  roomCode: string,
  nickname: string,
  avatar: Avatar = 'lobo',
): Promise<Ack<JoinRoomAck>> {
  const ack = await joinRoom(socket, roomCode, nickname, avatar);
  expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
  return ack;
}

export async function setReady(socket: TestClient, ready: boolean): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:setReady', { intentId: intent(), ready });
}

export async function startRound(socket: TestClient): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:startRound', { intentId: intent() });
}

export async function sendCommand(
  socket: TestClient,
  roundId: string,
  command: Record<string, unknown>,
  intentId = intent(),
): Promise<CommandAck> {
  return request<CommandAck>(socket, 'client:command', { intentId, roundId, command });
}

export async function returnToLobby(socket: TestClient): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:returnToLobby', { intentId: intent() });
}

export async function leaveRoom(socket: TestClient): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:leaveRoom', { intentId: intent() });
}

export async function substituteAbsent(socket: TestClient, targetId: string): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:substituteAbsent', { intentId: intent(), targetId });
}

export async function continueRound(socket: TestClient): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:continueRound', { intentId: intent() });
}

export async function endRoundWithoutWinner(socket: TestClient): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:endRoundWithoutWinner', { intentId: intent() });
}

export async function removeParticipant(socket: TestClient, targetId: string): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'client:removeParticipant', { intentId: intent(), targetId });
}

export async function chatSend(
  socket: TestClient,
  roomCode: string,
  text: string,
  intentId = intent(),
): Promise<Ack<ChatSendAck>> {
  return request<Ack<ChatSendAck>>(socket, 'client:chatSend', { intentId, roomCode, text });
}

export async function chatHistory(
  socket: TestClient,
  roomCode: string,
  options: { before?: number; limit?: number } = {},
): Promise<Ack<ChatHistoryAck>> {
  return request<Ack<ChatHistoryAck>>(socket, 'client:chatHistory', {
    roomCode,
    ...(options.before === undefined ? {} : { before: options.before }),
    ...(options.limit === undefined ? {} : { limit: options.limit }),
  });
}

export async function tauntSend(
  socket: TestClient,
  roomCode: string,
  type: TauntType,
  targetId: string,
  intentId = intent(),
): Promise<Ack<TauntSendAck>> {
  return request<Ack<TauntSendAck>>(socket, 'client:tauntSend', { intentId, roomCode, type, targetId });
}

export async function reactionSend(
  socket: TestClient,
  roomCode: string,
  type: ReactionType,
  intentId = intent(),
): Promise<Ack<ReactionSendAck>> {
  return request<Ack<ReactionSendAck>>(socket, 'client:reactionSend', { intentId, roomCode, type });
}

export function waitForDisconnect(socket: TestClient): Promise<void> {
  if (socket.disconnected) return Promise.resolve();
  return new Promise((resolve) => {
    socket.once('disconnect', () => resolve());
  });
}

export async function setNextDeck(socket: TestClient, roomCode: string, deck: readonly string[]): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'test:setNextDeck', { intentId: intent(), roomCode, deck });
}

export async function setEffectVariant(
  socket: TestClient,
  roomCode: string,
  variant: EffectVariant | null,
): Promise<SimpleAck> {
  return request<SimpleAck>(socket, 'test:setEffectVariant', { intentId: intent(), roomCode, variant });
}

export function expectOk(ack: { ok: boolean; error?: { message: string } }): void {
  expect(ack.ok, ack.ok ? '' : ack.error?.message).toBe(true);
}

export async function waitFor(condition: () => boolean, message = 'condição', timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Tempo esgotado aguardando ${message}.`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
