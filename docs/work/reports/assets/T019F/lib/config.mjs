/**
 * Configuração única do harness T019F.
 *
 * Este arquivo é a fonte da matriz, dos pisos e dos critérios. O harness não
 * importa nada de apps/web: os seletores recomendados são apenas contrato de
 * leitura. A implementação pode usar os hooks `data-tv2-*` ou os fallbacks
 * semânticos listados em SELECTORS.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const HARNESS_VERSION = '1.0.0';
export const HARNESS_DIR = resolve(HERE, '..');
export const REPO_ROOT = resolve(HERE, '../../../../../..');
export const BASELINE_PATH = resolve(HARNESS_DIR, 'baseline.json');
export const T018_DIR = resolve(REPO_ROOT, 'docs/work/reports/assets/T018');
export const T018_PROTOTYPE = resolve(REPO_ROOT, 'docs/work/t018-prototype/index.html');
export const DEFAULT_PROTOTYPE_URL = `file://${T018_PROTOTYPE}`;

export const LIMITS = {
  cardMin: 72,
  targetMin: 44,
  textContrast: 4.5,
  largeTextContrast: 3,
  uiContrast: 3,
  focusContrast: 3,
  minFunctionalText: 14,
  shortNameMax: 12,
  reactionCount: 12,
  reactionQueue: 3,
  reactionDurationMs: 4000,
  reactionCooldownMs: 5000
};

export const FONT_FLOORS = {
  turn: 20,
  direction: 18,
  countNum: 26,
  countLabel: 14,
  seatName: 16,
  cardName: 14,
  body: 16,
  label: 14,
  onTurn: 14
};

export const VIEWPORTS = {
  '412x915': {
    id: '412x915',
    width: 412,
    height: 915,
    dpr: 1,
    mobile: true,
    zoom200: false,
    allowTableScroll: false,
    note: 'celular principal'
  },
  '360x640': {
    id: '360x640',
    width: 360,
    height: 640,
    dpr: 1,
    mobile: true,
    zoom200: false,
    allowTableScroll: false,
    note: 'celular compacto'
  },
  '1280x800': {
    id: '1280x800',
    width: 1280,
    height: 800,
    dpr: 1,
    mobile: false,
    zoom200: false,
    allowTableScroll: false,
    note: 'desktop'
  },
  '640x800': {
    id: '640x800',
    width: 640,
    height: 800,
    dpr: 1,
    mobile: false,
    zoom200: true,
    allowTableScroll: false,
    note: 'zoom 200% equivalente (1280x800 / 2)'
  },
  '640x400': {
    id: '640x400',
    width: 640,
    height: 400,
    dpr: 1,
    mobile: false,
    zoom200: true,
    allowTableScroll: true,
    supplemental: true,
    note: 'zoom 200% em altura curta; rolagem permitida para não esconder informação'
  }
};

export const DEFAULT_VIEWPORTS = ['412x915', '360x640', '1280x800', '640x800'];

export const REACTION_LABELS = [
  'Eita!',
  'Que injustiça!',
  'Aí eu gostei!',
  'Não acredito!',
  'Boa jogada!',
  'Que comédia!',
  'Que tédio!',
  'Uau!',
  'Já era!',
  'Suspeito...',
  'Com carinho!',
  'Tá pegando fogo!'
];

/**
 * Texto proibido: provocação com alvo, resposta, aviso de 30s e a preferência
 * removida. `hard` bloqueia; `review` pede inspeção humana para não produzir
 * falso positivo em copy legítima ("sem destinatário" etc.).
 */
export const FORBIDDEN_COPY = {
  hard: [
    { id: 'provocacao', source: 'provoc', flags: 'i' },
    { id: 'taunt', source: 'taunt', flags: 'i' },
    { id: 'se-ferrou', source: 'se\\s+ferrou', flags: 'i' },
    { id: 'toma-essa', source: 'toma\\s+essa', flags: 'i' },
    { id: 'palhaco', source: 'palha(?:ç|c)o', flags: 'i' },
    { id: 'sacanagem', source: 'sacanagem', flags: 'i' },
    { id: 'aviso-30s', source: '\\b30\\s*s(?:egundos)?\\b', flags: 'i' },
    { id: 'ocultar-provocacoes', source: 'ocultar\\s+provoca', flags: 'i' },
    { id: 'responder-provocacao', source: 'responder\\s+(?:a\\s+)?(?:provoca|taunt)', flags: 'i' }
  ],
  review: [
    { id: 'alvo', source: '(?:escolher|selecionar|mandar|enviar)\\s+(?:um\\s+)?alvo|\\balvo\\s+(?:da|do)\\b', flags: 'i' },
    { id: 'resposta', source: 'aguardando\\s+resposta|resposta\\s+de\\s+(?:provoca|taunt)', flags: 'i' }
  ]
};

