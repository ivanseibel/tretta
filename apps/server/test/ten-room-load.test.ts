import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createClassicDeck, type Color } from '@tretta/rules';
import type { Ack, ChatHistoryAck, CommandAck, CreateRoomAck, JoinRoomAck, SimpleAck, StateMessage } from '@tretta/protocol';
import { describe, expect, it } from 'vitest';
import { connect, intent, record, request, startTestServer, waitFor, type Recorder, type TestClient } from './helpers.js';

const assetDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T007/', import.meta.url));
mkdirSync(assetDir, { recursive: true });

interface PlayerClient {
  readonly socket: TestClient;
  readonly recorder: Recorder;
  readonly playerId: string;
  readonly nickname: string;
}

interface LoadRoom {
  readonly index: number;
  readonly code: string;
  readonly players: PlayerClient[];
  commands: number;
  winnerId: string | null;
  roundFinishedEventsPerClient: number[];
}

interface LoadMetrics {
  acks: number;
  ackErrors: number;
  ackLatencyMs: number[];
}

const ROOM_COUNT = 10;
const CLIENTS_PER_ROOM = 8;
const MAX_COMMANDS_PER_ROOM = 256;
const ROOM_TIMEOUT_MS = 150_000;

describe('carga local de salas Socket.IO', () => {
  it('mantém dez rodadas ativas antes de executar 80 clientes em paralelo', async () => {
    const server = await startTestServer({ testHooks: true, seed: 707 });
    const clients: TestClient[] = [];
    const metrics: LoadMetrics = { acks: 0, ackErrors: 0, ackLatencyMs: [] };
    const cpuStart = process.cpuUsage();
    const wallStart = performance.now();
    const initialRssBytes = process.memoryUsage().rss;
    let maxRssBytes = initialRssBytes;
    const sampleTimer = setInterval(() => {
      maxRssBytes = Math.max(maxRssBytes, process.memoryUsage().rss);
    }, 100);
    const rooms: LoadRoom[] = [];
    try {
      const createRoomGroup = async (index: number): Promise<LoadRoom> => {
        const host = await connect(server.url);
        clients.push(host);
        const hostRecorder = record(host);
        const hostNickname = `T07-R${index + 1}-P1`;
        const created = await measuredRequest<Ack<CreateRoomAck>>(host, 'client:createRoom', {
          intentId: intent(), nickname: hostNickname, avatar: 'raposa',
        }, metrics);
        expect(created.ok, created.ok ? '' : created.error.message).toBe(true);
        if (!created.ok) throw new Error(`Não foi possível criar a sala ${index + 1}: ${created.error.code}`);
        const players: PlayerClient[] = [{ socket: host, recorder: hostRecorder, playerId: created.playerId, nickname: hostNickname }];
        for (let seat = 1; seat < CLIENTS_PER_ROOM; seat++) {
          const socket = await connect(server.url);
          clients.push(socket);
          const recorder = record(socket);
          const nickname = `T07-R${index + 1}-P${seat + 1}`;
          const joined = await measuredRequest<Ack<JoinRoomAck>>(socket, 'client:joinRoom', {
            intentId: intent(), roomCode: created.roomCode, nickname, avatar: 'lobo',
          }, metrics);
          expect(joined.ok, joined.ok ? '' : joined.error.message).toBe(true);
          if (!joined.ok) throw new Error(`Cliente ${seat + 1} não entrou na sala ${index + 1}: ${joined.error.code}`);
          players.push({ socket, recorder, playerId: joined.playerId, nickname });
        }
        const deckAck = await measuredRequest<SimpleAck>(host, 'test:setNextDeck', {
          intentId: intent(), roomCode: created.roomCode, deck: makeEightSeatDeck(),
        }, metrics);
        expect(deckAck.ok, deckAck.ok ? '' : deckAck.error.message).toBe(true);
        if (!deckAck.ok) throw new Error(`Baralho da sala ${index + 1} recusado: ${deckAck.error.code}`);
        return { index: index + 1, code: created.roomCode, players, commands: 0, winnerId: null, roundFinishedEventsPerClient: [] };
      };

      rooms.push(...await Promise.all(Array.from({ length: ROOM_COUNT }, (_, index) => createRoomGroup(index))));
      expect(new Set(rooms.map((room) => room.code)).size).toBe(ROOM_COUNT);
      expect(rooms.flatMap((room) => room.players)).toHaveLength(ROOM_COUNT * CLIENTS_PER_ROOM);

      const readyAcks = await Promise.all(rooms.flatMap((room) => room.players.map((player) =>
        measuredRequest<SimpleAck>(player.socket, 'client:setReady', { intentId: intent(), ready: true }, metrics),
      )));
      expect(readyAcks.every((ack) => ack.ok)).toBe(true);
      const startAcks = await Promise.all(rooms.map((room) => measuredRequest<SimpleAck>(room.players[0]!.socket, 'client:startRound', {
        intentId: intent(),
      }, metrics)));
      expect(startAcks.every((ack) => ack.ok)).toBe(true);

      await waitFor(() => rooms.every((room) => room.players.every((player) => {
        const state = latest(player.recorder);
        return state.room.status === 'playing' && state.room.roundId !== null &&
          state.table?.status === 'playing' && state.table.currentPlayerId !== null &&
          state.self.view?.hand.length === 7;
      })), 'barreira com 10 salas ativas e 80 mãos privadas de sete cartas', 20_000);
      const barrierStates = rooms.flatMap((room) => room.players.map((player) => latest(player.recorder)));
      const activeRoomsAtBarrier = rooms.filter((room) => room.players.every((player) => latest(player.recorder).room.status === 'playing')).length;
      const activeClientsAtBarrier = barrierStates.filter((state) => state.room.status === 'playing' && state.self.view?.hand.length === 7).length;
      expect(activeRoomsAtBarrier).toBe(ROOM_COUNT);
      expect(activeClientsAtBarrier).toBe(ROOM_COUNT * CLIENTS_PER_ROOM);

      for (const room of rooms) {
        const message = `isolamento-da-sala-${room.index}`;
        const chat = await measuredRequest<{ ok: boolean; error?: { code: string; message: string } }>(
          room.players[0]!.socket,
          'client:chatSend',
          { intentId: intent(), roomCode: room.code, text: message },
          metrics,
        );
        expect(chat.ok, chat.ok ? '' : chat.error?.message).toBe(true);
      }
      await waitFor(() => rooms.every((room) => room.players.every((player) =>
        player.recorder.chat.some((entry) => entry.message.text === `isolamento-da-sala-${room.index}`),
      )), 'chat isolado entregue aos oito clientes de cada sala', 10_000);
      for (const room of rooms) {
        for (const other of rooms) {
          if (room.index === other.index) continue;
          expect(other.players.every((player) => player.recorder.chat.every((entry) => entry.message.text !== `isolamento-da-sala-${room.index}`))).toBe(true);
        }
      }
      expect(rooms.every((room) => room.players.every((player) => latest(player.recorder).room.status === 'playing'))).toBe(true);

      const concurrentPlayStart = performance.now();
      await Promise.all(rooms.map((room) => finishRoom(room, metrics)));
      const concurrentPlayDurationMs = performance.now() - concurrentPlayStart;
      const health = await fetch(`${server.url}/healthz`);
      expect(health.status).toBe(200);
      const history = await measuredRequest<Ack<ChatHistoryAck>>(rooms[0]!.players[0]!.socket, 'client:chatHistory', {
        roomCode: rooms[0]!.code, limit: 10,
      }, metrics);
      expect(history.ok).toBe(true);
      expect(metrics.ackErrors).toBe(0);

      const cpu = process.cpuUsage(cpuStart);
      const elapsedMs = performance.now() - wallStart;
      const finalRssBytes = process.memoryUsage().rss;
      const artifact = {
        schemaVersion: 1,
        scenario: { rooms: ROOM_COUNT, clients: ROOM_COUNT * CLIENTS_PER_ROOM, concurrentRounds: ROOM_COUNT },
        barrier: {
          roomsActive: activeRoomsAtBarrier,
          clientsConnectedWithSevenCardHands: activeClientsAtBarrier,
          gamesStartedBeforeAnyConcurrentPlay: true,
        },
        result: {
          roomsCompleted: rooms.filter((room) => room.winnerId !== null).length,
          roundFinishedEventsPerClient: rooms.map((room) => room.roundFinishedEventsPerClient),
          healthHttpStatus: health.status,
          socketIoAckAfterLoad: history.ok,
          ackErrors: metrics.ackErrors,
        },
        timings: {
          elapsedMs: round(elapsedMs),
          concurrentPlayDurationMs: round(concurrentPlayDurationMs),
          measuredAcks: metrics.acks,
          ackLatencyMs: {
            p50: percentile(metrics.ackLatencyMs, 0.5),
            p95: percentile(metrics.ackLatencyMs, 0.95),
            p99: percentile(metrics.ackLatencyMs, 0.99),
            max: round(Math.max(...metrics.ackLatencyMs)),
          },
        },
        processResources: {
          measurementScope: 'single Vitest Node process containing in-process HTTP/Socket.IO server, 80 socket.io-client sockets, and harness',
          cpuUserSeconds: round(cpu.user / 1_000_000),
          cpuSystemSeconds: round(cpu.system / 1_000_000),
          rssInitialBytes: initialRssBytes,
          rssPeakSampledBytes: maxRssBytes,
          rssFinalBytes: finalRssBytes,
          samplingIntervalMs: 100,
          node: process.version,
          platform: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpuCount: os.cpus().length,
          hostMemoryBytes: os.totalmem(),
        },
        rooms: rooms.map((room) => ({
          roomIndex: room.index,
          commands: room.commands,
          roundFinishedEventsPerClient: room.roundFinishedEventsPerClient,
          completed: room.winnerId !== null,
        })),
        notes: [
          'CPU/RSS include both the in-process server and client/harness work; this is not a server-only measurement.',
          'The 100 ms RSS sample peak is a local peak, not an average monthly cloud memory estimate.',
          'This local result does not predict cloud capacity or production network behavior.',
        ],
      };
      writeFileSync(join(assetDir, 'ten-room-load.json'), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
      expect(rooms.every((room) => room.roundFinishedEventsPerClient.length === CLIENTS_PER_ROOM &&
        room.roundFinishedEventsPerClient.every((count) => count === 1))).toBe(true);
    } finally {
      clearInterval(sampleTimer);
      clients.forEach((client) => client.disconnect());
      await server.close();
    }
  }, 180_000);
});

async function finishRoom(room: LoadRoom, metrics: LoadMetrics): Promise<void> {
  const deadline = Date.now() + ROOM_TIMEOUT_MS;
  let lastVersion = -1;
  while (room.commands < MAX_COMMANDS_PER_ROOM && Date.now() < deadline) {
    await waitFor(() => hasCoherentSnapshots(room), `estado sincronizado da sala ${room.index}`, 8_000);
    const snapshots = room.players.map((player) => latest(player.recorder));
    const publicState = snapshots[0]!;
    if (publicState.room.status === 'finished') {
      room.winnerId = publicState.room.lastRound?.winnerId ?? null;
      break;
    }
    const activeId = publicState.table?.currentPlayerId;
    if (activeId === null || activeId === undefined) throw new Error(`Sala ${room.index} ativa sem jogador da vez.`);
    const active = room.players.find((player) => player.playerId === activeId);
    if (active === undefined) throw new Error(`Jogador da vez ausente na sala ${room.index}.`);
    const current = latest(active.recorder);
    const view = current.self.view;
    const roundId = current.room.roundId;
    if (view === null || roundId === null) throw new Error(`Projeção privada ausente na sala ${room.index}.`);
    if (current.room.version <= lastVersion) throw new Error(`Versão repetida antes da próxima jogada na sala ${room.index}.`);
    lastVersion = current.room.version;

    const globalHands = snapshots.map((state) => state.self.view?.hand ?? []);
    const activeColor = view.activeColor;
    const heldMatchingColor = globalHands.some((hand) => hand.some((card) => card.kind !== 'wild' && card.color === activeColor));
    const chosenMatchingCard = view.phase === 'play'
      ? view.hand.find((card) => card.kind !== 'wild' && card.color === activeColor && view.playableCardIds.includes(card.id))
      : undefined;
    const playableDraw = view.phase === 'after-draw'
      ? view.hand.find((card) => card.id === view.drawnCardId && view.playableCardIds.includes(card.id))
      : undefined;
    const wild = view.phase === 'play' ? view.hand.find((card) => card.kind === 'wild') : undefined;
    let command: Record<string, unknown>;
    if (playableDraw !== undefined) {
      command = makePlayCommand(playableDraw.id, playableDraw.kind === 'wild' ? nextColor(activeColor) : undefined, view.hand.length);
    } else if (view.phase === 'after-draw') {
      command = { type: 'pass' };
    } else if (chosenMatchingCard !== undefined) {
      command = makePlayCommand(chosenMatchingCard.id, undefined, view.hand.length);
    } else if (!heldMatchingColor && wild !== undefined) {
      command = makePlayCommand(wild.id, nextColor(activeColor), view.hand.length);
    } else {
      command = { type: 'draw' };
    }

    const ack = await measuredRequest<CommandAck>(active.socket, 'client:command', {
      intentId: intent(), roundId, command,
    }, metrics);
    expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
    if (!ack.ok) throw new Error(`Comando recusado na sala ${room.index}: ${ack.error.code}`);
    room.commands++;
    await waitFor(() => room.players.every((player) => latest(player.recorder).room.version >= ack.version) && hasCoherentSnapshots(room),
      `versão ${ack.version} propagada na sala ${room.index}`, 8_000);
  }
  if (room.winnerId === null) {
    const finalState = latest(room.players[0]!.recorder);
    if (finalState.room.status === 'finished') room.winnerId = finalState.room.lastRound?.winnerId ?? null;
  }
  if (room.winnerId === null) throw new Error(`Sala ${room.index} não concluiu antes do limite (${room.commands} comandos).`);

  const finalStates = room.players.map((player) => latest(player.recorder));
  expect(finalStates.every((state) => state.room.status === 'finished' && state.room.lastRound?.winnerId === room.winnerId)).toBe(true);
  expect(finalStates.every((state) => state.room.participants.reduce((sum, participant) => sum + participant.score, 0) === 1)).toBe(true);
  expect(finalStates.find((state) => state.self.playerId === room.winnerId)?.self.view?.hand).toHaveLength(0);
  room.roundFinishedEventsPerClient = room.players.map((player) => player.recorder.events.flatMap((batch) => batch.events)
    .filter((event) => event.type === 'roundFinished').length);
  expect(room.roundFinishedEventsPerClient).toEqual(Array.from({ length: CLIENTS_PER_ROOM }, () => 1));
}

async function measuredRequest<T extends { readonly ok: boolean }>(
  socket: TestClient,
  event: string,
  payload: unknown,
  metrics: LoadMetrics,
): Promise<T> {
  const start = performance.now();
  try {
    const response = await request<T>(socket, event, payload);
    metrics.acks++;
    metrics.ackLatencyMs.push(performance.now() - start);
    if (!response.ok) metrics.ackErrors++;
    return response;
  } catch (error) {
    metrics.ackErrors++;
    throw error;
  }
}

function hasCoherentSnapshots(room: LoadRoom): boolean {
  const states = room.players.map((player) => latest(player.recorder));
  const first = states[0];
  const firstTable = first?.table;
  if (first === undefined || first.room.roundId === null || firstTable === null || firstTable === undefined) return false;
  return states.every((state) => state.room.version === first.room.version && state.room.roundId === first.room.roundId &&
    state.room.status === first.room.status && state.table?.currentPlayerId === firstTable.currentPlayerId &&
    state.self.view?.status === first.self.view?.status);
}

function latest(recorder: Recorder): StateMessage {
  const state = recorder.states[recorder.states.length - 1];
  if (state === undefined) throw new Error('Cliente ainda não recebeu um snapshot.');
  return state;
}

function makePlayCommand(cardId: string, chosenColor: Color | undefined, handSize: number): Record<string, unknown> {
  return {
    type: 'play', cardId,
    ...(chosenColor === undefined ? {} : { chosenColor }),
    announceLastCard: handSize === 2,
  };
}

function nextColor(color: Color): Color {
  const next: Record<Color, Color> = { red: 'blue', blue: 'green', green: 'yellow', yellow: 'yellow' };
  return next[color];
}

function makeEightSeatDeck(): string[] {
  const cards = createClassicDeck();
  const numbers = (color: Color): string[] => cards
    .filter((card) => card.kind === 'number' && card.color === color)
    .map((card) => card.id);
  const red = numbers('red').filter((id) => id !== 'red-9-1');
  const blue = numbers('blue');
  const green = numbers('green');
  const yellow = numbers('yellow');
  const wild = cards.filter((card) => card.kind === 'wild' && card.variant === 'color').map((card) => card.id);
  const hands = Array.from({ length: CLIENTS_PER_ROOM }, (_, seat) => {
    const hand = [red[seat * 2], red[seat * 2 + 1], blue[seat * 2], blue[seat * 2 + 1], green[seat * 2], green[seat * 2 + 1]];
    if (seat < 4) hand.push(wild[seat]);
    else hand.push(yellow[seat - 4]);
    if (hand.some((id) => id === undefined)) throw new Error(`Baralho inválido no assento ${seat}.`);
    return hand as string[];
  });
  const dealt = new Set(hands.flat());
  const deck = hands.flatMap((hand) => hand);
  deck.push('red-9-1', ...yellow.filter((id) => !dealt.has(id)));
  const used = new Set(deck);
  deck.push(...cards.map((card) => card.id).filter((id) => !used.has(id)));
  if (deck.length !== 108 || new Set(deck).size !== 108) throw new Error('Baralho de validação não tem 108 cartas únicas.');
  return deck;
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  return round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
