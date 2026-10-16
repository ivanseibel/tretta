import { afterEach, describe, expect, it } from 'vitest';
import type { RandomSource, RoundEvent } from '@tretta/rules';
import type { AutomaticEffect, EffectVariant, EventsMessage } from '@tretta/protocol';
import { EFFECT_VARIANT_IDS, EFFECT_VARIANTS } from '@tretta/protocol/shared';
import { deriveAutomaticEffects, type EffectDerivationOptions } from '../src/effects.js';
import { DEFAULT_BOT_DELAY_MS } from '../src/rooms.js';
import {
  connect,
  createRoom,
  endRoundWithoutWinner,
  expectOk,
  FakeClock,
  intent,
  joinOrFail,
  latestState,
  leaveRoom,
  record,
  request,
  returnToLobby,
  sendCommand,
  setEffectVariant,
  setNextDeck,
  setReady,
  startRound,
  startTestServer,
  waitFor,
  type Recorder,
  type TestClient,
  type TestServer,
} from './helpers.js';
import {
  buildDeck,
  challengeDeck,
  penaltyDeck,
  reverseDeck,
  scenarioDeck,
  skipDeck,
  twoSkipsDeck,
} from './decks.js';

function effectsOf<T extends AutomaticEffect['category']>(
  batch: EventsMessage,
  category: T,
): Extract<AutomaticEffect, { category: T }>[] {
  return batch.effects.filter((effect): effect is Extract<AutomaticEffect, { category: T }> => effect.category === category);
}

describe('derivação pura de efeitos automáticos', () => {
  function makeOptions(): EffectDerivationOptions {
    let idSeq = 0;
    return {
      roundId: 'r_1',
      firstSeq: 1,
      pickVariant: (category) => EFFECT_VARIANTS[category][0],
      nextId: () => `fx_${(idSeq += 1)}`,
      nicknameOf: (id): string | null => ({ p1: 'Ana', p2: 'Bia' })[id] ?? null,
      isSubstitute: (id): boolean => id === 'p2',
    };
  }

  it('mapeia grupos aprovados, descarta compra voluntária e congela dados públicos', () => {
    const options = makeOptions();
    const events: RoundEvent[] = [
      { type: 'drew', playerId: 'p1', reason: 'voluntary', requested: 1, drawn: 1, reshuffled: false },
      { type: 'drew', playerId: 'p1', reason: 'penalty', requested: 2, drawn: 2, reshuffled: false },
      { type: 'turnSkipped', playerId: 'p2' },
      { type: 'directionChanged', direction: 'counterclockwise' },
      { type: 'roundFinished', winnerId: 'p2' },
      { type: 'played', playerId: 'p1', card: { id: 'red-1-1', kind: 'number', color: 'red', value: 1 }, chosenColor: null },
    ];
    const effects = deriveAutomaticEffects(events, options);

    expect(effects.map((effect) => effect.category)).toEqual(['penaltyDraw', 'blocked', 'directionReversed', 'victory']);
    expect(effects.map((effect) => effect.eventIndex)).toEqual([1, 2, 3, 4]);
    expect(effects.map((effect) => effect.seq)).toEqual([1, 2, 3, 4]);
    expect(new Set(effects.map((effect) => effect.id)).size).toBe(4);
    const penalty = effects[0];
    if (penalty?.category !== 'penaltyDraw') throw new Error('esperava penalidade');
    expect(penalty).toMatchObject({
      targetId: 'p1',
      targetNickname: 'Ana',
      drawn: 2,
      requested: 2,
      reason: 'penalty',
      variant: 'cards-rain',
    });
    const victory = effects[3];
    if (victory?.category !== 'victory') throw new Error('esperava vitória');
    expect(victory).toMatchObject({ winnerNickname: 'Bia', substitute: true });
    const reversed = effects[2];
    if (reversed?.category !== 'directionReversed') throw new Error('esperava inversão');
    expect(reversed.direction).toBe('counterclockwise');
    // O evento final não gerou efeito: a lista termina no quarto grupo.
    expect(effects).toHaveLength(4);
  });

  it('conserva compra parcial ou nula e descarta efeito sem apelido público', () => {
    const options = makeOptions();
    const events: RoundEvent[] = [
      { type: 'drew', playerId: 'p1', reason: 'penalty', requested: 4, drawn: 0, reshuffled: true },
      { type: 'drew', playerId: 'p9', reason: 'challenge', requested: 2, drawn: 2, reshuffled: false },
      { type: 'turnSkipped', playerId: 'p9' },
    ];
    const effects = deriveAutomaticEffects(events, options);
    expect(effects).toHaveLength(1);
    const penalty = effects[0];
    if (penalty?.category !== 'penaltyDraw') throw new Error('esperava penalidade');
    expect(penalty).toMatchObject({ drawn: 0, requested: 4, reason: 'penalty' });
    // participante retirado (nicknameOf null): sem efeito e sem seq consumida.
    expect(penalty.seq).toBe(1);
  });
});

