import type { ReactNode } from 'react';

export interface TableShellProps {
  /** Faixa superior: vez, sentido e marca. */
  readonly topo?: ReactNode;
  /** Palco da mesa; a geometria do trilho pertence à tarefa da mesa. */
  readonly mesa: ReactNode;
  /** Ações da vez. */
  readonly acoes?: ReactNode;
  /** Mão e seu cabeçalho. */
  readonly mao?: ReactNode;
  /** Barra inferior Conversa / Reagir / Histórico / Sala. */
  readonly barra?: ReactNode;
  readonly rotuloMesa?: string;
  readonly rotuloAcoes?: string;
  readonly rotuloMao?: string;
  readonly rotuloBarra?: string;
  readonly className?: string;
}

/**
 * Casca de uma tela de mesa: topo, palco, ações, mão e barra. A casca só
 * posiciona os slots; estado, geometria, foco e comportamento ficam nas
 * tarefas de mesa, gaveta e telas.
 */
export function TableShell({
  topo,
  mesa,
  acoes,
  mao,
  barra,
  rotuloMesa = 'Mesa',
  rotuloAcoes = 'Ações da rodada',
  rotuloMao = 'Sua mão',
  rotuloBarra = 'Conteúdo da sala',
  className,
}: TableShellProps): ReactNode {
  const classes = ['tv2-table-shell'];
  if (className !== undefined) classes.push(className);
  return (
    <div
      className={classes.join(' ')}
      data-tem-topo={topo !== undefined && topo !== null ? 'true' : 'false'}
      data-tem-acoes={acoes !== undefined && acoes !== null ? 'true' : 'false'}
      data-tem-mao={mao !== undefined && mao !== null ? 'true' : 'false'}
      data-tem-barra={barra !== undefined && barra !== null ? 'true' : 'false'}
    >
      {topo !== undefined && topo !== null ? <header className="tv2-table-topo">{topo}</header> : null}
      <section className="tv2-table-mesa" aria-label={rotuloMesa}>
        {mesa}
      </section>
      {acoes !== undefined && acoes !== null ? (
        <section className="tv2-table-acoes" aria-label={rotuloAcoes}>
          {acoes}
        </section>
      ) : null}
      {mao !== undefined && mao !== null ? (
        <section className="tv2-table-mao" aria-label={rotuloMao}>
          {mao}
        </section>
      ) : null}
      {barra !== undefined && barra !== null ? (
        <nav className="tv2-table-barra" aria-label={rotuloBarra}>
          {barra}
        </nav>
      ) : null}
    </div>
  );
}
