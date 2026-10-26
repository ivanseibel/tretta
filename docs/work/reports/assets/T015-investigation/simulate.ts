import { createSeededRandom, projectForPlayer, randomIndex, type PlayerView } from '../../../../../packages/rules/dist/index.js';
import type { ClientCommand } from '../../../../../packages/protocol/dist/index.js';
import type { Avatar } from '../../../../../packages/protocol/dist/shared.js';
import { decideBotCommand, mostPresentColor } from '../../../../../apps/server/src/bot.js';
import { RoomStore, type Participant, type Room, type RoomTransport } from '../../../../../apps/server/src/rooms.js';
import type { RoomClock, TimerHandle } from '../../../../../apps/server/src/clock.js';

type HumanPolicy = 'mirror-bot' | 'first-legal';
type RngWiring = 'shared-stream' | 'separate-streams';
type Identity = 'Pessoa' | 'Tico' | 'Lila' | 'Nino';

const SEED_START = 0x54524554;
const PERMUTATION_SEEDS = process.argv.includes('--quick') ? 8 : 2_000;
const FIXED_HUMAN_SEAT_SEEDS = process.argv.includes('--quick') ? 8 : 5_000;
const CONTINUITY_SESSIONS = process.argv.includes('--quick') ? 20 : 10_000;
const ROUNDS_PER_SESSION = 13;
const BOT_NAMES: readonly Identity[] = ['Tico', 'Lila', 'Nino'];
const IDENTITIES: readonly Identity[] = ['Pessoa', ...BOT_NAMES];
const POLICIES: readonly HumanPolicy[] = ['mirror-bot', 'first-legal'];
const RNG_WIRINGS: readonly RngWiring[] = ['shared-stream', 'separate-streams'];

class ImmediateClock implements RoomClock {
  private nextId = 1;
  private readonly callbacks = new Map<number, () => void>();

  now(): number {
    return 1_800_000_000_000;
  }

