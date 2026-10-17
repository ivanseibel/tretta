import { afterEach, describe, expect, it } from 'vitest';
import {
  connect,
  FakeClock,
  joinRoom,
  latestState,
  record,
  setNextDeck,
  startTestServer,
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { actCurrentPlayer, createTrainingRoom, startTrainingRound, trainingDeck } from './training.js';

function playedIds(recorder: Recorder): Set<string> {
  const ids = new Set<string>();
  for (const message of recorder.events) {
    for (const event of message.events) {
      if (event.type === 'played') ids.add(event.card.id);
    }
  }
  return ids;
}

describe('privacidade na mesa de treino', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<{ clock: FakeClock; server: TestServer; clients: TestClient[] }> {
    const clock = new FakeClock();
    const server = await startTestServer({ testHooks: true, clock });
    const clients: TestClient[] = [];
    active = { clock, server, clients };
    return active;
  }

  async function newClient(server: TestServer): Promise<TestClient> {
    const socket = await connect(server.url);
    active?.clients.push(socket);
    return socket;
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  it('nem mãos de bots nem a ordem da compra aparecem no transporte da pessoa', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    const room = server.server.rooms.debugRoom(created.roomCode);
    if (room?.round == null) throw new Error('rodada ausente');
    const round = room.round;
    const humanId = created.playerId;
    const bots = [...room.participants.values()].filter((entry) => entry.kind === 'bot');
    const botIds = new Set(bots.map((entry) => entry.id));
    const initialBotHands = new Map(
      [...botIds].map((id) => [id, new Set(round.state.seats.find((seat) => seat.id === id)?.hand.map((card) => card.id) ?? [])]),
    );
    const botHandIds = new Set([...initialBotHands.values()].flatMap((ids) => [...ids]));
    const initialPile = new Set(round.state.drawPile.map((card) => card.id));

    // Alguns turnos: a pessoa joga, os bots decidem sozinhos e o lote chega.
    for (let step = 0; step < 8 && latestState(hostRec).room.status === 'playing'; step++) {
      await actCurrentPlayer(clock, host, hostRec);
    }

    const acted = [...botIds].some((id) =>
      hostRec.events.some((message) => message.events.some((event) => 'playerId' in event && event.playerId === id)),
    );
    expect(acted, 'nenhum bot agiu: verificação sem substância').toBe(true);

    const played = playedIds(hostRec);
    const hostHandIds = new Set(latestState(hostRec).self.view?.hand.map((card) => card.id) ?? []);
    const text = JSON.stringify(hostRec.packets);
    for (const id of [...botHandIds, ...initialPile]) {
      if (played.has(id) || hostHandIds.has(id)) continue; // descarte público ou mão da própria pessoa
      expect(text.includes(`"${id}"`), `transporte vazou ${id}`).toBe(false);
    }

    // Credenciais de bot não vazam em nenhuma mensagem.
    for (const bot of bots) {
      expect(text.includes(bot.credential), `credencial do bot ${bot.nickname} vazou`).toBe(false);
    }

    // A pessoa recebe apenas a própria visão; nada de mão alheia projetada.
    for (const state of hostRec.states) {
      expect(state.self.playerId).toBe(humanId);
      if (state.self.view !== null) expect(state.self.view.viewerId).toBe(humanId);
    }

    // Todo descarte de bot vem da própria mão ou da compra — nunca de mão alheia.
    for (const message of hostRec.events) {
      for (const event of message.events) {
        if (event.type !== 'played' || !botIds.has(event.playerId)) continue;
        const fromHand = initialBotHands.get(event.playerId)?.has(event.card.id) ?? false;
        expect(fromHand || initialPile.has(event.card.id), `bot jogou ${event.card.id} fora de mão/pilha`).toBe(true);
      }
    }
  });

  it('sonda sem vínculo é recusada sem receber estado, eventos ou cartas', async () => {
    const { clock, server } = await setup();
    const host = await newClient(server);
    const hostRec = record(host);
    const created = await createTrainingRoom(host);
    if (!created.ok) throw new Error('criação recusada');
    await waitFor(() => hostRec.states.length > 0, 'estado inicial');
    await setNextDeck(host, created.roomCode, trainingDeck());
    await startTrainingRound(host, hostRec);
    await actCurrentPlayer(clock, host, hostRec);

    const intruder = await newClient(server);
    const intruderRec = record(intruder);
    const refused = await joinRoom(intruder, created.roomCode, 'Sonda');
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error('esperava recusa');
    expect(refused.error.code).toBe('TRAINING_ROOM_ENTRY_REFUSED');
    expect(intruderRec.states).toHaveLength(0);
    expect(intruderRec.events).toHaveLength(0);
    expect(intruderRec.packets).toHaveLength(0);
    const room = server.server.rooms.debugRoom(created.roomCode);
    if (room?.round == null) throw new Error('rodada ausente');
    const everyCardId = new Set([
      ...room.round.state.seats.flatMap((seat) => seat.hand.map((card) => card.id)),
      ...room.round.state.drawPile.map((card) => card.id),
      ...room.round.state.discardPile.map((card) => card.id),
    ]);
    for (const id of everyCardId) {
      expect(JSON.stringify(intruderRec.packets).includes(`"${id}"`), `sonda viu ${id}`).toBe(false);
    }
  });
});