export const FORBIDDEN_DOM = {
  hard: [
    { id: 'taunt-attr', source: '(?:^|[-_\\s])(?:taunt|provoc)', flags: 'i' },
    { id: 'target-attr', source: '(?:^|[-_\\s])(?:target|alvo|destinatario|jogador-alvo)', flags: 'i' }
  ]
};

/**
 * Seletores em ordem de preferência. O primeiro que existir vence no grupo.
 * `data-tv2-*` é o contrato recomendado; classes antigas e ARIA são fallback.
 */
export const SELECTORS = {
  screen: [
    '[data-tv2-screen]',
    '[data-screen]',
    '.tv2-table-root',
    'main.screen',
    'main',
    '.tela-mesa',
    '.tela-espera',
    '.tela-rolavel',
    '.app'
  ],
  table: [
    '[data-tv2-table]',
    '[data-tv2-mesa]',
    '.tv2-table-stage',
    '.tv2-table-mesa',
    '.tv2-table-root',
    '.tv2-table-shell',
    '#mesa',
    '.tela-mesa',
    '.tv2-mesa',
    '.mesa'
  ],
  center: [
    '[data-tv2-center]',
    '[data-tv2-centro]',
    '.tv2-table-center',
    '.tv2-centro',
    '.mesa-centro',
    '.centro',
    '.prep-centro'
  ],
  hand: [
    '[data-tv2-hand]',
    '[data-tv2-mao]',
    '[data-testid="my-hand"]',
    '.tv2-hand-cards',
    '#mao',
    '.tv2-mao',
    '.mao'
  ],
  seat: ['[data-tv2-seat]', '[data-tv2-assento]', '[data-assento]', '.tv2-seat', '.tv2-assento', '.assento'],
  seatName: [
    '[data-tv2-seat-name]',
    '[data-tv2-nome]',
    '.tv2-seat-name',
    '.tv2-assento-nome',
    '.assento-nome'
  ],
  countNum: [
    '[data-tv2-count]',
    '.tv2-seat-count strong',
    '.tv2-assento-conta strong',
    '.hand-count',
    '.conta-num',
    '[data-count]'
  ],
  countLabel: [
    '[data-tv2-count-label]',
    '.tv2-seat-count > span',
    '.tv2-assento-conta .tv2-assento-conta-rot',
    '.conta-rot',
    '.tv2-assento-conta'
  ],
  turn: ['[data-tv2-turn]', '[data-tv2-vez]', '[data-testid="turn-indicator"]', '.tv2-turn', '.tv2-vez', '.vez-nome', '[data-turn]'],
  direction: [
    '[data-tv2-direction]',
    '[data-tv2-sentido]',
    '[data-testid="table-direction"] strong',
    '.tv2-direction strong',
    '.tv2-sentido',
    '.sentido-valor'
  ],
  onTurn: ['[data-tv2-on-turn]', '.tv2-seat-now', '.tv2-tag-na-vez', '.tag-na-vez'],
  card: ['[data-tv2-card]', '[data-carta]', '.tv2-card', '.tv2-carta', '.carta'],
  cardName: ['[data-tv2-card-name]', '.tv2-card-rank', '.tv2-card-action-name', '.tv2-carta-nome', '.carta-nome'],
  reaction: [
    '[data-tv2-reaction]',
    '[data-reacao]',
    '.tv2-reaction-btn',
    '.tv2-reaction-option',
    '.tv2-reacao',
    '.mood-reaction-option',
    '[data-testid^="mood-reaction-"]',
    '.reacao-btn',
    '[data-reaction]'
  ],
  reactionTray: [
    '[data-tv2-reaction-tray]',
    '[data-tv2-bandeja-reacoes]',
    '.tv2-reaction-tray',
    '.tv2-bandeja-reacoes',
    '.reacoes-bandeja',
    '[data-testid="mood-menu"]',
    '.mood-menu'
  ],
  overlay: [
    '[data-tv2-reaction-overlay]',
    '[data-reacao-overlay]',
    '[data-testid="reaction-overlay"]',
    '.tv2-reaction-overlay',
    '.reaction-overlay',
    '.reacao-overlay'
  ],
  drawer: ['[data-tv2-drawer]', '.tv2-drawer', '[role="dialog"][aria-label*="Sala" i]', '.tv2-gaveta', '.gaveta'],
  dialog: ['[role="dialog"]', '[role="alertdialog"]'],
  live: ['[aria-live]', '[role="status"]', '[role="alert"]'],
  body: ['[data-tv2-body]', '[data-tv2-action]', '.tv2-btn', '.tv2-botao', '.botao'],
  label: ['[data-tv2-label]', '.tv2-chip', '.tv2-tag', '.tag'],
  focusable: [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[role="button"]:not([aria-disabled="true"])',
    '[role="tab"]:not([aria-disabled="true"])',
    '[role="menuitem"]:not([aria-disabled="true"])',
    '[tabindex]:not([tabindex="-1"])'
  ]
};