  setTimer(_delayMs: number, callback: () => void): TimerHandle {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  clearTimer(handle: TimerHandle): void {
    this.callbacks.delete(handle as number);
  }

  drain(): number {
    let count = 0;
    while (this.callbacks.size > 0) {
      const entry = this.callbacks.entries().next().value as [number, () => void] | undefined;
      if (entry === undefined) break;
      this.callbacks.delete(entry[0]);
      entry[1]();
      count += 1;
      if (count > 10_000) throw new Error('Limite de callbacks do relógio excedido.');
    }
    return count;
  }
}

const transport: RoomTransport = {
  toSocket: () => undefined,
  toRoom: () => undefined,
  toRoomChat: () => undefined,
  toRoomTaunt: () => undefined,
  toRoomReaction: () => undefined,
  attach: () => undefined,
  detach: () => undefined,
  removed: () => undefined,
};

interface Harness {
  readonly clock: ImmediateClock;
  readonly store: RoomStore;
  readonly room: Room;
  readonly human: Participant;
  readonly idsByIdentity: Map<Identity, string>;
}

function createHarness(seed: number, wiring: RngWiring): Harness {
  const gameRandom = createSeededRandom(seed);
  const effectRandom = wiring === 'shared-stream' ? gameRandom : createSeededRandom((seed ^ 0x5eed) >>> 0);
  const clock = new ImmediateClock();
  const store = new RoomStore(transport, () => gameRandom, {
    clock,
    botDelayMs: 0,
    effectRandomFactory: () => effectRandom,
  });
  const created = store.createRoom({
    socketId: `t015-${seed}`,
    nickname: 'Pessoa',
    avatar: 'raposa' as Avatar,
    mode: 'training',
  });
  if (!created.ok) throw new Error(`Falha ao criar treino: ${created.error.code}`);

  const room = created.room;
  const idsByIdentity = new Map<Identity, string>([['Pessoa', created.participant.id]]);
  for (const participant of room.participants.values()) {
    if (participant.kind === 'bot' && BOT_NAMES.includes(participant.nickname as (typeof BOT_NAMES)[number])) {
      idsByIdentity.set(participant.nickname as (typeof BOT_NAMES)[number], participant.id);
    }
  }
  if (idsByIdentity.size !== 4 || room.mode !== 'training' || room.order.length !== 4) {
    throw new Error('A sala não criou exatamente uma pessoa e os três bots de treino.');
  }
  return { clock, store, room, human: created.participant, idsByIdentity };
}

function humanCommand(view: PlayerView, policy: HumanPolicy): ClientCommand {
  if (policy === 'mirror-bot') {
    const decision = decideBotCommand(view);
    if (decision === null) throw new Error('A política espelhada não recebeu a vez da pessoa.');
    return decision;
  }

  if (view.phase === 'after-draw') {
    const drawnId = view.drawnCardId;
    if (drawnId === null || !view.playableCardIds.includes(drawnId)) return { type: 'pass' };
    const card = view.hand.find((candidate) => candidate.id === drawnId);
    if (card === undefined) throw new Error('A carta recém-comprada não aparece na própria mão.');
    return {
      type: 'play',
      cardId: drawnId,
      ...(card.kind === 'wild' ? { chosenColor: mostPresentColor(view.hand) } : {}),
      ...(view.hand.length === 2 ? { announceLastCard: true } : {}),
    };
  }

  const cardId = view.playableCardIds[0];
  if (cardId === undefined) return { type: 'draw' };
  const card = view.hand.find((candidate) => candidate.id === cardId);
  if (card === undefined) throw new Error('A primeira carta válida não aparece na própria mão.');
  return {
    type: 'play',
    cardId,
    ...(card.kind === 'wild' ? { chosenColor: mostPresentColor(view.hand) } : {}),
    ...(view.hand.length === 2 ? { announceLastCard: true } : {}),
  };
}

function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const suffix of permute(rest)) result.push([item, ...suffix]);
  });
  return result;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomIndex(random, index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

function startTrainingRound(harness: Harness): void {
  const ready = harness.store.setReady(harness.human, true);
  if (!ready.ok) throw new Error(`Falha ao preparar pessoa: ${ready.error.code}`);
  const started = harness.store.startRound(harness.human);
  if (!started.ok) throw new Error(`Falha ao iniciar treino: ${started.error.code}`);
}

function playUntilFinished(harness: Harness, policy: HumanPolicy): { winner: Identity; winningSeat: number; firstPlayerSeat: number } {
  const { room, store, human, clock, idsByIdentity } = harness;
  const initial = room.round;
  if (initial === null) throw new Error('Rodada iniciada sem motor.');
  const firstPlayerId = initial.state.seats[initial.state.currentIndex]?.id;
  const firstPlayerSeat = firstPlayerId === undefined ? -1 : initial.seatIds.indexOf(firstPlayerId);
  if (firstPlayerSeat < 0) throw new Error('Primeiro jogador não corresponde a um assento.');

  for (let step = 0; step < 10_000; step += 1) {
    const round = room.round;
    if (room.status === 'finished' && round !== null) {
      const winnerId = round.state.winnerId;
      if (winnerId === null) throw new Error('Rodada encerrou sem vencedor no jogo comum.');
      const winner = [...idsByIdentity].find(([, id]) => id === winnerId)?.[0];
      const winningSeat = round.seatIds.indexOf(winnerId);
      if (winner === undefined || winningSeat < 0) throw new Error('Vencedor não mapeado para identidade e assento.');
      return { winner, winningSeat, firstPlayerSeat };
    }
    if (round === null || room.status !== 'playing') throw new Error('Estado inesperado durante a rodada.');
    const activeId = round.state.seats[round.state.currentIndex]?.id;
    if (activeId === undefined) throw new Error('Motor sem assento ativo.');

    if (activeId === human.id) {
      const view = projectForPlayer(round.state, human.id);
      const result = store.applyRoundCommand(human, round.id, humanCommand(view, policy));
      if (!result.ok) throw new Error(`Comando simulado recusado: ${result.error.code}`);
    } else {
      const before = room.version;
      const callbacks = clock.drain();
      if (callbacks === 0 || (room.status === 'playing' && room.version === before)) {
        throw new Error('Assento de bot não produziu ação no agendador do servidor.');
      }
    }
  }
  throw new Error('Rodada excedeu 10.000 ações.');
}

function ciFromClusters(clusterRates: readonly number[]): { mean: number; ci95: [number, number] } {
  const n = clusterRates.length;
  const mean = clusterRates.reduce((sum, value) => sum + value, 0) / n;
  const variance = clusterRates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, n - 1);
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, ci95: [Math.max(0, mean - half), Math.min(1, mean + half)] };
}

