'use client';

import type { ReactNode } from 'react';

const ITEMS: readonly { readonly id: string; readonly label: string; readonly glyph: string }[] = [
  { id: 'conversa', label: 'Conversa', glyph: '💬' },
  { id: 'reagir', label: 'Reagir', glyph: '😄' },
  { id: 'historico', label: 'Histórico', glyph: '📜' },
];

/**
 * Barra inferior provisória da mesa. Os três itens são placeholders visuais:
 * a gaveta real (conversa, reações e histórico) entra na T019D, que troca este
 * componente pelos controles funcionais. Nada aqui abre painel.
 */
export function TableBar(): ReactNode {
  return (
    <>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tv2-barra-item"
          data-testid={`table-bar-${item.id}`}
          aria-disabled="true"
          title={`${item.label} chega na próxima etapa`}
          onClick={(event) => event.preventDefault()}
        >
          <span className="tv2-barra-glyph" aria-hidden="true">
            {item.glyph}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </>
  );
}
