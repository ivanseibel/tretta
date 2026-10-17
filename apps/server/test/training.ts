import { expect } from 'vitest';
import type { Ack, CommandAck, CreateRoomAck } from '@tretta/protocol';
import type { Avatar } from '@tretta/protocol/shared';
import { DEFAULT_BOT_DELAY_MS, type Room } from '../src/rooms.js';
import { buildDeck } from './decks.js';
import {
  intent,
  latestState,
  request,
  sendCommand,
  setReady,
  startRound,
  waitFor,
  type FakeClock,
  type Recorder,
  type TestClient,
} from './helpers.js';

/** Cria a mesa de treino pela opção nova do protocolo e exige sucesso. */
export async function createTrainingRoom(
  socket: TestClient,
  nickname = 'Ana',
  avatar: Avatar = 'raposa',
): Promise<Ack<CreateRoomAck>> {
  const ack = await request<Ack<CreateRoomAck>>(socket, 'client:createRoom', {
    intentId: intent(),
    nickname,
    avatar,
    mode: 'training',
  });
  expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
  return ack;
}

/** Confirma prontidão e inicia a rodada; devolve o id da rodada iniciada. */
export async function startTrainingRound(host: TestClient, recorder: Recorder): Promise<string> {
  const ready = await setReady(host, true);
  expect(ready.ok, ready.ok ? '' : ready.error.message).toBe(true);
  const started = await startRound(host);
  expect(started.ok, started.ok ? '' : started.error.message).toBe(true);
  await waitFor(() => latestState(recorder).room.status === 'playing', 'rodada do treino iniciar');
  const roundId = latestState(recorder).room.roundId;
  if (roundId === null) throw new Error('Rodada iniciada sem id.');
  return roundId;
}

async function sendExpectOk(host: TestClient, roundId: string, command: Record<string, unknown>): Promise<void> {
  const ack: CommandAck = await sendCommand(host, roundId, command);
  expect(ack.ok, ack.ok ? '' : ack.error.message).toBe(true);
}

/** Envia um comando aceito e espera o estado refletir (versão maior). */
export async function applyHumanCommand(
  host: TestClient,
  recorder: Recorder,
  roundId: string,
  command: Record<string, unknown>,
): Promise<void> {
  const before = latestState(recorder).room.version;
  await sendExpectOk(host, roundId, command);
  await waitFor(() => latestState(recorder).room.version > before, 'estado após comando');
}

export interface HumanTurnOptions {
  /** Compra mesmo com carta válida (mantém a mão crescendo de propósito). */
  readonly alwaysDraw?: boolean;
}

/**
 * Joga a vez da pessoa com decisão simples: descarta a primeira carta válida;
 * sem carta válida compra e usa a recém-comprada, senão passa.
 */
export async function playHumanTurn(
  host: TestClient,
  recorder: Recorder,
  roundId: string,
  options: HumanTurnOptions = {},
): Promise<void> {
  const view = latestState(recorder).self.view;
  if (view === null) throw new Error('Sem visão da própria mão.');
  if (options.alwaysDraw !== true) {
    const cardId = view.playableCardIds[0];
    if (cardId !== undefined) {
      await applyHumanCommand(host, recorder, roundId, { type: 'play', cardId });
      return;
    }
  }
  await applyHumanCommand(host, recorder, roundId, { type: 'draw' });
  const afterDraw = latestState(recorder).self.view;
  const drawn = afterDraw?.drawnCardId ?? null;
  if (afterDraw !== null && drawn !== null && afterDraw.playableCardIds.includes(drawn)) {
    await applyHumanCommand(host, recorder, roundId, { type: 'play', cardId: drawn });
    return;
  }
  await applyHumanCommand(host, recorder, roundId, { type: 'pass' });
}

/** Entrega o timer de bot vencido e espera a versão mudar. */
export async function advanceBotTurn(clock: FakeClock, recorder: Recorder): Promise<void> {
  const before = latestState(recorder).room.version;
  clock.advance(DEFAULT_BOT_DELAY_MS);
  await waitFor(
    () => latestState(recorder).room.version > before || latestState(recorder).room.status === 'finished',
    'turno de bot',
  );
}

/** Executa um passo do jogador da vez: pessoa com script, bot com relógio. */
export async function actCurrentPlayer(
  clock: FakeClock,
  host: TestClient,
  recorder: Recorder,
  options: HumanTurnOptions = {},
): Promise<void> {
  const state = latestState(recorder);
  const roundId = state.room.roundId;
  if (roundId === null || state.room.status !== 'playing') throw new Error('Rodada não está em andamento.');
  if (state.self.view?.currentPlayerId === state.self.playerId) {
    await playHumanTurn(host, recorder, roundId, options);
    return;
  }
  await advanceBotTurn(clock, recorder);
}