function ciFromClusterDifferences(clusterDifferences: readonly number[]): { mean: number; ci95: [number, number] } {
  const n = clusterDifferences.length;
  const mean = clusterDifferences.reduce((sum, value) => sum + value, 0) / n;
  const variance = clusterDifferences.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, n - 1);
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, ci95: [mean - half, mean + half] };
}

function wilson(successes: number, observations: number): { probability: number; ci95: [number, number] } {
  const z = 1.96;
  const p = successes / observations;
  const denominator = 1 + z ** 2 / observations;
  const center = (p + z ** 2 / (2 * observations)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * observations)) / observations)) / denominator;
  return { probability: p, ci95: [Math.max(0, center - half), Math.min(1, center + half)] };
}

function simulatePermutationMatrix(policy: HumanPolicy, wiring: RngWiring) {
  const permutations = permute(IDENTITIES);
  const seedClusters: Array<{
    seatWins: number[];
    identityWins: Record<Identity, number>;
    identitySeatWins: Record<string, number>;
    firstSeats: number[];
  }> = [];

  for (let seedIndex = 0; seedIndex < PERMUTATION_SEEDS; seedIndex += 1) {
    const seed = SEED_START + seedIndex;
    const harness = createHarness(seed, wiring);
    const identityById = new Map([...harness.idsByIdentity].map(([identity, id]) => [id, identity]));
    const orderRandom = createSeededRandom((seed ^ 0x71a155e) >>> 0);
    const orders = shuffled(permutations, orderRandom);
    const cluster = {
      seatWins: [0, 0, 0, 0],
      identityWins: Object.fromEntries(IDENTITIES.map((identity) => [identity, 0])) as Record<Identity, number>,
      identitySeatWins: Object.fromEntries(IDENTITIES.flatMap((identity) => [0, 1, 2, 3].map((seat) => [`${identity}@${seat}`, 0]))),
      firstSeats: [0, 0, 0, 0],
    };

    for (let permutationIndex = 0; permutationIndex < orders.length; permutationIndex += 1) {
      const order = orders[permutationIndex]!;
      harness.room.order.splice(0, harness.room.order.length, ...order.map((identity) => harness.idsByIdentity.get(identity)!));
      startTrainingRound(harness);
      const result = playUntilFinished(harness, policy);
      cluster.seatWins[result.winningSeat]! += 1;
      cluster.identityWins[result.winner] += 1;
      cluster.identitySeatWins[`${result.winner}@${result.winningSeat}`] += 1;
      cluster.firstSeats[result.firstPlayerSeat]! += 1;
      const scoreTotal = [...harness.room.history.values()].reduce((sum, entry) => sum + entry.wins, 0);
      if (scoreTotal !== permutationIndex + 1) throw new Error('Placar não somou exatamente uma vitória por rodada.');
      if (permutationIndex + 1 < orders.length) {
        const returned = harness.store.returnToLobby(harness.human);
        if (!returned.ok) throw new Error(`Falha ao voltar à preparação: ${returned.error.code}`);
      }
    }
    if (seedIndex % 500 === 499) console.error(`permutations ${policy}/${wiring}: ${seedIndex + 1}/${PERMUTATION_SEEDS} seeds`);
    seedClusters.push(cluster);
    harness.store.shutdown();
  }

  const seat = [0, 1, 2, 3].map((index) => {
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.seatWins[index]!, 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.seatWins[index]! / 24));
    return { seat: index, wins, observations: PERMUTATION_SEEDS * 24, rate: summary.mean, ci95: summary.ci95 };
  });
  const identity = IDENTITIES.map((name) => {
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.identityWins[name], 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.identityWins[name] / 24));
    return { identity: name, wins, observations: PERMUTATION_SEEDS * 24, rate: summary.mean, ci95: summary.ci95 };
  });
  const identityBySeat = IDENTITIES.flatMap((name) => [0, 1, 2, 3].map((seatIndex) => {
    const key = `${name}@${seatIndex}`;
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.identitySeatWins[key]!, 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.identitySeatWins[key]! / 6));
    return { identity: name, seat: seatIndex, wins, observations: PERMUTATION_SEEDS * 6, rate: summary.mean, ci95: summary.ci95 };
  }));
  const firstPlayerBySeat = [0, 1, 2, 3].map((index) => {
    const observations = seedClusters.reduce((sum, cluster) => sum + cluster.firstSeats[index]!, 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.firstSeats[index]! / 24));
    return { seat: index, observations, total: PERMUTATION_SEEDS * 24, rate: summary.mean, ci95: summary.ci95 };
  });

  return {
    policy,
    rngWiring: wiring,
    seedStart: SEED_START,
    seedCount: PERMUTATION_SEEDS,
    permutationsPerSeed: 24,
    rounds: PERMUTATION_SEEDS * 24,
    intervalMethod: '95% normal interval over per-seed proportions; each seed is a cluster containing all 24 identity/seat permutations',
    seat,
    identity,
    identityBySeat,
    firstPlayerBySeat,
  };
}