const tableState = (id, seats, extra = {}) => ({
  id,
  label: id,
  kind: 'table',
  table: true,
  tableScroll: true,
  hand: true,
  seats: { exact: seats },
  live: 'required',
  ariaCurrent: 'one',
  keyboard: true,
  ...extra
});

/**
 * Matriz de estados. `baseline` aponta para a captura T018 equivalente.
 * `t018Route` aponta para o hash do protótipo para o smoke de calibração.
 */
export const STATES = {
  home: {
    id: 'home',
    label: 'Home',
    kind: 'home',
    baseline: 'home',
    t018Route: 'home',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: false
  },
  preparacao: {
    id: 'preparacao',
    label: 'Preparação (2 assentos)',
    kind: 'preparation',
    baseline: 'preparacao',
    t018Route: 'preparacao',
    seats: { exact: 2 },
    hand: false,
    table: false,
    live: 'optional',
    ariaCurrent: 'none',
    keyboard: true,
    features: ['readiness', 'host-start'],
    mustContain: [
      { id: 'prontidao', source: 'pronto|aguardando|não pronto', flags: 'i' },
      { id: 'iniciar', source: 'iniciar\\s+rodada', flags: 'i' }
    ]
  },
  'preparacao-8': {
    id: 'preparacao-8',
    label: 'Preparação (8 assentos)',
    kind: 'preparation',
    baseline: 'preparacao-cheia',
    t018Route: 'preparacao-cheia',
    seats: { exact: 8 },
    hand: false,
    table: false,
    live: 'optional',
    ariaCurrent: 'none',
    keyboard: true,
    features: ['readiness', 'host-start'],
    mustContain: [{ id: 'prontidao', source: 'pronto|aguardando|não pronto', flags: 'i' }]
  },
  espera: {
    id: 'espera',
    label: 'Espera da próxima rodada',
    kind: 'waiting',
    baseline: 'espera',
    t018Route: 'espera',
    seats: { min: 2, max: 8 },
    hand: false,
    table: true,
    tableScroll: true,
    live: 'required',
    ariaCurrent: 'one',
    keyboard: true,
    features: ['observer', 'reactions', 'bottom-bar'],
    mustContain: [
      { id: 'reagir', source: 'reagir', flags: 'i' },
      { id: 'conversa', source: 'conversa', flags: 'i' }
    ]
  },
  observador: {
    id: 'observador',
    label: 'Observador na mesa pública',
    kind: 'waiting',
    baseline: 'espera',
    t018Route: 'espera',
    seats: { min: 2, max: 8 },
    hand: false,
    table: true,
    tableScroll: true,
    live: 'required',
    ariaCurrent: 'one',
    keyboard: true,
    features: ['observer', 'reactions', 'bottom-bar'],
    mustContain: [{ id: 'reagir', source: 'reagir', flags: 'i' }]
  },
  'mesa-2': tableState('mesa-2', 2, { baseline: 'mesa-2', t018Route: 'mesa-2', handCards: 8 }),
  'mesa-3': tableState('mesa-3', 3, { baseline: 'mesa-3', t018Route: 'mesa-3', handCards: 8 }),
  'mesa-4': tableState('mesa-4', 4, { baseline: 'mesa', t018Route: 'mesa', handCards: 8 }),
  'mesa-5': tableState('mesa-5', 5, { baseline: 'mesa-5', t018Route: 'mesa-5', handCards: 8 }),
  'mesa-6': tableState('mesa-6', 6, { baseline: 'mesa-6', t018Route: 'mesa-6', handCards: 8 }),
  'mesa-7': tableState('mesa-7', 7, { baseline: 'mesa-7', t018Route: 'mesa-7', handCards: 8 }),
  'mesa-8': tableState('mesa-8', 8, { baseline: 'mesa-8', t018Route: 'mesa-8', handCards: 8 }),
  'mesa-cheia': tableState('mesa-cheia', 8, {
    baseline: 'mesa-cheia',
    t018Route: 'mesa-cheia',
    handCards: 8,
    features: ['full-hand', 'host-start']
  }),
  pausa: tableState('pausa', 4, {
    baseline: 'pausada',
    t018Route: 'pausada',
    overlay: 'pause',
    ariaCurrent: 'none',
    features: ['pause'],
    mustContain: [
      { id: 'substituir', source: 'substituir', flags: 'i' },
      { id: 'continuar', source: 'continuar\\s+rodada', flags: 'i' },
      { id: 'encerrar', source: 'encerrar\\s+sem\\s+vencedor', flags: 'i' }
    ]
  }),
  ultima: tableState('ultima', 2, {
    baseline: 'ultima',
    t018Route: 'ultima',
    features: ['last-card'],
    mustContain: [{ id: 'ultima', source: 'última|ultima', flags: 'i' }]
  }),
  denuncia: tableState('denuncia', 2, {
    baseline: 'denuncia',
    t018Route: 'denuncia',
    features: ['denounce'],
    mustContain: [{ id: 'denunciar', source: 'denunciar', flags: 'i' }]
  }),
  treino: tableState('treino', 4, {
    baseline: 'treino',
    t018Route: 'treino',
    features: ['training', 'bots'],
    mustContain: [
      { id: 'treino', source: 'treino|treinar', flags: 'i' },
      { id: 'bot', source: '\\bbot', flags: 'i' }
    ]
  }),
  bots: tableState('bots', 4, {
    baseline: 'treino',
    t018Route: 'treino',
    features: ['bots'],
    mustContain: [{ id: 'bot', source: '\\bbot', flags: 'i' }]
  }),
  substituto: tableState('substituto', 8, {
    baseline: 'ausente',
    t018Route: 'ausente',
    features: ['absent', 'substitute'],
    mustContain: [
      { id: 'ausente', source: 'ausente|caiu|desconect', flags: 'i' },
      { id: 'substituto', source: 'substituto|substitu', flags: 'i' }
    ]
  }),
  resultado: {
    id: 'resultado',
    label: 'Resultado com vencedor',
    kind: 'result',
    baseline: 'resultado',
    t018Route: 'resultado',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: true,
    features: ['result', 'host-return'],
    mustContain: [
      { id: 'rodada-encerrada', source: 'rodada\\s+(?:\\d+\\s+)?encerrada', flags: 'i' },
      { id: 'voltar', source: 'voltar\\s+à\\s+prepara', flags: 'i' }
    ]
  },
  'resultado-sem-vencedor': {
    id: 'resultado-sem-vencedor',
    label: 'Resultado sem vencedor',
    kind: 'result',
    baseline: 'resultado-sem-vencedor',
    t018Route: 'resultado-sem-vencedor',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: true,
    features: ['result'],
    mustContain: [{ id: 'sem-vencedor', source: 'sem\\s+vencedor', flags: 'i' }]
  },
  'erro-conexao': {
    id: 'erro-conexao',
    label: 'Erro de conexão',
    kind: 'error',
    baseline: 'erro-conexao',
    t018Route: 'erro-conexao',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: false,
    mustContain: [{ id: 'conexao', source: 'conex', flags: 'i' }]
  },
  'erro-sala': {
    id: 'erro-sala',
    label: 'Sala expirada',
    kind: 'error',
    baseline: 'erro-sala',
    t018Route: 'erro-sala',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: false
  },
  'erro-link': {
    id: 'erro-link',
    label: 'Link inválido',
    kind: 'error',
    baseline: 'erro-link',
    t018Route: 'erro-link',
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: false
  },
  reacoes: tableState('reacoes', 4, {
    baseline: 'reacoes',
    t018Route: 'reacoes',
    reactions: 'tray',
    features: ['reactions'],
    mustContain: [{ id: 'sem-destinatario', source: 'sem\\s+destinat', flags: 'i' }]
  }),
  reacao: tableState('reacao', 4, {
    baseline: 'reacao',
    t018Route: 'reacao',
    reactions: 'overlay',
    features: ['reaction-overlay']
  }),
  sala: tableState('sala', 4, {
    baseline: 'sala',
    t018Route: 'sala',
    drawer: 'sala',
    features: ['drawer'],
    mustContain: [
      { id: 'sala', source: '\\bsala\\b', flags: 'i' },
      { id: 'jogadores', source: 'jogadores', flags: 'i' },
      { id: 'apresentacao', source: 'apresenta', flags: 'i' },
      { id: 'anfitriao', source: 'anfitri', flags: 'i' }
    ]
  }),
  'sala-apresentacao': tableState('sala-apresentacao', 4, {
    baseline: 'sala-apresentacao',
    t018Route: 'sala-apresentacao',
    drawer: 'sala',
    features: ['drawer', 'preferences'],
    mustContain: [
      { id: 'animações', source: 'anima', flags: 'i' },
      { id: 'ocultar-reacoes', source: 'ocultar\\s+rea', flags: 'i' }
    ]
  }),
  'sala-anfitriao': tableState('sala-anfitriao', 4, {
    baseline: 'sala-anfitriao',
    t018Route: 'sala-anfitriao',
    drawer: 'sala',
    features: ['drawer', 'host'],
    mustContain: [{ id: 'encerrar', source: 'encerrar', flags: 'i' }]
  }),
  conversa: tableState('conversa', 4, {
    baseline: 'conversa',
    t018Route: 'conversa',
    drawer: 'conversa',
    features: ['drawer', 'chat']
  }),
  historico: tableState('historico', 4, {
    baseline: null,
    t018Route: null,
    drawer: 'historico',
    features: ['drawer', 'history']
  }),
  inversao: tableState('inversao', 8, {
    baseline: 'inversao',
    t018Route: 'inversao',
    features: ['inversion'],
    mustContain: [{ id: 'sentido', source: 'sentido', flags: 'i' }]
  }),
  carta: tableState('carta', 4, {
    baseline: 'carta',
    t018Route: 'carta',
    overlay: 'card-confirmation',
    features: ['card-confirmation'],
    mustContain: [
      { id: 'jogar', source: 'jogar', flags: 'i' },
      { id: 'cancelar', source: 'cancelar', flags: 'i' }
    ]
  }),
  cor: tableState('cor', 4, {
    baseline: 'cor',
    t018Route: 'cor',
    overlay: 'color-choice',
    features: ['color-choice'],
    mustContain: [
      { id: 'vermelho', source: 'vermelho', flags: 'i' },
      { id: 'azul', source: 'azul', flags: 'i' },
      { id: 'verde', source: 'verde', flags: 'i' },
      { id: 'amarelo', source: 'amarelo', flags: 'i' }
    ]
  }),
  preview: {
    id: 'preview',
    label: 'Preview de primitivos',
    kind: 'preview',
    baseline: null,
    t018Route: null,
    seats: null,
    hand: false,
    table: false,
    live: 'optional',
    keyboard: false
  }
};

