/**
 * T012 — circuito dos assentos: ordem única com a própria pessoa na base,
 * rotação sem espelhamento, setas fiéis ao sentido recebido, resumo do percurso
 * no sentido vigente, consulta de nomes truncados por toque/teclado, mesa pública
 * sem observador, pausa sem “na vez” e alternativas textuais sem ruído.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { PublicParticipant } from '@tretta/protocol';

vi.mock('@/components/ui', () => ({ AvatarAction: () => null, AvatarBadge: () => null }));

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
    id,
    kind: 'bot',
    nickname,
    avatar: 'pinguim',
    ready: true,
    connected: false,
    score: 0,
    inRound: true,
    isHost: false,
    autoControlled: false,
    absentSince: null,
    ...overrides,
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

function seatStyle(element: HTMLElement): { left: number; top: number } {
  return { left: Number.parseFloat(element.style.left), top: Number.parseFloat(element.style.top) };
}

function chip(container: HTMLElement, playerId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-player-id="${playerId}"]`);
  if (found === null) throw new Error(`assento ausente: ${playerId}`);
  return found;
}

function rotationOf(element: HTMLElement): number {
  const raw = element.getAttribute('data-rotation');
  if (raw === null) throw new Error('seta sem data-rotation');
  return Number.parseFloat(raw);
}

function orderText(container: HTMLElement): string {
  return container.querySelector('[data-testid="circuit-order"]')?.textContent ?? '';
}

function details(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('[data-testid="seat-details"]');
  if (found === null) throw new Error('consulta de assento ausente');
  return found;
}

function consultButton(container: HTMLElement, slot: number): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`[data-testid="seat-name-${String(slot)}"]`);
  if (found === null) throw new Error(`botão de consulta ausente para o índice ${String(slot)}`);
  return found;
}

afterEach(() => {
  cleanup();
});

describe('circuito dos assentos', () => {
  it('mostra todos os assentos uma vez entre dois e oito, com a própria pessoa na base', () => {
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

      expect(container().querySelectorAll('.seat-arrow')).toHaveLength(count);
      expect(container().querySelectorAll('.seat-arrow[aria-hidden="true"]')).toHaveLength(count);
      expect(container().querySelectorAll('[data-testid="seat-circuit"]')).toHaveLength(1);
      cleanup();
    }
  });

  it('rotaciona a origem para a própria pessoa sem espelhar o ciclo', () => {
    // Ordem projetada diferente da ordem de participants e a própria pessoa fora do primeiro índice.
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

    // Índices crescentes percorrem o oval no sentido horário da tela: base, esquerda, topo, direita.
    const positions = [
      seatStyle(chip(container(), 'p2')),
      seatStyle(chip(container(), 'p3')),
      seatStyle(chip(container(), 'p1')),
      seatStyle(chip(container(), 'p4')),
    ];
    expect(positions[0]?.left).toBeCloseTo(50, 5);
    expect(positions[0]?.top).toBeCloseTo(84, 5);
    expect(positions[1]?.left).toBeCloseTo(17, 5);
    expect(positions[1]?.top).toBeCloseTo(50, 5);
    expect(positions[2]?.left).toBeCloseTo(50, 5);
    expect(positions[2]?.top).toBeCloseTo(16, 5);
    expect(positions[3]?.left).toBeCloseTo(83, 5);
    expect(positions[3]?.top).toBeCloseTo(50, 5);
  });

  it('inverte as setas em 180° sem deslocar nenhum assento', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const first = renderCircuit({ participants, selfId: 'p2' });
    const beforePositions = new Map(
      Array.from(first.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => [
        seat.dataset.playerId ?? '',
        seatStyle(seat),
      ]),
    );
    const beforeRotations = Array.from(first.container().querySelectorAll<HTMLElement>('.seat-arrow')).map(rotationOf);

    rerenderCircuit(first, { participants, direction: 'counterclockwise', selfId: 'p2' });

    for (const seat of Array.from(first.container().querySelectorAll<HTMLElement>('.seat'))) {
      expect(seatStyle(seat)).toEqual(beforePositions.get(seat.dataset.playerId ?? ''));
    }
    const afterRotations = Array.from(first.container().querySelectorAll<HTMLElement>('.seat-arrow')).map(rotationOf);
    expect(afterRotations).toHaveLength(4);
    for (let index = 0; index < 4; index++) {
      const diff = ((((afterRotations[index] ?? 0) - (beforeRotations[index] ?? 0)) % 360) + 360) % 360;
      expect(Math.abs(diff - 180)).toBeLessThanOrEqual(0.1);
    }
  });

  it('aponta as setas na direção certa com dois assentos nos dois sentidos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia')];
    const clockwise = renderCircuit({ participants });
    const cwArrows = Array.from(clockwise.container().querySelectorAll<HTMLElement>('.seat-arrow')).map(rotationOf);
    // Base embaixo e adversária no topo: a seta esquerda sobe e a direita desce.
    expect(cwArrows[0]).toBeCloseTo(0, 1);
    expect(cwArrows[1]).toBeCloseTo(180, 1);
    cleanup();

    const counter = renderCircuit({ participants, direction: 'counterclockwise' });
    const ccwArrows = Array.from(counter.container().querySelectorAll<HTMLElement>('.seat-arrow')).map(rotationOf);
    expect(ccwArrows[0]).toBeCloseTo(180, 1);
    expect(ccwArrows[1]).toBeCloseTo(0, 1);
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
    expect(seatStyle(first).top).toBeCloseTo(84, 5);
    expect(container().querySelector('[data-testid="public-hand-count-Bia"]')?.textContent).toContain('7 cartas');
    expect(chip(container(), 'p2').dataset.current).toBe('true');
    expect(chip(container(), 'p2').textContent).toContain('na vez');
  });

  it('em pausa preserva assentos e sentido, sem anunciar vez nem convite a jogar', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia')];
    const view = renderCircuit({ participants, currentPlayerId: 'p2', paused: true });

    expect(view.container().querySelectorAll('.seat')).toHaveLength(2);
    expect(view.container().querySelectorAll('[data-current="true"]')).toHaveLength(0);
    expect(view.container().textContent).not.toContain('na vez');
    const caption = view.container().querySelector('[data-testid="circuit-direction"]')?.textContent ?? '';
    expect(caption).toContain('Sentido horário');
    expect(caption).toContain('rodada pausada');
    expect(view.container().textContent).not.toMatch(/próximo|jogar/i);

    rerenderCircuit(view, { participants, currentPlayerId: 'p2', paused: false });
    expect(view.container().querySelectorAll('[data-current="true"]')).toHaveLength(1);
    expect(chip(view.container(), 'p2').textContent).toContain('na vez');
  });

  it('mantém rótulos de bot e substituto e nunca mostra bot como desconectado', () => {
    const participants = [
      human('p1', 'Ana'),
      bot('b1', 'Tico'),
      human('p2', 'Bia', { connected: false }),
      human('p3', 'Cai', { autoControlled: true }),
    ];
    const { container } = renderCircuit({
      participants,
      players: players('p1', 'b1', 'p2', 'p3'),
    });

    const tico = chip(container(), 'b1');
    expect(tico.textContent).toContain('bot');
    expect(tico.textContent).not.toContain('desconectado');
    expect(chip(container(), 'p2').textContent).toContain('desconectado');
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
    expect(container().querySelector('.seat-arrow svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(container().querySelectorAll('[aria-live]')).toHaveLength(0);
  });

  it('descreve o percurso no sentido vigente, com retorno à base, sem prever turnos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({
      participants,
      players: players('p3', 'p1', 'p4', 'p2'),
      selfId: 'p2',
      direction: 'clockwise',
    });

    // Base em Bia (índice projetado 3): horário desce a lista de índices crescentes a partir da base.
    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Bia), Cai, Ana, Davi, de volta a Você (Bia). Sentido horário da rodada.',
    );
    expect(orderText(view.container())).not.toMatch(/próximo|jogar/i);

    rerenderCircuit(view, { participants, players: players('p3', 'p1', 'p4', 'p2'), selfId: 'p2', direction: 'counterclockwise' });
    // Anti-horário percorre a mesma lista na ordem inversa: Bia → Davi → Ana → Cai.
    expect(orderText(view.container())).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Bia), Davi, Ana, Cai, de volta a Você (Bia). Sentido anti-horário da rodada.',
    );
  });

  it('recompõe o resumo em inversões consecutivas e em atualizações por snapshot sem mover assentos', () => {
    const participants = [human('p1', 'Ana'), human('p2', 'Bia'), human('p3', 'Cai'), human('p4', 'Davi')];
    const view = renderCircuit({ participants, selfId: 'p1', direction: 'clockwise' });
    const clockwiseText = orderText(view.container());
    const positions = Array.from(view.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => seatStyle(seat));

    rerenderCircuit(view, { participants, selfId: 'p1', direction: 'counterclockwise' });
    expect(orderText(view.container())).toContain('Você (Ana), Davi, Cai, Bia, de volta a Você (Ana). Sentido anti-horário');

    rerenderCircuit(view, { participants, selfId: 'p1', direction: 'clockwise' });
    expect(orderText(view.container())).toBe(clockwiseText);
    expect(
      Array.from(view.container().querySelectorAll<HTMLElement>('.seat')).map((seat) => seatStyle(seat)),
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

  it('consulta do assento revela o nome completo e os rótulos, sem roubar foco nem virar região viva', () => {
    const longName = 'W'.repeat(24);
    const participants = [
      human('p1', longName),
      bot('b1', 'Tico'),
      human('p2', 'Bia', { connected: false }),
      human('p3', 'Cai', { autoControlled: true }),
    ];
    const { container } = renderCircuit({ participants, players: players('p1', 'b1', 'p2', 'p3'), selfId: 'p1' });

    expect(container().querySelector('.participant-name')?.textContent).toBe(longName);
    const box = details(container());
    expect(box.hidden).toBe(true);
    expect(box.getAttribute('role')).toBeNull();

    const selfButton = consultButton(container(), 0);
    expect(selfButton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(selfButton);
    expect(selfButton.getAttribute('aria-expanded')).toBe('true');
    expect(selfButton.getAttribute('aria-controls')).toBe(box.id);
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain(longName);
    expect(box.textContent).toContain('Você');
    expect(box.textContent).toContain('7 cartas');

    const substituteButton = consultButton(container(), 3);
    fireEvent.click(substituteButton);
    expect(substituteButton.getAttribute('aria-expanded')).toBe('true');
    expect(selfButton.getAttribute('aria-expanded')).toBe('false');
    expect(box.textContent).toContain('substituto');

    fireEvent.keyDown(substituteButton, { key: 'Escape' });
    expect(substituteButton.getAttribute('aria-expanded')).toBe('false');
    expect(box.hidden).toBe(true);
  });

  it('consulta identifica o assento pelo id mesmo com apelidos coincidentes', () => {
    const participants = [human('p1', 'Tico'), human('p2', 'Tico')];
    const { container } = renderCircuit({
      participants,
      players: [
        { id: 'p1', handCount: 5 },
        { id: 'p2', handCount: 7 },
      ],
    });

    fireEvent.click(consultButton(container(), 0));
    expect(details(container()).textContent).toContain('5 cartas');
    fireEvent.click(consultButton(container(), 1));
    expect(details(container()).textContent).toContain('7 cartas');
  });
});