function simulateFixedHumanSeat(wiring: RngWiring) {
  const botPermutations = permute(BOT_NAMES);
  const seedClusters: Array<{
    seatWins: number[];
    identityWins: Record<Identity, number>;
    identitySeatWins: Record<string, number>;
    firstSeats: number[];
  }> = [];

  for (let seedIndex = 0; seedIndex < FIXED_HUMAN_SEAT_SEEDS; seedIndex += 1) {
    const seed = SEED_START + 0x200000 + seedIndex;
    const harness = createHarness(seed, wiring);
    const orders = shuffled(botPermutations, createSeededRandom((seed ^ 0x2f11e5) >>> 0));
    const cluster = {
      seatWins: [0, 0, 0, 0],
      identityWins: Object.fromEntries(IDENTITIES.map((identity) => [identity, 0])) as Record<Identity, number>,
      identitySeatWins: Object.fromEntries(IDENTITIES.flatMap((identity) => [0, 1, 2, 3].map((seat) => [`${identity}@${seat}`, 0]))),
      firstSeats: [0, 0, 0, 0],
    };

    for (let permutationIndex = 0; permutationIndex < orders.length; permutationIndex += 1) {
      const order: Identity[] = ['Pessoa', ...orders[permutationIndex]!];
      harness.room.order.splice(0, harness.room.order.length, ...order.map((identity) => harness.idsByIdentity.get(identity)!));
      startTrainingRound(harness);
      const result = playUntilFinished(harness, 'first-legal');
      cluster.seatWins[result.winningSeat]! += 1;
      cluster.identityWins[result.winner] += 1;
      cluster.identitySeatWins[`${result.winner}@${result.winningSeat}`] += 1;
      cluster.firstSeats[result.firstPlayerSeat]! += 1;
      const scoreTotal = [...harness.room.history.values()].reduce((sum, entry) => sum + entry.wins, 0);
      if (scoreTotal !== permutationIndex + 1) throw new Error('Placar não somou exatamente uma vitória por rodada.');
      if (permutationIndex + 1 < orders.length) {
        const returned = harness.store.returnToLobby(harness.human);
        if (!returned.ok) throw new Error(`Falha ao voltar à preparação: ${returned.error.code}`);
      }
    }
    if (seedIndex % 1_000 === 999) console.error(`fixed-human-seat/${wiring}: ${seedIndex + 1}/${FIXED_HUMAN_SEAT_SEEDS} seeds`);
    seedClusters.push(cluster);
    harness.store.shutdown();
  }

  const seat = [0, 1, 2, 3].map((index) => {
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.seatWins[index]!, 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.seatWins[index]! / 6));
    return { seat: index, wins, observations: FIXED_HUMAN_SEAT_SEEDS * 6, rate: summary.mean, ci95: summary.ci95 };
  });
  const identity = IDENTITIES.map((name) => {
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.identityWins[name], 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.identityWins[name] / 6));
    return { identity: name, wins, observations: FIXED_HUMAN_SEAT_SEEDS * 6, rate: summary.mean, ci95: summary.ci95 };
  });
  const identityBySeat = IDENTITIES.flatMap((name) => [0, 1, 2, 3].map((seatIndex) => {
    const observationsPerSeed = name === 'Pessoa' ? (seatIndex === 0 ? 6 : 0) : (seatIndex === 0 ? 0 : 2);
    if (observationsPerSeed === 0) return null;
    const key = `${name}@${seatIndex}`;
    const wins = seedClusters.reduce((sum, cluster) => sum + cluster.identitySeatWins[key]!, 0);
    const summary = ciFromClusters(seedClusters.map((cluster) => cluster.identitySeatWins[key]! / observationsPerSeed));
    return { identity: name, seat: seatIndex, wins, observations: FIXED_HUMAN_SEAT_SEEDS * observationsPerSeed, rate: summary.mean, ci95: summary.ci95 };
  }).filter((entry) => entry !== null));

  const seatContrasts = [[1, 2], [1, 3], [2, 3]].map(([left, right]) => {
    const summary = ciFromClusterDifferences(seedClusters.map((cluster) => (cluster.seatWins[left]! - cluster.seatWins[right]!) / 6));
    return { leftSeat: left, rightSeat: right, meanDifference: summary.mean, ci95: summary.ci95 };
  });
  const botIdentityContrasts = BOT_NAMES.map((name) => {
    const others = BOT_NAMES.filter((other) => other !== name);
    const summary = ciFromClusterDifferences(seedClusters.map((cluster) => (
      cluster.identityWins[name] / 6
      - others.reduce((sum, other) => sum + cluster.identityWins[other] / 6, 0) / others.length
    )));
    return { identity: name, differenceVsOtherBotsMean: summary.mean, ci95: summary.ci95 };
  });

  return {
    policy: 'first-legal' as const,
    rngWiring: wiring,
    humanSeat: 0,
    botNamePermutations: 6,
    seedStart: SEED_START + 0x200000,
    seedCount: FIXED_HUMAN_SEAT_SEEDS,
    rounds: FIXED_HUMAN_SEAT_SEEDS * 6,
    intervalMethod: '95% normal interval over per-seed proportions, clustering the six bot-name rotations by seed',
    seat,
    identity,
    identityBySeat,
    seatContrasts,
    botIdentityContrasts,
  };
}

