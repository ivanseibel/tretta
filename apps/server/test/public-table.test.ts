import { afterEach, describe, expect, it } from 'vitest';
import { projectPublicTable } from '@tretta/rules';
import {
  connect,
  createRoom,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  leaveRoom,
  record,
  request,
  sendCommand,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type TestClient,
  type TestServer,
} from './helpers.js';
import { scenarioDeck } from './decks.js';

function expectOkAck<T extends { ok: boolean; error?: { message: string } }>(ack: T): Extract<T, { ok: true }> {
  expect(ack.ok, ack.ok ? '' : ack.error?.message).toBe(true);
  return ack as Extract<T, { ok: true }>;
}

describe('mesa pública para quem aguarda', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(): Promise<NonNullable<typeof active>> {
    const clock = new FakeClock();
    const server = await startTestServer({ testHooks: true, clock });
    const clients: TestClient[] = [];
    active = { clock, server, clients };
    return active;
  }

  async function newClient(): Promise<TestClient> {
    if (active === null) throw new Error('setup ausente');
    const socket = await connect(active.server.url);
    active.clients.push(socket);
    return socket;
  }

  afterEach(async () => {
    if (active === null) return;
    for (const client of active.clients) client.disconnect();
    await active.server.close();
    active = null;
  });

  it('quem entra depois vê a mesa pública imediatamente e nas atualizações, sem mão nem compra', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expect((await startRound(host)).ok).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');

    const watcher = await newClient();
    const watcherRec = record(watcher);
    await joinOrFail(watcher, created.roomCode, 'Cai');
    await waitFor(() => latestState(watcherRec).table !== null, 'mesa pública');

    const table = latestState(watcherRec).table;
    if (table === null) throw new Error('mesa pública ausente');
    expect(latestState(watcherRec).self.view).toBeNull();
    expect(latestState(watcherRec).self.waiting).toBe(true);
    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room?.round === null || room?.round === undefined) throw new Error('rodada ausente');
    const engineView = projectPublicTable(room.round.state);
    expect(table).toEqual(engineView);

    // Dados públicos presentes; nenhum segredo no transporte de quem espera.
    const json = JSON.stringify(watcherRec.packets);
    expect(json).not.toMatch(/"hand":/);
    expect(json).not.toContain('drawnCardId');
    expect(json).not.toContain('credential');
    for (const seat of room.round.state.seats) {
      for (const card of seat.hand) {
        // A mão nunca aparece; o topo do descarte público pode aparecer.
        if (card.id === table.discardTop.id) continue;
        expect(json).not.toContain(`"${card.id}"`);
      }
    }
    for (const card of room.round.state.drawPile) {
      expect(json).not.toContain(`"${card.id}"`);
    }

    // Atualização ao vivo: jogada humana reflete na mesa pública de quem espera.
    const roundId = room.round.id;
    if (latestState(hostRec).self.view?.currentPlayerId === created.playerId) {
      expect((await sendCommand(host, roundId, { type: 'play', cardId: 'red-1-1' })).ok).toBe(true);
    }
    await waitFor(
      () => latestState(watcherRec).table?.discardTop.id !== table.discardTop.id ||
        latestState(watcherRec).table?.currentPlayerId !== table.currentPlayerId,
      'atualização da mesa',
    );
    const updated = latestState(watcherRec).table;
    expect(updated).not.toBeNull();
    expect(updated?.players.map((player) => player.handCount)).toEqual(room.round.state.seats.map((seat) => seat.hand.length));

    // Quem espera não comanda a rodada.
    const denied = await request<{ ok: boolean; error?: { code: string } }>(watcher, 'client:command', {
      intentId: intent(),
      roundId,
      command: { type: 'draw' },
    });
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe('WAITING_FOR_NEXT_ROUND');
    expect(joined.playerId).not.toBe(created.playerId);
  });

  it('pausa mantém a mesa visível e sem avanço; nova preparação limpa a projeção', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expect((await startRound(host)).ok).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const watcher = await newClient();
    const watcherRec = record(watcher);
    await joinOrFail(watcher, created.roomCode, 'Cai');
    await waitFor(() => latestState(watcherRec).table !== null, 'mesa pública');
    const beforePause = latestState(watcherRec).table;

    guest.disconnect();
    await waitFor(() => latestState(watcherRec).room.status === 'paused', 'pausa');
    const pausedTable = latestState(watcherRec).table;
    expect(pausedTable).not.toBeNull();
    // A pausa não avança a mesa: mesmos dados públicos do turno pausado.
    expect(pausedTable?.discardTop).toEqual(beforePause?.discardTop);
    expect(pausedTable?.currentPlayerId).toBe(beforePause?.currentPlayerId);
    expect(pausedTable?.drawPileCount).toBe(beforePause?.drawPileCount);
    expect(pausedTable?.players).toEqual(beforePause?.players);

    // Retomada e fim: mesa continua coerente, depois desaparece na preparação.
    ctx.clock.advance(90_000);
    expect((await request<{ ok: boolean }>(host, 'client:continueRound', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(watcherRec).room.status === 'playing', 'retomada');
    expect(latestState(watcherRec).table).not.toBeNull();
    expect((await request<{ ok: boolean }>(host, 'client:endRoundWithoutWinner', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(watcherRec).room.status === 'finished', 'resultado');
    expect(latestState(watcherRec).table?.status).toBe('finished');
    expect((await request<{ ok: boolean }>(host, 'client:returnToLobby', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(watcherRec).room.status === 'lobby', 'preparação');
    expect(latestState(watcherRec).table).toBeNull();
  });

  it('anfitrião que aguarda durante a pausa mantém os controles administrativos', async () => {
    const ctx = await setup();
    const host = await newClient();
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    const joined = expectOkAck(await joinOrFail(guest, created.roomCode, 'Bia'));
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expect((await startRound(host)).ok).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');

    // Quem espera entra; a ausência de Bia pausa a rodada; o anfitrião sai em
    // seguida e o papel passa a quem espera (único conectado).
    const watcher = await newClient();
    const watcherRec = record(watcher);
    const watched = expectOkAck(await joinOrFail(watcher, created.roomCode, 'Cai'));
    guest.disconnect();
    await waitFor(() => latestState(watcherRec).room.status === 'paused', 'pausa');
    expect((await leaveRoom(host)).ok).toBe(true);
    await waitFor(() => latestState(watcherRec).room.hostId === watched.playerId, 'transferência do anfitrião');

    expect(latestState(watcherRec).self.view).toBeNull();
    expect(latestState(watcherRec).table).not.toBeNull();
    ctx.clock.advance(90_000);
    const substituted = await request<{ ok: boolean }>(watcher, 'client:substituteAbsent', { intentId: intent(), targetId: joined.playerId });
    expect(substituted.ok).toBe(true);
    expect((await request<{ ok: boolean }>(watcher, 'client:endRoundWithoutWinner', { intentId: intent() })).ok).toBe(true);
    await waitFor(() => latestState(watcherRec).room.status === 'finished', 'encerramento pelo anfitrião que aguarda');
  });

  it('todos os participantes recebem a mesma mesa pública no mesmo estado', async () => {
    const ctx = await setup();
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await newClient();
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    expect((await startRound(host)).ok).toBe(true);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
    const watcher = await newClient();
    const watcherRec = record(watcher);
    await joinOrFail(watcher, created.roomCode, 'Cai');
    await waitFor(() => latestState(watcherRec).table !== null, 'mesa pública');

    const room = ctx.server.server.rooms.debugRoom(created.roomCode);
    if (room?.round === null || room?.round === undefined) throw new Error('rodada ausente');
    const engineView = projectPublicTable(room.round.state);
    expect(latestState(hostRec).table).toEqual(engineView);
    expect(latestState(guestRec).table).toEqual(engineView);
    expect(latestState(watcherRec).table).toEqual(engineView);
  });
});
