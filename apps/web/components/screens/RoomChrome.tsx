'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/chrome';
import { LeaveButton } from '@/components/ui';
import { TableBarNav } from '@/components/drawer/TableBarNav';
import { useTableDrawer } from '@/components/drawer/TableDrawerProvider';
import styles from './room.module.css';

/**
 * Topo comum das telas da sala: marca, etapa e as saídas reais — abrir a
 * gaveta na aba Sala e sair. Não decide fluxo; só compõe a casca.
 */
export function RoomTopBar({
  etapa,
  mostrarSala = false,
  mostrarSair = false,
}: {
  readonly etapa: ReactNode;
  readonly mostrarSala?: boolean;
  readonly mostrarSair?: boolean;
}): ReactNode {
  const drawer = useTableDrawer();
  return (
    <div className={styles.topbar}>
      <p className={styles.marca}>
        <span className={styles.marcaNome}>Tretta</span>
        <span className={styles.etapa}>{etapa}</span>
      </p>
      <div className={styles.topbarAcoes}>
        {mostrarSala ? (
          <Button
            variant="fantasma"
            data-testid="open-room-drawer"
            aria-haspopup="dialog"
            onClick={(event) => drawer.abrir('sala', event.currentTarget)}
          >
            <span aria-hidden="true">🪑</span>
            <span>Sala</span>
          </Button>
        ) : null}
        {mostrarSair ? <LeaveButton /> : null}
      </div>
    </div>
  );
}

/** Título grande com foco programático, usado pela preparação, resultado e entrada. */
export function RoomHeading({
  titulo,
  sobretitulo,
  subtitulo,
  meta,
}: {
  readonly titulo: string;
  readonly sobretitulo?: string;
  readonly subtitulo?: ReactNode;
  readonly meta?: ReactNode;
}): ReactNode {
  return (
    <div className={styles.cabecalhoTitulo}>
      {sobretitulo === undefined ? null : <p className={styles.sobretitulo}>{sobretitulo}</p>}
      <h1 className={styles.titulo} data-focus-target tabIndex={-1}>
        {titulo}
      </h1>
      {subtitulo === undefined ? null : <p className={styles.subtitulo}>{subtitulo}</p>}
      {meta === undefined ? null : <div className={styles.metaLinha}>{meta}</div>}
    </div>
  );
}

/** Barra inferior compartilhada: Conversa, Reagir e Histórico, com a gaveta real. */
export function RoomBar(): ReactNode {
  return <TableBarNav />;
}
