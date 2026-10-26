/**
 * T019C — trilho da mesa: 2–8 assentos com a própria pessoa na base, topo
 * oposto, laterais equilibradas, aria-current, peão na vez, etiquetas públicas
 * e nome completo em diálogo. Sem micro-setas: o sentido é textual.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublicParticipant } from '@tretta/protocol';

vi.mock('@/components/ui', () => ({
  AvatarAction: () => null,
  AvatarBadge: () => null,
}));

import { SeatCircuit, type SeatCircuitPlayer } from '@/components/SeatCircuit';

function human(id: string, nickname: string, overrides: Partial<PublicParticipant> = {}): PublicParticipant {
  return {
    id,
    kind: 'human',
    nickname,
    avatar: 'raposa',
    ready: true,
    connected: true,
    score: 0,
    inRound: true,
    isHost: false,
    autoControlled: false,
    absentSince: null,
    ...overrides,
  };
}

function bot(id: string, nickname: string, overrides: Partial<PublicParticipant> = {}): PublicParticipant {
  return {
    ...human(id, nickname, overrides),
    kind: 'bot',
    avatar: 'pinguim',
    connected: false,
  };
}

function players(...ids: string[]): SeatCircuitPlayer[] {
  return ids.map((id) => ({ id, handCount: 7 }));
}

interface TableProps {
  players?: readonly SeatCircuitPlayer[];
  direction?: 'clockwise' | 'counterclockwise';
  currentPlayerId?: string | null;
  selfId?: string | null;
  participants?: readonly PublicParticipant[];
  paused?: boolean;
  roundFinished?: boolean;
  variant?: 'table' | 'public';
}

function renderCircuit(overrides: TableProps = {}) {
  const participants = overrides.participants ?? [human('p1', 'Ana'), human('p2', 'Bia')];
  const base: Required<TableProps> = {
    players: players(...participants.map((participant) => participant.id)),
    direction: 'clockwise',
    currentPlayerId: null,
    selfId: 'p1',
    participants,
    paused: false,
    roundFinished: false,
    variant: 'table',
    ...overrides,
  };
  const view = render(
    <SeatCircuit
      players={base.players}
      direction={base.direction}
      currentPlayerId={base.currentPlayerId}
      selfId={base.selfId}
      participants={base.participants}
      paused={base.paused}
      roundFinished={base.roundFinished}
      variant={base.variant}
    />,
  );
  return { ...view, container: () => view.container };
}

function rerenderCircuit(view: ReturnType<typeof renderCircuit>, overrides: TableProps = {}): void {
  const participants = overrides.participants ?? [human('p1', 'Ana'), human('p2', 'Bia')];
  view.rerender(
    <SeatCircuit
      players={overrides.players ?? players(...participants.map((participant) => participant.id))}
      direction={overrides.direction ?? 'clockwise'}
      currentPlayerId={overrides.currentPlayerId ?? null}
      selfId={overrides.selfId === undefined ? 'p1' : overrides.selfId}
      participants={participants}
      paused={overrides.paused ?? false}
      roundFinished={overrides.roundFinished ?? false}
      variant={overrides.variant ?? 'table'}
    />,
  );
}

function chip(container: HTMLElement, playerId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-player-id="${playerId}"]`);
  if (found === null) throw new Error(`assento ausente: ${playerId}`);
  return found;
}

function sideOf(seat: HTMLElement): string {
  const side = ['base', 'top', 'left', 'right'].find((entry) => seat.classList.contains(`tv2-seat--${entry}`));
  if (side === undefined) throw new Error('assento sem lado');
  return side;
}

function orderText(container: HTMLElement): string {
  return container.querySelector('[data-testid="circuit-order"]')?.textContent ?? '';
}

function consultButton(container: HTMLElement, slot: number): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`[data-testid="seat-name-${String(slot)}"]`);
  if (found === null) throw new Error(`botão de consulta ausente para o índice ${slot}`);
  return found;
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('trilho dos assentos', () => {
  it('distribui de dois a oito assentos com a própria pessoa na base e o oposto no topo', () => {
    const expectedSides: Record<number, { left: number; right: number }> = {
      2: { left: 0, right: 0 },
      3: { left: 1, right: 0 },
      4: { left: 1, right: 1 },
      5: { left: 2, right: 1 },
      6: { left: 2, right: 2 },
      7: { left: 3, right: 2 },
      8: { left: 3, right: 3 },
    };

    for (const count of [2, 3, 4, 5, 6, 7, 8]) {
      const participants = Array.from({ length: count }, (_, index) => human(`p${index + 1}`, `P${index + 1}`));
      const { container } = renderCircuit({ participants, selfId: 'p1' });
      const seats = Array.from(container().querySelectorAll<HTMLElement>('.seat'));
      expect(seats).toHaveLength(count);

      const ringIndexes = seats.map((seat) => seat.dataset.ringIndex).sort();
      expect(ringIndexes).toEqual(Array.from({ length: count }, (_, index) => String(index)));

      const self = container().querySelectorAll<HTMLElement>('[data-self="true"]');
      expect(self).toHaveLength(1);
      expect(self[0]?.dataset.ringIndex).toBe('0');
      expect(self[0]?.textContent).toContain('Você');
      expect(sideOf(self[0]!)).toBe('base');

      const top = seats.find((seat) => sideOf(seat) === 'top');
      expect(top).toBeDefined();
      expect(top?.dataset.ringIndex).toBe(String(count === 2 ? 1 : Math.ceil((count - 2) / 2) + 1));

      const distribution = expectedSides[count]!;
      expect(seats.filter((seat) => sideOf(seat) === 'left')).toHaveLength(distribution.left);
      expect(seats.filter((seat) => sideOf(seat) === 'right')).toHaveLength(distribution.right);

      expect(container().querySelectorAll('.seat-arrow')).toHaveLength(0);
      expect(container().querySelectorAll('[data-testid="seat-circuit"]')).toHaveLength(1);
      expect(container().querySelectorAll('.tv2-rail-svg')).toHaveLength(1);
      cleanup();
    }
  });

  it('rotaciona a origem para a própria pessoa sem espelhar o ciclo', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const { container } = renderCircuit({
      participants,
      players: players('p3', 'p1', 'p4', 'p2'),
      selfId: 'p2',
    });

    expect(chip(container(), 'p2').dataset.ringIndex).toBe('0');
    expect(chip(container(), 'p3').dataset.ringIndex).toBe('1');
    expect(chip(container(), 'p1').dataset.ringIndex).toBe('2');
    expect(chip(container(), 'p4').dataset.ringIndex).toBe('3');
    expect(sideOf(chip(container(), 'p2'))).toBe('base');
    expect(sideOf(chip(container(), 'p3'))).toBe('left');
    expect(sideOf(chip(container(), 'p1'))).toBe('top');
    expect(sideOf(chip(container(), 'p4'))).toBe('right');
  });

  it('não move assentos ao inverter o sentido e atualiza o texto do percurso', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({ participants, selfId: 'p1', direction: 'clockwise' });
    const before = new Map(
      Array.from(view.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => [
        seat.dataset.playerId ?? '',
        { slot: seat.dataset.ringIndex, side: sideOf(seat) },
      ]),
    );
    const clockwiseText = orderText(view.container());

    rerenderCircuit(view, { participants, selfId: 'p1', direction: 'counterclockwise' });

    for (const seat of Array.from(view.container().querySelectorAll<HTMLElement>('.seat'))) {
      expect({ slot: seat.dataset.ringIndex, side: sideOf(seat) }).toEqual(before.get(seat.dataset.playerId ?? ''));
    }
    expect(containerDirection(view.container())).toBe('counterclockwise');
    expect(orderText(view.container())).not.toBe(clockwiseText);
    expect(orderText(view.container())).toContain('Sentido anti-horário');
  });

  it('com dois assentos a base é você e o topo é a pessoa oposta', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia')];
    const { container } = renderCircuit({ participants });
    const seats = Array.from(container().querySelectorAll<HTMLElement>('.seat'));
    expect(seats).toHaveLength(2);
    expect(sideOf(chip(container(), 'p2'))).toBe('top');
    expect(container().querySelectorAll('.tv2-seat-arrow, .seat-arrow')).toHaveLength(0);
  });

  it('desambigua identidades com apelidos coincidentes pelos ids', () => {
    const participants = [human('p1', 'Tico'), human('p2', 'Tico')];
    const { container } = renderCircuit({ participants });
    expect(container().querySelectorAll('.seat')).toHaveLength(2);
    expect(chip(container(), 'p1').dataset.ringIndex).not.toBe(chip(container(), 'p2').dataset.ringIndex);
    expect(container().querySelectorAll('[data-testid="seat-Tico"]')).toHaveLength(2);
  });

  it('na mesa pública o observador fica fora e o primeiro assento fica na base', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai')];
    const { container } = renderCircuit({
      participants,
      players: players('p1', 'p2', 'p3'),
      selfId: null,
      variant: 'public',
      currentPlayerId: 'p2',
    });

    expect(container().querySelectorAll('.seat')).toHaveLength(3);
    expect(container().querySelectorAll('[data-self="true"]')).toHaveLength(0);
    expect(container().textContent).not.toContain('Você');
    const first = chip(container(), 'p1');
    expect(first.dataset.ringIndex).toBe('0');
    expect(sideOf(first)).toBe('base');
    expect(container().querySelector('[data-testid="public-hand-count-Bia"]')?.textContent).toContain('7 cartas');
    expect(chip(container(), 'p2').dataset.current).toBe('true');
    expect(chip(container(), 'p2').textContent).toContain('na vez');
    expect(chip(container(), 'p2').getAttribute('aria-current')).toBe('true');
  });

  it('em pausa preserva assentos e sentido, sem anunciar vez nem peão', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia')];
    const view = renderCircuit({ participants, currentPlayerId: 'p2', paused: true });

    expect(view.container().querySelectorAll('.seat')).toHaveLength(2);
    expect(view.container().querySelectorAll('[data-current="true"]')).toHaveLength(0);
    expect(view.container().querySelectorAll('[aria-current="true"]')).toHaveLength(0);
    expect(view.container().textContent).not.toContain('na vez');
    expect(view.container().querySelectorAll('[data-testid="turn-pawn"]')).toHaveLength(0);
    const caption = view.container().querySelector('[data-testid="circuit-direction"]')?.textContent ?? '';
    expect(caption).toContain('Sentido horário');
    expect(caption).toContain('rodada pausada');
    expect(view.container().textContent).not.toMatch(/próximo|jogar/i);

    rerenderCircuit(view, { participants, currentPlayerId: 'p2', paused: false });
    expect(view.container().querySelectorAll('[data-current="true"]')).toHaveLength(1);
    expect(chip(view.container(), 'p2').textContent).toContain('na vez');
    expect(view.container().querySelectorAll('[data-testid="turn-pawn"]')).toHaveLength(1);
  });

  it('mantém rótulos de bot, substituto, caiu e última carta', () => {
    const participants = [
      human('p1', 'Ana'),
      bot('b1', 'Tico'),
      human('p2', 'Bia', { connected: false }),
      human('p3', 'Cai', { autoControlled: true }),
    ];
    const { container } = renderCircuit({
      participants,
      players: [
        { id: 'p1', handCount: 5 },
        { id: 'b1', handCount: 1 },
        { id: 'p2', handCount: 7 },
        { id: 'p3', handCount: 7 },
      ],
    });

    const tico = chip(container(), 'b1');
    expect(tico.textContent).toContain('bot');
    expect(tico.textContent).toContain('última');
    expect(tico.textContent).not.toContain('desconectado');
    expect(tico.textContent).not.toContain('caiu');
    expect(chip(container(), 'p2').textContent).toContain('caiu');
    expect(chip(container(), 'p2').querySelector('.status.disconnected')).not.toBeNull();
    expect(chip(container(), 'p3').textContent).toContain('substituto');
  });

  it('oferece alternativa textual do percurso e não adiciona regiões vivas', () => {
    const participants = [human('p1', 'Ana'), bot('b1', 'Tico'), human('p2', 'Cai')];
    const { container } = renderCircuit({
      participants,
      players: players('p1', 'b1', 'p2'),
      currentPlayerId: 'b1',
    });

    expect(orderText(container())).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Ana), Tico (bot), Cai, de volta a Você (Ana). Sentido horário da rodada.',
    );
    const region = container().querySelector('[data-testid="seat-circuit"]');
    expect(region?.getAttribute('aria-live')).toBeNull();
    expect(region?.getAttribute('aria-label')).toBe('Ordem dos assentos e sentido da rodada');
    const track = container().querySelector('.circuit-track');
    expect(track?.getAttribute('aria-hidden')).toBe('true');
    expect(container().querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(container().querySelectorAll('.seat-arrow')).toHaveLength(0);
  });

  it('descreve o percurso no sentido vigente, com retorno à base, sem prever turnos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({
      participants,
      players: players('p3', 'p1', 'p4', 'p2'),
      selfId: 'p2',
      direction: 'clockwise',
    });

    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Bia), Cai, Ana, Davi, de volta a Você (Bia). Sentido horário da rodada.',
    );
    expect(orderText(view.container())).not.toMatch(/próximo|jogar/i);

    rerenderCircuit(view, { participants, players: players('p3', 'p1', 'p4', 'p2'), selfId: 'p2', direction: 'counterclockwise' });
    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Bia), Davi, Ana, Cai, de volta a Você (Bia). Sentido anti-horário da rodada.',
    );
  });

  it('recompõe o resumo em inversões consecutivas e em atualizações por snapshot sem mover assentos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({ participants, selfId: 'p1', direction: 'clockwise' });
    const clockwiseText = orderText(view.container());
    const positions = Array.from(view.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => ({
      slot: seat.dataset.ringIndex,
      side: sideOf(seat),
    }));

    rerenderCircuit(view, { participants, selfId: 'p1', direction: 'counterclockwise' });
    expect(orderText(view.container())).toContain('Você (Ana), Davi, Cai, Bia, de volta a Você (Ana). Sentido anti-horário');

    rerenderCircuit(view, { participants, selfId: 'p1', direction: 'clockwise' });
    expect(orderText(view.container())).toBe(clockwiseText);
    expect(
      Array.from(view.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => ({
        slot: seat.dataset.ringIndex,
        side: sideOf(seat),
      })),
    ).toEqual(positions);
  });

  it('na mesa pública o resumo parte da base pública nos dois sentidos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({ participants, selfId: null, variant: 'public', direction: 'clockwise' });
    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base: Ana, Bia, Cai, Davi, de volta a Ana. Sentido horário da rodada.',
    );

    rerenderCircuit(view, { participants, selfId: null, variant: 'public', direction: 'counterclockwise' });
    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base: Ana, Davi, Cai, Bia, de volta a Ana. Sentido anti-horário da rodada.',
    );
  });

  it('abre o nome completo em diálogo, com etiquetas, foco preso e Escape', () => {
    const longName = 'W'.repeat(24);
    const participants = [
      human('p1', longName),
      bot('b1', 'Tico'),
      human('p2', 'Bia', { connected: false }),
      human('p3', 'Cai', { autoControlled: true }),
    ];
    const { container } = renderCircuit({ participants, players: players('p1', 'b1', 'p2', 'p3'), selfId: 'p1', currentPlayerId: 'p1' });

    expect(container().querySelector('.participant-name')?.textContent).toBe(longName);
    expect(container().querySelector('.tv2-seat-name--long')).not.toBeNull();
    expect(screen.queryByTestId('seat-dialog')).toBeNull();

    const selfButton = consultButton(container(), 0);
    expect(selfButton.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(selfButton);

    const dialog = screen.getByTestId('seat-dialog');
    expect(dialog.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: longName })).toBeTruthy();
    expect(dialog.textContent).toContain('7 cartas');
    expect(dialog.textContent).toContain('você');
    expect(dialog.textContent).toContain('na vez');
    expect(document.activeElement).toBe(screen.getByTestId('seat-dialog-close'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('seat-dialog')).toBeNull();
    expect(document.activeElement).toBe(selfButton);
  });

  it('nomes curtos não recebem a classe de reticências; longos recebem', () => {
    const participants = [human('p1', 'Vó Cida'), human('p2', 'Seu Nilton'), human('p3', 'W'.repeat(24))];
    const { container } = renderCircuit({ participants, players: players('p1', 'p2', 'p3') });
    const names = Array.from(container().querySelectorAll('.tv2-seat-name'));
    expect(names[0]?.classList.contains('tv2-seat-name--long')).toBe(false);
    expect(names[1]?.classList.contains('tv2-seat-name--long')).toBe(false);
    expect(names[2]?.classList.contains('tv2-seat-name--long')).toBe(true);
  });
});

function containerDirection(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="seat-circuit"]')?.getAttribute('data-direction') ?? null;
}
