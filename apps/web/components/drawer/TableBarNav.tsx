'use client';

import type { ReactNode } from 'react';
import { useRoom } from '@/app/providers';
import { useTableDrawer } from './TableDrawerProvider';

/**
 * Barra da mesa: Conversa e Histórico abrem a gaveta na aba certa; Reagir
 * abre a bandeja das doze reações. Nada aqui muda a geometria da mesa.
 */
export function TableBarNav(): ReactNode {
  const room = useRoom();
  const drawer = useTableDrawer();
  const reagindo = room.moodMenu?.kind === 'reaction';

  return (
    <>
      <button
        type="button"
        className="tv2-barra-item"
        data-testid="table-bar-conversa"
        aria-current={drawer.aberta && drawer.aba === 'conversa' ? 'true' : undefined}
        aria-haspopup="dialog"
        onClick={(event) => drawer.abrir('conversa', event.currentTarget)}
      >
        <span className="tv2-barra-glyph" aria-hidden="true">
          💬
        </span>
        <span>Conversa</span>
      </button>
      <button
        type="button"
        className="tv2-barra-item"
        data-testid="table-bar-reagir"
        aria-expanded={reagindo}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (reagindo) room.closeMoodMenu(true);
          else room.openReactionMenu(event.currentTarget);
        }}
      >
        <span className="tv2-barra-glyph" aria-hidden="true">
          😄
        </span>
        <span>Reagir</span>
      </button>
      <button
        type="button"
        className="tv2-barra-item"
        data-testid="table-bar-historico"
        aria-current={drawer.aberta && drawer.aba === 'historico' ? 'true' : undefined}
        aria-haspopup="dialog"
        onClick={(event) => drawer.abrir('historico', event.currentTarget)}
      >
        <span className="tv2-barra-glyph" aria-hidden="true">
          📜
        </span>
        <span>Histórico</span>
      </button>
      <button
        type="button"
        className="tv2-barra-item"
        data-testid="table-bar-sala"
        aria-current={drawer.aberta && drawer.aba === 'sala' ? 'true' : undefined}
        aria-haspopup="dialog"
        onClick={(event) => drawer.abrir('sala', event.currentTarget)}
      >
        <span className="tv2-barra-glyph" aria-hidden="true">
          🪑
        </span>
        <span>Sala</span>
      </button>
    </>
  );
}