/** Conduz a rodada até o fim (determinístico com os baralhos de teste). */
export async function playRoundToEnd(
  clock: FakeClock,
  host: TestClient,
  recorder: Recorder,
  options: HumanTurnOptions & { readonly maxSteps?: number } = {},
): Promise<void> {
  const maxSteps = options.maxSteps ?? 400;
  for (let step = 0; step < maxSteps; step++) {
    if (latestState(recorder).room.status === 'finished') return;
    await actCurrentPlayer(clock, host, recorder, options);
  }
  throw new Error('A rodada não terminou dentro do limite de passos.');
}

/** Conduz até um bot agir (jogar, comprar ou passar) depois do ponto atual. */
export async function driveUntilBotAction(
  clock: FakeClock,
  host: TestClient,
  recorder: Recorder,
  options: HumanTurnOptions & { readonly maxSteps?: number } = {},
): Promise<void> {
  const botIds = new Set(
    latestState(recorder)
      .room.participants.filter((entry) => entry.kind === 'bot')
      .map((entry) => entry.id),
  );
  const botActed = (): boolean =>
    recorder.events.some((batch) => batch.events.some((event) => 'playerId' in event && botIds.has(event.playerId)));
  if (botActed()) return;
  const maxSteps = options.maxSteps ?? 12;
  for (let step = 0; step < maxSteps; step++) {
    await actCurrentPlayer(clock, host, recorder, options);
    if (botActed()) return;
  }
  throw new Error('Nenhum bot agiu dentro do limite de passos.');
}

/** Cartas vivas da rodada: mãos + pilha de compra + descarte. Nunca deve passar de 108. */
export function poolOf(room: Room | undefined): { total: number; unique: number } {
  const round = room?.round;
  if (round == null) return { total: 0, unique: 0 };
  const cards = [
    ...round.state.seats.flatMap((seat) => seat.hand),
    ...round.state.drawPile,
    ...round.state.discardPile,
  ];
  return { total: cards.length, unique: new Set(cards.map((card) => card.id)).size };
}

/**
 * Baralho determinístico de 4 assentos em que a pessoa dona vence: mão vermelha
 * 1..7 sempre jogável; bots com símbolos/zeros fora do vermelho nunca descartam
 * da própria mão. O topo da pilha começa com vermelhas jogáveis na fase
 * pós-compra; na sequência, cartas fora do vermelho apenas acumulam na mão.
 */
export function trainingDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
      ['blue-skip-1', 'blue-skip-2', 'blue-reverse-1', 'blue-reverse-2', 'blue-draw-two-1', 'blue-draw-two-2', 'blue-0-1'],
      ['green-skip-1', 'green-skip-2', 'green-reverse-1', 'green-reverse-2', 'green-draw-two-1', 'green-draw-two-2', 'green-0-1'],
      ['yellow-skip-1', 'yellow-skip-2', 'yellow-reverse-1', 'yellow-reverse-2', 'yellow-draw-two-1', 'yellow-draw-two-2', 'yellow-0-1'],
    ],
    discard: 'red-9-1',
    draw: [
      'red-8-1',
      'red-8-2',
      'red-9-2',
      'red-1-2',
      'red-2-2',
      'red-3-2',
      'red-4-2',
      'red-5-2',
      'red-6-2',
      'red-7-2',
      'blue-8-1',
      'blue-8-2',
      'blue-9-1',
      'blue-9-2',
      'green-8-1',
      'green-8-2',
      'green-9-1',
      'green-9-2',
      'yellow-8-1',
      'yellow-8-2',
      'yellow-9-1',
      'yellow-9-2',
    ],
  });
}

/**
 * Baralho determinístico em que os três bots descartam da própria mão a cada
 * vez e o primeiro a esvaziar vence; a pessoa compra lixo de propósito e passa.
 */
export function botWinsDeck(): string[] {
  return buildDeck({
    hands: [
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
      ['red-1-2', 'red-2-2', 'red-3-2', 'red-4-2', 'red-5-2', 'red-6-2', 'red-7-2'],
      ['red-0-1', 'red-8-1', 'red-8-2', 'red-9-2', 'wild-color-1', 'wild-color-2', 'wild-color-3'],
    ],
    discard: 'red-9-1',
    draw: [
      'blue-skip-1',
      'blue-skip-2',
      'blue-reverse-1',
      'blue-reverse-2',
      'blue-draw-two-1',
      'blue-draw-two-2',
      'green-skip-1',
      'green-skip-2',
      'green-reverse-1',
      'green-reverse-2',
      'green-draw-two-1',
      'green-draw-two-2',
      'yellow-skip-1',
      'yellow-skip-2',
      'yellow-reverse-1',
      'yellow-reverse-2',
      'yellow-draw-two-1',
      'yellow-draw-two-2',
    ],
  });
}