function simulateContinuity(policy: HumanPolicy) {
  const identities = [...IDENTITIES];
  const sessionRates: Record<Identity, number[]> = Object.fromEntries(identities.map((identity) => [identity, []])) as Record<Identity, number[]>;
  const rankCounts: Record<Identity, { first: number; topTwo: number }> = Object.fromEntries(identities.map((identity) => [identity, { first: 0, topTwo: 0 }])) as Record<Identity, { first: number; topTwo: number }>;
  const exactPatterns = new Map<string, number>();
  let lilaAtLeastTen = 0;
  let screenshotPattern = 0;

  for (let sessionIndex = 0; sessionIndex < CONTINUITY_SESSIONS; sessionIndex += 1) {
    const seed = SEED_START + 0x100000 + sessionIndex;
    const harness = createHarness(seed, 'shared-stream');
    const canonicalOrder = IDENTITIES.map((identity) => harness.idsByIdentity.get(identity)!);
    harness.room.order.splice(0, harness.room.order.length, ...canonicalOrder);

    for (let roundIndex = 0; roundIndex < ROUNDS_PER_SESSION; roundIndex += 1) {
      startTrainingRound(harness);
      playUntilFinished(harness, policy);
      if (roundIndex + 1 < ROUNDS_PER_SESSION) {
        const returned = harness.store.returnToLobby(harness.human);
        if (!returned.ok) throw new Error(`Falha na continuidade da sessão: ${returned.error.code}`);
      }
    }

    const scores = Object.fromEntries(identities.map((identity) => {
      const id = harness.idsByIdentity.get(identity)!;
      return [identity, harness.room.history.get(id)?.wins ?? 0];
    })) as Record<Identity, number>;
    if (Object.values(scores).reduce((sum, value) => sum + value, 0) !== ROUNDS_PER_SESSION) {
      throw new Error('Placar final não conserva as 13 vitórias da sessão.');
    }
    identities.forEach((identity) => sessionRates[identity].push(scores[identity] / ROUNDS_PER_SESSION));
    if (scores.Lila >= 10) lilaAtLeastTen += 1;
    if (scores.Lila === 10 && scores.Pessoa === 2 && scores.Nino === 1 && scores.Tico === 0) screenshotPattern += 1;
    const pattern = identities.map((identity) => scores[identity]).join('-');
    exactPatterns.set(pattern, (exactPatterns.get(pattern) ?? 0) + 1);

    const rank = (identity: Identity): number => 1 + identities.filter((other) => scores[other] > scores[identity]).length;
    identities.forEach((identity) => {
      if (rank(identity) === 1) rankCounts[identity].first += 1;
      if (rank(identity) <= 2) rankCounts[identity].topTwo += 1;
    });
    if (sessionIndex % 1_000 === 999) console.error(`continuity ${policy}: ${sessionIndex + 1}/${CONTINUITY_SESSIONS} sessions`);
    harness.store.shutdown();
  }

  const winners = identities.map((identity) => {
    const summary = ciFromClusters(sessionRates[identity]);
    const wins = Math.round(summary.mean * ROUNDS_PER_SESSION * CONTINUITY_SESSIONS);
    return { identity, wins, rounds: ROUNDS_PER_SESSION * CONTINUITY_SESSIONS, rate: summary.mean, ci95: summary.ci95 };
  });
  const ranks = identities.map((identity) => ({
    identity,
    firstSessions: rankCounts[identity].first,
    firstRate: wilson(rankCounts[identity].first, CONTINUITY_SESSIONS),
    topTwoSessions: rankCounts[identity].topTwo,
    topTwoRate: wilson(rankCounts[identity].topTwo, CONTINUITY_SESSIONS),
  }));
  const lilaRanks = rankCounts.Lila;
  const topPatterns = [...exactPatterns.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([scoreOrderPessoaTicoLilaNino, sessions]) => ({ scoreOrderPessoaTicoLilaNino, sessions }));

  return {
    policy,
    rngWiring: 'shared-stream',
    roundsPerSession: ROUNDS_PER_SESSION,
    sessions: CONTINUITY_SESSIONS,
    seedStart: SEED_START + 0x100000,
    winners,
    ranks,
    lilaRank: {
      firstSessions: lilaRanks.first,
      firstRate: wilson(lilaRanks.first, CONTINUITY_SESSIONS),
      topTwoSessions: lilaRanks.topTwo,
      topTwoRate: wilson(lilaRanks.topTwo, CONTINUITY_SESSIONS),
    },
    lilaAtLeastTen: { sessions: lilaAtLeastTen, ...wilson(lilaAtLeastTen, CONTINUITY_SESSIONS) },
    screenshotScoreboard: {
      Pessoa: 2,
      Tico: 0,
      Lila: 10,
      Nino: 1,
      sessions: screenshotPattern,
      ...wilson(screenshotPattern, CONTINUITY_SESSIONS),
    },
    mostCommonScoreboards: topPatterns,
  };
}

