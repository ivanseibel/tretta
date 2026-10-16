import { type Card, type CardId, COLORS, type Color } from './card.js';
import { type RandomSource } from './random.js';
import { type PlayerId } from './round.js';
import {
  type Direction,
  drawFromPiles,
  freezeCard,
  type LastCardWindow,
  type RoundState,
  seatAt,
  type Seat,
  topCard,
  type TurnPhase,
} from './state.js';

/** Comandos aceitos pelo motor, um por vez, na ordem recebida pelo chamador. */
export type RoundCommand =
  | {
      readonly type: 'play';
      readonly playerId: PlayerId;
      readonly cardId: CardId;
      /** Obrigatória ao descartar coringa; proibida nas demais cartas. */
      readonly chosenColor?: Color;
      /** Aviso de última carta junto do descarte que deixa exatamente uma carta. */
      readonly announceLastCard?: boolean;
    }
  | { readonly type: 'draw'; readonly playerId: PlayerId }
  | { readonly type: 'pass'; readonly playerId: PlayerId }
  | { readonly type: 'announceLastCard'; readonly playerId: PlayerId }
  | { readonly type: 'challengeLastCard'; readonly playerId: PlayerId; readonly targetId: PlayerId };

export type CommandErrorCode =
  | 'INVALID_COMMAND'
  | 'ROUND_FINISHED'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_IN_HAND'
  | 'CARD_NOT_PLAYABLE'
  | 'ONLY_DRAWN_CARD_PLAYABLE'
  | 'COLOR_REQUIRED'
  | 'INVALID_COLOR'
  | 'COLOR_NOT_ALLOWED'
  | 'ANNOUNCE_NOT_APPLICABLE'
  | 'ALREADY_DREW'
  | 'PASS_REQUIRES_DRAW'
  | 'NO_LAST_CARD_WINDOW'
  | 'ALREADY_ANNOUNCED'
  | 'INVALID_CHALLENGE';

export interface CommandError {
  readonly code: CommandErrorCode;
  /** Motivo em português, adequado para exibir ao jogador. */
  readonly message: string;
}

/**
 * Eventos públicos: nenhum contém mãos ocultas, ids de cartas da pilha de compra
 * nem conteúdo da pilha. A única carta exibida é a que acabou de ir ao descarte.
 */
export type RoundEvent =
  | { readonly type: 'played'; readonly playerId: PlayerId; readonly card: Card; readonly chosenColor: Color | null }
  | {
      readonly type: 'drew';
      readonly playerId: PlayerId;
      readonly reason: 'voluntary' | 'penalty' | 'challenge';
      readonly requested: number;
      readonly drawn: number;
      readonly reshuffled: boolean;
    }
  | { readonly type: 'passed'; readonly playerId: PlayerId }
  | { readonly type: 'turnSkipped'; readonly playerId: PlayerId }
  | { readonly type: 'directionChanged'; readonly direction: Direction }
  | { readonly type: 'lastCardAnnounced'; readonly playerId: PlayerId; readonly withDiscard: boolean }
  | {
      readonly type: 'challengeAccepted';
      readonly challengerId: PlayerId;
      readonly targetId: PlayerId;
      readonly penalty: number;
    }
  | { readonly type: 'roundFinished'; readonly winnerId: PlayerId };

export type CommandResult =
  | { readonly ok: true; readonly state: RoundState; readonly events: readonly RoundEvent[] }
  | { readonly ok: false; readonly error: CommandError };

/**
 * Aplica um comando sem alterar `state`. Rejeições retornam motivo explícito e
 * não consomem aleatoriedade. Em sucesso, retorna novo estado e eventos públicos.
 */
