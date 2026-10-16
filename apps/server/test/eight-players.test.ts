import { afterEach, describe, expect, it } from 'vitest';
import { COLORS, createSeededRandom, type Color, type PlayerView } from '@tretta/rules';
import type { ClientCommand } from '@tretta/protocol';
import {
  connect,
  createRoom,
  joinOrFail,
  latestState,
  record,
  sendCommand,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';

const MAX_COMMANDS = 20_000;

describe('oito participantes conectados', () => {
  let server: TestServer | null = null;
  const clients: TestClient[] = [];

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    clients.length = 0;
    if (server !== null) await server.close();
    server = null;
  });

  it(
    'inicia com oito pessoas, distribui sete cartas e conclui uma rodada completa',
    async () => {
      const started = await startTestServer({ seed: 3 });
      server = started;

      const host = await connect(started.url);
      clients.push(host);
      const hostRec = record(host);
      const created = await createRoom(host, 'Pessoa 1');
      if (!created.ok) throw new Error('criação falhou');
      const others: TestClient[] = [];
      for (let index = 2; index <= 8; index++) {
        const socket = await connect(started.url);
        clients.push(socket);
        await joinOrFail(socket, created.roomCode, `Pessoa ${index}`);
        others.push(socket);
      }

      const everyone = [host, ...others];
      const recorders = [hostRec, ...others.map((socket) => record(socket))];
      for (const socket of everyone) {
        const ack = await setReady(socket, true);
        expect(ack.ok).toBe(true);
      }
      const startedAck = await startRound(host);
      expect(startedAck.ok).toBe(true);

      for (const recorder of recorders) {
        await waitFor(() => latestState(recorder).self.view?.hand.length === 7, 'mão de sete cartas');
        const view = latestState(recorder).self.view;
        expect(view?.hand).toHaveLength(7);
        expect(view?.players).toHaveLength(8);
      }

      const entries = everyone.map((socket, index) => ({ socket, recorder: recorders[index] as Recorder }));
      const isTheirTurn = (entry: (typeof entries)[number]): boolean => {
        const view = latestState(entry.recorder).self.view;
        return view !== null && view.status === 'playing' && view.currentPlayerId === view.viewerId;
      };
      const roundIsOver = (): boolean => recorders.every((recorder) => latestState(recorder).room.status === 'finished');

      const botRandom = createSeededRandom(99);
      let commands = 0;
      const history: string[] = [];
      while (commands < MAX_COMMANDS) {
        await waitFor(() => roundIsOver() || entries.some(isTheirTurn), 'próximo jogador ou fim da rodada', 10_000);
        if (roundIsOver()) break;
        const current = entries.find(isTheirTurn);
        if (current === undefined) throw new Error('jogador da vez ausente');
        const view = latestState(current.recorder).self.view;
        if (view === null) throw new Error('projeção ausente');
        const command = chooseFromView(view, botRandom);
        const roundId = latestState(current.recorder).room.roundId ?? '';
        const ack = await sendCommand(current.socket, roundId, command);
        expect(ack.ok, ack.ok ? '' : `${ack.error.code}: ${ack.error.message}`).toBe(true);
        commands += 1;
        history.push(command.type);
      }
      expect(commands).toBeLessThan(MAX_COMMANDS);
      expect(history.length).toBeGreaterThan(0);
      await waitFor(roundIsOver, 'fim da rodada para todos');

      const finalStates = recorders.map((recorder) => latestState(recorder));
      const finished = finalStates[0];
      if (finished === undefined) throw new Error('sem estado final');
      expect(finished.room.status).toBe('finished');
      const winnerId = finished.self.view?.winnerId;
      expect(winnerId).toBeTruthy();
      for (const state of finalStates) {
        expect(state.room.status).toBe('finished');
        expect(state.self.view?.winnerId).toBe(winnerId);
        const total = state.room.participants.reduce((sum, participant) => sum + participant.score, 0);
        expect(total).toBe(1);
        expect(state.room.lastRound?.winnerId).toBe(winnerId);
      }
      const winnerState = finalStates.find((state) => state.self.playerId === winnerId);
      expect(winnerState?.self.view?.hand).toHaveLength(0);
    },
    180_000,
  );
});

function chooseFromView(view: PlayerView, botRandom: () => number): ClientCommand {
  if (view.phase === 'after-draw') {
    const drawn = view.hand.find((card) => card.id === view.drawnCardId);
    if (drawn !== undefined && view.playableCardIds.includes(drawn.id)) {
      return playCommand(view, drawn.id, botRandom);
    }
    return { type: 'pass' };
  }
  const playableId = view.playableCardIds[Math.floor(botRandom() * view.playableCardIds.length)];
  if (playableId !== undefined) return playCommand(view, playableId, botRandom);
  return { type: 'draw' };
}

function playCommand(view: PlayerView, cardId: string, botRandom: () => number): ClientCommand {
  const card = view.hand.find((candidate) => candidate.id === cardId);
  if (card === undefined) return { type: 'draw' };
  const announceLastCard = view.hand.length - 1 === 1 && botRandom() < 0.5;
  if (card.kind === 'wild') {
    const counts = new Map<Color, number>();
    for (const other of view.hand) {
      if (other.kind !== 'wild') counts.set(other.color, (counts.get(other.color) ?? 0) + 1);
    }
    let best: Color | undefined;
    let bestCount = -1;
    for (const color of COLORS) {
      const count = counts.get(color) ?? 0;
      if (count > bestCount) {
        best = color;
        bestCount = count;
      }
    }
    return { type: 'play', cardId, chosenColor: best ?? COLORS[Math.floor(botRandom() * COLORS.length)] ?? 'red', announceLastCard };
  }
  return { type: 'play', cardId, announceLastCard };
}