export const SETS = {
  smoke: ['home', 'preparacao', 'espera', 'mesa-4', 'mesa-cheia', 'pausa', 'ultima', 'denuncia', 'treino', 'reacoes', 'resultado'],
  core: [
    'home',
    'preparacao',
    'preparacao-8',
    'espera',
    'observador',
    'mesa-2',
    'mesa-3',
    'mesa-4',
    'mesa-5',
    'mesa-6',
    'mesa-7',
    'mesa-8',
    'mesa-cheia',
    'pausa',
    'ultima',
    'denuncia',
    'treino',
    'bots',
    'substituto',
    'resultado',
    'resultado-sem-vencedor',
    'erro-conexao',
    'erro-sala',
    'erro-link',
    'reacoes',
    'sala',
    'inversao'
  ],
  full: Object.keys(STATES).filter((id) => id !== 'preview')
};

export const STATE_ALIASES = {
  pausada: 'pausa',
  mesa: 'mesa-4',
  preparacao_cheia: 'preparacao-8',
  'resultado-convidado': 'resultado'
};

export function resolveState(id) {
  const normalized = STATE_ALIASES[id] || id;
  const state = STATES[normalized];
  if (!state) {
    throw new Error(`Estado desconhecido: ${id}. Use --set=core|full|smoke ou um id de STATES.`);
  }
  return state;
}

export function statesForSet(setName) {
  const ids = SETS[setName];
  if (!ids) {
    throw new Error(`Conjunto desconhecido: ${setName}. Use smoke, core ou full.`);
  }
  return ids.map(resolveState);
}

export function resolveViewports(list) {
  if (!list) return DEFAULT_VIEWPORTS.map((id) => VIEWPORTS[id]);
  return list
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => {
      const vp = VIEWPORTS[id];
      if (!vp) {
        throw new Error(`Viewport desconhecido: ${id}. Use ${Object.keys(VIEWPORTS).join(', ')}.`);
      }
      return vp;
    });
}