const results = {
  metadata: {
    description: 'Deterministic simulations through the production RoomStore training path; no product files modified.',
    runtime: process.version,
    seedGenerator: 'packages/rules/src/random.ts createSeededRandom (mulberry32)',
    seedStart: SEED_START,
    permutationSeedCount: PERMUTATION_SEEDS,
    fixedHumanSeatSeedCount: FIXED_HUMAN_SEAT_SEEDS,
    continuitySessionCount: CONTINUITY_SESSIONS,
    roundsPerContinuitySession: ROUNDS_PER_SESSION,
    simulatedPolicies: {
      'mirror-bot': 'The human seat calls the real decideBotCommand on projectForPlayer output, isolating identity and seat effects under identical policy.',
      'first-legal': 'The human plays playableCardIds[0] in hand order, otherwise draws; after a draw plays it if legal, otherwise passes; chooses the most present wild color and announces when reducing to one card. This is an explicit reference policy based on the simple training-test helper, with color choice and last-card announcement made explicit; it is not a model of observed user behavior. Unlike the bot, it does not prefer colored cards over an earlier playable wild.',
    },
    rngWiring: {
      'shared-stream': 'One seeded function instance is supplied as both room.random and room.effectRandom, matching the production call topology when TRE_TTA_SEED is absent and both default to Math.random.',
      'separate-streams': 'Separate seeded functions are supplied to rules and cosmetics to test the documented isolated-stream alternative; not the current default wiring.',
    },
    permutationMethod: 'All 24 permutations of Pessoa/Tico/Lila/Nino are played once per seed in a deterministic shuffled order. Each identity appears six times in every physical seat.',
    intervalMethod: 'Permutation intervals use 95% normal intervals over per-seed proportions, clustering all 24 permutations by seed. Continuity intervals use per-session proportions; rare-pattern intervals use Wilson score intervals.',
  },
  permutationMatrices: POLICIES.flatMap((policy) => RNG_WIRINGS.map((wiring) => simulatePermutationMatrix(policy, wiring))),
  fixedHumanSeatRotations: RNG_WIRINGS.map((wiring) => simulateFixedHumanSeat(wiring)),
  canonicalContinuity: POLICIES.map((policy) => simulateContinuity(policy)),
};

console.log(JSON.stringify(results, null, 2));
