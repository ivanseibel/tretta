/**
 * Interação de humor pelo avatar (T014B): menu único, reação transitória,
 * aviso de resposta, intervalos com referência do servidor e ciclo de vida.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  PublicTableView,
  ReactionEvent,
  StateMessage,
  TauntEvent,
} from '@tretta/protocol';
import { createClassicDeck } from '@tretta/rules';
import type { RoomSocket, StoredIdentity } from '@/lib/client';
import { RoomProvider, useRoom, type RoomContextValue } from '@/app/providers';
import { Lobby } from '@/components/Lobby';
import { MoodFeedback, MoodAnnouncer } from '@/components/MoodFeedback';
import { MoodMenu } from '@/components/MoodMenu';
import { MoodSettings } from '@/components/MoodSettings';
import { Results } from '@/components/Results';
import { TauntPanel } from '@/components/TauntPanel';
import { TauntResponseNotice } from '@/components/TauntResponseNotice';
import { WaitingRoom } from '@/components/WaitingRoom';

const soundSpy = vi.hoisted(() => ({
  playEffectSound: vi.fn(),
  playTauntSound: vi.fn(),
  playTurnNotificationSound: vi.fn(),
  prepareSoundPlayback: vi.fn(),
  setSoundMuted: vi.fn(),
  stopAllSounds: vi.fn(),
}));

vi.mock('@/lib/sounds', () => soundSpy);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

interface PendingRequest {
  event: string;
  payload: Record<string, unknown>;
  callback: (response: unknown) => void;
}

const harness = vi.hoisted(() => {
  const state = {
    connected: true,
    handlers: new Map<string, (payload: unknown) => void>(),
    onceHandlers: new Map<string, Set<() => void>>(),
    pending: [] as PendingRequest[],
    identities: new Map<string, StoredIdentity>(),
    nonce: 0,
  };
  interface FakeSocket {
    readonly connected: boolean;
    on(event: string, callback: (payload: unknown) => void): FakeSocket;
    once(event: string, callback: () => void): FakeSocket;
    off(event: string, callback: () => void): FakeSocket;
    emit(event: string, payload: Record<string, unknown>, callback: (response: unknown) => void): void;
    disconnect(): void;
  }
  const socket: FakeSocket = {
    get connected(): boolean {
      return state.connected;
    },
    on(event: string, callback: (payload: unknown) => void): FakeSocket {
      state.handlers.set(event, callback);
      return socket;
    },
    once(event: string, callback: () => void): FakeSocket {
      const set = state.onceHandlers.get(event) ?? new Set<() => void>();
      set.add(callback);
      state.onceHandlers.set(event, set);
      return socket;
    },
    off(event: string, callback: () => void): FakeSocket {
      state.onceHandlers.get(event)?.delete(callback);
      return socket;
    },
    emit(event: string, payload: Record<string, unknown>, callback: (response: unknown) => void): void {
      state.pending.push({ event, payload, callback });
    },
    disconnect(): void {},
  };
  return { state, socket };
});

vi.mock('@/lib/client', () => ({
  createSocket: () => harness.socket as unknown as RoomSocket,
  newIntentId: () => `test_${++harness.state.nonce}`,
  loadIdentity: (code: string): StoredIdentity | null => harness.state.identities.get(code) ?? null,
  saveIdentity: (code: string, identity: StoredIdentity): void => {
    harness.state.identities.set(code, identity);
  },
  clearIdentity: (code: string): void => {
    harness.state.identities.delete(code);
  },
}));

let latest: RoomContextValue | null = null;

function Probe(): ReactNode {
  latest = useRoom();
  return null;
}

function api(): RoomContextValue {
  if (latest === null) throw new Error('RoomProvider não montado.');
  return latest;
}

function Stage(): ReactNode {
  const room = useRoom();
  if (room.state === null) return null;
  return (
    <>
      {room.state.room.status === 'lobby' ? <Lobby state={room.state} /> : null}
      {room.state.room.status === 'playing' && room.state.self.view === null ? (
        <WaitingRoom state={room.state} events={[]} />
      ) : null}
      {room.state.room.status === 'paused' && room.state.self.view === null ? (
        <WaitingRoom state={room.state} events={[]} />
      ) : null}
      {room.state.room.status === 'finished' ? <Results state={room.state} events={[]} /> : null}
      <TauntPanel />
      <MoodSettings />
      <TauntResponseNotice />
      <MoodMenu />
      <MoodFeedback />
      <MoodAnnouncer />
    </>
  );
}

const DISCARD = createClassicDeck()[0];

interface ParticipantFixture {
  readonly id: string;
  readonly nickname: string;
  readonly avatar?: 'raposa' | 'lobo' | 'tucano';
  readonly connected?: boolean;
  readonly autoControlled?: boolean;
  readonly kind?: 'human' | 'bot';
  readonly inRound?: boolean;
  readonly isHost?: boolean;
}

const ANA: ParticipantFixture = { id: 'player_anA', nickname: 'Ana', avatar: 'raposa', isHost: true };
const BIA: ParticipantFixture = { id: 'player_biA', nickname: 'Bia', avatar: 'lobo' };
const CAI: ParticipantFixture = { id: 'player_caI', nickname: 'Cai', avatar: 'tucano' };

interface StateOptions {
  readonly status?: 'lobby' | 'playing' | 'paused' | 'finished';
  readonly roundId?: string | null;
  readonly version?: number;
  readonly participants?: readonly ParticipantFixture[];
  readonly selfId?: string;
  readonly waiting?: boolean;
  readonly table?: PublicTableView | null;
  readonly tauntNextSendAt?: number | null;
  readonly reactionNextSendAt?: number | null;
  readonly serverTime?: number;
}

function stateMessage(roomCode: string, options: StateOptions = {}): StateMessage {
  const {
    status = 'lobby',
    roundId = status === 'lobby' ? null : 'r1',
    version = 1,
    participants = [ANA, BIA],
    selfId = 'player_anA',
    waiting = false,
    table = null,
    tauntNextSendAt = null,
    reactionNextSendAt = null,
    serverTime = Date.now(),
  } = options;
  const selfFixture = participants.find((participant) => participant.id === selfId) ?? ANA;
  return {
    room: {
      roomCode,
      mode: 'classic',
      hostId: participants.find((participant) => participant.isHost)?.id ?? participants[0]?.id ?? selfId,
      status,
      roundNumber: roundId === null ? 0 : 1,
      roundId,
      lastRound: null,
      participants: participants.map((participant) => ({
        id: participant.id,
        kind: participant.kind ?? 'human',
        nickname: participant.nickname,
        avatar: participant.avatar ?? 'lobo',
        ready: true,
        connected: participant.connected ?? true,
        score: 0,
        inRound: participant.inRound ?? false,
        isHost: participant.isHost ?? false,
        autoControlled: participant.autoControlled ?? false,
        absentSince: null,
      })),
      scoreboard: participants.map((participant) => ({
        playerId: participant.id,
        kind: participant.kind ?? 'human',
        nickname: participant.nickname,
        avatar: participant.avatar ?? 'lobo',
        wins: 0,
        current: true,
      })),
      pause: null,
      retainedUntil: null,
      serverTime,
      version,
    },
    self: {
      playerId: selfId,
      nickname: selfFixture.nickname,
      avatar: selfFixture.avatar ?? 'lobo',
      ready: true,
      inRound: status !== 'lobby' && !waiting,
      waiting,
      view: null,
      tauntNextSendAt,
      reactionNextSendAt,
    },
    table,
  } as unknown as StateMessage;
}

function waitingTable(participants: readonly ParticipantFixture[] = [ANA, BIA]): PublicTableView {
  return {
    status: 'playing',
    players: participants.map((participant) => ({ id: participant.id, handCount: 5 })),
    drawPileCount: 40,
    discardTop: DISCARD,
    activeColor: 'red',
    direction: 'clockwise',
    currentPlayerId: participants[0]?.id ?? null,
    phase: 'play',
    lastCardWindow: null,
    winnerId: null,
  } as unknown as PublicTableView;
}

function reaction(id: string, type: ReactionEvent['type'], sender: ReactionEvent['sender']): ReactionEvent {
  return { id, type, sender, sentAt: Date.now() };
}

function taunt(id: string, sender: TauntEvent['sender'], target: TauntEvent['target'], type: TauntEvent['type'] = 'tomate'): TauntEvent {
  return { id, type, sender, target, sentAt: Date.now() };
}

const ANA_ACTOR = { playerId: 'player_anA', nickname: 'Ana', avatar: 'raposa' as const };
const BIA_ACTOR = { playerId: 'player_biA', nickname: 'Bia', avatar: 'lobo' as const };
const CAI_ACTOR = { playerId: 'player_caI', nickname: 'Cai', avatar: 'tucano' as const };

function takePending(event: string): PendingRequest {
  const index = harness.state.pending.findIndex((request) => request.event === event);
  if (index === -1) throw new Error(`Requisição ausente: ${event}`);
  const [request] = harness.state.pending.splice(index, 1);
  if (request === undefined) throw new Error(`Requisição ausente: ${event}`);
  return request;
}

async function complete(request: PendingRequest, response: unknown): Promise<void> {
  await act(async () => {
    request.callback(response);
    await Promise.resolve();
  });
}

async function respond(event: string, response: unknown): Promise<void> {
  await complete(takePending(event), response);
}

function deliver(event: string, payload?: unknown): void {
  const handler = harness.state.handlers.get(event);
  if (handler === undefined) throw new Error(`Handler ausente: ${event}`);
  act(() => {
    handler(payload);
  });
}

async function pushState(message: StateMessage): Promise<void> {
  await act(async () => {
    deliver('server:state', message);
  });
}

async function enterRoom(roomCode = 'ROOM01', selfId = 'player_anA'): Promise<void> {
  await act(async () => {
    const promise = api().createRoom('Ana', 'raposa');
    takePending('client:createRoom').callback({
      ok: true,
      roomCode,
      playerId: selfId,
      credential: `cred_${roomCode}_${selfId}`,
      version: 1,
    });
    await promise;
  });
  await pushState(stateMessage(roomCode, { selfId, version: 1 }));
}

async function mount(): Promise<void> {
  await act(async () => {
    render(
      <RoomProvider>
        <Probe />
        <Stage />
      </RoomProvider>,
    );
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.state.connected = true;
  harness.state.handlers.clear();
  harness.state.pending.length = 0;
  harness.state.identities.clear();
  harness.state.nonce = 0;
  latest = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('reações sem destinatário na interface', () => {
  it('reage pelo próprio avatar, deduplica ack/broadcast, mantém 4 s e respeita ocultar', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA, CAI], version: 2 }));
    const t0 = Date.now();

    fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));
    expect(screen.getByTestId('mood-menu')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Reagir' })).toBeTruthy();

    fireEvent.click(screen.getByTestId('mood-reaction-rindo'));
    const request = takePending('client:reactionSend');
    expect(request.payload).toMatchObject({ roomCode: 'ROOM01', type: 'rindo' });
    expect(request.payload).not.toHaveProperty('targetId');
    const event = reaction('rx_1', 'rindo', ANA_ACTOR);
    await complete(request, {
      ok: true,
      reaction: event,
      limits: { serverTime: t0, nextSendAt: t0 + 5_000 },
    });

    expect(screen.queryByTestId('mood-menu')).toBeNull();
    expect(screen.getByTestId('mood-feedback').textContent).toContain('Reação enviada: Rindo');
    expect(screen.getAllByTestId('reaction-badge-player_anA')).toHaveLength(1);

    // Ack e broadcast do mesmo id: uma apresentação; repetição não prolonga.
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: event });
    expect(screen.getAllByTestId('reaction-badge-player_anA')).toHaveLength(1);
    advance(2_000);
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: event });
    advance(1_999);
    expect(screen.getByTestId('reaction-badge-player_anA')).toBeTruthy();
    advance(1);
    expect(screen.queryByTestId('reaction-badge-player_anA')).toBeNull();

    // Emissores diferentes aparecem ao mesmo tempo; anúncio é único.
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_2', 'bravo', BIA_ACTOR) });
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_3', 'chorando', CAI_ACTOR) });
    expect(screen.getByTestId('reaction-badge-player_biA').dataset.reactionType).toBe('bravo');
    expect(screen.getByTestId('reaction-badge-player_caI').dataset.reactionType).toBe('chorando');
    expect(screen.getByTestId('reaction-announcer').textContent).toBe('Cai: Chorando');
    // Reação nova do mesmo emissor substitui a anterior.
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_4', 'rindo', BIA_ACTOR) });
    const biaBadges = screen.getAllByTestId('reaction-badge-player_biA');
    expect(biaBadges).toHaveLength(1);
    expect(biaBadges[0]?.dataset.reactionType).toBe('rindo');

    // Ocultar limpa na hora, inclusive a própria, e reativar não reproduz.
    fireEvent.click(screen.getByTestId('pref-hide-reactions'));
    expect(screen.queryByTestId('reaction-badge-player_anA')).toBeNull();
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_5', 'bravo', BIA_ACTOR) });
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
    fireEvent.click(screen.getByTestId('pref-hide-reactions'));
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_6', 'chorando', BIA_ACTOR) });
    expect(screen.getByTestId('reaction-badge-player_biA').dataset.reactionType).toBe('chorando');

    // Reação não toca som.
    expect(soundSpy.playTauntSound).not.toHaveBeenCalled();
  });

  it('aviso de resposta mostra só o destinatário, o mais recente, responde ao emissor e protege o foco', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA, CAI], version: 2 }));

    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_1', BIA_ACTOR, ANA_ACTOR),
    });
    expect(screen.getByTestId('taunt-notice').textContent).toContain('Bia provocou você');

    advance(10_000);
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_2', CAI_ACTOR, ANA_ACTOR),
    });
    expect(screen.getByTestId('taunt-notice').textContent).toContain('Cai provocou você');

    // Outra pessoa como destinatária não troca o aviso da Ana.
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_3', BIA_ACTOR, CAI_ACTOR),
    });
    expect(screen.getByTestId('taunt-notice').textContent).toContain('Cai provocou você');

    // Responder mantém o emissor mesmo se outro aviso chegar com o menu aberto.
    fireEvent.click(screen.getByTestId('taunt-respond'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Responder a Cai');
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_4', BIA_ACTOR, ANA_ACTOR),
    });
    expect(screen.getByTestId('mood-menu').textContent).toContain('Responder a Cai');
    fireEvent.click(screen.getByTestId('mood-taunt-torta'));
    const request = takePending('client:tauntSend');
    expect(request.payload).toMatchObject({ roomCode: 'ROOM01', type: 'torta', targetId: 'player_caI' });
    await complete(request, {
      ok: true,
      taunt: taunt('t_5', ANA_ACTOR, CAI_ACTOR, 'torta'),
      limits: { serverTime: Date.now(), nextSendAt: Date.now() + 15_000 },
    });
    expect(screen.queryByTestId('mood-menu')).toBeNull();

    // Prazo vencido com foco no aviso: permanece até o foco sair.
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_6', BIA_ACTOR, ANA_ACTOR),
    });
    const respondButton = screen.getByTestId('taunt-respond');
    respondButton.focus();
    advance(30_000);
    expect(screen.getByTestId('taunt-notice').getAttribute('data-expired')).toBe('true');
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();
    act(() => {
      respondButton.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    });
    expect(screen.queryByTestId('taunt-notice')).toBeNull();

    // Ocultar provocações esconde o aviso, inclusive o já aberto.
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_7', BIA_ACTOR, ANA_ACTOR),
    });
    fireEvent.click(screen.getByTestId('pref-hide-taunts'));
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_8', CAI_ACTOR, ANA_ACTOR),
    });
    expect(screen.queryByTestId('taunt-notice')).toBeNull();

    // Saída do emissor encerra o aviso pendente.
    fireEvent.click(screen.getByTestId('pref-hide-taunts'));
    deliver('server:taunt', {
      roomCode: 'ROOM01',
      taunt: taunt('t_9', CAI_ACTOR, ANA_ACTOR),
    });
    expect(screen.getByTestId('taunt-notice').textContent).toContain('Cai provocou você');
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA], version: 3 }));
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
  });

  it('intervalos por categoria e por alvo aparecem no menu e não são herdados', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA, CAI], version: 2 }));
    const t0 = Date.now();

    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Provocar Bia');
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    await respond('client:tauntSend', {
      ok: false,
      error: {
        code: 'TAUNT_SENDER_COOLDOWN',
        message: 'Calma um pouco! Você pode provocar de novo em 15s.',
        retry: { serverTime: t0, retryAt: t0 + 15_000, scope: 'sender' },
      },
    });
    expect(screen.getByTestId('mood-menu-error').textContent).toContain('Calma');
    expect(screen.getByTestId('mood-countdown').textContent).toContain('Aguarde');
    expect(screen.getByTestId('mood-taunt-tomate').getAttribute('aria-disabled')).toBe('true');
    advance(15_000);
    expect(screen.queryByTestId('mood-countdown')).toBeNull();
    expect(screen.getByTestId('mood-taunt-tomate').getAttribute('aria-disabled')).toBe('false');

    // Sucesso atualiza o intervalo próprio a partir do ack.
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    await respond('client:tauntSend', {
      ok: true,
      taunt: taunt('t_ok', ANA_ACTOR, BIA_ACTOR),
      limits: { serverTime: Date.now(), nextSendAt: Date.now() + 15_000 },
    });
    expect(screen.queryByTestId('mood-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    expect(screen.getByTestId('mood-countdown').textContent).toContain('Aguarde');
    fireEvent.click(screen.getByTestId('mood-menu-close'));

    // Cota do alvo: mensagem própria e isolada por id.
    advance(15_000);
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    fireEvent.click(screen.getByTestId('mood-taunt-torta'));
    await respond('client:tauntSend', {
      ok: false,
      error: {
        code: 'TAUNT_TARGET_LIMIT',
        message: 'Bia já levou provocação demais. Tente de novo em 60s.',
        retry: { serverTime: Date.now(), retryAt: Date.now() + 60_000, scope: 'target', targetId: 'player_biA' },
      },
    });
    const countdown = screen.getByTestId('mood-countdown');
    expect(countdown.dataset.waitScope).toBe('target');
    expect(countdown.textContent).toContain('alvo');
    fireEvent.click(screen.getByTestId('mood-menu-close'));
    fireEvent.click(screen.getByTestId('mood-avatar-player_caI'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Provocar Cai');
    expect(screen.queryByTestId('mood-countdown')).toBeNull();
  });

  it('ack vencido (replay) não inicia uma nova espera no menu', async () => {
    await mount();
    await enterRoom();
    const t0 = Date.now();

    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    // Ack original de t0 chega em t0+4.999: só falta 1 ms, não 5 s.
    await respond('client:tauntSend', {
      ok: true,
      taunt: taunt('t_old', ANA_ACTOR, BIA_ACTOR),
      limits: { serverTime: t0 - 4_999, nextSendAt: t0 + 1 },
    });
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    expect(screen.queryByTestId('mood-countdown')).toBeNull();
  });

  it('novo ciclo limpa, pausa/resultados/preparação preservam até o prazo', async () => {
    await mount();
    await enterRoom();

    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_a', 'rindo', BIA_ACTOR) });
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: taunt('t_a', BIA_ACTOR, ANA_ACTOR, 'torta') });
    expect(screen.getByTestId('reaction-badge-player_biA')).toBeTruthy();
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();

    // Nova rodada (lobby → rodada r1) limpa reações/avisos e fecha o menu.
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    expect(screen.getByTestId('mood-menu')).toBeTruthy();
    await pushState(stateMessage('ROOM01', { status: 'playing', roundId: 'r1', version: 2, participants: [ANA, BIA] }));
    expect(screen.queryByTestId('mood-menu')).toBeNull();
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
    expect(screen.queryByTestId('taunt-notice')).toBeNull();

    // Pausa, resultado e volta à preparação preservam até o prazo normal.
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_b', 'bravo', BIA_ACTOR) });
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: taunt('t_b', BIA_ACTOR, ANA_ACTOR) });
    expect(screen.getByTestId('reaction-badge-player_biA')).toBeTruthy();
    await pushState(stateMessage('ROOM01', { status: 'paused', roundId: 'r1', version: 3, participants: [ANA, BIA] }));
    expect(Object.keys(api().activeReactions)).toEqual(['player_biA']);
    expect(screen.getByTestId('reaction-badge-player_biA')).toBeTruthy();
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();
    await pushState(stateMessage('ROOM01', { status: 'finished', roundId: 'r1', version: 4, participants: [ANA, BIA] }));
    expect(screen.getByTestId('reaction-badge-player_biA')).toBeTruthy();
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();
    // Nos resultados, o avatar atual continua abrindo o menu (não o histórico).
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Provocar Bia');
    fireEvent.click(screen.getByTestId('mood-menu-close'));
    await pushState(stateMessage('ROOM01', { status: 'lobby', roundId: null, version: 5, participants: [ANA, BIA] }));
    expect(screen.getByTestId('reaction-badge-player_biA')).toBeTruthy();
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();

    // Rodada realmente nova limpa.
    await pushState(stateMessage('ROOM01', { status: 'playing', roundId: 'r2', version: 6, participants: [ANA, BIA] }));
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
    expect(screen.queryByTestId('taunt-notice')).toBeNull();

    // Perda de conexão limpa os transitórios e fecha o menu.
    deliver('server:reaction', { roomCode: 'ROOM01', reaction: reaction('rx_c', 'rindo', BIA_ACTOR) });
    fireEvent.click(screen.getByTestId('self-reaction-button'));
    expect(screen.getByTestId('mood-menu')).toBeTruthy();
    harness.state.connected = false;
    deliver('disconnect');
    expect(screen.queryByTestId('mood-menu')).toBeNull();
    expect(screen.queryByTestId('reaction-badge-player_biA')).toBeNull();
  });
});

describe('quem aguarda e o painel alternativo', () => {
  it('observador reage pela própria identificação e provoca um assento público', async () => {
    await mount();
    await enterRoom();
    await pushState(
      stateMessage('ROOM01', {
        status: 'playing',
        roundId: 'r1',
        version: 2,
        participants: [ANA, BIA, { ...CAI, connected: true }],
        selfId: 'player_caI',
        waiting: true,
        table: waitingTable([ANA, BIA]),
      }),
    );

    expect(screen.getByTestId('waiting-banner')).toBeTruthy();
    fireEvent.click(screen.getByTestId('self-reaction-button'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Reagir');
    fireEvent.click(screen.getByTestId('mood-reaction-chorando'));
    await respond('client:reactionSend', {
      ok: true,
      reaction: reaction('rx_w', 'chorando', CAI_ACTOR),
      limits: { serverTime: Date.now(), nextSendAt: Date.now() + 5_000 },
    });
    expect(screen.getByTestId('reaction-badge-player_caI').dataset.reactionType).toBe('chorando');

    fireEvent.click(screen.getByTestId('seat-avatar-0'));
    expect(screen.getByTestId('mood-menu').textContent).toContain('Provocar');
  });

  it('mantém o painel recolhido e explica alvo indisponível', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, { ...BIA, connected: false }], version: 2 }));

    const panel = screen.getByTestId('taunt-panel') as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    fireEvent.click(screen.getByTestId('taunt-panel-toggle'));
    expect(panel.open).toBe(true);
    expect(screen.getByTestId('taunt-target').textContent).toContain('desconectado');
    expect((screen.getByTestId('taunt-send') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('taunt-target-unavailable').textContent).toContain('desconectado');
  });
});

/**
 * Ajustes T014B (R1/R3): validade das operações de menu/apresentação e
 * deduplicação do aviso de resposta. Reproduções do orquestrador equivalentes
 * + cobertura de recusa atrasada, foco, sala/identidade e limpeza/ocultação.
 */
