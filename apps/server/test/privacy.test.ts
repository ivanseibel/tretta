import { afterEach, describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import { createSeededRandom } from '@tretta/rules';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';
import { createTrettaServer, type TrettaServer } from '../src/server.js';
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
  waitFor,
  type Recorder,
  type TestClient,
} from './helpers.js';
import { scenarioDeck } from './decks.js';

const CARD_ID = /"((?:red|yellow|green|blue|wild)-[^"]+)"/g;

function cardIdsIn(text: string): Set<string> {
  return new Set([...text.matchAll(CARD_ID)].map((match) => match[1] ?? ''));
}

function playedIds(recorder: Recorder): Set<string> {
  const ids = new Set<string>();
  for (const message of recorder.events) {
    for (const event of message.events) {
      if (event.type === 'played') ids.add(event.card.id);
    }
  }
  return ids;
}

describe('privacidade no transporte', () => {
  const servers: TrettaServer[] = [];
  const clients: TestClient[] = [];

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    clients.length = 0;
    for (const server of servers) await server.close();
    servers.length = 0;
  });

  async function start(seed: number): Promise<{ server: TrettaServer; url: string }> {
    const server = createTrettaServer({
      webOrigin: 'http://localhost:3000',
      testHooks: true,
      randomFactory: () => createSeededRandom(seed),
    });
    servers.push(server);
    const port = await server.listen(0);
    return { server, url: `http://127.0.0.1:${port}` };
  }

  async function client(url: string): Promise<TestClient> {
    const socket = await connect(url);
    clients.push(socket);
    return socket;
  }

  it('cada cliente recebe apenas a própria mão; quem espera não recebe mão alguma', async () => {
    const { server, url } = await start(7);
    const host = await client(url);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await client(url);
    const guestRec = record(guest);
    await joinOrFail(guest, created.roomCode, 'Bia');

    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    await startRound(host);

    const watcher = await client(url);
    const watcherRec = record(watcher);
    await joinOrFail(watcher, created.roomCode, 'Cai');

    await sendCommand(host, latestState(hostRec).room.roundId ?? '', { type: 'play', cardId: 'red-1-1' });
    await sendCommand(guest, latestState(hostRec).room.roundId ?? '', { type: 'draw' });
    await sendCommand(guest, latestState(hostRec).room.roundId ?? '', { type: 'pass' });

    const room = server.rooms.debugRoom(created.roomCode);
    if (room?.round === null || room?.round === undefined) throw new Error('rodada ausente');
    const handOf = (nickname: string): string[] =>
      room.round?.state.seats.find((seat) => room.participants.get(seat.id)?.nickname === nickname)?.hand.map((card) => card.id) ??
      [];
    const drawPileIds = room.round.state.drawPile.map((card) => card.id);
    const hostId = latestState(hostRec).self.playerId;
    const guestId = latestState(guestRec).self.playerId;
    const credentialOf = (playerId: string): string => room.participants.get(playerId)?.credential ?? '';

    for (const watcherState of watcherRec.states) {
      expect(watcherState.self.view).toBeNull();
      expect(watcherState.self.waiting).toBe(true);
    }

    const hostTranscript = JSON.stringify(hostRec.packets);
    const guestTranscript = JSON.stringify(guestRec.packets);
    const watcherTranscript = JSON.stringify(watcherRec.packets);

    const discardTops = (recorder: Recorder): string[] =>
      recorder.states.flatMap((state) => (state.self.view === null ? [] : [state.self.view.discardTop.id]));
    // A mesa pública de quem espera revela apenas o topo do descarte, como para os jogadores.
    const publicTops = (recorder: Recorder): string[] =>
      recorder.states.flatMap((state) => (state.table === null ? [] : [state.table.discardTop.id]));

    const hostIds = cardIdsIn(hostTranscript);
    const allowedForHost = new Set([...handOf('Ana'), ...discardTops(hostRec), ...playedIds(hostRec)]);
    for (const id of hostIds) {
      expect(allowedForHost.has(id), `host viu ${id}`).toBe(true);
      expect(handOf('Bia')).not.toContain(id);
    }

    const guestIds = cardIdsIn(guestTranscript);
    const allowedForGuest = new Set([...handOf('Bia'), ...discardTops(guestRec), ...playedIds(guestRec)]);
    for (const id of guestIds) {
      expect(allowedForGuest.has(id), `guest viu ${id}`).toBe(true);
      expect(handOf('Ana')).not.toContain(id);
    }

    const watcherIds = cardIdsIn(watcherTranscript);
    const allowedForWatcher = new Set([...playedIds(watcherRec), ...publicTops(watcherRec)]);
    for (const id of watcherIds) {
      expect(allowedForWatcher.has(id), `watcher viu ${id}`).toBe(true);
    }

    for (const id of drawPileIds) {
      expect(hostTranscript).not.toContain(`"${id}"`);
      expect(guestTranscript).not.toContain(`"${id}"`);
      expect(watcherTranscript).not.toContain(`"${id}"`);
    }

    const watcherId = latestState(watcherRec).self.playerId;
    expect(hostTranscript).not.toContain(credentialOf(hostId));
    expect(hostTranscript).not.toContain(credentialOf(guestId));
    expect(hostTranscript).not.toContain(credentialOf(watcherId));
    expect(guestTranscript).not.toContain(credentialOf(hostId));
    expect(guestTranscript).not.toContain(credentialOf(guestId));
    expect(guestTranscript).not.toContain(credentialOf(watcherId));
    expect(watcherTranscript).not.toContain(credentialOf(hostId));
    expect(watcherTranscript).not.toContain(credentialOf(guestId));
    expect(watcherTranscript).not.toContain(credentialOf(watcherId));
    for (const recorder of [hostRec, guestRec, watcherRec]) {
      expect(JSON.stringify(recorder.states)).not.toContain('credential');
      expect(JSON.stringify(recorder.events)).not.toContain('credential');
    }
  });

  it('substituição e retorno preservam a privacidade do transporte', async () => {
    const clock = new FakeClock();
    const server = createTrettaServer({
      webOrigin: 'http://localhost:3000',
      testHooks: true,
      randomFactory: () => createSeededRandom(7),
      clock,
    });
    servers.push(server);
    const port = await server.listen(0);
    const url = `http://127.0.0.1:${port}`;

    const host = await client(url);
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const guest = await client(url);
    const guestRec = record(guest);
    const joined = await joinOrFail(guest, created.roomCode, 'Bia');
    if (!joined.ok) throw new Error('entrada falhou');
    await setNextDeck(host, created.roomCode, scenarioDeck());
    await setReady(host, true);
    await setReady(guest, true);
    await startRound(host);
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');

    const room = server.rooms.debugRoom(created.roomCode);
    if (room?.round == null) throw new Error('rodada ausente');
    const roundId = room.round.id;
    const guestId = joined.playerId;
    const hostId = latestState(hostRec).self.playerId;
    const guestSeat = room.round.state.seats.find((seat) => seat.id === guestId);
    const guestHandBefore = guestSeat?.hand.map((card) => card.id) ?? [];
    const drawPileBefore = room.round.state.drawPile.map((card) => card.id);

    // Bia sai: o substituto assume; Ana passa a vez para o bot agir.
    expect((await leaveRoom(guest)).ok).toBe(true);
    if (latestState(hostRec).self.view?.currentPlayerId === hostId) {
      expect((await sendCommand(host, roundId, { type: 'draw' })).ok).toBe(true);
      expect((await sendCommand(host, roundId, { type: 'pass' })).ok).toBe(true);
    }
    await waitFor(() => latestState(hostRec).self.view?.currentPlayerId === guestId, 'vez do substituto');
    const versionBeforeBot = latestState(hostRec).room.version;
    clock.advance(DEFAULT_BOT_DELAY_MS);
    await waitFor(() => latestState(hostRec).room.version > versionBeforeBot, 'ação do substituto');

    // Bia retorna pela credencial e recupera a vaga.
    const back = await client(url);
    const backRec = record(back);
    const rejoined = await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(),
      roomCode: created.roomCode,
      nickname: 'Bia',
      avatar: 'lobo',
      credential: joined.credential,
    });
    expect(rejoined.ok, rejoined.ok ? '' : rejoined.error.message).toBe(true);
    await waitFor(
      () => latestState(hostRec).room.participants.find((p) => p.id === guestId)?.autoControlled === false,
      'controle devolvido',
    );

    // A mão de Bia e a ordem da compra nunca aparecem no transporte de Ana;
    // a mão de Ana nunca aparece para Bia; credenciais não vazam para ninguém.
    const hostTranscript = JSON.stringify(hostRec.packets);
    const guestTranscript = JSON.stringify([...guestRec.packets, ...backRec.packets]);
    const hostHand = latestState(hostRec).self.view?.hand.map((card) => card.id) ?? [];
    const hostHandSet = new Set(hostHand);
    const guestFinal = room.round.state.seats.find((seat) => seat.id === guestId)?.hand.map((card) => card.id) ?? [];

    for (const id of [...guestHandBefore, ...drawPileBefore]) {
      if (hostHandSet.has(id)) continue; // cartas que Ana legitimamente comprou
      expect(hostTranscript).not.toContain(`"${id}"`);
    }
    for (const id of hostHand) {
      expect(guestTranscript).not.toContain(`"${id}"`);
    }
    expect(guestFinal.length).toBeGreaterThan(0);
    expect(hostTranscript).not.toContain(room.participants.get(hostId)?.credential ?? '');
    expect(hostTranscript).not.toContain(joined.credential);
    expect(guestTranscript).not.toContain(room.participants.get(hostId)?.credential ?? '');
    expect(guestTranscript).not.toContain(joined.credential);
  });

  it('salas diferentes ficam isoladas, inclusive entre servidores', async () => {
    const first = await start(7);
    const hostA = await client(first.url);
    const hostARec = record(hostA);
    const createdA = await createRoom(hostA, 'Ana');
    if (!createdA.ok) throw new Error('criação falhou');
    const guestA = await client(first.url);
    const guestARec = record(guestA);
    await joinOrFail(guestA, createdA.roomCode, 'Bia');
    await setNextDeck(hostA, createdA.roomCode, scenarioDeck());
    await setReady(hostA, true);
    await setReady(guestA, true);
    await startRound(hostA);

    const second = await start(8);
    const hostB = await client(second.url);
    const hostBRec = record(hostB);
    const createdB = await createRoom(hostB, 'Cai');
    if (!createdB.ok) throw new Error('criação falhou');
    const guestB = await client(second.url);
    const guestBRec = record(guestB);
    await joinOrFail(guestB, createdB.roomCode, 'Duda');
    await setReady(hostB, true);
    await setReady(guestB, true);
    await startRound(hostB);

    const roomA = first.server.rooms.debugRoom(createdA.roomCode);
    const roomB = second.server.rooms.debugRoom(createdB.roomCode);
    if (!roomA?.round || !roomB?.round) throw new Error('rodadas ausentes');
    for (const state of [...hostARec.states, ...guestARec.states]) {
      expect(state.room.roomCode).toBe(createdA.roomCode);
    }
    for (const state of [...hostBRec.states, ...guestBRec.states]) {
      expect(state.room.roomCode).toBe(createdB.roomCode);
    }

    const secretValuesOf = (room: typeof roomA): string[] => [
      ...room.participants.keys(),
      ...[...room.participants.values()].map((participant) => participant.credential),
    ];
    const transcriptA = JSON.stringify([...hostARec.packets, ...guestARec.packets]);
    const transcriptB = JSON.stringify([...hostBRec.packets, ...guestBRec.packets]);
    for (const secret of secretValuesOf(roomA)) {
      expect(transcriptB).not.toContain(secret);
    }
    for (const secret of secretValuesOf(roomB)) {
      expect(transcriptA).not.toContain(secret);
    }
    expect(transcriptB).not.toContain(`"roomCode":"${createdA.roomCode}"`);
    expect(transcriptA).not.toContain(`"roomCode":"${createdB.roomCode}"`);
    expect(createdA.roomCode).not.toBe(createdB.roomCode);
  });
});
