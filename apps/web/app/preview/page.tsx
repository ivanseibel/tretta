import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Button, Chip, DrawerFrame, Panel, ScreenShell, TableShell } from '@/components/chrome';

export const metadata: Metadata = {
  title: 'Tretta — base visual T019B',
  description: 'Prova visual estática dos tokens, tipografia e cascas da mesa.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-static';

interface ColorToken {
  readonly nome: string;
  readonly valor: string;
  readonly uso: string;
}

const COLOR_TOKENS: readonly ColorToken[] = [
  { nome: '--tv2-page', valor: '#0a1310', uso: 'fundo da página' },
  { nome: '--tv2-page-2', valor: '#0e1b16', uso: 'topo e rodapé' },
  { nome: '--tv2-felt', valor: '#123b2d', uso: 'feltro' },
  { nome: '--tv2-felt-lit', valor: '#1b4c3b', uso: 'luz do feltro' },
  { nome: '--tv2-felt-deep', valor: '#0d2e23', uso: 'sombra do feltro' },
  { nome: '--tv2-wood', valor: '#3b2418', uso: 'madeira' },
  { nome: '--tv2-wood-lit', valor: '#5a3a28', uso: 'madeira iluminada' },
  { nome: '--tv2-wood-deep', valor: '#24150f', uso: 'madeira profunda' },
  { nome: '--tv2-wood-soft', valor: '#2c1b12', uso: 'placa de assento' },
  { nome: '--tv2-brass', valor: '#d7ab63', uso: 'latão' },
  { nome: '--tv2-brass-light', valor: '#f0d49b', uso: 'latão claro' },
  { nome: '--tv2-brass-deep', valor: '#a97b3f', uso: 'latão profundo' },
  { nome: '--tv2-cream', valor: '#f7edd8', uso: 'texto principal' },
  { nome: '--tv2-ink', valor: '#1b1410', uso: 'texto sobre latão' },
  { nome: '--tv2-muted', valor: '#cbbaa7', uso: 'texto secundário' },
  { nome: '--tv2-muted-2', valor: '#b8aa94', uso: 'texto desabilitado' },
  { nome: '--tv2-red', valor: '#c4322a', uso: 'vermelho' },
  { nome: '--tv2-yellow', valor: '#f0b93a', uso: 'amarelo' },
  { nome: '--tv2-green', valor: '#277147', uso: 'verde' },
  { nome: '--tv2-blue', valor: '#2857b8', uso: 'azul' },
  { nome: '--tv2-focus', valor: '#f2c766', uso: 'foco no escuro' },
  { nome: '--tv2-focus-no-claro', valor: '#7a3f0e', uso: 'foco no papel' },
  { nome: '--tv2-paper', valor: '#fbf3e2', uso: 'papel' },
  { nome: '--tv2-paper-line', valor: '#d8c8ad', uso: 'linha do papel' },
  { nome: '--tv2-paper-ink', valor: '#2a2018', uso: 'tinta no papel' },
  { nome: '--tv2-paper-muted', valor: '#5a4430', uso: 'texto secundário no papel' },
  { nome: '--tv2-surface', valor: '#141e19', uso: 'painel' },
  { nome: '--tv2-drawer', valor: '#14100c', uso: 'gaveta' },
];

const TYPE_TOKENS: readonly { nome: string; valor: string; amostra: string; display?: boolean }[] = [
  { nome: '--tv2-fs-40', valor: '40px', amostra: 'Mesa posta', display: true },
  { nome: '--tv2-fs-32', valor: '32px', amostra: 'Tretta', display: true },
  { nome: '--tv2-fs-26', valor: '26px', amostra: '26 cartas', display: true },
  { nome: '--tv2-fs-24', valor: '24px', amostra: 'Rodada encerrada', display: true },
  { nome: '--tv2-fs-22', valor: '22px', amostra: 'Conversa', display: true },
  { nome: '--tv2-text-vez', valor: '20px', amostra: 'Vez de Bia', display: true },
  { nome: '--tv2-text-sentido', valor: '18px', amostra: 'Sentido anti-horário' },
  { nome: '--tv2-text-nome', valor: '16px', amostra: 'Tio Juca' },
  { nome: '--tv2-text-corpo', valor: '16px', amostra: 'Corpo de texto e botões' },
  { nome: '--tv2-text-rotulo', valor: '14px', amostra: 'Rótulo, “na vez”, contagem' },
  { nome: '--tv2-text-nome-carta', valor: '14px', amostra: 'Nome na carta' },
];

const CHIPS: readonly { tone: 'latao' | 'creme' | 'ultima' | 'offline' | 'bot' | 'substituto' | 'pronto' | 'espera'; texto: string }[] = [
  { tone: 'latao', texto: 'Anfitriã' },
  { tone: 'creme', texto: 'Você' },
  { tone: 'ultima', texto: 'Última' },
  { tone: 'offline', texto: 'Ausente' },
  { tone: 'bot', texto: 'Bot' },
  { tone: 'substituto', texto: 'Substituto' },
  { tone: 'pronto', texto: 'Pronto' },
  { tone: 'espera', texto: 'Aguardando' },
];

const DEMO_HAND = ['4', '7', '9', '⛔', '↺', '★', '2', '5'];

function DemoBarra({ ativo = 'conversa' }: { readonly ativo?: string }): ReactNode {
  const itens = [
    { id: 'conversa', glifo: '💬', rotulo: 'Conversa' },
    { id: 'reagir', glifo: '🙂', rotulo: 'Reagir' },
    { id: 'historico', glifo: '☰', rotulo: 'Histórico' },
    { id: 'sala', glifo: '⌂', rotulo: 'Sala' },
  ];
  return (
    <div className="tv2-demo-barra">
      {itens.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tv2-barra-item"
          aria-current={item.id === ativo ? 'true' : undefined}
        >
          <span className="tv2-demo-barra-glifo" aria-hidden="true">
            {item.glifo}
          </span>
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}

function DemoMesa(): ReactNode {
  return (
    <div className="tv2-demo-mesa">
      <div className="tv2-demo-feltro">
        <div className="tv2-demo-assentos" aria-hidden="true">
          {[
            { nome: 'Bia', cartas: 4 },
            { nome: 'Cai', cartas: 7 },
            { nome: 'Rita', cartas: 2 },
            { nome: 'Léo', cartas: 9 },
          ].map((assento) => (
            <div className="tv2-demo-assento" key={assento.nome}>
              <span className="tv2-demo-assento-nome">{assento.nome}</span>
              <span className="tv2-demo-assento-conta">
                <strong>{assento.cartas}</strong> cartas
              </span>
            </div>
          ))}
        </div>
        <div className="tv2-demo-centro">
          <div className="tv2-demo-monte">T</div>
          <div className="tv2-demo-descarte">6</div>
          <span className="tv2-demo-cor">
            cor ativa <strong>Vermelho</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function DemoTabela({ largura }: { readonly largura: '412' | '1280' }): ReactNode {
  return (
    <div className="tv2-preview-frame" data-largura={largura} role="group" aria-label={`Prévia da TableShell em ${largura} pixels`}>
      <TableShell
        topo={
          <div className="tv2-demo-topo">
            <div className="tv2-demo-topo-texto">
              <span className="tv2-demo-vez">Vez de Bia</span>
              <span className="tv2-demo-sentido">Sentido horário</span>
            </div>
            <Chip tone="ultima">Última</Chip>
          </div>
        }
        mesa={<DemoMesa />}
        acoes={
          <div className="tv2-demo-acoes">
            <span className="tv2-demo-acoes-status">
              <strong>Vermelho 6</strong> na mesa
            </span>
            <Button variant="secundario">Comprar</Button>
            <Button variant="principal" size="principal">
              Jogar
            </Button>
          </div>
        }
        mao={
          <div className="tv2-demo-mao">
            <div className="tv2-demo-mao-cabeca">
              Sua mão <span>8 cartas</span>
            </div>
            <div className="tv2-demo-cartas" aria-hidden="true">
              {DEMO_HAND.map((valor, indice) => (
                <span className="tv2-demo-carta" key={`${valor}-${indice}`}>
                  {valor}
                </span>
              ))}
            </div>
          </div>
        }
        barra={<DemoBarra ativo="reagir" />}
      />
    </div>
  );
}

function DemoDrawer({ largura }: { readonly largura: '412' | '1280' }): ReactNode {
  return (
    <div
      className="tv2-preview-drawer-palco"
      data-largura={largura}
      role="group"
      aria-label={`Prévia da DrawerFrame em ${largura} pixels`}
    >
      <DrawerFrame
        id={`preview-drawer-${largura}`}
        titulo="Conversa"
        sobretitulo="Sala ABC234"
        abaAtiva="conversa"
        abas={[
          { id: 'conversa', label: 'Conversa' },
          { id: 'historico', label: 'Histórico' },
          { id: 'sala', label: 'Sala' },
        ]}
      >
        <Panel
          titulo="Bia"
          sobretitulo="12:41"
          acoes={<Chip tone="latao">Você</Chip>}
        >
          <p>Eu tenho duas cartas. Quem está com o coringa?</p>
        </Panel>
        <Panel titulo="Cai" sobretitulo="12:42">
          <p>Boa jogada! Agora é o vermelho.</p>
        </Panel>
      </DrawerFrame>
    </div>
  );
}

function DemoTela({ largura }: { readonly largura: '412' | '1280' }): ReactNode {
  return (
    <div
      className="tv2-preview-frame tv2-preview-frame--tela"
      data-largura={largura}
      role="group"
      aria-label={`Prévia da ScreenShell em ${largura} pixels`}
    >
      <ScreenShell
        cabecalho={
          <div className="tv2-demo-topo-texto">
            <span className="tv2-preview-sobretitulo">Preparação</span>
            <span className="tv2-demo-vez">Mesa de Bia</span>
          </div>
        }
        conteudo={
          <div className="tv2-preview-grade">
            <Panel titulo="Jogadoras" sobretitulo="2 de 8" acoes={<Chip tone="pronto">Todos prontos</Chip>}>
              <p>Bia está pronta. Cai ainda escolhe o avatar.</p>
            </Panel>
            <Panel titulo="Regras" sobretitulo="Clássico" tone="papel">
              <p>Uma linha curta de resumo, sem esconder a ação principal.</p>
            </Panel>
          </div>
        }
        rodape={
          <div className="tv2-preview-linha" style={{ marginTop: 0 }}>
            <Button variant="principal" size="principal" bloco>
              Iniciar rodada
            </Button>
          </div>
        }
        barra={<DemoBarra ativo="sala" />}
      />
    </div>
  );
}

export default function PreviewPage(): ReactNode {
  return (
    <main className="tv2-preview">
      <header className="tv2-preview-cabecalho">
        <p className="tv2-preview-sobretitulo">T019B · prova visual</p>
        <h1 className="tv2-preview-titulo">Mesa posta, base pronta.</h1>
        <p className="tv2-preview-sub">
          Página estática, não linkada e com <code>noindex</code>. Mostra os tokens, a tipografia local, os primitivos e as
          cascas em 412 e 1280. Nenhuma tela existente usa esta rota; o comportamento de jogo continua fora daqui.
        </p>
      </header>

      <section className="tv2-preview-secao" aria-labelledby="preview-tokens">
        <h2 className="tv2-preview-secao-titulo" id="preview-tokens">
          Tokens de cor
        </h2>
        <p className="tv2-preview-secao-sub">Valores medidos a partir de table-v2.css; contraste conferido no report.</p>
        <div className="tv2-preview-grade tv2-preview-grade--cores">
          {COLOR_TOKENS.map((token) => (
            <div className="tv2-preview-token" key={token.nome}>
              <span
                className="tv2-preview-amostra"
                style={{ background: `var(${token.nome})` } as CSSProperties}
                aria-hidden="true"
              />
              <span className="tv2-preview-token-nome">{token.nome}</span>
              <span className="tv2-preview-token-valor">{token.valor}</span>
              <span className="tv2-preview-secao-sub">{token.uso}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="tv2-preview-secao" aria-labelledby="preview-tipografia">
        <h2 className="tv2-preview-secao-titulo" id="preview-tipografia">
          Tipografia
        </h2>
        <p className="tv2-preview-secao-sub">
          Fraunces para títulos e números; Atkinson Hyperlegible Next para corpo e rótulos. Ambas locais, com fallback de
          sistema e <code>font-display: swap</code>.
        </p>
        <div className="tv2-preview-grade tv2-preview-grade--tipos">
          <div className="tv2-preview-tipo" style={{ fontFamily: 'var(--tv2-font-display)' }}>
            <span className="tv2-preview-tipo-rotulo">--tv2-font-display · Fraunces</span>
            <span className="tv2-preview-tipo-amostra" style={{ fontSize: 'var(--tv2-fs-32)' }}>
              Tretta, mesa posta
            </span>
          </div>
          <div className="tv2-preview-tipo" style={{ fontFamily: 'var(--tv2-font-ui)' }}>
            <span className="tv2-preview-tipo-rotulo">--tv2-font-ui · Atkinson</span>
            <span className="tv2-preview-tipo-amostra" style={{ fontSize: 'var(--tv2-text-corpo)' }}>
              Jogo de cartas para amigos e família.
            </span>
          </div>
          {TYPE_TOKENS.map((token) => (
            <div className="tv2-preview-tipo" key={token.nome}>
              <span className="tv2-preview-tipo-rotulo">
                {token.nome} · {token.valor}
              </span>
              <span
                className="tv2-preview-tipo-amostra"
                style={{
                  fontFamily: token.display === true ? 'var(--tv2-font-display)' : 'var(--tv2-font-ui)',
                  fontSize: `var(${token.nome})`,
                  fontWeight: token.display === true ? 600 : 400,
                }}
              >
                {token.amostra}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="tv2-preview-secao" aria-labelledby="preview-primitivos">
        <h2 className="tv2-preview-secao-titulo" id="preview-primitivos">
          Botões, chips e painel
        </h2>
        <p className="tv2-preview-secao-sub">Alvo mínimo de 44px; principal de 56px; foco de 3px visível.</p>
        <div className="tv2-preview-linha">
          <Button variant="principal" size="principal">
            Jogar carta
          </Button>
          <Button variant="secundario">Comprar</Button>
          <Button variant="atencao">Avisar última</Button>
          <Button variant="perigo">Denunciar</Button>
          <Button variant="fantasma">Cancelar</Button>
          <Button disabled>Indisponível</Button>
          <Button variant="fantasma" size="icone" aria-label="Fechar">
            <span aria-hidden="true">×</span>
          </Button>
        </div>
        <div className="tv2-preview-linha">
          {CHIPS.map((chip) => (
            <Chip key={chip.tone} tone={chip.tone}>
              {chip.texto}
            </Chip>
          ))}
        </div>
        <div className="tv2-preview-grade tv2-preview-grade--tipos">
          <Panel titulo="Painel escuro" sobretitulo="Conteúdo" acoes={<Chip tone="latao">Sala</Chip>}>
            <p>Superfície padrão para listas, jogadores e preferências.</p>
          </Panel>
          <Panel titulo="Painel de papel" sobretitulo="Convite" tone="papel">
            <p>Placar, confirmação e conteúdo sobre papel creme.</p>
          </Panel>
        </div>
      </section>

      <section className="tv2-preview-faixa" data-largura="412" aria-labelledby="preview-mesa-412">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-mesa-412">
            TableShell · 412 × 915
          </h2>
          <span className="tv2-preview-faixa-nota">celular principal</span>
        </div>
        <DemoTabela largura="412" />
      </section>

      <section className="tv2-preview-faixa" data-largura="1280" aria-labelledby="preview-mesa-1280">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-mesa-1280">
            TableShell · 1280 × 800
          </h2>
          <span className="tv2-preview-faixa-nota">desktop, oito cartas em uma fileira</span>
        </div>
        <DemoTabela largura="1280" />
      </section>

      <section className="tv2-preview-faixa" data-largura="412" aria-labelledby="preview-drawer-412">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-drawer-412">
            DrawerFrame · 412
          </h2>
          <span className="tv2-preview-faixa-nota">apresentacional; foco e Escape na tarefa da gaveta</span>
        </div>
        <DemoDrawer largura="412" />
      </section>

      <section className="tv2-preview-faixa" data-largura="1280" aria-labelledby="preview-drawer-1280">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-drawer-1280">
            DrawerFrame · 1280
          </h2>
          <span className="tv2-preview-faixa-nota">largura máxima de 760px, centrada</span>
        </div>
        <DemoDrawer largura="1280" />
      </section>

      <section className="tv2-preview-faixa" data-largura="412" aria-labelledby="preview-screen-412">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-screen-412">
            ScreenShell · 412
          </h2>
          <span className="tv2-preview-faixa-nota">preparação, espera, resultado e erros</span>
        </div>
        <DemoTela largura="412" />
      </section>

      <section className="tv2-preview-faixa" data-largura="1280" aria-labelledby="preview-screen-1280">
        <div className="tv2-preview-faixa-topo">
          <h2 className="tv2-preview-faixa-titulo" id="preview-screen-1280">
            ScreenShell · 1280
          </h2>
          <span className="tv2-preview-faixa-nota">conteúdo rola; ação principal fixa</span>
        </div>
        <DemoTela largura="1280" />
      </section>
    </main>
  );
}