export function applyCommand(state: RoundState, command: RoundCommand, random: RandomSource): CommandResult {
  const draft = toDraft(state);
  try {
    if (typeof command !== 'object' || command === null) {
      throw reject('INVALID_COMMAND', 'Comando inválido.');
    }
    switch (command.type) {
      case 'play':
        play(draft, command, random);
        break;
      case 'draw':
        draw(draft, command, random);
        break;
      case 'pass':
        pass(draft, command);
        break;
      case 'announceLastCard':
        announce(draft, command);
        break;
      case 'challengeLastCard':
        challenge(draft, command, random);
        break;
      default:
        throw reject('INVALID_COMMAND', 'Tipo de comando desconhecido.');
    }
  } catch (error) {
    if (error instanceof CommandRejected) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
  return { ok: true, state: toState(draft), events: draft.events };
}

/** Carta jogável sobre o topo e a cor ativa: cor, número ou símbolo; coringas sempre. */
export function isPlayableOn(card: Card, top: Card, activeColor: Color): boolean {
  if (card.kind === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.kind === 'number') return top.kind === 'number' && top.value === card.value;
  return top.kind === 'action' && top.action === card.action;
}

interface Draft {
  status: RoundState['status'];
  seats: { id: PlayerId; hand: Card[] }[];
  drawPile: Card[];
  discardPile: Card[];
  currentIndex: number;
  direction: Direction;
  activeColor: Color;
  phase: TurnPhase;
  drawnCardId: CardId | null;
  lastCard: LastCardWindow | null;
  winnerId: PlayerId | null;
  events: RoundEvent[];
}

class CommandRejected extends Error {
  readonly code: CommandErrorCode;

  constructor(code: CommandErrorCode, message: string) {
    super(message);
    this.name = 'CommandRejected';
    this.code = code;
  }
}

function reject(code: CommandErrorCode, message: string): CommandRejected {
  return new CommandRejected(code, message);
}

function toDraft(state: RoundState): Draft {
  return {
    status: state.status,
    seats: state.seats.map((seat) => ({ id: seat.id, hand: [...seat.hand] })),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    currentIndex: state.currentIndex,
    direction: state.direction,
    activeColor: state.activeColor,
    phase: state.phase,
    drawnCardId: state.drawnCardId,
    lastCard: state.lastCard,
    winnerId: state.winnerId,
    events: [],
  };
}

function toState(draft: Draft): RoundState {
  const seats: Seat[] = draft.seats.map((seat) => Object.freeze({ id: seat.id, hand: Object.freeze([...seat.hand]) }));
  return Object.freeze({
    status: draft.status,
    seats: Object.freeze(seats),
    drawPile: Object.freeze([...draft.drawPile]),
    discardPile: Object.freeze([...draft.discardPile]),
    currentIndex: draft.currentIndex,
    direction: draft.direction,
    activeColor: draft.activeColor,
    phase: draft.phase,
    drawnCardId: draft.drawnCardId,
    lastCard: draft.lastCard === null ? null : Object.freeze({ ...draft.lastCard }),
    winnerId: draft.winnerId,
  });
}

function ensureRunning(draft: Draft): void {
  if (draft.status === 'finished') {
    throw reject('ROUND_FINISHED', 'A rodada já terminou; comandos posteriores são recusados.');
  }
}

/** Índice do participante; rejeita ids desconhecidos. */
function seatOf(draft: Draft, playerId: unknown): number {
  const index = typeof playerId === 'string' ? draft.seats.findIndex((seat) => seat.id === playerId) : -1;
  if (index < 0) {
    throw reject('UNKNOWN_PLAYER', 'Participante desconhecido na rodada.');
  }
  return index;
}

function ensureTurn(draft: Draft, actor: number): void {
  if (actor !== draft.currentIndex) {
    throw reject('NOT_YOUR_TURN', 'Não é a sua vez.');
  }
}

function seatCount(draft: Draft): number {
  return draft.seats.length;
}

function play(draft: Draft, command: Extract<RoundCommand, { type: 'play' }>, random: RandomSource): void {
  ensureRunning(draft);
  const actor = seatOf(draft, command.playerId);
  ensureTurn(draft, actor);
  if (typeof command.cardId !== 'string') {
    throw reject('INVALID_COMMAND', 'Id de carta inválido.');
  }
  if (command.announceLastCard !== undefined && typeof command.announceLastCard !== 'boolean') {
    throw reject('INVALID_COMMAND', 'announceLastCard deve ser booleano.');
  }

  if (draft.phase === 'after-draw' && (draft.drawnCardId === null || command.cardId !== draft.drawnCardId)) {
    throw reject(
      'ONLY_DRAWN_CARD_PLAYABLE',
      'Depois de comprar, só a carta recém-comprada pode ser descartada; ou passe.',
    );
  }

  const seat = draft.seats[actor];
  const card = seat?.hand.find((candidate) => candidate.id === command.cardId);
  if (seat === undefined || card === undefined) {
    throw reject('CARD_NOT_IN_HAND', 'A carta não está na sua mão.');
  }
  const top = topCard(draft.discardPile);
  if (!isPlayableOn(card, top, draft.activeColor)) {
    throw reject(
      'CARD_NOT_PLAYABLE',
      `${describeCard(card)} não combina com ${describeCard(top)} (cor ativa: ${draft.activeColor}).`,
    );
  }

  let nextColor: Color;
  let chosenForEvent: Color | null = null;
  if (card.kind === 'wild') {
    if (command.chosenColor === undefined) {
      throw reject('COLOR_REQUIRED', 'Escolha a cor ativa ao descartar um coringa.');
    }
    if (!isColor(command.chosenColor)) {
      throw reject('INVALID_COLOR', `Cor inválida: ${String(command.chosenColor)}.`);
    }
    nextColor = command.chosenColor;
    chosenForEvent = command.chosenColor;
  } else {
    if (command.chosenColor !== undefined) {
      throw reject('COLOR_NOT_ALLOWED', 'Só coringas aceitam escolha de cor.');
    }
    nextColor = card.color;
  }

  const announce = command.announceLastCard === true;
  const remaining = seat.hand.length - 1;
  if (announce && remaining !== 1) {
    throw reject('ANNOUNCE_NOT_APPLICABLE', 'O aviso de última carta só acompanha um descarte que deixa uma carta.');
  }

  // A partir daqui o comando é aceito; nenhuma validação ocorre depois.
  draft.lastCard = null;
  seat.hand = seat.hand.filter((candidate) => candidate.id !== card.id);
  draft.discardPile.push(freezeCard(card));
  draft.activeColor = nextColor;
  draft.phase = 'play';
  draft.drawnCardId = null;
  draft.events.push({ type: 'played', playerId: seat.id, card, chosenColor: chosenForEvent });

  if (remaining === 0) {
    // Todos os efeitos da carta vencedora são resolvidos uma única vez antes de publicar o resultado.
    draft.currentIndex = resolveEffects(draft, card, actor, random);
    draft.status = 'finished';
    draft.winnerId = seat.id;
    draft.events.push({ type: 'roundFinished', winnerId: seat.id });
    return;
  }

  if (remaining === 1) {
    draft.lastCard = { playerId: seat.id, announced: announce };
  }
  if (announce) {
    draft.events.push({ type: 'lastCardAnnounced', playerId: seat.id, withDiscard: true });
  }
  draft.currentIndex = resolveEffects(draft, card, actor, random);
}

function draw(draft: Draft, command: Extract<RoundCommand, { type: 'draw' }>, random: RandomSource): void {
  ensureRunning(draft);
  const actor = seatOf(draft, command.playerId);
  ensureTurn(draft, actor);
  if (draft.phase === 'after-draw') {
    throw reject('ALREADY_DREW', 'Você já comprou neste turno; descarte a carta comprada ou passe.');
  }
  draft.lastCard = null;
  const drawn = drawInto(draft, actor, 1, 'voluntary', random);
  draft.phase = 'after-draw';
  draft.drawnCardId = drawn[0]?.id ?? null;
}

function pass(draft: Draft, command: Extract<RoundCommand, { type: 'pass' }>): void {
  ensureRunning(draft);
  const actor = seatOf(draft, command.playerId);
  ensureTurn(draft, actor);
  if (draft.phase !== 'after-draw') {
    throw reject('PASS_REQUIRES_DRAW', 'Só é possível passar depois de comprar.');
  }
  draft.events.push({ type: 'passed', playerId: command.playerId });
  draft.phase = 'play';
  draft.drawnCardId = null;
  draft.currentIndex = seatAt(actor, 1, seatCount(draft), draft.direction);
}

function announce(draft: Draft, command: Extract<RoundCommand, { type: 'announceLastCard' }>): void {
  ensureRunning(draft);
  seatOf(draft, command.playerId);
  const window = draft.lastCard;
  if (window === null || window.playerId !== command.playerId) {
    throw reject('NO_LAST_CARD_WINDOW', 'Não há janela de última carta aberta para esta pessoa.');
  }
  if (window.announced) {
    throw reject('ALREADY_ANNOUNCED', 'O aviso de última carta já foi feito.');
  }
  draft.lastCard = { playerId: window.playerId, announced: true };
  draft.events.push({ type: 'lastCardAnnounced', playerId: window.playerId, withDiscard: false });
}

function challenge(draft: Draft, command: Extract<RoundCommand, { type: 'challengeLastCard' }>, random: RandomSource): void {
  ensureRunning(draft);
  const challenger = seatOf(draft, command.playerId);
  const target = seatOf(draft, command.targetId);
  if (challenger === target) {
    throw reject('INVALID_CHALLENGE', 'Não é possível denunciar a si mesmo.');
  }
  const window = draft.lastCard;
  if (window === null || window.playerId !== command.targetId) {
    throw reject(
      'NO_LAST_CARD_WINDOW',
      'Não há janela de última carta aberta para esta pessoa. A janela fecha na próxima compra voluntária ou descarte aceito.',
    );
  }
  if (window.announced) {
    throw reject('INVALID_CHALLENGE', 'Quem já avisou a última carta não pode ser denunciado.');
  }

  draft.lastCard = null;
  const cards = drawInto(draft, target, 2, 'challenge', random);
  draft.events.push({
    type: 'challengeAccepted',
    challengerId: command.playerId,
    targetId: command.targetId,
    penalty: cards.length,
  });
}

/**
 * Aplica o efeito da carta descartada uma única vez e retorna o próximo assento a jogar.
 * Compras obrigatórias ocorrem dentro do mesmo comando. No descarte vencedor, os eventos
 * dos efeitos precedem `roundFinished`.
 */
function resolveEffects(draft: Draft, card: Card, actor: number, random: RandomSource): number {
  const count = seatCount(draft);
  const effect = effectOf(card);

  if (effect === 'reverse' && count > 2) {
    draft.direction = draft.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
    draft.events.push({ type: 'directionChanged', direction: draft.direction });
    return seatAt(actor, 1, count, draft.direction);
  }

  if (effect === 'skip' || effect === 'reverse') {
    // Com duas pessoas, Inversão funciona como Bloqueio e mantém o sentido.
    pushSkipped(draft, seatAt(actor, 1, count, draft.direction));
    return seatAt(actor, 2, count, draft.direction);
  }

  if (effect === 'draw-two' || effect === 'draw-four') {
    const victim = seatAt(actor, 1, count, draft.direction);
    drawInto(draft, victim, effect === 'draw-two' ? 2 : 4, 'penalty', random);
    pushSkipped(draft, victim);
    return seatAt(victim, 1, count, draft.direction);
  }

  return seatAt(actor, 1, count, draft.direction);
}

function pushSkipped(draft: Draft, index: number): void {
  const seat = draft.seats[index];
  if (seat !== undefined) {
    draft.events.push({ type: 'turnSkipped', playerId: seat.id });
  }
}

function effectOf(card: Card): 'skip' | 'reverse' | 'draw-two' | 'draw-four' | null {
  if (card.kind === 'action') return card.action;
  if (card.kind === 'wild' && card.variant === 'draw-four') return 'draw-four';
  return null;
}

function drawInto(
  draft: Draft,
  index: number,
  count: number,
  reason: 'voluntary' | 'penalty' | 'challenge',
  random: RandomSource,
): Card[] {
  const seat = draft.seats[index];
  if (seat === undefined) {
    throw reject('UNKNOWN_PLAYER', 'Participante desconhecido na rodada.');
  }
  const result = drawFromPiles(draft, count, random);
  seat.hand = [...seat.hand, ...result.cards];
  draft.events.push({
    type: 'drew',
    playerId: seat.id,
    reason,
    requested: count,
    drawn: result.cards.length,
    reshuffled: result.reshuffled,
  });
  return result.cards;
}

function isColor(value: unknown): value is Color {
  return typeof value === 'string' && (COLORS as readonly string[]).includes(value);
}

function describeCard(card: Card): string {
  if (card.kind === 'number') return `${card.color} ${card.value}`;
  if (card.kind === 'action') return `${card.color} ${card.action}`;
  return `coringa (${card.variant})`;
}
