import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react';

export type ButtonVariant = 'principal' | 'secundario' | 'atencao' | 'perigo' | 'fantasma';
export type ButtonSize = 'normal' | 'principal' | 'icone';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly bloco?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Botão da casca nova. Variantes e pisos vêm de `table-v2.css`; nenhuma
 * decisão de jogo, estado ou foco vive aqui.
 */
export function Button({
  variant,
  size = 'normal',
  bloco = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps): ReactNode {
  const classes = ['tv2-btn'];
  if (variant !== undefined) classes.push(`tv2-btn--${variant}`);
  if (size === 'principal' && variant !== 'principal') classes.push('tv2-btn--principal');
  if (size === 'icone') classes.push('tv2-btn--icone');
  if (bloco) classes.push('tv2-btn--bloco');
  if (className !== undefined) classes.push(className);
  return (
    <button {...props} type={type} className={classes.join(' ')}>
      {children}
    </button>
  );
}

export type PanelTone = 'escuro' | 'papel' | 'madeira';

export interface PanelProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title' | 'className'> {
  readonly titulo?: ReactNode;
  readonly sobretitulo?: ReactNode;
  readonly acoes?: ReactNode;
  readonly tone?: PanelTone;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Superfície de conteúdo; título, sobretítulo e ações são slots opcionais. */
export function Panel({
  titulo,
  sobretitulo,
  acoes,
  tone = 'escuro',
  className,
  children,
  ...props
}: PanelProps): ReactNode {
  const classes = ['tv2-panel'];
  if (className !== undefined) classes.push(className);
  const temCabeca = titulo !== undefined || sobretitulo !== undefined || acoes !== undefined;
  return (
    <section {...props} className={classes.join(' ')} data-tom={tone}>
      {temCabeca ? (
        <header className="tv2-panel-cabeca">
          <div className="tv2-panel-titulos">
            {sobretitulo !== undefined ? <p className="tv2-panel-sobretitulo">{sobretitulo}</p> : null}
            {titulo !== undefined ? <h2 className="tv2-panel-titulo">{titulo}</h2> : null}
          </div>
          {acoes !== undefined ? <div className="tv2-panel-acoes">{acoes}</div> : null}
        </header>
      ) : null}
      <div className="tv2-panel-corpo">{children}</div>
    </section>
  );
}

export type ChipTone = 'latao' | 'creme' | 'ultima' | 'offline' | 'bot' | 'substituto' | 'pronto' | 'espera';

export interface ChipProps extends Omit<ComponentPropsWithoutRef<'span'>, 'className'> {
  readonly tone?: ChipTone;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Etiqueta curta de estado; cor nunca é o único canal porque o texto permanece. */
export function Chip({ tone = 'latao', className, children, ...props }: ChipProps): ReactNode {
  const classes = ['tv2-chip', `tv2-chip--${tone}`];
  if (className !== undefined) classes.push(className);
  return (
    <span {...props} className={classes.join(' ')}>
      {children}
    </span>
  );
}