describe('efeitos automáticos no transporte do servidor', () => {
  let active: { clock: FakeClock; server: TestServer; clients: TestClient[] } | null = null;

  async function setup(options: { effectRandomFactory?: () => RandomSource; testHooks?: boolean } = {}): Promise<{
    clock: FakeClock;
    server: TestServer;
  }> {
    const clock = new FakeClock();
    const server = await startTestServer({
      testHooks: options.testHooks ?? true,
      clock,
      ...(options.effectRandomFactory === undefined ? {} : { effectRandomFactory: options.effectRandomFactory }),
    });
    active = { clock, server, clients: [] };
    return { clock, server };
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

  interface Fixture {
    host: TestClient;
    guest: TestClient;
    hostRec: Recorder;
    guestRec: Recorder;
    third: { socket: TestClient; rec: Recorder; playerId: string } | null;
    roomCode: string;
    roundId: string;
    hostId: string;
    guestId: string;
  }

  async function makePlaying(
    deck: readonly string[],
    options: { playerCount?: 2 | 3; variant?: EffectVariant | null } = {},
  ): Promise<Fixture> {
    const playerCount = options.playerCount ?? 2;
    const host = await newClient();
    const hostRec = record(host);
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    if (options.variant !== undefined) {
      expectOk(await setEffectVariant(host, created.roomCode, options.variant));
    }
    const guest = await newClient();
    const guestRec = record(guest);
    expectOk(await joinOrFail(guest, created.roomCode, 'Bia'));
    let third: Fixture['third'] = null;
    if (playerCount === 3) {
      const socket = await newClient();
      const rec = record(socket);
      const joined = await joinOrFail(socket, created.roomCode, 'Cai');
      if (!joined.ok) throw new Error('terceira entrada falhou');
      third = { socket, rec, playerId: joined.playerId };
    }
    expectOk(await setNextDeck(host, created.roomCode, deck));
    expectOk(await setReady(host, true));
    expectOk(await setReady(guest, true));
    if (third !== null) expectOk(await setReady(third.socket, true));
    expectOk(await startRound(host));
    await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada em andamento');
    return {
      host,
      guest,
      hostRec,
      guestRec,
      third,
      roomCode: created.roomCode,
      roundId: latestState(hostRec).room.roundId ?? '',
      hostId: latestState(hostRec).self.playerId,
      guestId: latestState(guestRec).self.playerId,
    };
  }

  function lastBatch(recorder: Recorder): EventsMessage {
    const batch = recorder.events[recorder.events.length - 1];
    if (batch === undefined) throw new Error('nenhum lote de eventos recebido');
    return batch;
  }

  async function playAndCatchBatch(fixture: Fixture, command: Record<string, unknown>): Promise<EventsMessage> {
    const before = fixture.hostRec.events.length;
    const ack = await sendCommand(fixture.host, fixture.roundId, command);
    expectOk(ack);
    await waitFor(() => fixture.hostRec.events.length > before, 'lote de eventos');
    return lastBatch(fixture.hostRec);
  }

  /** Sequência determinística de scenarioDeck (semente 7): Ana vence com o coringa. */
  async function driveHostVictory(fixture: Fixture): Promise<void> {
    const steps: Array<[TestClient, Record<string, unknown>]> = [
      [fixture.host, { type: 'play', cardId: 'red-1-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-2-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'play', cardId: 'red-7-1' }],
      [fixture.host, { type: 'play', cardId: 'red-3-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-4-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-5-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-6-1', announceLastCard: true }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'wild-color-1', chosenColor: 'green' }],
    ];
    for (const [socket, command] of steps) {
      expectOk(await sendCommand(socket, fixture.roundId, command));
    }
    await waitFor(() => latestState(fixture.hostRec).room.status === 'finished', 'fim da rodada');
  }

  /**
   * Dirige os três assentos até a primeira Inversão vermelha: quem não tem
   * inversão jogável compra e passa. Não depende de quem abre a rodada.
   */
  async function playOpeningReverse(fixture: Fixture): Promise<EventsMessage> {
    const reverseByPlayer = new Map<string, { socket: TestClient; rec: Recorder; reverseId: string }>([
      [fixture.hostId, { socket: fixture.host, rec: fixture.hostRec, reverseId: 'red-reverse-1' }],
      [fixture.guestId, { socket: fixture.guest, rec: fixture.guestRec, reverseId: 'red-reverse-2' }],
    ]);
    for (let guard = 0; guard < 60; guard++) {
      const candidates = [
        { socket: fixture.host, rec: fixture.hostRec, playerId: fixture.hostId },
        { socket: fixture.guest, rec: fixture.guestRec, playerId: fixture.guestId },
        ...(fixture.third === null
          ? []
          : [{ socket: fixture.third.socket, rec: fixture.third.rec, playerId: fixture.third.playerId }]),
      ];
      const current = candidates.find(
        (player) => latestState(player.rec).self.view?.currentPlayerId === player.playerId,
      );
      if (current === undefined) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }
      const view = latestState(current.rec).self.view;
      if (view === null) throw new Error('sem projeção');
      const holder = reverseByPlayer.get(current.playerId);
      if (holder !== undefined && view.playableCardIds.includes(holder.reverseId)) {
        const before = fixture.hostRec.events.length;
        expectOk(await sendCommand(holder.socket, fixture.roundId, { type: 'play', cardId: holder.reverseId }));
        await waitFor(() => fixture.hostRec.events.length > before, 'lote da inversão');
        return lastBatch(fixture.hostRec);
      }
      // Sem inversão disponível: compra e passa a vez.
      expectOk(await sendCommand(current.socket, fixture.roundId, { type: 'draw' }));
      expectOk(await sendCommand(current.socket, fixture.roundId, { type: 'pass' }));
      await waitFor(
        () => latestState(current.rec).self.view?.currentPlayerId !== current.playerId,
        'turno seguinte da inversão',
      );
    }
    throw new Error('a inversão não ocorreu dentro do limite');
  }

  it('lote de +2 carrega penaltyDraw e blocked iguais para jogadores e expectador, sem segredos', async () => {
    await setup();
    const fixture = await makePlaying(penaltyDeck());
    const watcher = await newClient();
    const watcherRec = record(watcher);
    expectOk(await joinOrFail(watcher, fixture.roomCode, 'Cai'));
    await waitFor(() => latestState(watcherRec).table !== null, 'expectador na mesa');

    const batch = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-draw-two-1' });
    expect(batch.events.map((event) => event.type)).toEqual(['played', 'drew', 'turnSkipped']);
    expect(batch.effects).toHaveLength(2);
    const penalty = effectsOf(batch, 'penaltyDraw')[0];
    const blocked = effectsOf(batch, 'blocked')[0];
    if (penalty === undefined || blocked === undefined) throw new Error('esperava penalidade e bloqueio');
    expect(penalty).toMatchObject({
      roundId: fixture.roundId,
      seq: 1,
      eventIndex: 1,
      targetId: fixture.guestId,
      targetNickname: 'Bia',
      drawn: 2,
      requested: 2,
      reason: 'penalty',
    });
    expect(EFFECT_VARIANTS.penaltyDraw).toContain(penalty.variant);
    expect(blocked).toMatchObject({ roundId: fixture.roundId, seq: 2, eventIndex: 2, playerId: fixture.guestId, playerNickname: 'Bia' });
    expect(EFFECT_VARIANTS.blocked).toContain(blocked.variant);
    expect(penalty.id).not.toBe(blocked.id);

    // Mesmo lote, mesmos efeitos, para quem joga e quem assiste.
    await waitFor(() => watcherRec.events.length === fixture.hostRec.events.length, 'lote no expectador');
    expect(JSON.stringify(lastBatch(fixture.guestRec))).toBe(JSON.stringify(batch));
    expect(JSON.stringify(lastBatch(watcherRec))).toBe(JSON.stringify(batch));

    // Efeitos carregam dados públicos, nunca mãos nem pilha.
    const json = JSON.stringify(fixture.hostRec.events);
    expect(json).not.toMatch(/"hand":/);
    expect(json).not.toContain('drawnCardId');
    expect(json).not.toContain('credential');
  });

  it('dois lotes de Bloqueio seguem seq monotônico por sala com ids distintos', async () => {
    await setup();
    const fixture = await makePlaying(twoSkipsDeck(), { variant: 'brick-wall' });

    const first = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-skip-1' });
    expect(effectsOf(first, 'blocked')).toHaveLength(1);
    expect(effectsOf(first, 'blocked')[0]?.seq).toBe(1);

    const second = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-skip-2' });
    const blockedSecond = effectsOf(second, 'blocked')[0];
    if (blockedSecond === undefined) throw new Error('segundo lote sem bloqueio');
    expect(blockedSecond.seq).toBe(2);
    expect(blockedSecond.id).not.toBe(effectsOf(first, 'blocked')[0]?.id);
    expect(blockedSecond.variant).toBe('brick-wall');
  });

  it('Inversão com três assentos gera directionReversed sem bloquear ninguém', async () => {
    await setup();
    const fixture = await makePlaying(reverseDeck(), { playerCount: 3 });
    const batch = await playOpeningReverse(fixture);
    expect(batch.events.map((event) => event.type)).toEqual(['played', 'directionChanged']);
    const reversed = effectsOf(batch, 'directionReversed')[0];
    if (reversed === undefined) throw new Error('esperava inversão');
    expect(reversed).toMatchObject({ roundId: fixture.roundId, seq: 1, eventIndex: 1, direction: 'counterclockwise' });
    expect(EFFECT_VARIANTS.directionReversed).toContain(reversed.variant);
    expect(effectsOf(batch, 'blocked')).toHaveLength(0);
  });

  it('denúncia gera penaltyDraw reason challenge naquele lote, com seq da primeira emissão', async () => {
    await setup();
    const fixture = await makePlaying(challengeDeck());
    const steps: Array<[TestClient, Record<string, unknown>]> = [
      [fixture.host, { type: 'play', cardId: 'red-1-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-2-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-3-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-4-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-5-1' }],
      [fixture.guest, { type: 'draw' }],
      [fixture.guest, { type: 'pass' }],
      [fixture.host, { type: 'play', cardId: 'red-6-1' }],
    ];
    for (const [socket, command] of steps) {
      expectOk(await sendCommand(socket, fixture.roundId, command));
    }
    // Nenhum lote até aqui gerou efeito: compras são voluntárias e descartes simples.
    expect(fixture.hostRec.events.flatMap((entry) => entry.effects)).toHaveLength(0);

    const before = fixture.hostRec.events.length;
    expectOk(await sendCommand(fixture.guest, fixture.roundId, { type: 'challengeLastCard', targetId: fixture.hostId }));
    await waitFor(() => fixture.hostRec.events.length > before, 'lote da denúncia');
    const batch = lastBatch(fixture.hostRec);
    expect(batch.events.map((event) => event.type)).toEqual(['drew', 'challengeAccepted']);
    const penalty = effectsOf(batch, 'penaltyDraw')[0];
    if (penalty === undefined) throw new Error('esperava penalidade da denúncia');
    expect(penalty).toMatchObject({ seq: 1, eventIndex: 0, targetId: fixture.hostId, targetNickname: 'Ana', drawn: 2, requested: 2, reason: 'challenge' });
    expect(effectsOf(batch, 'blocked')).toHaveLength(0);
  });

  it('vitória humana gera victory congelado antes do encerramento da rodada', async () => {
    await setup();
    const fixture = await makePlaying(scenarioDeck(), { variant: 'trophy' });
    await driveHostVictory(fixture);
    const batch = lastBatch(fixture.hostRec);
    expect(batch.events.map((event) => event.type)).toEqual(['played', 'roundFinished']);
    const victory = effectsOf(batch, 'victory')[0];
    if (victory === undefined) throw new Error('esperava vitória');
    expect(victory).toMatchObject({
      roundId: fixture.roundId,
      seq: 1,
      eventIndex: 1,
      winnerId: fixture.hostId,
      winnerNickname: 'Ana',
      substitute: false,
      variant: 'trophy',
    });
  });

  it(
    'vitória de substituto congela substitute true antes da retirada da vaga',
    async () => {
      const { clock } = await setup();
    const fixture = await makePlaying(
      buildDeck({
        hands: [
          ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
          ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
        ],
        discard: 'red-9-1',
        draw: ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1'],
      }),
      { variant: 'confetti' },
    );
    expectOk(await leaveRoom(fixture.guest));

    for (let guard = 0; guard < 80; guard++) {
      const state = latestState(fixture.hostRec);
      if (state.room.status === 'finished') break;
      const view = state.self.view;
      if (view === null) throw new Error('sem projeção');
      if (view.currentPlayerId === fixture.hostId) {
        expectOk(await sendCommand(fixture.host, fixture.roundId, { type: 'draw' }));
        expectOk(await sendCommand(fixture.host, fixture.roundId, { type: 'pass' }));
        await waitFor(() => latestState(fixture.hostRec).self.view?.currentPlayerId !== fixture.hostId, 'turno seguinte');
      } else {
        const version = state.room.version;
        clock.advance(DEFAULT_BOT_DELAY_MS);
        await waitFor(() => latestState(fixture.hostRec).room.version > version, 'ação do substituto');
      }
    }
    expect(latestState(fixture.hostRec).room.status).toBe('finished');

    const batch = lastBatch(fixture.hostRec);
    const victory = effectsOf(batch, 'victory')[0];
    if (victory === undefined) throw new Error('esperava vitória do substituto');
    expect(victory).toMatchObject({
      winnerId: fixture.guestId,
      winnerNickname: 'Bia',
      substitute: true,
      variant: 'confetti',
    });
    expect(latestState(fixture.hostRec).room.lastRound).toMatchObject({ substitute: true, winnerNickname: 'Bia' });
    },
    30_000,
  );

  it('compra voluntária não gera efeito e encerrar sem vencedor não transmite lote', async () => {
    await setup();
    const fixture = await makePlaying(penaltyDeck());

    expectOk(await sendCommand(fixture.host, fixture.roundId, { type: 'draw' }));
    await waitFor(() => fixture.hostRec.events.length > 0, 'lote da compra');
    const batch = lastBatch(fixture.hostRec);
    expect(batch.events.map((event) => event.type)).toEqual(['drew']);
    expect(batch.effects).toHaveLength(0);

    expectOk(await endRoundWithoutWinner(fixture.host));
    await waitFor(() => latestState(fixture.hostRec).room.status === 'finished', 'encerramento');
    expect(fixture.hostRec.events).toHaveLength(1);
  });

  it('replay do comando não repete o lote nem os efeitos', async () => {
    await setup();
    const fixture = await makePlaying(penaltyDeck());
    const commandIntent = intent();
    const before = fixture.hostRec.events.length;
    const first = await sendCommand(fixture.host, fixture.roundId, { type: 'play', cardId: 'red-draw-two-1' }, commandIntent);
    expectOk(first);
    await waitFor(() => fixture.hostRec.events.length > before, 'lote original');
    const ids = lastBatch(fixture.hostRec).effects.map((effect) => effect.id);

    const replay = await sendCommand(fixture.host, fixture.roundId, { type: 'play', cardId: 'red-draw-two-1' }, commandIntent);
    expect(replay).toEqual(first);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fixture.hostRec.events).toHaveLength(before + 1);
    expect(lastBatch(fixture.hostRec).effects.map((effect) => effect.id)).toEqual(ids);
  });

  it('ganchos desativados recusam o evento de variação', async () => {
    const { server } = await setup({ testHooks: false });
    const host = await newClient();
    const created = await createRoom(host, 'Ana');
    if (!created.ok) throw new Error('criação falhou');
    const response = await request<{ ok: boolean; error?: { code: string } }>(host, 'test:setEffectVariant', {
      intentId: intent(),
      roomCode: created.roomCode,
      variant: 'confetti',
    });
    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe('TEST_HOOKS_DISABLED');
    expect(server.server.rooms.debugRoom(created.roomCode)?.effectVariantOverride).toBeNull();
  });

  it('não-anfitrião não fixa variação e variação de outra categoria não veste o efeito', async () => {
    await setup();
    const fixture = await makePlaying(penaltyDeck());
    const denied = await request<{ ok: boolean; error?: { code: string } }>(fixture.guest, 'test:setEffectVariant', {
      intentId: intent(),
      roomCode: fixture.roomCode,
      variant: 'cards-rain',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe('NOT_HOST');

    // Gancho pedido para outra categoria: o efeito usa o RNG cosmético da própria.
    expectOk(await setEffectVariant(fixture.host, fixture.roomCode, 'confetti'));
    const batch = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-draw-two-1' });
    const penalty = effectsOf(batch, 'penaltyDraw')[0];
    if (penalty === undefined) throw new Error('esperava penalidade');
    expect(EFFECT_VARIANTS.penaltyDraw).toContain(penalty.variant);
    expect(penalty.variant).not.toBe('confetti');
  });

  it(
    'ganche fixa as oito variações (duas por categoria) em rodadas controladas',
    async () => {
      await setup();

      const penaltyDeckFixture = await makePlaying(penaltyDeck(), { variant: 'cards-avalanche' });
      const penaltyBatch = await playAndCatchBatch(penaltyDeckFixture, { type: 'play', cardId: 'red-draw-two-1' });
      expect(effectsOf(penaltyBatch, 'penaltyDraw')[0]?.variant).toBe('cards-avalanche');
      // O bloqueio do mesmo lote não tem gancho desta categoria: só precisa ser variação válida.
      expect(EFFECT_VARIANTS.blocked).toContain(effectsOf(penaltyBatch, 'blocked')[0]?.variant);

      const skipFixture = await makePlaying(skipDeck(), { variant: 'stumble' });
      const skipBatch = await playAndCatchBatch(skipFixture, { type: 'play', cardId: 'red-skip-1' });
      expect(effectsOf(skipBatch, 'blocked')[0]?.variant).toBe('stumble');

      const rainFixture = await makePlaying(penaltyDeck(), { variant: 'cards-rain' });
      const rainBatch = await playAndCatchBatch(rainFixture, { type: 'play', cardId: 'red-draw-two-1' });
      expect(effectsOf(rainBatch, 'penaltyDraw')[0]?.variant).toBe('cards-rain');

      const wallFixture = await makePlaying(twoSkipsDeck(), { variant: 'brick-wall' });
      const wallBatch = await playAndCatchBatch(wallFixture, { type: 'play', cardId: 'red-skip-1' });
      expect(effectsOf(wallBatch, 'blocked')[0]?.variant).toBe('brick-wall');

      const boomerangFixture = await makePlaying(reverseDeck(), { playerCount: 3, variant: 'boomerang' });
      const boomerangBatch = await playOpeningReverse(boomerangFixture);
      expect(effectsOf(boomerangBatch, 'directionReversed')[0]?.variant).toBe('boomerang');

      const windmillFixture = await makePlaying(reverseDeck(), { playerCount: 3, variant: 'windmill' });
      const windmillBatch = await playOpeningReverse(windmillFixture);
      expect(effectsOf(windmillBatch, 'directionReversed')[0]?.variant).toBe('windmill');

      const confettiFixture = await makePlaying(scenarioDeck(), { variant: 'confetti' });
      await driveHostVictory(confettiFixture);
      expect(effectsOf(lastBatch(confettiFixture.hostRec), 'victory')[0]?.variant).toBe('confetti');

      const trophyFixture = await makePlaying(scenarioDeck(), { variant: 'trophy' });
      await driveHostVictory(trophyFixture);
      expect(effectsOf(lastBatch(trophyFixture.hostRec), 'victory')[0]?.variant).toBe('trophy');

      // As oito variações existem e todas foram exercitadas.
      expect(EFFECT_VARIANT_IDS).toHaveLength(8);
      const exercised = new Set<string>([
        'cards-avalanche',
        'cards-rain',
        'brick-wall',
        'stumble',
        'boomerang',
        'windmill',
        'confetti',
        'trophy',
      ]);
      for (const variant of exercised) expect(EFFECT_VARIANT_IDS).toContain(variant);
    },
    60_000,
  );

  describe('RNG cosmetico independente das regras', () => {
    function ruleFingerprint(server: TestServer, roomCode: string): string {
      const room = server.server.rooms.debugRoom(roomCode);
      const state = room?.round?.state;
      if (state === undefined || state === null) throw new Error('rodada ausente');
      return JSON.stringify({
        hands: state.seats.map((seat) => seat.hand.map((card) => card.id)),
        drawPile: state.drawPile.map((card) => card.id),
        discardPile: state.discardPile.map((card) => card.id),
        direction: state.direction,
        currentIndex: state.currentIndex,
        status: state.status,
        winnerId: state.winnerId,
      });
    }

    async function playPenaltyWithRandom(effectRandom: () => number): Promise<{
      variant: EffectVariant | undefined;
      fingerprint: string;
    }> {
      const server = await startTestServer({
        testHooks: true,
        effectRandomFactory: (): RandomSource => effectRandom,
      });
      try {
        const host = await connect(server.url);
        const hostRec = record(host);
        const created = await createRoom(host, 'Ana');
        if (!created.ok) throw new Error('criação falhou');
        const guest = await connect(server.url);
        const guestRec = record(guest);
        expectOk(await joinOrFail(guest, created.roomCode, 'Bia'));
        expectOk(await setNextDeck(host, created.roomCode, penaltyDeck()));
        expectOk(await setReady(host, true));
        expectOk(await setReady(guest, true));
        expectOk(await startRound(host));
        await waitFor(() => latestState(guestRec).room.status === 'playing', 'rodada');
        const before = hostRec.events.length;
        expectOk(await sendCommand(host, latestState(hostRec).room.roundId ?? '', { type: 'play', cardId: 'red-draw-two-1' }));
        await waitFor(() => hostRec.events.length > before, 'lote');
        const batch = hostRec.events[hostRec.events.length - 1];
        if (batch === undefined) throw new Error('lote ausente');
        const penalty = effectsOf(batch, 'penaltyDraw')[0];
        host.disconnect();
        guest.disconnect();
        return { variant: penalty?.variant, fingerprint: ruleFingerprint(server, created.roomCode) };
      } finally {
        await server.close();
      }
    }

    it('mesma semente com RNG cosmetico diferente: regras idênticas, variação oposta', async () => {
      const low = await playPenaltyWithRandom(() => 0.1);
      const high = await playPenaltyWithRandom(() => 0.9);
      expect(low.variant).toBe('cards-rain');
      expect(high.variant).toBe('cards-avalanche');
      expect(low.fingerprint).toBe(high.fingerprint);
    });

    it('limpar o gancho volta a escolher pelo RNG cosmetico da sala', async () => {
      const { server } = await setup({ effectRandomFactory: (): RandomSource => () => 0.9 });
      const fixture = await makePlaying(penaltyDeck(), { variant: 'cards-rain' });
      const overridden = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-draw-two-1' });
      expect(effectsOf(overridden, 'penaltyDraw')[0]?.variant).toBe('cards-rain');

      expectOk(await endRoundWithoutWinner(fixture.host));
      await waitFor(() => latestState(fixture.hostRec).room.status === 'finished', 'fim');
      expectOk(await returnToLobby(fixture.host));
      await waitFor(() => latestState(fixture.hostRec).room.status === 'lobby', 'preparação');
      expectOk(await setEffectVariant(fixture.host, fixture.roomCode, null));
      expectOk(await setNextDeck(fixture.host, fixture.roomCode, penaltyDeck()));
      expectOk(await setReady(fixture.host, true));
      expectOk(await setReady(fixture.guest, true));
      expectOk(await startRound(fixture.host));
      await waitFor(() => latestState(fixture.hostRec).room.status === 'playing', 'rodada nova');
      fixture.roundId = latestState(fixture.hostRec).room.roundId ?? '';
      const byRandom = await playAndCatchBatch(fixture, { type: 'play', cardId: 'red-draw-two-1' });
      expect(effectsOf(byRandom, 'penaltyDraw')[0]?.variant).toBe('cards-avalanche');
      expect(server.server.rooms.debugRoom(fixture.roomCode)?.effectVariantOverride).toBeNull();
    });
  });
});
