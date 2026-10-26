import type { ReactNode } from 'react';
import { Button } from './primitives';

export interface DrawerTab {
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly badge?: ReactNode;
}

export interface DrawerFrameProps {
  /** Identificador estável para ligar título, abas e painel por ARIA. */
  readonly id: string;
  readonly titulo: ReactNode;
  readonly sobretitulo?: ReactNode;
  readonly abas: readonly DrawerTab[];
  readonly abaAtiva: string;
  readonly onSelecionarAba?: (aba: string) => void;
  readonly onFechar?: () => void;
  readonly rotuloFechar?: string;
  readonly rotuloAbas?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Superfície da gaveta: puxador, título, abas, fechar e corpo rolável.
 * Foco preso, Escape, retorno de foco e animação de abertura pertencem à
 * tarefa da gaveta; aqui só há marcação e slots.
 */
export function DrawerFrame({
  id,
  titulo,
  sobretitulo,
  abas,
  abaAtiva,
  onSelecionarAba,
  onFechar,
  rotuloFechar = 'Fechar gaveta',
  rotuloAbas = 'Conteúdo secundário',
  children,
  className,
}: DrawerFrameProps): ReactNode {
  const classes = ['tv2-drawer'];
  if (className !== undefined) classes.push(className);
  const tituloId = `${id}-titulo`;
  const painelId = `${id}-painel`;
  const abaAtivaId = `${id}-aba-${abaAtiva}`;
  return (
    <section className={classes.join(' ')} role="dialog" aria-modal="true" aria-labelledby={tituloId}>
      <header className="tv2-drawer-topo">
        <div className="tv2-drawer-titulos">
          {sobretitulo !== undefined ? <p className="tv2-drawer-sobretitulo">{sobretitulo}</p> : null}
          <h2 className="tv2-drawer-titulo" id={tituloId}>
            {titulo}
          </h2>
        </div>
        <Button variant="fantasma" size="icone" aria-label={rotuloFechar} onClick={onFechar}>
          <span aria-hidden="true">×</span>
        </Button>
      </header>
      <div className="tv2-drawer-abas" role="tablist" aria-label={rotuloAbas}>
        {abas.map((aba) => {
          const ativa = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              className="tv2-drawer-aba"
              role="tab"
              id={`${id}-aba-${aba.id}`}
              aria-selected={ativa}
              aria-controls={painelId}
              onClick={onSelecionarAba === undefined ? undefined : () => onSelecionarAba(aba.id)}
            >
              {aba.icon}
              <span>{aba.label}</span>
              {aba.badge !== undefined ? <span className="tv2-chip tv2-chip--latao">{aba.badge}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        className="tv2-drawer-corpo"
        id={painelId}
        role="tabpanel"
        aria-labelledby={abaAtivaId}
        tabIndex={0}
      >
        {children}
      </div>
    </section>
  );
}
