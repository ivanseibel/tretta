import { describe, expect, it } from 'vitest';
import { isLongName, pawnPosition, seatPositions } from '@/components/table/layout';

describe('geometria do trilho', () => {
  it('distribui 2–8 assentos na base, topo e laterais equilibradas', () => {
    const expected: Record<number, { base: number; top: number; left: number; right: number }> = {
      2: { base: 1, top: 1, left: 0, right: 0 },
      3: { base: 1, top: 1, left: 1, right: 0 },
      4: { base: 1, top: 1, left: 1, right: 1 },
      5: { base: 1, top: 1, left: 2, right: 1 },
      6: { base: 1, top: 1, left: 2, right: 2 },
      7: { base: 1, top: 1, left: 3, right: 2 },
      8: { base: 1, top: 1, left: 3, right: 3 },
    };

    for (const [count, sides] of Object.entries(expected)) {
      const positions = seatPositions(Number(count));
      expect(positions).toHaveLength(Number(count));
      for (const side of ['base', 'top', 'left', 'right'] as const) {
        expect(positions.filter((position) => position.side === side)).toHaveLength(sides[side]);
      }
      expect(positions.map((position) => position.slot)).toEqual(
        Array.from({ length: Number(count) }, (_, index) => index),
      );
      expect(positions[0]?.side).toBe('base');
      expect(positions.find((position) => position.side === 'top')?.top).toBeLessThan(10);
    }
  });

  it('mantém laterais afastadas do topo e da base', () => {
    const positions = seatPositions(8);
    for (const position of positions.filter((entry) => entry.side === 'left' || entry.side === 'right')) {
      expect(position.top).toBeGreaterThan(10);
      expect(position.top).toBeLessThan(90);
    }
  });

  it('coloca o peão ao lado do assento da vez, sem sobrepor o centro', () => {
    const positions = seatPositions(8);
    for (const position of positions) {
      const pawn = pawnPosition(position);
      expect(pawn.left).toBeGreaterThanOrEqual(0);
      expect(pawn.left).toBeLessThanOrEqual(100);
      expect(pawn.top).toBeGreaterThanOrEqual(0);
      expect(pawn.top).toBeLessThanOrEqual(100);
      expect(Number.isFinite(pawn.left)).toBe(true);
      expect(Number.isFinite(pawn.top)).toBe(true);
    }
  });

  it('considera longo apenas o nome acima de doze caracteres', () => {
    expect(isLongName('Vó Cida')).toBe(false);
    expect(isLongName('Seu Nilton')).toBe(false);
    expect(isLongName('abcdefghijkl')).toBe(false);
    expect(isLongName('abcdefghijklm')).toBe(true);
  });
});
