import type { ReactNode } from 'react';

export type ScreenWidth = 'leitura' | 'ampla' | 'total';

export interface ScreenShellProps {
  /** Cabeçalho da tela, acima da área rolável. */
  readonly cabecalho?: ReactNode;
  /** Conteúdo principal; rola dentro da casca quando `rolavel` é true. */
  readonly conteudo: ReactNode;
  /** Rodapé fixo acima da barra inferior. */
  readonly rodape?: ReactNode;
  /** Barra inferior Conversa / Reagir / Histórico / Sala. */
  readonly barra?: ReactNode;
  readonly largura?: ScreenWidth;
  readonly rolavel?: boolean;
  /** Cabeçalho participa da rolagem do conteúdo em vez de ficar fixo. */
  readonly cabecalhoRolavel?: boolean;
  readonly rotuloConteudo?: string;
  readonly rotuloBarra?: string;
  readonly className?: string;
}

/**
 * Casca de uma tela que não é a mesa: preparação, espera, resultado, erros e
 * home. O conteúdo rola; cabeçalho, rodapé e barra ficam fixos. Nenhuma
 * decisão de fluxo ou de jogo é tomada aqui.
 */
export function ScreenShell({
  cabecalho,
  conteudo,
  rodape,
  barra,
  largura = 'ampla',
  rolavel = true,
  cabecalhoRolavel = false,
  rotuloConteudo,
  rotuloBarra = 'Conteúdo da sala',
  className,
}: ScreenShellProps): ReactNode {
  const classes = ['tv2-screen-shell'];
  if (className !== undefined) classes.push(className);
  return (
    <div
      className={classes.join(' ')}
      data-largura={largura}
      data-rolavel={rolavel ? 'true' : 'false'}
      data-tem-cabecalho={cabecalho !== undefined && cabecalho !== null ? 'true' : 'false'}
      data-tem-rodape={rodape !== undefined && rodape !== null ? 'true' : 'false'}
      data-tem-barra={barra !== undefined && barra !== null ? 'true' : 'false'}
    >
      {cabecalho !== undefined && cabecalho !== null && !cabecalhoRolavel ? (
        <header className="tv2-screen-cabecalho">{cabecalho}</header>
      ) : null}
      <div
        className="tv2-screen-conteudo"
        style={rolavel ? undefined : { overflowY: 'hidden' }}
        aria-label={rotuloConteudo}
      >
        <div className="tv2-screen-conteudo-interno">
          {cabecalho !== undefined && cabecalho !== null && cabecalhoRolavel ? (
            <header className="tv2-screen-cabecalho tv2-screen-cabecalho--rolavel">{cabecalho}</header>
          ) : null}
          {conteudo}
        </div>
      </div>
      {rodape !== undefined && rodape !== null ? <footer className="tv2-screen-rodape">{rodape}</footer> : null}
      {barra !== undefined && barra !== null ? (
        <nav className="tv2-screen-barra" aria-label={rotuloBarra}>
          {barra}
        </nav>
      ) : null}
    </div>
  );
}