describe('validade de operações e avisos obsoletos', () => {
  it('ack de menu já fechado não encerra o menu novo nem devolve foco à origem antiga', async () => {
    await mount();
    await enterRoom();
    const t0 = Date.now();
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    const pending = takePending('client:tauntSend');
    fireEvent.click(screen.getByTestId('mood-menu-close'));
    fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));
    expect(screen.getByTestId('mood-menu').dataset.menuKind).toBe('reaction');

    await complete(pending, {
      ok: true,
      taunt: taunt('old-menu', ANA_ACTOR, BIA_ACTOR),
      limits: { serverTime: t0, nextSendAt: t0 + 15_000 },
    });

    expect(screen.getByTestId('mood-menu').dataset.menuKind).toBe('reaction');
    expect(screen.queryByTestId('mood-menu-error')).toBeNull();
    advance(20);
    expect(document.activeElement).toBe(screen.getByTestId('mood-reaction-rindo'));
    expect(document.activeElement).not.toBe(screen.getByTestId('mood-avatar-player_biA'));

    // O envio do menu novo continua funcionando depois da conclusão antiga.
    fireEvent.click(screen.getByTestId('mood-reaction-rindo'));
    const next = takePending('client:reactionSend');
    expect(next.payload).toMatchObject({ roomCode: 'ROOM01', type: 'rindo' });
    await complete(next, {
      ok: true,
      reaction: reaction('new-op', 'rindo', ANA_ACTOR),
      limits: { serverTime: t0, nextSendAt: t0 + 5_000 },
    });
    expect(screen.getByTestId('reaction-badge-player_anA')).toBeTruthy();
  });

  it('recusa atrasada não escreve erro/escolha no menu novo e mantém o prazo no escopo próprio', async () => {
    await mount();
    await enterRoom();
    const t0 = Date.now();
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    const pending = takePending('client:tauntSend');
    fireEvent.click(screen.getByTestId('mood-menu-close'));
    fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));

    await complete(pending, {
      ok: false,
      error: {
        code: 'TAUNT_SENDER_COOLDOWN',
        message: 'Calma um pouco! Você pode provocar de novo em 15s.',
        retry: { serverTime: t0, retryAt: t0 + 15_000, scope: 'sender' },
      },
    });

    expect(screen.getByTestId('mood-menu').dataset.menuKind).toBe('reaction');
    expect(screen.queryByTestId('mood-menu-error')).toBeNull();
    expect(screen.getByTestId('mood-reaction-rindo').getAttribute('data-chosen')).toBeNull();
    // A espera anotada é da provocação; a reação segue livre e o foco não migra.
    expect(screen.queryByTestId('mood-countdown')).toBeNull();
    expect(screen.getByTestId('mood-reaction-rindo').getAttribute('aria-disabled')).toBe('false');
    advance(20);
    expect(document.activeElement).toBe(screen.getByTestId('mood-reaction-rindo'));
    expect(document.activeElement).not.toBe(screen.getByTestId('mood-avatar-player_biA'));
  });

  it.each(['disconnect', 'new-round', 'leave-room'])(
    'resultado de envio não restaura apresentação depois de %s',
    async (transition) => {
      await mount();
      await enterRoom();
      const t0 = Date.now();
      fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));
      fireEvent.click(screen.getByTestId('mood-reaction-rindo'));
      const pending = takePending('client:reactionSend');

      if (transition === 'disconnect') {
        harness.state.connected = false;
        deliver('disconnect');
      } else if (transition === 'new-round') {
        await pushState(stateMessage('ROOM01', { status: 'playing', roundId: 'new-round', version: 2 }));
      } else {
        await act(async () => {
          const leaving = api().leaveRoom();
          takePending('client:leaveRoom').callback({ ok: true, version: 99 });
          await leaving;
        });
      }
      expect(Object.keys(api().activeReactions)).toEqual([]);

      await complete(pending, {
        ok: true,
        reaction: reaction(`old-${transition}`, 'rindo', ANA_ACTOR),
        limits: { serverTime: t0, nextSendAt: t0 + 5_000 },
      });

      expect(Object.keys(api().activeReactions)).toEqual([]);
      expect(screen.queryByTestId('mood-feedback')).toBeNull();
      // Limites autoritativos da mesma identidade continuam; saída de sala zera.
      if (transition === 'leave-room') {
        expect(api().moodRemaining('reaction')).toBe(0);
        expect(api().state).toBeNull();
      } else {
        expect(api().moodRemaining('reaction')).toBeGreaterThan(0);
      }
    },
  );

  it('repetição de provocação antiga não substitui o aviso mais recente nem renova o prazo', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA, CAI], version: 2 }));
    const old = taunt('old-notice', BIA_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: old });
    advance(1_000);
    const latest = taunt('new-notice', CAI_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: latest });
    const receivedAt = api().moodNotice?.receivedAt;
    expect(api().moodNotice?.taunt.id).toBe('new-notice');

    advance(1_000);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: old });
    expect(api().moodNotice?.taunt.id).toBe('new-notice');
    expect(api().moodNotice?.receivedAt).toBe(receivedAt);

    // Repetir o próprio evento mais recente não prolonga os 30 segundos.
    advance(28_000);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: latest });
    expect(api().moodNotice?.receivedAt).toBe(receivedAt);
    advance(1_500);
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
  });

  it('aviso limpo ou ocultado não reaparece com a repetição do mesmo evento', async () => {
    await mount();
    await enterRoom();

    const hidden = taunt('hide-notice', BIA_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: hidden });
    fireEvent.click(screen.getByTestId('pref-hide-taunts'));
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
    fireEvent.click(screen.getByTestId('pref-hide-taunts'));
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: hidden });
    expect(screen.queryByTestId('taunt-notice')).toBeNull();

    // Saída do emissor encerra o aviso; repetir o evento não o recria.
    const left = taunt('leave-notice', BIA_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: left });
    expect(screen.getByTestId('taunt-notice')).toBeTruthy();
    await pushState(stateMessage('ROOM01', { participants: [ANA, CAI], version: 2 }));
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: left });
    expect(screen.queryByTestId('taunt-notice')).toBeNull();
  });
});
