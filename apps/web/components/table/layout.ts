/**
 * Geometria do trilho da mesa. A base é sempre a própria pessoa; o topo é o
 * assento oposto. As laterais são preenchidas de baixo para cima à esquerda e
 * de cima para baixo à direita, para que os índices crescentes leiam o caminho
 * no sentido horário quando a mesa está no sentido padrão.
 *
 * A distribuição aprovada é: 2 = base/topo; 3 = base/topo + 1 lateral;
 * 4 = 1+1; 5 = 2+1; 6 = 2+2; 7 = 3+2; 8 = 3+3.
 */
export type SeatSide = 'base' | 'top' | 'left' | 'right';

export interface SeatPosition {
  readonly side: SeatSide;
  /** Percentual horizontal do centro do assento no palco. */
  readonly left: number;
  /** Percentual vertical do centro do assento no palco. */
  readonly top: number;
  /** Ordem no percurso a partir da base, no sentido horário. */
  readonly slot: number;
}

const SIDE_INSET = 4.5;

function lateralYs(count: number, fromBottom: boolean): readonly number[] {
  if (count <= 0) return [];
  if (count === 1) return [50];
  if (count === 2) return fromBottom ? [68, 32] : [32, 68];
  return fromBottom ? [82, 50, 18] : [18, 50, 82];
}

/** Distribui de dois a oito assentos no perímetro; acima de oito mantém o padrão máximo. */
export function seatPositions(count: number): readonly SeatPosition[] {
  if (count <= 0) return [];
  if (count === 1) return [{ side: 'base', left: 50, top: 98, slot: 0 }];

  const positions: SeatPosition[] = [{ side: 'base', left: 50, top: 98, slot: 0 }];
  const lateral = Math.max(0, Math.min(6, count - 2));
  const leftCount = Math.ceil(lateral / 2);
  const rightCount = lateral - leftCount;

  const leftYs = lateralYs(leftCount, true);
  for (let index = 0; index < leftCount; index += 1) {
    positions.push({ side: 'left', left: SIDE_INSET, top: leftYs[index] ?? 50, slot: positions.length });
  }

  if (count >= 2) {
    positions.push({ side: 'top', left: 50, top: 2, slot: positions.length });
  }

  const rightYs = lateralYs(rightCount, false);
  for (let index = 0; index < rightCount; index += 1) {
    positions.push({ side: 'right', left: 100 - SIDE_INSET, top: rightYs[index] ?? 50, slot: positions.length });
  }

  return positions;
}

/** Posição do peão no trilho, ao lado do assento da vez. */
export function pawnPosition(position: SeatPosition): { readonly left: number; readonly top: number } {
  switch (position.side) {
    case 'base':
      return { left: 25, top: 97 };
    case 'top':
      return { left: 75, top: 3 };
    case 'left':
      return { left: 5.5, top: Math.max(7, Math.min(93, position.top - 13)) };
    case 'right':
      return { left: 94.5, top: Math.max(7, Math.min(93, position.top - 13)) };
  }
}

/** Nomes acima deste limite usam reticências; até ele, quebram linha sem truncar. */
export const SHORT_NAME_LIMIT = 12;

export function isLongName(nickname: string): boolean {
  return Array.from(nickname).length > SHORT_NAME_LIMIT;
}
