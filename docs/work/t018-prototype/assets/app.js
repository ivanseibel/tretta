(() => {
  'use strict';

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  const app = $('#app');
  const topo = $('#topo');
  const palco = $('#palco');
  const barra = $('#barra');
  const gaveta = $('#gaveta');
  const gavetaTitulo = $('#gaveta-titulo');
  const gavetaSalaNome = $('#gaveta-sala-nome');
  const gavetaAbas = $('#gaveta-abas');
  const gavetaCorpo = $('#gaveta-corpo');
  const gavetaScrim = $('#gaveta-scrim');
  const gavetaFechar = $('#gaveta-fechar');
  const overlays = $('#overlays');
  const toastEl = $('#toast');
  const live = $('#live');

  const CORES = {
    vermelho: { nome: 'Vermelho', forma: 'circulo', hex: '#C4322A', tinta: '#FFF8EA' },
    amarelo: { nome: 'Amarelo', forma: 'diamante', hex: '#F0B93A', tinta: '#231A10' },
    verde: { nome: 'Verde', forma: 'triangulo', hex: '#277147', tinta: '#FFF8EA' },
    azul: { nome: 'Azul', forma: 'quadrado', hex: '#2857B8', tinta: '#FFF8EA' },
    coringa: { nome: 'Coringa', forma: 'coringa', hex: '#F7EDD8', tinta: '#1B1410' }
  };

  const ICONE_TIPO = {
    bloqueio: 'ic-bloqueio',
    inversao: 'ic-inversao',
    compra2: 'ic-cartas',
    compra4: 'ic-cartas',
    coringa: 'ic-coringa'
  };

  const ABAS = [
    { id: 'conversa', rotulo: 'Conversa', icone: 'ic-conversa' },
    { id: 'historico', rotulo: 'Histórico', icone: 'ic-historico' },
    { id: 'sala', rotulo: 'Sala', icone: 'ic-sala' }
  ];

  /* Doze reações individuais. Nenhuma escolhe destinatário. */
  const REACOES = {
    eita: { emoji: '😂', rotulo: 'Eita!' },
    injustica: { emoji: '😭', rotulo: 'Que injustiça!' },
    'ai-gostei': { emoji: '😈', rotulo: 'Aí eu gostei!' },
    'nao-acredito': { emoji: '🤬', rotulo: 'Não acredito!' },
    'boa-jogada': { emoji: '👏', rotulo: 'Boa jogada!' },
    comedia: { emoji: '🤡', rotulo: 'Que comédia!' },
    tedio: { emoji: '🥱', rotulo: 'Que tédio!' },
    uau: { emoji: '😱', rotulo: 'Uau!' },
    'ja-era': { emoji: '💀', rotulo: 'Já era!' },
    suspeito: { emoji: '🤔', rotulo: 'Suspeito...' },
    carinho: { emoji: '😘', rotulo: 'Com carinho!' },
    fogo: { emoji: '🔥', rotulo: 'Tá pegando fogo!' }
  };
  const REACAO_PADRAO = 'eita';
  const LIMITE_REACAO_MS = 5000;
  const DURACAO_REACAO_MS = 4000;
  const MAX_FILA_REACAO = 3;

  const TITULOS = {
    home: 'início',
    preparacao: 'preparação',
    'preparacao-pronta': 'preparação',
    'preparacao-cheia': 'preparação',
    'preparacao-sala': 'sala',
    'preparacao-paineis': 'preparação',
    espera: 'observando',
    mesa: 'mesa',
    'mesa-2': 'mesa',
    'mesa-3': 'mesa',
    'mesa-4': 'mesa',
    'mesa-5': 'mesa',
    'mesa-6': 'mesa',
    'mesa-7': 'mesa',
    'mesa-8': 'mesa',
    'mesa-cheia': 'mesa cheia',
    inversao: 'inversão',
    carta: 'confirmar jogada',
    cor: 'escolher cor',
    conversa: 'conversa',
    sala: 'sala',
    'sala-apresentacao': 'sala',
    'sala-anfitriao': 'sala',
    pausada: 'rodada pausada',
    ausente: 'presenças',
    ultima: 'última carta',
    denuncia: 'denúncia',
    treino: 'treino',
    reacao: 'reação',
    reacoes: 'reações',
    resultado: 'resultado',
    'resultado-convidado': 'resultado',
    'resultado-sem-vencedor': 'resultado',
    'erro-conexao': 'conexão',
    'erro-sala': 'sala expirada',
    'erro-link': 'link inválido'
  };

  const ROTAS = Object.keys(TITULOS);

  let estado = null;
  let selecaoPendente = null;
  let modal = null;
  let reacaoAtual = null;
  let reacaoTimers = [];
  let filaReacoes = [];
  let ultimoEnvioReacao = 0;
  let bandejaAberta = false;
  let bandejaFoco = null;
  let gavetaAbridor = null;
  let gavetaAbridorRef = null;
  let toastTimer = null;
  let anuncioTimer = null;
  let uid = 0;
  let peaoEl = null;
  let peaoPosicionado = false;
  let rafMedida = 0;

  const SESSAO_KEY = 'tretta.t018.sessao';
  const PREFS_KEY = 'tretta.t018.prefs';

  function lerJson(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? Object.assign({}, padrao, JSON.parse(bruto)) : Object.assign({}, padrao);
    } catch (erro) {
      return Object.assign({}, padrao);
    }
  }

  function gravarJson(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (erro) { /* protótipo local */ }
  }

  const sessao = lerJson(SESSAO_KEY, { apelido: 'Você', avatar: '🦉' });
  const prefs = lerJson(PREFS_KEY, {
    animacoes: 'completa',
    sons: true,
    avisoVez: true,
    ocultarReacoes: false,
    silenciados: {}
  });
  if (!prefs.silenciados || typeof prefs.silenciados !== 'object') prefs.silenciados = {};

  function salvarSessao() { gravarJson(SESSAO_KEY, sessao); }
  function salvarPrefs() { gravarJson(PREFS_KEY, prefs); }

  function esc(valor) {
    return String(valor).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function icone(nome, classe = 'ic') {
    return `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#${nome}"></use></svg>`;
  }

  function formaSvg(cor, classe = 'forma', tinta) {
    const info = CORES[cor];
    const corHex = tinta || (info ? info.hex : '#F7EDD8');
    const formas = {
      circulo: '<circle cx="6" cy="6" r="4.8" fill="currentColor"/>',
      diamante: '<path d="M6 .8 11.2 6 6 11.2.8 6Z" fill="currentColor"/>',
      triangulo: '<path d="M6 .8 11.4 11.2H.6Z" fill="currentColor"/>',
      quadrado: '<rect x="1.2" y="1.2" width="9.6" height="9.6" rx=".9" fill="currentColor"/>'
    };
    return `<svg class="${classe}" viewBox="0 0 12 12" aria-hidden="true" style="color:${corHex}">${formas[info ? info.forma : 'circulo'] || formas.circulo}</svg>`;
  }

  function plural(valor) { return valor === 1 ? 'carta' : 'cartas'; }
  function horaAgora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function anunciar(texto) {
    clearTimeout(anuncioTimer);
    live.textContent = '';
    anuncioTimer = setTimeout(() => { live.textContent = texto; }, 80);
  }

  function mostrarToast(texto, duracao = 4200) {
    clearTimeout(toastTimer);
    toastEl.textContent = texto;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, duracao);
  }

  function esconderToast() {
    clearTimeout(toastTimer);
    toastEl.hidden = true;
  }

  let seqCarta = 0;
  function carta(cor, tipo, valor) {
    const nomes = ['Zero', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'];
    const nome = tipo === 'numero' ? nomes[valor] : {
      bloqueio: 'Bloqueio',
      inversao: 'Inversão',
      compra2: 'Compra 2',
      coringa: 'Coringa',
      compra4: 'Compra 4'
    }[tipo];
    return { id: `c${++seqCarta}`, cor, tipo, valor, nome };
  }
  const n = (cor, valor) => carta(cor, 'numero', valor);
  const esp = (cor, tipo) => carta(cor, tipo, null);

  function falaCarta(c) {
    const cor = CORES[c.cor] ? CORES[c.cor].nome : 'Coringa';
    if (c.tipo === 'numero') return `${cor}, ${c.valor}`;
    if (c.tipo === 'coringa') return cor;
    return `${cor}, ${c.nome}`;
  }

  function tituloCarta(c) {
    const cor = CORES[c.cor] ? CORES[c.cor].nome : 'Coringa';
    if (c.tipo === 'numero') return `${cor} ${c.valor}`;
    if (c.tipo === 'coringa') return cor;
    return `${cor} ${c.nome}`;
  }

  function miniCarta(c) {
    if (c.tipo === 'numero') return String(c.valor);
    if (c.tipo === 'compra2') return '+2';
    if (c.tipo === 'compra4') return '+4';
    if (c.tipo === 'bloqueio') return 'B';
    if (c.tipo === 'inversao') return 'I';
    return 'C';
  }

  function jogador(id, nome, avatar, extra = {}) {
    return Object.assign({
      id, nome, avatar,
      cartas: 7,
      avisou: true,
      status: 'ok',
      pronto: false,
      voce: false,
      host: false,
      venceu: false
    }, extra);
  }

  function salaBase() {
    return { nome: 'Sala da Vó Cida', codigo: 'TRT-4821', rodada: 8 };
  }

  function mensagensBase() {
    return [
      { autor: 'Vó Cida', autorId: 'cida', hora: '20:36', texto: 'Boa noite, gente. A mesa tá posta.' },
      { autor: 'Bia', autorId: 'bia', hora: '20:37', texto: 'Vó, quantas cartas a senhora tem?' },
      { autor: 'Vó Cida', autorId: 'cida', hora: '20:37', texto: 'Sete. Igual todo mundo, minha filha.' },
      { autor: 'Seu Nilton', autorId: 'nilton', hora: '20:38', texto: 'Essa rodada vai longe.' },
      { autor: 'Bia', autorId: 'bia', hora: '20:38', texto: 'Alguém viu meu boné?' }
    ];
  }

  function eventosBase() {
    return [
      { hora: '20:36', texto: '<strong>Vó Cida</strong> abriu a sala.' },
      { hora: '20:37', texto: '<strong>Bia</strong> entrou pelo link.' },
      { hora: '20:38', texto: 'Rodada 8 começou · sentido horário.' },
      { hora: '20:39', texto: '<strong>Vó Cida</strong> jogou Bloqueio vermelho.' },
      { hora: '20:40', texto: '<strong>Seu Nilton</strong> comprou uma carta.' }
    ];
  }

  function jogadorVoce(extra = {}) {
    return jogador('voce', sessao.apelido || 'Você', sessao.avatar || '🦉', Object.assign({
      voce: true, host: true, cartas: 8
    }, extra));
  }

  function elencoBase() {
    return {
      cida: jogador('cida', 'Vó Cida', '🧶', { cartas: 6 }),
      nilton: jogador('nilton', 'Seu Nilton', '🎣', { cartas: 8 }),
      bia: jogador('bia', 'Bia', '🍅', { cartas: 5 }),
      rita: jogador('rita', 'Rita', '🌻', { cartas: 8 }),
      fernanda: jogador('fernanda', 'Fernanda Albuquerque', '📚', { cartas: 6 }),
      leo: jogador('leo', 'Léo', '🎸', { cartas: 1, avisou: false }),
      juca: jogador('juca', 'Tio Juca do Sítio', '🚜', { cartas: 12 }),
      zeca: jogador('zeca', 'Tio Zeca', '🐟', { cartas: 7 })
    };
  }

  function jogadoresPorContagem(qtd) {
    const voce = jogadorVoce();
    const e = elencoBase();
    if (qtd === 2) return [voce, e.bia];
    if (qtd === 3) return [voce, e.cida, e.nilton];
    if (qtd === 4) return [voce, e.cida, e.nilton, e.bia];
    if (qtd === 5) return [voce, e.cida, e.nilton, e.bia, e.rita];
    if (qtd === 6) return [voce, e.cida, e.nilton, e.bia, e.rita, e.fernanda];
    if (qtd === 7) return [voce, e.cida, e.nilton, e.bia, e.rita, e.fernanda, e.leo];
    return [voce, e.juca, e.bia, e.cida, e.rita, e.fernanda, e.leo, e.nilton];
  }

  function maoBase() {
    return [
      n('vermelho', 9),
      n('amarelo', 6),
      esp('vermelho', 'bloqueio'),
      esp('coringa', 'coringa'),
      n('verde', 3),
      esp('azul', 'compra2'),
      n('azul', 7),
      n('amarelo', 1)
    ];
  }

  function maoCheia() {
    return [
      n('azul', 2),
      esp('verde', 'bloqueio'),
      n('amarelo', 2),
      esp('coringa', 'compra4'),
      n('vermelho', 5),
      n('verde', 8),
      esp('azul', 'inversao'),
      n('amarelo', 1)
    ];
  }

  function maoCurta() {
    return [n('vermelho', 4), esp('coringa', 'coringa')];
  }

  function faixasLaterais(qtd) {
    if (qtd <= 0) return [];
    if (qtd === 1) return ['50%'];
    if (qtd === 2) return ['30%', '70%'];
    return ['22%', '50%', '78%'];
  }

  function posicoesAssentos(qtd, direcao = 1) {
    if (qtd === 2) return [
      { classe: 'assento--base' },
      { classe: 'assento--topo', x: '50%', w: '46%' }
    ];
    if (qtd === 3) {
      const lado = direcao < 0 ? 'dir' : 'esq';
      return [
        { classe: 'assento--base' },
        { classe: `assento--${lado}`, y: '50%' },
        { classe: 'assento--topo', x: '50%', w: '42%' }
      ];
    }
    const topo = Math.ceil(qtd / 2);
    const posicoes = [{ classe: 'assento--base' }];
    const esquerdas = faixasLaterais(topo - 1);
    const direitas = faixasLaterais(qtd - topo - 1);
    for (let i = 1; i < qtd; i += 1) {
      if (i === topo) {
        posicoes.push({ classe: 'assento--topo', x: '50%', w: '42%' });
      } else if (i < topo) {
        posicoes.push({ classe: 'assento--esq', y: esquerdas[i - 1] });
      } else {
        posicoes.push({ classe: 'assento--dir', y: direitas[i - topo - 1] });
      }
    }
    return posicoes;
  }

  function cenarioMesa(qtd = 4, extra = {}) {
    const jogadores = jogadoresPorContagem(qtd);
    const cheia = qtd >= 8;
    const mao = cheia ? maoCheia() : maoBase();
    jogadores[0].cartas = mao.length;
    return Object.assign({
      tela: 'mesa',
      sala: salaBase(),
      jogadores,
      turno: 0,
      direcao: 1,
      corAtiva: cheia ? 'verde' : 'vermelho',
      descarte: cheia ? n('verde', 4) : n('vermelho', 6),
      deck: cheia ? 71 : 79,
      mao,
      compraFila: [n('azul', 4), n('verde', 1), esp('amarelo', 'compra2'), n('vermelho', 2)],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: false,
      pausado: null,
      resultado: null,
      preparacao: false,
      host: true,
      treino: false,
      mensagens: mensagensBase(),
      naoLidas: 3,
      eventos: eventosBase(),
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: 'Sua vez. Cor ativa vermelha. Descarte vermelho seis. Oito cartas na mão.'
    }, extra);
  }

  function cenarioMesaCheia() {
    const e = cenarioMesa(8);
    e.turno = 4;
    e.corAtiva = 'verde';
    e.descarte = n('verde', 4);
    e.deck = 71;
    e.mao = maoCheia();
    e.jogadores[0].cartas = e.mao.length;
    e.jogadores[1].cartas = 12;
    e.jogadores[6].cartas = 1;
    e.jogadores[6].avisou = false;
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: '<strong>Tio Juca do Sítio</strong> comprou e ficou com 12 cartas.' },
      { hora: '20:41', texto: '<strong>Léo</strong> ficou com uma carta e ainda não avisou.' }
    ]);
    e.anuncio = 'Vez de Rita. Cor ativa verde. Descarte verde quatro. Tio Juca tem doze cartas. Léo tem uma carta sem aviso.';
    return e;
  }

  function cenarioInversao() {
    const e = cenarioMesaCheia();
    e.turno = 6;
    e.direcao = -1;
    e.corAtiva = 'azul';
    e.descarte = esp('azul', 'inversao');
    e.deck = 55;
    e.mao = maoBase();
    e.jogadores[0].cartas = e.mao.length;
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: 'Você jogou <strong>Inversão azul</strong>. O sentido virou anti-horário.' }
    ]);
    e.anuncio = 'Sentido anti-horário. Inversão jogada. Vez de Léo. Cor ativa azul.';
    e.toast = 'Inversão! Agora o sentido é anti-horário.';
    return e;
  }

  function cenarioEspera() {
    const e = elencoBase();
    const jogadores = [e.bia, e.juca, e.cida, e.rita, e.fernanda, e.nilton];
    return {
      tela: 'espera',
      sala: salaBase(),
      jogadores,
      turno: 2,
      direcao: 1,
      corAtiva: 'amarelo',
      descarte: n('amarelo', 7),
      deck: 48,
      mao: [],
      compraFila: [],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: true,
      pausado: null,
      resultado: null,
      preparacao: false,
      host: false,
      treino: false,
      mensagens: mensagensBase(),
      naoLidas: 2,
      eventos: eventosBase().concat([
        { hora: '20:41', texto: '<strong>Vó Cida</strong> jogou Amarelo 7.' }
      ]),
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: 'Você está observando. Vez de Vó Cida. Você entra automaticamente na próxima rodada.'
    };
  }

  function cenarioPreparacao(qtd = 2, opts = {}) {
    const jogadores = jogadoresPorContagem(qtd);
    jogadores.forEach((j, i) => {
      j.cartas = 0;
      j.avisou = true;
      j.pronto = opts.todosProntos ? true : i === 0;
    });
    if (qtd === 8 && !opts.todosProntos) {
      jogadores.forEach((j, i) => { j.pronto = [true, true, false, true, true, false, true, true][i]; });
    }
    const aguardando = qtd >= 8
      ? [
          { id: 'zeca', nome: 'Tio Zeca', avatar: '🐟' },
          { id: 'nena', nome: 'Nena', avatar: '🌼' }
        ]
      : [{ id: 'zeca', nome: 'Tio Zeca', avatar: '🐟' }];
    return {
      tela: 'preparacao',
      sala: salaBase(),
      jogadores,
      turno: null,
      direcao: 1,
      corAtiva: null,
      descarte: null,
      deck: 80,
      mao: [],
      compraFila: [],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: false,
      pausado: null,
      resultado: null,
      preparacao: true,
      host: true,
      treino: false,
      mensagens: mensagensBase(),
      naoLidas: 1,
      eventos: eventosBase().concat([
        { hora: '20:41', texto: 'A mesa voltou para a preparação. Todos confirmam prontidão.' }
      ]),
      aguardando,
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: 'Preparação. Você é o anfitrião. Marque pronto e inicie quando todos estiverem prontos.'
    };
  }

  function cenarioPausada() {
    const e = cenarioMesa(4);
    e.turno = 3;
    e.jogadores[3].status = 'offline';
    e.pausado = { id: 'bia', nome: 'Bia' };
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: '<strong>Bia</strong> caiu da conexão. Rodada pausada.' }
    ]);
    e.anuncio = 'Rodada pausada. Bia caiu da conexão. O anfitrião decide substituir, continuar ou encerrar.';
    return e;
  }

  function cenarioAusente() {
    const e = cenarioMesa(8);
    e.turno = 4;
    e.jogadores[2].status = 'offline';
    e.jogadores[6].status = 'bot';
    e.jogadores[7] = jogador('zeca', 'Tio Zeca', '🐟', { cartas: 7, status: 'substituto', substitutoDe: 'Seu Nilton' });
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: '<strong>Bia</strong> caiu. A mesa segue com o assento reservado.' },
      { hora: '20:42', texto: '<strong>Tio Zeca</strong> entrou no lugar de Seu Nilton.' },
      { hora: '20:43', texto: '<strong>Léo</strong> passou a ser conduzido por um bot.' }
    ]);
    e.anuncio = 'Vez de Rita. Bia está desconectada. Tio Zeca substitui Seu Nilton. Léo é um bot.';
    return e;
  }

  function cenarioUltima() {
    const e = cenarioMesa(2);
    e.mao = maoCurta();
    e.jogadores[0].cartas = 2;
    e.jogadores[0].avisou = false;
    e.jogadores[1].cartas = 1;
    e.jogadores[1].avisou = true;
    e.corAtiva = 'vermelho';
    e.descarte = n('vermelho', 6);
    e.anuncio = 'Sua vez. Duas cartas na mão. Avise última antes do descarte que deixa uma carta.';
    return e;
  }

  function cenarioDenuncia() {
    const e = cenarioMesa(2);
    e.jogadores[1].cartas = 1;
    e.jogadores[1].avisou = false;
    e.anuncio = 'Sua vez. Bia tem uma carta e não avisou. Você pode denunciar.';
    return e;
  }

  function cenarioResultado(opts = {}) {
    const jogadores = jogadoresPorContagem(8);
    jogadores.forEach((j) => { j.cartas = 0; j.avisou = true; });
    const semVencedor = Boolean(opts.semVencedor);
    const placar = [
      { nome: 'Vó Cida', rodadas: semVencedor ? 2 : 3, venceu: !semVencedor },
      { nome: 'Seu Nilton', rodadas: 2, venceu: false },
      { nome: 'Bia', rodadas: 1, venceu: false },
      { nome: sessao.apelido || 'Você', rodadas: 1, venceu: false },
      { nome: 'Rita', rodadas: 1, venceu: false },
      { nome: 'Tio Juca do Sítio', rodadas: 1, venceu: false },
      { nome: 'Fernanda Albuquerque', rodadas: 0, venceu: false },
      { nome: 'Léo', rodadas: 0, venceu: false }
    ];
    return {
      tela: 'resultado',
      sala: salaBase(),
      jogadores,
      turno: null,
      direcao: 1,
      corAtiva: null,
      descarte: null,
      deck: 0,
      mao: [],
      compraFila: [],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: false,
      pausado: null,
      resultado: semVencedor ? {
        rotulo: 'Rodada 8 encerrada',
        titulo: 'Rodada encerrada sem vencedor',
        sub: 'O anfitrião encerrou a rodada antes do fim.',
        vencedor: null,
        semVencedor: true,
        placar
      } : {
        rotulo: 'Rodada 8 encerrada',
        titulo: 'Vó Cida venceu a rodada',
        sub: 'Primeira a ficar sem cartas · 3ª vitória da noite',
        vencedor: 'Vó Cida',
        semVencedor: false,
        placar
      },
      preparacao: false,
      host: opts.host !== false,
      treino: false,
      mensagens: mensagensBase(),
      naoLidas: 0,
      eventos: eventosBase().concat([
        { hora: '20:44', texto: semVencedor ? 'O anfitrião encerrou a rodada sem vencedor.' : '<strong>Vó Cida</strong> venceu a rodada 8.' }
      ]),
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: semVencedor ? 'Rodada encerrada sem vencedor. O anfitrião pode voltar à preparação.' : 'Rodada encerrada. Vó Cida venceu com três rodadas. O anfitrião pode voltar à preparação.'
    };
  }

  function cenarioHome() {
    return {
      tela: 'home',
      sala: salaBase(),
      jogadores: [],
      turno: null,
      direcao: 1,
      corAtiva: null,
      descarte: null,
      deck: 0,
      mao: [],
      compraFila: [],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: false,
      pausado: null,
      resultado: null,
      preparacao: false,
      host: false,
      treino: false,
      mensagens: [],
      naoLidas: 0,
      eventos: [],
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: 'Tretta. Crie uma sala, entre com um código ou treine com bots.'
    };
  }

  function cenarioErro(tipo) {
    return {
      tela: 'erro',
      erro: tipo,
      sala: salaBase(),
      jogadores: [],
      turno: null,
      direcao: 1,
      corAtiva: null,
      descarte: null,
      deck: 0,
      mao: [],
      compraFila: [],
      comprada: false,
      compradaId: null,
      selecionado: null,
      confirmando: false,
      observador: false,
      pausado: null,
      resultado: null,
      preparacao: false,
      host: false,
      treino: false,
      mensagens: [],
      naoLidas: 0,
      eventos: [],
      gaveta: null,
      abaGaveta: 'conversa',
      rotaBase: null,
      gavetaRota: false,
      secaoRolagem: null,
      anuncio: 'Tela de recuperação.'
    };
  }

  const CENARIOS = {
    home: cenarioHome,
    preparacao: () => cenarioPreparacao(2),
    'preparacao-pronta': () => cenarioPreparacao(2, { todosProntos: true }),
    'preparacao-cheia': () => cenarioPreparacao(8),
    'preparacao-sala': () => Object.assign(cenarioPreparacao(2), {
      gaveta: 'sala', abaGaveta: 'sala', rotaBase: 'preparacao', gavetaRota: true
    }),
    'preparacao-paineis': () => Object.assign(cenarioPreparacao(2), {
      scrollPrep: 'paineis'
    }),
    espera: cenarioEspera,
    mesa: () => cenarioMesa(4),
    'mesa-2': () => cenarioMesa(2),
    'mesa-3': () => cenarioMesa(3),
    'mesa-4': () => cenarioMesa(4),
    'mesa-5': () => cenarioMesa(5),
    'mesa-6': () => cenarioMesa(6),
    'mesa-7': () => cenarioMesa(7),
    'mesa-8': () => cenarioMesa(8),
    'mesa-cheia': cenarioMesaCheia,
    inversao: cenarioInversao,
    carta: () => {
      const e = cenarioMesa(4);
      e.confirmando = true;
      e.selecionado = e.mao[0].id;
      e.anuncio = 'Carta selecionada. Confirme para jogar ou cancele.';
      return e;
    },
    cor: () => {
      const e = cenarioMesa(4);
      e.corAtiva = null;
      e.descarte = esp('coringa', 'coringa');
      e.confirmando = true;
      const curinga = e.mao.find((c) => c.tipo === 'coringa');
      e.selecionado = curinga ? curinga.id : e.mao[0].id;
      e.corModal = true;
      e.anuncio = 'Coringa jogado. Escolha a cor para a próxima jogada.';
      return e;
    },
    conversa: () => Object.assign(cenarioMesa(4), {
      gaveta: 'conversa', abaGaveta: 'conversa', rotaBase: 'mesa', gavetaRota: true
    }),
    sala: () => Object.assign(cenarioMesa(4), {
      gaveta: 'sala', abaGaveta: 'sala', rotaBase: 'mesa', gavetaRota: true
    }),
    'sala-apresentacao': () => Object.assign(cenarioMesa(4), {
      gaveta: 'sala', abaGaveta: 'sala', rotaBase: 'mesa', gavetaRota: true, secaoRolagem: 'secao-apresentacao'
    }),
    'sala-anfitriao': () => Object.assign(cenarioMesa(4), {
      gaveta: 'sala', abaGaveta: 'sala', rotaBase: 'mesa', gavetaRota: true, secaoRolagem: 'secao-anfitriao'
    }),
    pausada: cenarioPausada,
    ausente: cenarioAusente,
    ultima: cenarioUltima,
    denuncia: cenarioDenuncia,
    treino: () => {
      const e = cenarioMesa(4);
      e.treino = true;
      e.jogadores[1].status = 'bot';
      e.jogadores[2].status = 'bot';
      e.jogadores[3].status = 'bot';
      e.jogadores[1].nome = 'Cida';
      e.jogadores[2].nome = 'Nilton';
      e.jogadores[3].nome = 'Bia';
      e.anuncio = 'Treino. Você joga com três bots. Sua vez.';
      return e;
    },
    reacao: () => Object.assign(cenarioMesa(4), {
      reacaoFixa: { tipo: 'boa-jogada', autor: 'Bia' },
      anuncio: 'Bia reagiu: Boa jogada! Todos na mesa veem.'
    }),
    reacoes: () => Object.assign(cenarioMesa(4), {
      bandejaReacoes: true,
      anuncio: 'Bandeja de reações aberta. Doze reações individuais, sem destinatário.'
    }),
    resultado: () => cenarioResultado({ host: true }),
    'resultado-convidado': () => cenarioResultado({ host: false }),
    'resultado-sem-vencedor': () => cenarioResultado({ semVencedor: true, host: true }),
    'erro-conexao': () => cenarioErro('conexao'),
    'erro-sala': () => cenarioErro('sala'),
    'erro-link': () => cenarioErro('link')
  };

  function rotaAtual() {
    const bruta = location.hash.replace(/^#/, '');
    if (!bruta) return 'home';
    return ROTAS.includes(bruta) ? bruta : 'erro-link';
  }

  function idxVoce() {
    if (!estado) return -1;
    return estado.jogadores.findIndex((j) => j.voce);
  }

  function nomeVez() {
    if (!estado || estado.turno == null) return '';
    const j = estado.jogadores[estado.turno];
    return j ? j.nome : '';
  }

  function minhaVez() {
    return !!estado && estado.turno != null && estado.turno === idxVoce() && !estado.pausado && !estado.resultado && !estado.confirmando;
  }

  function combina(c) {
    if (!estado) return false;
    if (c.tipo === 'coringa' || c.tipo === 'compra4') return true;
    const d = estado.descarte;
    if (estado.corAtiva && c.cor === estado.corAtiva) return true;
    if (d && d.tipo === 'numero' && c.tipo === 'numero' && c.valor === d.valor) return true;
    if (d && d.tipo !== 'numero' && c.tipo === d.tipo) return true;
    return false;
  }

  function podeComprar() {
    return minhaVez() && !estado.comprada && !estado.observador;
  }

  function avancarTurno() {
    if (!estado || estado.turno == null) return;
    const total = estado.jogadores.length;
    let proximo = estado.turno;
    for (let i = 0; i < total; i += 1) {
      proximo = (proximo + (estado.direcao < 0 ? -1 : 1) + total) % total;
      if (estado.jogadores[proximo].status !== 'offline') break;
    }
    estado.turno = proximo;
  }

  function cartaHtml(c, opts = {}) {
    const cor = CORES[c.cor] || CORES.coringa;
    const classes = ['carta'];
    if (opts.descarte) classes.push('carta--descarte');
    if (opts.selecionada) classes.push('carta-selecionada');
    if (opts.comprada) classes.push('carta-comprada');
    const estilo = `--cor:${cor.hex};--tinta:${cor.tinta}`;
    const topoHtml = `<span class="carta-topo"><span class="carta-cor">${cor.nome}</span></span>`;
    const centroHtml = c.tipo === 'numero'
      ? `<span class="carta-centro"><span class="carta-rank">${c.valor}</span></span>`
      : `<span class="carta-centro"><span class="carta-icone">${icone(ICONE_TIPO[c.tipo] || 'ic-coringa')}</span><span class="carta-nome">${esc(c.nome)}</span></span>`;
    const peHtml = c.cor === 'coringa'
      ? `<span class="carta-pe"><span class="forma-quatro">${['vermelho', 'amarelo', 'verde', 'azul'].map((x) => formaSvg(x, 'forma-mini')).join('')}</span></span>`
      : `<span class="carta-pe">${formaSvg(c.cor, 'forma', cor.tinta)}</span>`;
    const conteudo = `${topoHtml}${centroHtml}${peHtml}`;
    if (opts.descarte) {
      return `<div class="${classes.join(' ')}" data-cor="${c.cor}" style="${estilo}" role="img" aria-label="Descarte: ${esc(falaCarta(c))}">${conteudo}</div>`;
    }
    return `<button class="${classes.join(' ')}" type="button" data-cor="${c.cor}" data-carta="${c.id}" data-jogavel="${opts.jogavel ? 'true' : 'false'}" style="${estilo}" aria-label="${esc(falaCarta(c))}${opts.jogavel ? ', pode jogar' : ''}">${conteudo}</button>`;
  }

  function rosaSentido(anti) {
    return `<svg class="sentido-rosacea${anti ? ' anti' : ''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".7"/>
      <path d="M10 2.6 12.6 10.1 10 8.9 7.4 10.1Z" fill="currentColor"/>
      <path d="M10 17.4 7.9 11.7 10 12.6 12.1 11.7Z" fill="currentColor" opacity=".5"/>
    </svg>`;
  }

  function renderTopo() {
    if (!estado || estado.tela === 'home') {
      topo.innerHTML = '';
      return;
    }
    if (estado.tela === 'erro') {
      topo.innerHTML = `<div class="topo-marca"><strong>Tretta</strong><span>Recuperação</span></div>`;
      return;
    }
    const sentido = estado.direcao < 0 ? 'anti-horário' : 'horário';
    const mostrarSentido = estado.tela !== 'resultado';
    let titulo = 'Mesa';
    let etiqueta = '';
    if (estado.tela === 'preparacao') {
      titulo = 'Preparação';
    } else if (estado.tela === 'resultado') {
      titulo = 'Rodada encerrada';
    } else if (estado.pausado) {
      titulo = 'Rodada pausada';
    } else if (estado.observador) {
      titulo = estado.turno != null ? `Vez de ${nomeVez()}` : 'Você observa';
    } else if (estado.turno != null) {
      const j = estado.jogadores[estado.turno];
      titulo = j && j.voce ? 'Sua vez' : `Vez de ${nomeVez()}`;
      if (j && j.voce) etiqueta = 'na vez';
    }
    topo.innerHTML = `
      <div class="topo-vez">
        <div class="vez-linha">
          <span class="vez-nome">${esc(titulo)}</span>
          ${etiqueta ? `<span class="tag tag--latao tag-na-vez-topo">${etiqueta}</span>` : ''}
        </div>
      </div>
      ${mostrarSentido ? `<div class="topo-sentido">
        <div class="sentido-placa" role="group" aria-label="Sentido da rodada: ${sentido}">
          ${rosaSentido(estado.direcao < 0)}
          <span class="sentido-textos">
            <span class="sentido-rotulo">sentido</span>
            <span class="sentido-valor">${sentido}</span>
          </span>
        </div>
      </div>` : ''}`;
  }

  function renderBarra() {
    if (!estado || !['preparacao', 'espera', 'mesa', 'resultado'].includes(estado.tela)) {
      barra.innerHTML = '';
      return;
    }
    const naoLidas = estado.naoLidas > 0
      ? `<span class="selo" aria-hidden="true">${estado.naoLidas}</span>`
      : '';
    barra.innerHTML = `
      <button class="barra-item" type="button" data-abrir="conversa" aria-label="Conversa${estado.naoLidas > 0 ? `, ${estado.naoLidas} mensagens não lidas` : ''}">
        ${icone('ic-conversa')}<span>Conversa</span>${naoLidas}
      </button>
      <button class="barra-item" id="barra-reagir" type="button" aria-expanded="${bandejaAberta}" aria-controls="reacoes-bandeja">
        ${icone('ic-reagir')}<span>Reagir</span>
      </button>
      <button class="barra-item" type="button" data-abrir="historico" aria-label="Histórico da rodada">
        ${icone('ic-historico')}<span>Histórico</span>
      </button>`;
  }

  function renderAssentos(opts = {}) {
    if (!estado) return '';
    const posicoes = posicoesAssentos(estado.jogadores.length, estado.direcao);
    return estado.jogadores.map((j, i) => {
      const pos = posicoes[i] || { classe: 'assento--base' };
      const atual = estado.turno === i && !estado.resultado && !estado.preparacao;
      const ultima = j.cartas === 1 && j.avisou && j.status !== 'offline';
      const longo = Array.from(j.nome).length > 12;
      const classes = ['assento', ...pos.classe.split(' ')];
      if (opts.prep) classes.push('assento--prep');
      if (atual) classes.push('atual');
      if (j.status === 'offline') classes.push('offline');
      if (ultima && !opts.prep) classes.push('ultima');
      const estilo = [];
      if (pos.x) estilo.push(`--x:${pos.x}`);
      if (pos.w) estilo.push(`--w:${pos.w}`);
      if (pos.y) estilo.push(`--y:${pos.y}`);
      const statusRotulo = j.status === 'offline'
        ? 'caiu'
        : j.status === 'bot'
          ? 'bot'
          : j.status === 'substituto'
            ? 'substituto'
            : j.status === 'aguardando'
              ? 'aguarda a próxima rodada'
              : '';
      const info = [
        j.nome,
        opts.prep ? (j.pronto ? 'pronto' : 'aguardando') : `${j.cartas} ${plural(j.cartas)}`,
        atual ? 'na vez' : '',
        ultima && !opts.prep ? 'avisou última carta' : '',
        statusRotulo,
        j.host ? 'anfitrião' : '',
        j.voce ? 'você' : ''
      ].filter(Boolean).join(', ');
      const marca = j.host
        ? `<span class="assento-marca" aria-hidden="true">${icone('ic-coroa')}</span>`
        : j.status === 'offline'
          ? `<span class="assento-marca" aria-hidden="true">${icone('ic-caiu')}</span>`
          : j.status === 'bot'
            ? `<span class="assento-marca" aria-hidden="true">${icone('ic-bot')}</span>`
            : j.status === 'substituto'
              ? `<span class="assento-marca" aria-hidden="true">${icone('ic-substituto')}</span>`
              : '';
      const conta = opts.prep
        ? ''
        : `<span class="assento-conta"><span class="conta-num">${j.cartas}</span>${ultima ? '<span class="tag tag--ultima">última</span>' : `<span class="conta-rot">${plural(j.cartas)}</span>`}</span>`;
      const statusTag = opts.prep
        ? `<span class="assento-status"><span class="tag ${j.pronto ? 'tag--pronto' : 'tag--espera'}">${j.pronto ? 'pronto' : 'não pronto'}</span></span>`
        : statusRotulo
          ? `<span class="assento-status"><span class="tag ${j.status === 'offline' ? 'tag--offline' : j.status === 'bot' ? 'tag--bot' : 'tag--substituto'}">${statusRotulo}</span></span>`
          : '';
      return `<button class="${classes.join(' ')}" type="button" data-jogador="${j.id}"${atual ? ' aria-current="true"' : ''} aria-label="${esc(info)}. Toque para ver detalhes."${estilo.length ? ` style="${estilo.join(';')}"` : ''}>
        ${atual ? '<span class="tag tag--latao tag-na-vez">na vez</span>' : ''}
        <span class="assento-topo">
          <span class="avatar${j.voce ? ' avatar--voce' : ''}${j.status === 'offline' ? ' avatar--offline' : ''}${j.status === 'bot' ? ' avatar--bot' : ''}${j.status === 'substituto' ? ' avatar--substituto' : ''}" aria-hidden="true">${esc(j.avatar)}</span>
          <span class="assento-nome${longo ? ' assento-nome--longo' : ''}">${esc(j.nome)}</span>
          ${marca}
        </span>
        ${conta}
        ${statusTag}
      </button>`;
    }).join('');
  }

  function renderCentro() {
    if (!estado) return '';
    if (estado.preparacao) {
      return `<div class="prep-centro">
        <p class="prep-centro-rot">Código da sala</p>
        <strong class="prep-centro-codigo">${esc(estado.sala.codigo)}</strong>
        <p class="prep-centro-regra">Combine por cor, número ou símbolo.</p>
        <button class="botao botao--primario" type="button" data-acao="copiar" aria-label="Copiar convite">${icone('ic-copiar')}Copiar</button>
      </div>`;
    }
    const ativa = estado.corAtiva ? CORES[estado.corAtiva] : null;
    const corPlate = ativa
      ? `${formaSvg(estado.corAtiva, 'cor-forma')}<span class="cor-nome">${ativa.nome}</span>`
      : `${icone('ic-coringa', 'cor-forma')}<span class="cor-nome">a escolher</span>`;
    const comprarOk = podeComprar();
    return `<div class="mesa-centro">
        <button class="monte" type="button" data-acao="comprar"${comprarOk ? '' : ' disabled'} aria-label="Comprar uma carta. ${estado.deck} cartas no monte.">
          <span class="monte-verso" aria-hidden="true"></span>
          <span class="monte-conta" aria-hidden="true"><span class="num">${estado.deck}</span><span class="rot">cartas</span></span>
        </button>
        ${estado.descarte ? cartaHtml(estado.descarte, { descarte: true }) : ''}
      </div>
      <div class="cor-ativa" role="group" aria-label="Cor ativa: ${ativa ? ativa.nome : 'a escolher'}">
        <span class="cor-rotulo">cor</span>
        ${corPlate}
      </div>`;
  }

  function renderPausa() {
    if (!estado || !estado.pausado) return '';
    const nome = estado.pausado.nome;
    const host = estado.host;
    return `<section class="pausa" aria-labelledby="pausa-titulo">
      <div class="pausa-cartao">
        <p class="pausa-rotulo">Rodada pausada</p>
        <h2 class="pausa-titulo" id="pausa-titulo">${esc(nome)} caiu da conexão</h2>
        <p class="pausa-texto">A mesa espera por ${esc(nome)}. Se a conexão voltar, a rodada retoma sozinha.</p>
        ${host ? `<div class="pausa-acoes">
          <button class="botao botao--primario" type="button" data-acao="pausa-substituir">Substituir por bot</button>
          <button class="botao botao--secundario" type="button" data-acao="pausa-continuar">Continuar sem ${esc(nome)}</button>
          <button class="botao botao--perigo" type="button" data-acao="pausa-encerrar">Encerrar sem vencedor</button>
        </div>` : `<p class="pausa-nota">Aguardando a decisão do anfitrião.</p>`}
        <p class="pausa-nota">A vez de ${esc(nome)} fica guardada até a decisão.</p>
      </div>
    </section>`;
  }

  function mesaHtml(opts = {}) {
    return `<div class="mesa-wrap">
      <section class="mesa${opts.prep ? ' prep-mesa' : ''}" id="mesa" tabindex="-1" aria-label="Mesa de jogo">
        <div class="feltro" aria-hidden="true"></div>
        <svg class="trilho" id="trilho" aria-hidden="true" focusable="false">
          <path class="trilho-base" id="trilho-base" d=""></path>
          <path class="trilho-luz" id="trilho-luz" d=""></path>
        </svg>
        ${opts.prep ? renderCentro() : `<div class="centro" id="centro">${renderCentro()}</div>`}
        <div class="assentos" id="assentos" role="group" aria-label="Assentos da mesa">${renderAssentos({ prep: Boolean(opts.prep) })}</div>
        ${opts.prep ? '' : renderPausa()}
        <div class="brilho-vez" id="brilho-vez" aria-hidden="true"></div>
      </section>
    </div>`;
  }

  function quemDenunciar() {
    if (!estado) return null;
    return estado.jogadores.find((j) => !j.voce && j.cartas === 1 && !j.avisou && j.status !== 'offline') || null;
  }

  function acoesHtml() {
    if (!estado) return '';
    const eu = idxVoce();
    let status = '';
    let iconeId = 'ic-cartas';
    const botoes = [];

    if (estado.pausado) {
      iconeId = 'ic-pausa';
      status = `<strong>Pausada</strong> · ${esc(estado.pausado.nome)}`;
    } else if (estado.observador) {
      iconeId = 'ic-olho';
      status = 'Você observa';
    } else if (estado.confirmando) {
      iconeId = 'ic-cartas';
      status = estado.corAtiva === null ? '<strong>Escolha a cor</strong>' : '<strong>Confirme a jogada</strong> · ou cancele';
    } else if (estado.turno === eu) {
      iconeId = 'ic-cartas';
      status = estado.comprada
        ? '<strong>Comprou</strong> · jogue ou passe'
        : estado.treino ? '<strong>Treino</strong>' : '<strong>Sua vez</strong>';
      botoes.push({
        rotulo: 'Comprar', acao: 'comprar', tipo: 'principal',
        desabilitado: !podeComprar(), aria: 'Comprar uma carta do monte'
      });
      const quem = quemDenunciar();
      if (quem) {
        botoes.push({
          rotulo: 'Denunciar', acao: 'denunciar', tipo: 'atencao',
          aria: `Denunciar ${quem.nome} por não avisar última carta`
        });
      }
      if ((estado.mao.length === 2 || estado.mao.length === 1) && estado.jogadores[eu] && !estado.jogadores[eu].avisou) {
        botoes.push({ rotulo: 'Avisar última', acao: 'avisar-ultima', tipo: 'atencao', aria: 'Avisar última carta antes do descarte' });
      }
      botoes.push({
        rotulo: 'Passar', acao: 'passar', tipo: 'secundario',
        desabilitado: !estado.comprada, aria: 'Passar a vez'
      });
    } else {
      iconeId = 'ic-cartas';
      status = `<strong>Vez de ${esc(nomeVez())}</strong>`;
      const quem = quemDenunciar();
      if (quem) {
        botoes.push({
          rotulo: 'Denunciar', acao: 'denunciar', tipo: 'atencao',
          aria: `Denunciar ${quem.nome} por não avisar última carta`
        });
      }
    }

    const visiveis = botoes.slice(0, 3);
    return `<div class="acoes${visiveis.length >= 3 ? ' acoes--compacta' : ''}" aria-label="Ações da mesa">
      <p class="acoes-status">${icone(iconeId)}<span>${status}</span></p>
      ${visiveis.map((b) => `<button class="botao botao--${b.tipo}" type="button" data-acao="${b.acao}"${b.desabilitado ? ' disabled' : ''}${b.aria ? ` aria-label="${esc(b.aria)}"` : ''}>${b.rotulo}</button>`).join('')}
    </div>`;
  }

  function maoHtml() {
    if (!estado || estado.observador) return '';
    const eu = idxVoce();
    if (eu < 0) return '';
    const total = estado.mao.length;
    const ativo = minhaVez() && !estado.pausado && !estado.confirmando;
    const cartas = estado.mao.map((c) => cartaHtml(c, {
      jogavel: ativo && combina(c),
      selecionada: c.id === estado.selecionado,
      comprada: c.id === estado.compradaId
    })).join('');
    const bandeja = estado.confirmando && !estado.corModal ? bandejaHtml() : '';
    return `<section class="mao-wrap" id="mao-wrap" aria-label="Sua mão">
      ${bandeja}
      <div class="mao-cabeca">
        <div class="voce">
          <span class="avatar avatar--voce" aria-hidden="true">${esc(sessao.avatar || '🦉')}</span>
          <span class="voce-nome">${esc(estado.jogadores[eu].nome)}${estado.jogadores[eu].nome === 'Você' ? '' : ' <span class="voce-voce">· você</span>'}</span>
        </div>
        <div class="voce-conta"><span class="num">${total}</span><span class="rot">${plural(total)}</span></div>
      </div>
      <div class="mao${total > 8 ? ' mao--rolagem' : ''}" id="mao" aria-label="Sua mão, ${total} ${plural(total)}">${cartas}</div>
    </section>`;
  }

  function bandejaHtml() {
    if (!estado) return '';
    const c = estado.mao.find((x) => x.id === estado.selecionado);
    if (!c) return '';
    const cor = CORES[c.cor] || CORES.coringa;
    return `<div class="bandeja" role="group" aria-label="Confirmação da jogada">
      <span class="bandeja-carta" style="--cor:${cor.hex};--tinta-mini:${cor.tinta}" aria-hidden="true">${miniCarta(c)}</span>
      <span class="bandeja-texto">Jogar ${esc(tituloCarta(c))}?<small>A carta vai para o descarte. Sem pressa.</small></span>
      <button class="botao botao--primario" type="button" data-acao="confirmar-jogada">Jogar</button>
      <button class="botao botao--secundario" type="button" data-acao="cancelar-jogada">Cancelar</button>
    </div>`;
  }

  function renderHome() {
    const avatares = ['🦉', '🐻', '🌻', '⭐', '🍀', '🐟'];
    return `<section class="tela-home" aria-labelledby="home-titulo">
      <div class="home-cena">
        <div class="home-feltro">
          <div class="home-texto">
            <p class="home-sobretitulo">Jogo de cartas para família e amigos</p>
            <h1 class="home-titulo" id="home-titulo">Tretta</h1>
            <p class="home-chamada">A mesa está posta. Sente-se, escolha um apelido e chame quem você gosta.</p>
          </div>
          <div class="home-cartas" aria-hidden="true">
            ${cartaHtml(n('vermelho', 7), { descarte: true })}
            ${cartaHtml(n('amarelo', 4), { descarte: true })}
            ${cartaHtml(esp('coringa', 'coringa'), { descarte: true })}
          </div>
          <div class="home-peao" aria-hidden="true"></div>
        </div>
        <div class="home-papel">
          <h2>Entre na mesa</h2>
          <p class="dica">Sem login, sem instalação. Só a mesa e as pessoas.</p>
          <form class="home-form" id="home-form" novalidate>
            <div class="campo-claro">
              <label for="apelido">Seu apelido</label>
              <input id="apelido" name="apelido" type="text" maxlength="24" autocomplete="nickname" placeholder="Como quer ser chamado?" value="${esc(sessao.apelido || '')}">
            </div>
            <div class="campo-claro">
              <span class="campo-rotulo">Seu avatar</span>
              <div class="avatares" role="group" aria-label="Escolha um avatar">
                ${avatares.map((a) => `<button class="avatar-opcao" type="button" data-avatar="${a}" aria-pressed="${sessao.avatar === a}" aria-label="Avatar ${a}">${a}</button>`).join('')}
              </div>
            </div>
            <div class="home-acoes">
              <button class="botao botao--principal" type="submit">Criar sala</button>
            </div>
          </form>
          <div class="home-ou">ou</div>
          <div class="home-entrar">
            <div class="campo-claro">
              <label for="codigo">Código do convite</label>
              <input id="codigo" name="codigo" type="text" maxlength="9" autocomplete="off" placeholder="TRT-4821" inputmode="text">
            </div>
            <button class="botao botao--secundario" type="button" data-acao="entrar-sala">Entrar</button>
          </div>
          <div class="home-treino">
            <button class="botao botao--fantasma" type="button" data-acao="treino">${icone('ic-bot')}Treinar com bots</button>
          </div>
          <p class="home-nota">Você pode reagir, conversar e sair quando quiser.</p>
        </div>
      </div>
    </section>`;
  }

  function todosProntos() {
    return !!estado && estado.jogadores.length >= 2 && estado.jogadores.every((j) => j.pronto);
  }

  function renderPrep() {
    const prontos = estado.jogadores.filter((j) => j.pronto).length;
    const total = estado.jogadores.length;
    const host = estado.host;
    const podeIniciar = host && todosProntos();
    const voce = estado.jogadores.find((j) => j.voce);
    const aguardando = estado.aguardando || [];
    const jogadoresPainel = estado.jogadores.map((j) => `<div class="painel-linha">
      <span class="painel-nome"><span class="avatar${j.voce ? ' avatar--voce' : ''}" aria-hidden="true">${esc(j.avatar)}</span><span>${esc(j.nome)}${j.voce && j.nome !== 'Você' ? ' · você' : ''}${j.host ? ' · anfitrião' : ''}</span></span>
      <span class="tag ${j.pronto ? 'tag--pronto' : 'tag--espera'}">${j.pronto ? 'pronto' : 'não pronto'}</span>
    </div>`).join('');
    return `<section class="tela-prep" aria-labelledby="prep-titulo">
      <div class="prep-conteudo">
        <header class="prep-cabeca">
          <div>
            <p class="prep-sobre">Mesa posta</p>
            <h1 class="prep-titulo" id="prep-titulo">Preparação</h1>
            <p class="prep-sub">${host ? 'Você é o anfitrião. Quando todos estiverem prontos, a rodada começa.' : 'Marque pronto. O anfitrião inicia quando todos estiverem prontos.'}</p>
          </div>
          <p class="prep-selo">${icone('ic-coroa')}${host ? 'Anfitrião' : 'Convidado'} · ${prontos}/${total} prontos</p>
        </header>
        <div class="prep-acao">
          <p class="prep-acao-status">${todosProntos() ? '<strong>Todos prontos.</strong> A mesa pode começar.' : `<strong>${prontos} de ${total} prontos.</strong> Aguardando o restante.`}</p>
          <button class="botao botao--secundario" type="button" data-acao="pronto" aria-pressed="${voce && voce.pronto}">${voce && voce.pronto ? 'Não pronto' : 'Estou pronto'}</button>
          ${host ? `<button class="botao botao--principal" type="button" data-acao="iniciar"${podeIniciar ? '' : ' disabled'}>Iniciar rodada</button>` : ''}
        </div>
        ${mesaHtml({ prep: true })}
        <div class="prep-paineis">
          <section class="painel" aria-labelledby="painel-convite">
            <h3 id="painel-convite">Convite</h3>
            <p class="dica">Código <strong>${esc(estado.sala.codigo)}</strong> · a sala é da Vó Cida.</p>
            <div class="sala-acoes" style="margin-top:8px">
              <button class="botao botao--secundario" type="button" data-acao="copiar">${icone('ic-copiar')}Copiar convite</button>
              <button class="botao botao--secundario" type="button" data-acao="abrir-sala">${icone('ic-sala')}Abrir Sala</button>
            </div>
          </section>
          <section class="painel" aria-labelledby="painel-mesa">
            <h3 id="painel-mesa">Na mesa</h3>
            <p class="dica">${total} ${total === 1 ? 'pessoa' : 'pessoas'} · ${prontos} prontas</p>
            <div style="margin-top:6px">${jogadoresPainel}</div>
          </section>
          <section class="painel" aria-labelledby="painel-aguardando">
            <h3 id="painel-aguardando">Aguardando a próxima rodada</h3>
            <p class="dica">Entram automaticamente quando esta rodada terminar.</p>
            <div class="painel-aguardando">
              ${aguardando.length ? aguardando.map((a) => `<div class="painel-linha"><span class="painel-nome"><span class="avatar" aria-hidden="true">${esc(a.avatar)}</span><span>${esc(a.nome)}</span></span><span class="tag tag--espera">aguarda</span></div>`).join('') : '<p class="dica">Ninguém aguardando.</p>'}
            </div>
          </section>
          <section class="painel" aria-labelledby="painel-regras">
            <h3 id="painel-regras">Regras rápidas</h3>
            <p class="dica">Combine por cor, número ou símbolo. Bloqueio pula a pessoa seguinte. Inversão troca o sentido. Compra 2 e Compra 4 fazem comprar e perder a vez. Quem fica sem cartas vence a rodada.</p>
            <p class="dica" style="margin-top:6px">Antes do descarte que deixa uma carta, avise “Última”. Quem não avisar pode ser denunciado.</p>
          </section>
        </div>
      </div>
    </section>`;
  }

  function renderEspera() {
    return `<div class="tela-espera">
      ${mesaHtml()}
      <div class="espera-status">
        ${icone('ic-olho')}
        <span><strong>Você observa.</strong> A mesa tem ${estado.jogadores.length} jogadores. Você entra automaticamente na próxima rodada.</span>
      </div>
    </div>`;
  }

  function renderMesaTela() {
    return `<div class="tela-mesa">
      ${mesaHtml()}
      ${acoesHtml()}
      ${maoHtml()}
    </div>`;
  }

  function renderResultado() {
    const r = estado.resultado;
    if (!r) return '';
    const linhas = r.placar.map((l) => `<div class="placar-linha${l.venceu ? ' vencedor' : ''}">
      <span class="placar-nome"><span>${esc(l.nome)}</span></span>
      <span class="placar-pontos" aria-label="${l.rodadas} rodadas vencidas">${l.rodadas}</span>
    </div>`).join('');
    const host = estado.host;
    return `<section class="tela-resultado" aria-labelledby="resultado-titulo">
      <div class="resultado-cena">
        <div class="resultado-feltro">
          <div class="resultado-papel">
            <div class="resultado-topo">
              <span class="resultado-coroa" aria-hidden="true">${icone(r.semVencedor ? 'ic-relogio' : 'ic-coroa')}</span>
              <p class="resultado-rotulo">${esc(r.rotulo)}</p>
              <h1 class="resultado-titulo" id="resultado-titulo">${esc(r.titulo)}</h1>
              <p class="resultado-sub">${esc(r.sub)}</p>
            </div>
            <div class="placar-cabeca"><span>Rodadas vencidas</span><span>Total</span></div>
            <div class="placar-lista">${linhas}</div>
            <p class="resultado-nota">A próxima rodada começa na preparação. Todos confirmam prontidão; ninguém entra em uma rodada por um toque.</p>
          </div>
        </div>
      </div>
      <div class="resultado-acao">
        ${host
          ? `<button class="botao botao--principal" type="button" data-acao="resultado-voltar">Voltar à preparação</button>`
          : `<p class="resultado-acao-status">Aguardando o anfitrião voltar à preparação.</p>`}
      </div>
    </section>`;
  }

  function renderErro() {
    const map = {
      conexao: {
        icone: 'ic-plug', rotulo: 'Conexão', titulo: 'A conexão caiu',
        texto: 'Sua mão e a mesa continuam guardadas. A reconexão é automática; você também pode tentar agora.',
        primario: { rotulo: 'Tentar de novo', acao: 'erro-tentar' },
        secundario: { rotulo: 'Voltar ao início', acao: 'erro-home' },
        dica: 'Se a queda continuar, entre de novo pelo convite. Nada da sua mão foi perdido.'
      },
      sala: {
        icone: 'ic-relogio', rotulo: 'Sala expirada', titulo: 'Esta sala expirou',
        texto: 'A mesa ficou aberta tempo demais sem jogadas. Crie uma nova sala ou entre com um convite novo.',
        primario: { rotulo: 'Criar nova sala', acao: 'erro-criar' },
        secundario: { rotulo: 'Entrar com código', acao: 'erro-codigo' },
        dica: 'Salas encerradas não podem ser retomadas. O histórico da noite não é afetado.'
      },
      link: {
        icone: 'ic-link', rotulo: 'Link inválido', titulo: 'Este link não abre uma sala',
        texto: 'Confira o convite ou peça o código para quem criou a mesa.',
        primario: { rotulo: 'Entrar com código', acao: 'erro-codigo' },
        secundario: { rotulo: 'Voltar ao início', acao: 'erro-home' },
        dica: 'O código tem o formato TRT-0000 e fica na gaveta Sala.'
      }
    };
    const c = map[estado.erro] || map.link;
    return `<section class="tela-erro" aria-labelledby="erro-titulo">
      <div class="erro-cena">
        <div class="erro-feltro">
          <div class="erro-papel">
            <span class="erro-icone" aria-hidden="true">${icone(c.icone)}</span>
            <p class="erro-rotulo">${esc(c.rotulo)}</p>
            <h1 class="erro-titulo" id="erro-titulo">${esc(c.titulo)}</h1>
            <p class="erro-texto">${esc(c.texto)}</p>
            <div class="erro-acoes">
              <button class="botao botao--principal" type="button" data-acao="${c.primario.acao}">${c.primario.rotulo}</button>
              <button class="botao botao--secundario" type="button" data-acao="${c.secundario.acao}">${c.secundario.rotulo}</button>
            </div>
            <p class="erro-dica">${esc(c.dica)}</p>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderPalco() {
    if (!estado) return;
    if (estado.tela === 'home') palco.innerHTML = renderHome();
    else if (estado.tela === 'preparacao') palco.innerHTML = renderPrep();
    else if (estado.tela === 'espera') palco.innerHTML = renderEspera();
    else if (estado.tela === 'mesa') palco.innerHTML = renderMesaTela();
    else if (estado.tela === 'resultado') palco.innerHTML = renderResultado();
    else if (estado.tela === 'erro') palco.innerHTML = renderErro();
  }

  function renderAbas() {
    if (!estado) return;
    gavetaAbas.innerHTML = ABAS.map((a) => {
      const ativa = a.id === estado.abaGaveta;
      const selo = a.id === 'conversa' && estado.naoLidas > 0
        ? `<span class="selo" aria-hidden="true">${estado.naoLidas}</span>`
        : '';
      return `<button class="aba${ativa ? ' ativa' : ''}" type="button" role="tab" id="aba-${a.id}" aria-controls="gaveta-corpo" aria-selected="${ativa}" tabindex="${ativa ? 0 : -1}" data-tab="${a.id}">
        ${icone(a.icone)}<span>${a.rotulo}</span>${selo}
      </button>`;
    }).join('');
  }

  function mensagemHtml(m) {
    const silenciado = prefs.silenciados[m.autorId];
    if (silenciado) {
      return `<div class="msg msg--silenciado">
        <div class="msg-linha"><span class="msg-autor">${esc(m.autor)}</span><span class="msg-hora">${esc(m.hora)}</span></div>
        <p class="msg-texto">Mensagem oculta: participante silenciado.</p>
      </div>`;
    }
    return `<div class="msg${m.voce ? ' msg--voce' : ''}">
      <div class="msg-linha"><span class="msg-autor">${esc(m.autor)}</span><span class="msg-hora">${esc(m.hora)}</span></div>
      <p class="msg-texto">${esc(m.texto)}</p>
    </div>`;
  }

  function conteudoConversa() {
    const lista = estado.mensagens.length
      ? estado.mensagens.map(mensagemHtml).join('')
      : '<p class="chat-vazio">Ninguém falou ainda. Puxe assunto.</p>';
    return `<div class="chat">
      <div class="chat-lista" role="log" aria-label="Mensagens da sala">${lista}</div>
      <form class="compositor" id="chat-form" novalidate>
        <div class="campo">
          <label class="campo-rotulo" for="chat-campo">Mensagem para a mesa</label>
          <div class="campo-linha">
            <input class="entrada" id="chat-campo" name="mensagem" type="text" autocomplete="off" maxlength="240" placeholder="Escreva para a mesa…">
            <button class="botao botao--primario" type="submit">Enviar</button>
          </div>
          <p class="dica">Enter envia. A mensagem aparece só nesta sala.</p>
        </div>
      </form>
    </div>`;
  }

  function conteudoHistorico() {
    const eventos = estado.eventos.slice().reverse();
    if (!eventos.length) return '<p class="chat-vazio">A rodada ainda não teve eventos.</p>';
    return `<div class="historico" role="list">${eventos.map((ev) => `<div class="evento" role="listitem">
      <span class="evento-hora">${esc(ev.hora)}</span>
      <p class="evento-texto">${ev.texto}</p>
    </div>`).join('')}</div>`;
  }

  function statusJogador(j) {
    if (j.status === 'offline') return 'desconectado';
    if (j.status === 'bot') return 'conduzido por bot';
    if (j.status === 'substituto') return `no lugar de ${j.substitutoDe || 'alguém'}`;
    if (j.status === 'aguardando') return 'aguarda a próxima rodada';
    if (estado.preparacao) return j.pronto ? 'pronto' : 'aguardando';
    if (j.cartas === 1 && j.avisou) return 'última carta';
    return `${j.cartas} ${plural(j.cartas)}`;
  }

  function conteudoSala() {
    const jogadores = estado.jogadores.map((j) => {
      const silenciado = Boolean(prefs.silenciados[j.id]);
      const podeSilenciar = !j.voce;
      const podeRemover = estado.host && estado.preparacao && !j.voce;
      return `<div class="jogador">
        <span class="avatar${j.voce ? ' avatar--voce' : ''}${j.status === 'offline' ? ' avatar--offline' : ''}${j.status === 'bot' ? ' avatar--bot' : ''}${j.status === 'substituto' ? ' avatar--substituto' : ''}" aria-hidden="true">${esc(j.avatar)}</span>
        <span class="jogador-corpo">
          <span class="jogador-nome">${esc(j.nome)}${j.voce && j.nome !== 'Você' ? ' · você' : ''}</span>
          <span class="jogador-meta">
            ${j.host ? '<span class="tag tag--latao">anfitrião</span>' : ''}
            <span>${esc(statusJogador(j))}</span>
            ${j.status === 'offline' ? '<span class="tag tag--offline">caiu</span>' : ''}
            ${j.status === 'bot' ? '<span class="tag tag--bot">bot</span>' : ''}
            ${j.status === 'substituto' ? '<span class="tag tag--substituto">substituto</span>' : ''}
            ${silenciado ? '<span class="tag tag--espera">silenciado</span>' : ''}
          </span>
        </span>
        <span class="jogador-acoes">
          ${podeSilenciar ? `<button class="jogador-acao" type="button" data-acao="silenciar" data-jogador="${j.id}" aria-pressed="${silenciado}" aria-label="${silenciado ? 'Voltar a ouvir' : 'Silenciar'} ${esc(j.nome)}">${icone(silenciado ? 'ic-som-off' : 'ic-silenciar')}</button>` : ''}
          ${podeRemover ? `<button class="jogador-acao jogador-acao--perigo" type="button" data-acao="remover" data-jogador="${j.id}" aria-label="Remover ${esc(j.nome)} da sala">${icone('ic-remover')}</button>` : ''}
        </span>
      </div>`;
    }).join('');
    const host = estado.host;
    const podeIniciar = host && estado.preparacao && todosProntos();
    const anfitriao = host
      ? estado.preparacao
        ? `<p class="dica">${todosProntos() ? 'Todos prontos. A rodada pode começar.' : 'Aguarde todos marcarem pronto.'}</p>
           <button class="botao botao--primario" type="button" data-acao="iniciar"${podeIniciar ? '' : ' disabled'}>Iniciar rodada</button>`
        : estado.tela === 'resultado'
          ? '<p class="dica">A rodada terminou. Use a tela de resultado para voltar à preparação.</p>'
          : `<p class="dica">Encerrar sem vencedor mantém o placar e devolve todos à preparação.</p>
             <button class="botao botao--perigo" type="button" data-acao="encerrar">Encerrar sem vencedor</button>`
      : '<p class="dica">Só o anfitrião inicia ou encerra a rodada.</p>';
    return `<div class="sala">
      <section class="sala-secao" id="secao-sala" aria-labelledby="sala-titulo-secao">
        <h3 id="sala-titulo-secao">Sala</h3>
        <div class="sala-codigo">
          <div><span class="sala-codigo-rot">Código da sala</span><strong>${esc(estado.sala.codigo)}</strong></div>
          <button class="botao botao--secundario" type="button" data-acao="copiar">${icone('ic-copiar')}Copiar</button>
        </div>
        <p class="sala-convite">Convite: tretta.app/sala/${esc(estado.sala.codigo)} · rodada ${estado.sala.rodada}</p>
        <details class="regras">
          <summary>
            <span class="regras-titulo">Resumo das regras</span>
            <span class="regras-preview">Cor, número ou símbolo; última carta; compras.</span>
            <span class="regras-chevron" aria-hidden="true"></span>
          </summary>
          <p>Combine por <strong>cor, número ou símbolo</strong>. Bloqueio pula a pessoa seguinte. Inversão troca o sentido. Compra 2 e Compra 4 fazem a pessoa seguinte comprar e perder a vez. Coringa escolhe a cor. Quem fica sem cartas vence a rodada.</p>
          <p>Antes do descarte que deixa uma carta, avise <strong>Última</strong>. Quem não avisar pode ser denunciado e compra duas.</p>
        </details>
      </section>

      <section class="sala-secao" id="secao-jogadores" aria-labelledby="jogadores-titulo">
        <h3 id="jogadores-titulo">Jogadores</h3>
        <p class="dica">Nome completo, cartas, presença e controles do anfitrião.</p>
        <div class="jogadores-lista">${jogadores}</div>
      </section>

      <section class="sala-secao" id="secao-apresentacao" aria-labelledby="apresentacao-titulo">
        <h3 id="apresentacao-titulo">Apresentação</h3>
        <div class="pref-linha">
          <span class="pref-texto"><span class="pref-nome">Animações</span><span class="pref-desc">Completa, reduzida ou desligada.</span></span>
          <span class="segmentado" role="group" aria-label="Animações">
            ${['completa', 'reduzida', 'desligada'].map((v) => `<button type="button" data-acao="animacao" data-animacao="${v}" aria-pressed="${prefs.animacoes === v}">${v === 'completa' ? 'Completa' : v === 'reduzida' ? 'Reduzida' : 'Desligada'}</button>`).join('')}
          </span>
        </div>
        <div class="pref-linha">
          <span class="pref-texto"><span class="pref-nome">Silenciar sons</span><span class="pref-desc">Efeitos da mesa ficam mudos.</span></span>
          <button class="interruptor" type="button" data-acao="toggle-som" aria-pressed="${!prefs.sons}" aria-label="Silenciar sons"></button>
        </div>
        <div class="pref-linha">
          <span class="pref-texto"><span class="pref-nome">Aviso sonoro da vez</span><span class="pref-desc">Um toque curto quando chega a sua vez.</span></span>
          <button class="interruptor" type="button" data-acao="toggle-aviso" aria-pressed="${prefs.avisoVez}" aria-label="Aviso sonoro da vez"></button>
        </div>
        <div class="pref-linha">
          <span class="pref-texto"><span class="pref-nome">Ocultar reações</span><span class="pref-desc">Remove as apresentações locais. Reativar mostra apenas as novas.</span></span>
          <button class="interruptor" type="button" data-acao="toggle-ocultar" aria-pressed="${prefs.ocultarReacoes}" aria-label="Ocultar reações"></button>
        </div>
      </section>

      <section class="sala-secao sala-anfitriao" id="secao-anfitriao" aria-labelledby="anfitriao-titulo">
        <h3 id="anfitriao-titulo">Anfitrião</h3>
        ${anfitriao}
      </section>

      <div class="sala-sair">
        <p class="dica">Sair da sala não encerra a mesa para as outras pessoas.</p>
        <button class="botao botao--perigo" type="button" data-acao="sair">${icone('ic-sair')}Sair da sala</button>
      </div>
    </div>`;
  }

  function renderCorpo() {
    if (!estado) return;
    const rotulos = { conversa: 'Conversa', historico: 'Histórico', sala: 'Sala' };
    gavetaTitulo.textContent = rotulos[estado.abaGaveta] || 'Conversa';
    gavetaSalaNome.textContent = estado.sala.nome;
    gavetaCorpo.setAttribute('aria-labelledby', `aba-${estado.abaGaveta}`);
    if (estado.abaGaveta === 'conversa') gavetaCorpo.innerHTML = conteudoConversa();
    else if (estado.abaGaveta === 'historico') gavetaCorpo.innerHTML = conteudoHistorico();
    else gavetaCorpo.innerHTML = conteudoSala();
    if (estado.abaGaveta === 'conversa') {
      requestAnimationFrame(() => { gavetaCorpo.scrollTop = gavetaCorpo.scrollHeight; });
    } else {
      gavetaCorpo.scrollTop = 0;
    }
  }

  function renderGaveta() {
    if (!estado) return;
    const aberta = Boolean(estado.gaveta);
    gaveta.classList.toggle('aberta', aberta);
    gaveta.setAttribute('aria-hidden', aberta ? 'false' : 'true');
    gavetaScrim.hidden = !aberta;
    if (aberta) {
      renderAbas();
      renderCorpo();
      if (estado.secaoRolagem) {
        requestAnimationFrame(() => {
          const secao = document.getElementById(estado.secaoRolagem);
          if (secao) {
            const topo = secao.getBoundingClientRect().top - gavetaCorpo.getBoundingClientRect().top + gavetaCorpo.scrollTop;
            gavetaCorpo.scrollTop = Math.max(0, topo - 8);
          }
        });
      }
    }
  }

  function render() {
    if (!estado) return;
    const semTopo = estado.tela === 'home';
    const semBarra = !['preparacao', 'espera', 'mesa', 'resultado'].includes(estado.tela);
    app.classList.toggle('sem-topo', semTopo);
    app.classList.toggle('sem-barra', semBarra);
    renderTopo();
    renderBarra();
    renderPalco();
    renderGaveta();
    peaoEl = null;
    peaoPosicionado = false;
    requestAnimationFrame(() => {
      desenharTrilho();
      posicionarPeao();
      medirMao();
    });
  }

  function medirMao() {
    const maoWrap = $('#mao-wrap');
    if (maoWrap) app.style.setProperty('--hand-h', `${Math.round(maoWrap.offsetHeight)}px`);
  }

  function desenharTrilho() {
    const mesaEl = $('#mesa');
    if (!mesaEl) return;
    const w = mesaEl.clientWidth;
    const h = mesaEl.clientHeight;
    if (!w || !h) return;
    const inset = Math.max(14, Math.min(24, Math.min(w, h) * 0.055));
    const x = inset;
    const y = inset;
    const larg = w - inset * 2;
    const alt = h - inset * 2;
    const r = Math.min(46, larg / 2, alt / 2);
    const d = `M${x + r},${y} H${x + larg - r} A${r},${r} 0 0 1 ${x + larg},${y + r} V${y + alt - r} A${r},${r} 0 0 1 ${x + larg - r},${y + alt} H${x + r} A${r},${r} 0 0 1 ${x},${y + alt - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
    const trilho = $('#trilho');
    const base = $('#trilho-base');
    const luz = $('#trilho-luz');
    if (!trilho || !base || !luz) return;
    trilho.setAttribute('viewBox', `0 0 ${w} ${h}`);
    base.setAttribute('d', d);
    luz.setAttribute('d', d);
  }

  function garantirPeao() {
    const mesaEl = $('#mesa');
    if (!mesaEl) return null;
    if (peaoEl && mesaEl.contains(peaoEl)) return peaoEl;
    peaoEl = document.createElement('div');
    peaoEl.className = 'peao';
    peaoEl.hidden = true;
    peaoEl.setAttribute('aria-hidden', 'true');
    mesaEl.appendChild(peaoEl);
    return peaoEl;
  }

  function posicionarPeao() {
    const mesaEl = $('#mesa');
    const base = $('#trilho-base');
    const brilho = $('#brilho-vez');
    if (!estado || !mesaEl || !base || !brilho) return;
    const token = garantirPeao();
    if (!token) return;
    const idx = estado.turno;
    if (idx == null || idx < 0 || !estado.jogadores[idx] || estado.preparacao || estado.tela === 'resultado') {
      token.hidden = true;
      brilho.style.opacity = '0';
      return;
    }
    const assento = $('#assentos') ? $('#assentos').children[idx] : null;
    if (!assento) {
      token.hidden = true;
      return;
    }
    const mr = mesaEl.getBoundingClientRect();
    const ar = assento.getBoundingClientRect();
    const cx = ar.left - mr.left + ar.width / 2;
    const cy = ar.top - mr.top + ar.height / 2;
    const comprimento = base.getTotalLength();
    if (!comprimento) return;
    let melhor = 0;
    let melhorDist = Infinity;
    const amostras = 360;
    for (let i = 0; i < amostras; i += 1) {
      const t = (comprimento * i) / amostras;
      const p = base.getPointAtLength(t);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = dx * dx + dy * dy;
      if (dist < melhorDist) { melhorDist = dist; melhor = t; }
    }
    const passo = 0.6;
    const p1 = base.getPointAtLength((melhor - passo + comprimento) % comprimento);
    const p2 = base.getPointAtLength((melhor + passo) % comprimento);
    let tx = p2.x - p1.x;
    let ty = p2.y - p1.y;
    const tam = Math.hypot(tx, ty) || 1;
    tx /= tam; ty /= tam;
    // O peão fica no trilho, encostado na borda do assento, sem cobrir avatar,
    // nome ou etiqueta. O afastamento extra de 8px cria a folga visual.
    const desvio = (Math.abs(tx) * ar.width + Math.abs(ty) * ar.height) / 2 + 12;
    const sinal = estado.direcao < 0 ? -1 : 1;
    const t = (melhor + sinal * desvio + comprimento) % comprimento;
    const p = base.getPointAtLength(t);
    if (!peaoPosicionado) token.style.transition = 'none';
    token.hidden = false;
    token.style.left = `${p.x}px`;
    token.style.top = `${p.y}px`;
    if (!peaoPosicionado) {
      void token.offsetWidth;
      token.style.transition = '';
      peaoPosicionado = true;
    }
    brilho.style.left = `${p.x}px`;
    brilho.style.top = `${p.y}px`;
    brilho.style.opacity = '1';
  }

  function aoRedimensionar() {
    desenharTrilho();
    posicionarPeao();
    medirMao();
  }

  function agendarMedida() {
    cancelAnimationFrame(rafMedida);
    rafMedida = requestAnimationFrame(aoRedimensionar);
  }

  function trapTab(container, ev) {
    const seletor = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const itens = $$(seletor, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!itens.length) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (ev.shiftKey && (document.activeElement === primeiro || !container.contains(document.activeElement))) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && (document.activeElement === ultimo || !container.contains(document.activeElement))) {
      ev.preventDefault();
      primeiro.focus();
    }
  }

  function abrirModal(html, opts = {}) {
    fecharBandejaReacoes({ silencioso: true });
    fecharModal({ silencioso: true });
    const anterior = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML = html;
    const caixa = scrim.querySelector('.modal');
    overlays.appendChild(scrim);
    if (caixa) {
      if (!caixa.hasAttribute('role')) caixa.setAttribute('role', 'dialog');
      caixa.setAttribute('aria-modal', 'true');
    }
    const fechar = () => {
      if (!scrim.isConnected) return;
      scrim.remove();
      modal = null;
      if (opts.aoFechar) opts.aoFechar();
      else if (anterior && anterior.isConnected) {
        try { anterior.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
    };
    modal = { scrim, caixa, fechar };
    scrim.addEventListener('mousedown', (ev) => { if (ev.target === scrim) fechar(); });
    const elementoFoco = (opts.focoSeletor && caixa && caixa.querySelector(opts.focoSeletor))
      || (caixa && caixa.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled])'))
      || caixa;
    if (elementoFoco && elementoFoco.focus) {
      try { elementoFoco.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      setTimeout(() => { try { elementoFoco.focus({ preventScroll: true }); } catch (erro) { /* ignora */ } }, 0);
    }
    return scrim;
  }

  function fecharModal(opts = {}) {
    if (!modal) return;
    if (opts.silencioso) {
      const atual = modal;
      modal = null;
      atual.scrim.remove();
      return;
    }
    modal.fechar();
  }

  function abrirModalCor() {
    const tid = `cor-titulo-${++uid}`;
    const opcoes = ['vermelho', 'amarelo', 'verde', 'azul'].map((cor) => {
      const c = CORES[cor];
      return `<button class="cor-opcao" type="button" data-cor="${cor}" style="--cor:${c.hex};--tinta:${c.tinta}" aria-label="Escolher ${c.nome}">${formaSvg(cor, 'forma', c.tinta)}<span>${c.nome}</span></button>`;
    }).join('');
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div>
          <h2 class="modal-titulo" id="${tid}">Escolha a cor</h2>
          <p class="modal-sub">Coringa jogado · vale para quem jogar depois de você</p>
        </div>
        <button class="modal-fechar" type="button" data-acao="cancelar-cor" aria-label="Cancelar escolha de cor">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-texto">A carta continua na mesa. A cor ativa muda para a próxima jogada.</p>
      <div class="cores-grade">${opcoes}</div>
    </div>`, {
      focoSeletor: '.cor-opcao',
      aoFechar: () => {
        if (estado && estado.corModal) {
          estado.corModal = false;
          estado.confirmando = false;
          estado.selecionado = null;
          if (estado.rota === 'cor') {
            estado.rota = 'mesa';
            try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
          }
          render();
          anunciar('Escolha de cor cancelada. A mesa continua.');
        }
      }
    });
  }

  function abrirModalAssento(id) {
    if (!estado) return;
    const j = estado.jogadores.find((x) => x.id === id);
    if (!j) return;
    const tid = `assento-${++uid}`;
    const atual = estado.turno != null && estado.jogadores[estado.turno] === j;
    const ultima = j.cartas === 1 && j.avisou && j.status !== 'offline';
    const status = j.status === 'offline'
      ? 'Caiu da conexão'
      : j.status === 'bot'
        ? 'Conduzido por bot'
        : j.status === 'substituto'
          ? `Substituto de ${j.substitutoDe || 'alguém'}`
          : atual
            ? 'Na vez'
            : j.voce
              ? 'Sua mão'
              : estado.preparacao
                ? j.pronto ? 'Pronto' : 'Aguardando'
                : 'Aguardando a vez';
    const texto = j.voce
      ? 'Esta é a sua mão. Só você vê estas cartas.'
      : j.status === 'offline'
        ? 'A mesa espera a conexão voltar. O assento fica reservado.'
        : j.status === 'bot'
          ? 'O bot joga no lugar desta pessoa enquanto a conexão não volta.'
          : j.status === 'substituto'
            ? 'Outra pessoa ocupa este assento até o fim da rodada.'
            : 'Só a quantidade de cartas é pública. O conteúdo da mão é privado.';
    const silenciado = Boolean(prefs.silenciados[j.id]);
    const acoes = [];
    if (!j.voce) {
      acoes.push(`<button class="botao botao--secundario" type="button" data-acao="silenciar" data-jogador="${j.id}">${silenciado ? 'Voltar a ouvir' : 'Silenciar participante'}</button>`);
    }
    if (estado.host && estado.preparacao && !j.voce) {
      acoes.push(`<button class="botao botao--perigo" type="button" data-acao="remover" data-jogador="${j.id}">Remover da sala</button>`);
    }
    acoes.push('<button class="botao botao--secundario" type="button" data-acao="fechar-modal">Fechar</button>');
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div class="assento-modal" style="flex:1 1 auto">
          <div class="assento-modal-topo">
            <span class="avatar avatar--grande${j.voce ? ' avatar--voce' : ''}" aria-hidden="true">${esc(j.avatar)}</span>
            <div>
              <h2 class="assento-modal-nome" id="${tid}">${esc(j.nome)}</h2>
              <p class="assento-modal-status">${esc(status)}${ultima ? ' · avisou última carta' : ''}</p>
            </div>
          </div>
          <div class="assento-modal-conta"><strong>${j.cartas}</strong><span>${plural(j.cartas)} na mão</span></div>
        </div>
        <button class="modal-fechar" type="button" data-acao="fechar-modal" aria-label="Fechar">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-texto">${esc(texto)}</p>
      <div class="modal-acoes">${acoes.join('')}</div>
    </div>`, { focoSeletor: '[data-acao="fechar-modal"]' });
  }

  function abrirModalSair() {
    const tid = `sair-${++uid}`;
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div><h2 class="modal-titulo" id="${tid}">Sair da sala?</h2><p class="modal-sub">A mesa continua com as outras pessoas.</p></div>
        <button class="modal-fechar" type="button" data-acao="fechar-modal" aria-label="Fechar">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-texto">Você pode voltar depois com o código ${esc(estado.sala.codigo)}. Sua mão não fica salva nesta demonstração.</p>
      <div class="modal-acoes">
        <button class="botao botao--perigo" type="button" data-acao="sair-confirmar">Sair da sala</button>
        <button class="botao botao--secundario" type="button" data-acao="fechar-modal">Ficar</button>
      </div>
    </div>`, { focoSeletor: '[data-acao="fechar-modal"]' });
  }

  function abrirModalRemover(id) {
    const j = estado && estado.jogadores.find((x) => x.id === id);
    if (!j) return;
    const tid = `remover-${++uid}`;
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div><h2 class="modal-titulo" id="${tid}">Remover ${esc(j.nome)}?</h2><p class="modal-sub">Só na preparação.</p></div>
        <button class="modal-fechar" type="button" data-acao="fechar-modal" aria-label="Fechar">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-texto">A pessoa sai da mesa e pode entrar de novo pelo convite.</p>
      <div class="modal-acoes">
        <button class="botao botao--perigo" type="button" data-acao="remover-confirmar" data-jogador="${j.id}">Remover</button>
        <button class="botao botao--secundario" type="button" data-acao="fechar-modal">Cancelar</button>
      </div>
    </div>`, { focoSeletor: '[data-acao="fechar-modal"]' });
  }

  function abrirModalEncerrar() {
    const tid = `encerrar-${++uid}`;
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div><h2 class="modal-titulo" id="${tid}">Encerrar sem vencedor?</h2><p class="modal-sub">A rodada termina e todos voltam à preparação.</p></div>
        <button class="modal-fechar" type="button" data-acao="fechar-modal" aria-label="Fechar">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-texto">O placar da noite é preservado. A próxima rodada começa quando todos estiverem prontos.</p>
      <div class="modal-acoes">
        <button class="botao botao--perigo" type="button" data-acao="encerrar-confirmar">Encerrar rodada</button>
        <button class="botao botao--secundario" type="button" data-acao="fechar-modal">Continuar jogando</button>
      </div>
    </div>`, { focoSeletor: '[data-acao="fechar-modal"]' });
  }

  function focarAbaGaveta() {
    if (!estado || !estado.gaveta) return;
    const abaAtiva = gavetaAbas.querySelector('[aria-selected="true"]') || gavetaFechar;
    if (!abaAtiva) return;
    try { abaAtiva.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
    setTimeout(() => {
      if (estado && estado.gaveta) {
        try { abaAtiva.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
    }, 0);
  }

  function abrirGaveta(aba = 'conversa', opts = {}) {
    if (!estado) return;
    if (!opts.silencioso) fecharBandejaReacoes({ silencioso: true });
    if (!estado.gaveta) {
      gavetaAbridor = document.activeElement;
      gavetaAbridorRef = gavetaAbridor && gavetaAbridor.dataset
        ? gavetaAbridor.dataset.abrir
          ? { tipo: 'abrir', valor: gavetaAbridor.dataset.abrir }
          : gavetaAbridor.dataset.acao
            ? { tipo: 'acao', valor: gavetaAbridor.dataset.acao }
            : null
        : null;
    }
    const idAba = aba === 'mesa' ? 'sala' : aba;
    estado.abaGaveta = ABAS.some((a) => a.id === idAba) ? idAba : 'conversa';
    estado.gaveta = estado.abaGaveta;
    render();
    if (opts.foco !== false) focarAbaGaveta();
  }

  function fecharGaveta(opts = {}) {
    if (!estado || !estado.gaveta) return;
    const abridor = gavetaAbridor;
    const ref = gavetaAbridorRef;
    gavetaAbridor = null;
    gavetaAbridorRef = null;
    const eraRota = estado.gavetaRota;
    const rotaBase = estado.rotaBase;
    estado.gaveta = null;
    estado.secaoRolagem = null;
    estado.gavetaRota = false;
    if (eraRota && rotaBase) {
      estado.rota = rotaBase;
      try { history.replaceState(null, '', `#${rotaBase}`); } catch (erro) { /* hash opcional */ }
      document.title = `Tretta — ${TITULOS[rotaBase] || 'protótipo'}`;
    }
    render();
    if (opts.silencioso) return;
    let foco = abridor && abridor.isConnected ? abridor : null;
    if (!foco && ref) {
      foco = ref.tipo === 'abrir'
        ? document.querySelector(`[data-abrir="${ref.valor}"]`)
        : document.querySelector(`[data-acao="${ref.valor}"]`);
    }
    if (!foco) foco = palco;
    if (foco && foco.focus) {
      try { foco.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
    }
  }

  function trocarAba(id, opts = {}) {
    if (!estado || !ABAS.some((a) => a.id === id) || id === estado.abaGaveta) {
      if (opts.foco) {
        const atual = gavetaAbas.querySelector(`[data-tab="${id}"]`);
        if (atual) atual.focus();
      }
      return;
    }
    estado.abaGaveta = id;
    estado.gaveta = id;
    render();
    if (opts.foco) {
      const t = gavetaAbas.querySelector(`[data-tab="${id}"]`);
      if (t) {
        try { t.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
    }
  }

  function enviarMensagem(texto) {
    if (!estado) return;
    const limpo = String(texto || '').trim().slice(0, 240);
    if (!limpo) return;
    estado.mensagens.push({ autor: sessao.apelido || 'Você', autorId: 'voce', hora: horaAgora(), texto: limpo, voce: true });
    estado.naoLidas = 0;
    renderBarra();
    renderGaveta();
    anunciar('Mensagem enviada para a mesa.');
    requestAnimationFrame(() => {
      const campo = document.getElementById('chat-campo');
      if (campo) campo.focus({ preventScroll: true });
    });
  }

  async function copiarConvite() {
    if (!estado) return;
    const link = `https://tretta.app/sala/${estado.sala.codigo}`;
    try {
      await navigator.clipboard.writeText(link);
      mostrarToast('Convite copiado. Mande no grupo da família.');
      anunciar('Convite copiado.');
    } catch (erro) {
      mostrarToast(`Copie o código ${estado.sala.codigo} para convidar.`);
    }
  }

  function comprarCarta() {
    if (!estado || !minhaVez()) return;
    if (estado.comprada) {
      mostrarToast('Você já comprou nesta vez. Jogue a carta comprada ou passe.');
      return;
    }
    const c = estado.compraFila.shift() || n('amarelo', 1);
    estado.mao.push(c);
    estado.deck = Math.max(0, estado.deck - 1);
    estado.comprada = true;
    estado.compradaId = c.id;
    estado.selecionado = null;
    render();
    mostrarToast(`Você comprou ${falaCarta(c)}. Jogue ou passe.`);
    anunciar(`Você comprou uma carta. ${estado.mao.length} cartas na mão.`);
  }

  function passarVez() {
    if (!estado || !minhaVez()) return;
    if (!estado.comprada) {
      mostrarToast('Compre uma carta antes de passar.');
      return;
    }
    estado.comprada = false;
    estado.compradaId = null;
    estado.selecionado = null;
    avancarTurno();
    render();
    mostrarToast(`Você passou. Vez de ${nomeVez()}.`);
    anunciar(`Você passou. Vez de ${nomeVez()}.`);
  }

  function sairDaRotaCarta() {
    if (estado && estado.rota === 'carta') {
      estado.rota = 'mesa';
      try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
    }
  }

  function selecionarCarta(id) {
    if (!estado) return;
    const c = estado.mao.find((x) => x.id === id);
    if (!c) return;
    if (estado.observador) { mostrarToast('Você está observando esta rodada.'); return; }
    if (estado.pausado) { mostrarToast('A rodada está pausada.'); return; }
    if (!minhaVez()) { mostrarToast(`Aguarde a vez de ${nomeVez()}.`); return; }
    if (!combina(c)) {
      mostrarToast(`${falaCarta(c)} não combina com a mesa (${falaCarta(estado.descarte)}). Use cor, número ou símbolo.`);
      anunciar(`${falaCarta(c)} não combina com a mesa. Use cor, número ou símbolo.`);
      return;
    }
    estado.selecionado = c.id;
    estado.confirmando = true;
    render();
    requestAnimationFrame(() => {
      const b = $('[data-acao="confirmar-jogada"]');
      if (b) b.focus({ preventScroll: true });
    });
    anunciar(`Carta selecionada: ${falaCarta(c)}. Confirme para jogar ou cancele.`);
  }

  function cancelarJogada() {
    if (!estado) return;
    estado.confirmando = false;
    estado.selecionado = null;
    sairDaRotaCarta();
    render();
    mostrarToast('Jogada cancelada.');
  }

  function confirmarJogada() {
    if (!estado) return;
    const c = estado.mao.find((x) => x.id === estado.selecionado);
    if (!c) { estado.confirmando = false; render(); return; }
    if (c.tipo === 'coringa' || c.tipo === 'compra4') {
      estado.corModal = true;
      estado.confirmando = true;
      abrirModalCor();
      return;
    }
    const eu = idxVoce();
    estado.mao = estado.mao.filter((x) => x.id !== c.id);
    estado.descarte = c;
    estado.corAtiva = c.cor;
    estado.selecionado = null;
    estado.confirmando = false;
    estado.comprada = false;
    estado.compradaId = null;
    if (eu >= 0) {
      const tinhaAvisado = estado.jogadores[eu].avisou;
      estado.jogadores[eu].cartas = estado.mao.length;
      estado.jogadores[eu].avisou = estado.mao.length === 1 ? tinhaAvisado : true;
    }
    avancarTurno();
    sairDaRotaCarta();
    render();
    mostrarToast(`Você jogou ${falaCarta(c)}. Vez de ${nomeVez()}.`);
    anunciar(`Você jogou ${falaCarta(c)}. Restam ${estado.mao.length} cartas na sua mão. Vez de ${nomeVez()}.`);
  }

  function escolherCor(cor) {
    if (!estado || !CORES[cor] || !estado.corModal) return;
    const c = estado.mao.find((x) => x.id === estado.selecionado)
      || estado.mao.find((x) => x.tipo === 'coringa' || x.tipo === 'compra4');
    if (!c) { fecharModal({ silencioso: true }); return; }
    fecharModal({ silencioso: true });
    const eu = idxVoce();
    estado.mao = estado.mao.filter((x) => x.id !== c.id);
    estado.descarte = c;
    estado.corAtiva = cor;
    estado.selecionado = null;
    estado.confirmando = false;
    estado.corModal = false;
    estado.comprada = false;
    estado.compradaId = null;
    if (eu >= 0) {
      const tinhaAvisado = estado.jogadores[eu].avisou;
      estado.jogadores[eu].cartas = estado.mao.length;
      estado.jogadores[eu].avisou = estado.mao.length === 1 ? tinhaAvisado : true;
    }
    avancarTurno();
    estado.rota = 'mesa';
    try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
    render();
    mostrarToast(`Cor ${CORES[cor].nome.toLowerCase()} escolhida. Vez de ${nomeVez()}.`);
    anunciar(`Você jogou ${falaCarta(c)} e escolheu ${CORES[cor].nome}. Vez de ${nomeVez()}.`);
  }

  function avisarUltima() {
    const eu = idxVoce();
    if (!estado || eu < 0) return;
    if (estado.mao.length > 2) {
      mostrarToast('O aviso vale quando o próximo descarte deixa uma carta na mão.');
      return;
    }
    estado.jogadores[eu].avisou = true;
    render();
    mostrarToast('Você avisou “Última”.');
    anunciar('Você avisou última carta.');
  }

  function denunciar() {
    if (!estado) return;
    const quem = quemDenunciar();
    if (!quem) return;
    quem.cartas += 2;
    quem.avisou = true;
    estado.eventos.push({ hora: horaAgora(), texto: `<strong>${esc(quem.nome)}</strong> não avisou “Última” e comprou duas.` });
    render();
    mostrarToast(`${quem.nome} comprou 2 cartas por não avisar “Última”.`);
    anunciar(`${quem.nome} comprou duas cartas por não avisar última carta.`);
  }

  function iniciarRodada() {
    if (!estado) return;
    if (!estado.host) { mostrarToast('Só o anfitrião inicia a rodada.'); return; }
    if (!todosProntos()) { mostrarToast('Aguarde todos ficarem prontos.'); return; }
    irPara('mesa');
  }

  function resultadoVoltar() {
    if (!estado || !estado.host) return;
    irPara('preparacao');
  }

  function pausaSubstituir() {
    if (!estado || !estado.pausado) return;
    const j = estado.jogadores.find((x) => x.id === estado.pausado.id);
    if (j) { j.status = 'bot'; j.nome = j.nome; }
    estado.pausado = null;
    estado.eventos.push({ hora: horaAgora(), texto: `<strong>${esc(j ? j.nome : 'A pessoa ausente')}</strong> passou a ser conduzida por um bot.` });
    estado.rota = 'mesa';
    try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
    render();
    mostrarToast('Assento substituído por bot. A rodada continua.');
    anunciar('Assento substituído por bot. A rodada continua.');
  }

  function pausaContinuar() {
    if (!estado || !estado.pausado) return;
    const j = estado.jogadores.find((x) => x.id === estado.pausado.id);
    estado.pausado = null;
    if (j) j.status = 'offline';
    estado.eventos.push({ hora: horaAgora(), texto: `A rodada continuou sem ${esc(j ? j.nome : 'a pessoa ausente')}.` });
    if (j && estado.turno === estado.jogadores.indexOf(j)) avancarTurno();
    estado.rota = 'mesa';
    try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
    render();
    mostrarToast('A rodada continua sem a pessoa ausente.');
    anunciar(`A rodada continua sem ${j ? j.nome : 'a pessoa ausente'}.`);
  }

  function encerrarSemVencedor() {
    if (!estado || !estado.host) return;
    fecharModal({ silencioso: true });
    const e = cenarioResultado({ semVencedor: true, host: true });
    estado = e;
    estado.rota = 'resultado-sem-vencedor';
    try { history.replaceState(null, '', '#resultado-sem-vencedor'); } catch (erro) { /* hash opcional */ }
    render();
    anunciar('Rodada encerrada sem vencedor. O anfitrião pode voltar à preparação.');
  }

  function limparTimersReacao() {
    reacaoTimers.forEach((t) => clearTimeout(t));
    reacaoTimers = [];
  }

  function removerReacao() {
    limparTimersReacao();
    if (reacaoAtual && reacaoAtual.el) reacaoAtual.el.remove();
    reacaoAtual = null;
  }

  function limparReacoes() {
    filaReacoes = [];
    removerReacao();
  }

  function fecharReacao() {
    if (!reacaoAtual) return;
    const wrap = reacaoAtual.el;
    const eraFixa = reacaoAtual.fixa;
    reacaoAtual = null;
    limparTimersReacao();
    if (!wrap) return;
    wrap.classList.add('reacao--saindo');
    const remover = () => { if (wrap.isConnected) wrap.remove(); };
    wrap.addEventListener('animationend', (ev) => { if (ev.target === wrap) remover(); });
    setTimeout(remover, 420);
    if (!eraFixa) reacaoTimers.push(setTimeout(proximaReacao, 460));
  }

  function proximaReacao() {
    if (reacaoAtual || !filaReacoes.length) return;
    const dados = filaReacoes.shift();
    mostrarReacao(dados);
  }

  function mostrarReacao(dados = {}) {
    const tipo = REACOES[dados.tipo] ? dados.tipo : REACAO_PADRAO;
    const info = REACOES[tipo];
    const autor = dados.autor || 'Você';
    const fixa = Boolean(dados.fixa);
    removerReacao();
    const wrap = document.createElement('div');
    wrap.className = `reacao${fixa ? ' reacao--fixa' : ''}`;
    wrap.setAttribute('role', 'status');
    wrap.innerHTML = `<div class="reacao-palco">
        <span class="reacao-faisca reacao-faisca--a" aria-hidden="true">${info.emoji}</span>
        <span class="reacao-faisca reacao-faisca--b" aria-hidden="true">${info.emoji}</span>
        <span class="reacao-faisca reacao-faisca--c" aria-hidden="true">${info.emoji}</span>
        <div class="reacao-emoji" aria-hidden="true">${info.emoji}</div>
        <p class="reacao-nome"><strong>${esc(autor)}</strong><span class="reacao-ponto" aria-hidden="true">·</span>${esc(info.rotulo)}</p>
      </div>`;
    overlays.appendChild(wrap);
    reacaoAtual = { el: wrap, dados: { tipo, autor, rotulo: info.rotulo }, fixa };
    anunciar(`${autor} reagiu: ${info.rotulo}. Todos na mesa veem.`);
    if (!fixa) reacaoTimers.push(setTimeout(fecharReacao, DURACAO_REACAO_MS));
  }

  function enviarReacao(tipo, opts = {}) {
    const info = REACOES[tipo];
    if (!info) return;
    const agora = Date.now();
    if (!opts.ignorarLimite && agora - ultimoEnvioReacao < LIMITE_REACAO_MS) {
      mostrarToast('Calma: uma reação a cada 5 segundos.');
      return;
    }
    ultimoEnvioReacao = agora;
    if (prefs.ocultarReacoes) {
      mostrarToast('Reação enviada. As apresentações estão ocultas.');
      if (estado) estado.eventos.push({ hora: horaAgora(), texto: `Você reagiu com <strong>${esc(info.rotulo)}</strong>.` });
      return;
    }
    if (reacaoAtual) {
      if (filaReacoes.length >= MAX_FILA_REACAO) {
        mostrarToast('A sequência de reações está cheia. A reação não entrou.');
        return;
      }
      filaReacoes.push({ tipo, autor: 'Você' });
      mostrarToast('Reação na sequência. Até três aparecem em ordem.');
      if (estado) estado.eventos.push({ hora: horaAgora(), texto: `Você reagiu com <strong>${esc(info.rotulo)}</strong>.` });
      return;
    }
    mostrarReacao({ tipo, autor: 'Você' });
    if (estado) estado.eventos.push({ hora: horaAgora(), texto: `Você reagiu com <strong>${esc(info.rotulo)}</strong>.` });
  }

  function simularReacao(autor, tipo) {
    if (!REACOES[tipo]) return;
    if (prefs.ocultarReacoes) return;
    if (reacaoAtual) {
      if (filaReacoes.length >= MAX_FILA_REACAO) return;
      filaReacoes.push({ tipo, autor });
      return;
    }
    mostrarReacao({ tipo, autor });
  }

  function renderBandejaReacoes() {
    const existente = $('#reacoes-bandeja');
    if (existente) existente.remove();
    const wrap = document.createElement('section');
    wrap.className = 'reacoes-bandeja';
    wrap.id = 'reacoes-bandeja';
    wrap.setAttribute('aria-labelledby', 'reacoes-rotulo');
    wrap.innerHTML = `<p class="reacoes-rotulo" id="reacoes-rotulo">Reagir à jogada</p>
      <div class="reacoes-grade" role="group" aria-labelledby="reacoes-rotulo">
        ${Object.entries(REACOES).map(([id, r]) => `<button class="reacao-btn" type="button" data-reacao="${id}" aria-label="Reagir: ${esc(r.rotulo)}"><span class="reacao-glifo" aria-hidden="true">${r.emoji}</span><span class="reacao-btn-rotulo">${esc(r.rotulo)}</span></button>`).join('')}
      </div>
      <p class="reacoes-dica">Todos na mesa veem · individual, sem destinatário · some sozinho</p>`;
    overlays.appendChild(wrap);
    return wrap;
  }

  function abrirBandejaReacoes(opts = {}) {
    if (!estado || bandejaAberta) return;
    bandejaFoco = document.activeElement;
    const wrap = renderBandejaReacoes();
    bandejaAberta = true;
    const barraReagir = $('#barra-reagir');
    if (barraReagir) barraReagir.setAttribute('aria-expanded', 'true');
    if (opts.foco !== false) {
      const b = wrap.querySelector('.reacao-btn');
      if (b) {
        try { b.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
        setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (erro) { /* ignora */ } }, 0);
      }
    }
  }

  function fecharBandejaReacoes(opts = {}) {
    if (!bandejaAberta) return;
    bandejaAberta = false;
    const wrap = $('#reacoes-bandeja');
    if (wrap) wrap.remove();
    const barraReagir = $('#barra-reagir');
    if (barraReagir) barraReagir.setAttribute('aria-expanded', 'false');
    const foco = bandejaFoco;
    bandejaFoco = null;
    if (!opts.silencioso && foco && foco.isConnected) {
      try { foco.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
    }
  }

  function aplicarPreferencias() {
    app.classList.toggle('anim-reduzida', prefs.animacoes === 'reduzida');
    app.classList.toggle('anim-desligada', prefs.animacoes === 'desligada');
    if (prefs.ocultarReacoes) limparReacoes();
  }

  function irPara(rota) {
    if (!ROTAS.includes(rota)) rota = 'home';
    if (location.hash === `#${rota}`) {
      aplicarRota();
      return;
    }
    location.hash = rota;
  }

  function fecharTudo() {
    fecharModal({ silencioso: true });
    limparReacoes();
    fecharBandejaReacoes({ silencioso: true });
    esconderToast();
  }

  function focarInicial(rota) {
    if (rota === 'carta') {
      const b = $('[data-acao="confirmar-jogada"]');
      if (b) {
        try { b.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
      return;
    }
    if (rota === 'pausada') {
      const b = $('.pausa button');
      if (b) {
        try { b.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
      return;
    }
    if (rota === 'reacoes') {
      const b = $('#reacoes-bandeja .reacao-btn');
      if (b) {
        try { b.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
      return;
    }
    if (rota === 'home') {
      const campo = $('#apelido');
      if (campo) {
        try { campo.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
    }
  }

  function aplicarRota(inicial = false) {
    const rota = rotaAtual();
    fecharTudo();
    gavetaAbridor = null;
    estado = (CENARIOS[rota] || CENARIOS.home)();
    estado.rota = rota;
    if (rota === 'carta') {
      let indice = Number.isInteger(selecaoPendente) ? selecaoPendente : 0;
      if (!estado.mao[indice]) indice = 0;
      estado.selecionado = estado.mao[indice] ? estado.mao[indice].id : null;
    }
    selecaoPendente = null;
    aplicarPreferencias();
    render();

    if (estado.gaveta) focarAbaGaveta();
    if (estado.corModal) abrirModalCor();
    if (estado.bandejaReacoes) abrirBandejaReacoes({ foco: false });
    if (estado.reacaoFixa) mostrarReacao(Object.assign({ fixa: true }, estado.reacaoFixa));
    if (estado.toast) mostrarToast(estado.toast, 6000);
    anunciar(estado.anuncio);
    document.title = `Tretta — ${TITULOS[rota] || 'protótipo'}`;
    requestAnimationFrame(() => {
      const telaRolavel = $('.tela-home, .tela-prep, .tela-resultado, .tela-erro');
      if (telaRolavel) telaRolavel.scrollTop = 0;
      if (estado.scrollPrep === 'paineis') {
        const telaPrep = $('.tela-prep');
        const paineis = $('.prep-paineis');
        if (telaPrep && paineis) telaPrep.scrollTop = Math.max(0, paineis.offsetTop - 90);
      }
    });
    if (!inicial) focarInicial(rota);
    requestAnimationFrame(aoRedimensionar);
  }

  function tratarAcao(botao) {
    const acao = botao.dataset.acao;
    switch (acao) {
      case 'entrar-sala': {
        const campo = $('#codigo');
        const codigo = campo ? campo.value.trim() : '';
        if (!codigo) { mostrarToast('Digite o código do convite para entrar.'); if (campo) campo.focus(); return; }
        const apelido = $('#apelido');
        if (apelido) sessao.apelido = apelido.value.trim() || 'Você';
        salvarSessao();
        irPara('preparacao');
        mostrarToast(`Entrando na sala ${codigo.toUpperCase()}.`);
        break;
      }
      case 'treino':
        sessao.apelido = ($('#apelido') && $('#apelido').value.trim()) || sessao.apelido || 'Você';
        salvarSessao();
        irPara('treino');
        break;
      case 'pronto': {
        const eu = estado && estado.jogadores.find((j) => j.voce);
        if (!eu) return;
        eu.pronto = !eu.pronto;
        render();
        mostrarToast(eu.pronto ? 'Você está pronto.' : 'Você não está pronto.');
        anunciar(eu.pronto ? 'Você está pronto.' : 'Você não está pronto.');
        break;
      }
      case 'iniciar': iniciarRodada(); break;
      case 'abrir-sala': abrirGaveta('sala'); break;
      case 'copiar': copiarConvite(); break;
      case 'comprar': comprarCarta(); break;
      case 'passar': passarVez(); break;
      case 'denunciar': denunciar(); break;
      case 'avisar-ultima': avisarUltima(); break;
      case 'confirmar-jogada': confirmarJogada(); break;
      case 'cancelar-jogada': cancelarJogada(); break;
      case 'cancelar-cor': fecharModal(); break;
      case 'fechar-modal': fecharModal(); break;
      case 'pausa-substituir': pausaSubstituir(); break;
      case 'pausa-continuar': pausaContinuar(); break;
      case 'pausa-encerrar': abrirModalEncerrar(); break;
      case 'encerrar': abrirModalEncerrar(); break;
      case 'encerrar-confirmar': encerrarSemVencedor(); break;
      case 'resultado-voltar': resultadoVoltar(); break;
      case 'erro-tentar': irPara('mesa'); break;
      case 'erro-home': irPara('home'); break;
      case 'erro-criar': irPara('home'); break;
      case 'erro-codigo':
        irPara('home');
        setTimeout(() => { const c = $('#codigo'); if (c) c.focus(); }, 160);
        break;
      case 'sair': abrirModalSair(); break;
      case 'sair-confirmar':
        fecharModal({ silencioso: true });
        irPara('home');
        mostrarToast('Você saiu da sala.');
        break;
      case 'remover': abrirModalRemover(botao.dataset.jogador); break;
      case 'remover-confirmar': {
        const id = botao.dataset.jogador;
        const j = estado && estado.jogadores.find((x) => x.id === id);
        if (j && estado.preparacao) {
          estado.jogadores = estado.jogadores.filter((x) => x.id !== id);
          fecharModal({ silencioso: true });
          render();
          mostrarToast(`${j.nome} foi removido da sala.`);
          anunciar(`${j.nome} foi removido da sala.`);
        }
        break;
      }
      case 'silenciar': {
        const id = botao.dataset.jogador;
        if (!id) return;
        prefs.silenciados[id] = !prefs.silenciados[id];
        if (!prefs.silenciados[id]) delete prefs.silenciados[id];
        salvarPrefs();
        renderGaveta();
        requestAnimationFrame(() => {
          const b = document.querySelector(`[data-acao="silenciar"][data-jogador="${id}"]`);
          if (b) b.focus({ preventScroll: true });
        });
        mostrarToast(prefs.silenciados[id] ? 'Participante silenciado.' : 'Participante voltou a ser ouvido.');
        break;
      }
      case 'animacao': {
        const valor = botao.dataset.animacao;
        if (!['completa', 'reduzida', 'desligada'].includes(valor)) return;
        prefs.animacoes = valor;
        salvarPrefs();
        aplicarPreferencias();
        renderGaveta();
        requestAnimationFrame(() => {
          const b = document.querySelector(`[data-acao="animacao"][data-animacao="${valor}"]`);
          if (b) b.focus({ preventScroll: true });
        });
        mostrarToast(`Animações: ${valor}.`);
        break;
      }
      case 'toggle-som':
        prefs.sons = !prefs.sons;
        salvarPrefs();
        renderGaveta();
        requestAnimationFrame(() => {
          const b = document.querySelector('[data-acao="toggle-som"]');
          if (b) b.focus({ preventScroll: true });
        });
        mostrarToast(prefs.sons ? 'Sons da mesa ligados.' : 'Sons da mesa silenciados.');
        break;
      case 'toggle-aviso':
        prefs.avisoVez = !prefs.avisoVez;
        salvarPrefs();
        renderGaveta();
        requestAnimationFrame(() => {
          const b = document.querySelector('[data-acao="toggle-aviso"]');
          if (b) b.focus({ preventScroll: true });
        });
        mostrarToast(prefs.avisoVez ? 'Aviso sonoro da vez ligado.' : 'Aviso sonoro da vez desligado.');
        break;
      case 'toggle-ocultar':
        prefs.ocultarReacoes = !prefs.ocultarReacoes;
        salvarPrefs();
        aplicarPreferencias();
        renderGaveta();
        requestAnimationFrame(() => {
          const b = document.querySelector('[data-acao="toggle-ocultar"]');
          if (b) b.focus({ preventScroll: true });
        });
        mostrarToast(prefs.ocultarReacoes
          ? 'Reações ocultas. Você ainda pode enviar; a confirmação é textual.'
          : 'Reações visíveis. Apenas as novas aparecem.');
        break;
      default: break;
    }
  }

  document.addEventListener('click', (ev) => {
    if (bandejaAberta && !ev.target.closest('#reacoes-bandeja') && !ev.target.closest('#barra-reagir')) {
      fecharBandejaReacoes();
    }
    const botaoAcao = ev.target.closest('[data-acao]');
    if (botaoAcao) {
      ev.preventDefault();
      tratarAcao(botaoAcao);
      return;
    }
    const card = ev.target.closest('[data-carta]');
    if (card) { selecionarCarta(card.dataset.carta); return; }
    const assento = ev.target.closest('[data-jogador]');
    if (assento) { abrirModalAssento(assento.dataset.jogador); return; }
    const abrir = ev.target.closest('[data-abrir]');
    if (abrir) { abrirGaveta(abrir.dataset.abrir); return; }
    const aba = ev.target.closest('[data-tab]');
    if (aba) { trocarAba(aba.dataset.tab, { foco: true }); return; }
    const cor = ev.target.closest('.cor-opcao[data-cor]');
    if (cor) { escolherCor(cor.dataset.cor); return; }
    const reacao = ev.target.closest('[data-reacao]');
    if (reacao) {
      const tipo = reacao.dataset.reacao;
      const info = REACOES[tipo] || REACOES[REACAO_PADRAO];
      fecharBandejaReacoes({ foco: true });
      enviarReacao(tipo);
      anunciar(`Você reagiu: ${info.rotulo}.`);
      return;
    }
    const avatar = ev.target.closest('[data-avatar]');
    if (avatar) {
      sessao.avatar = avatar.dataset.avatar;
      salvarSessao();
      $$('.avatar-opcao').forEach((b) => b.setAttribute('aria-pressed', String(b === avatar)));
      return;
    }
    if (ev.target === gavetaScrim) fecharGaveta();
  });

  document.addEventListener('submit', (ev) => {
    const homeForm = ev.target.closest('#home-form');
    if (homeForm) {
      ev.preventDefault();
      const campo = $('#apelido');
      const apelido = campo ? campo.value.trim() : '';
      if (!apelido) {
        mostrarToast('Escolha um apelido para sentar à mesa.');
        if (campo) campo.focus();
        return;
      }
      sessao.apelido = apelido;
      salvarSessao();
      irPara('preparacao');
      return;
    }
    const form = ev.target.closest('#chat-form');
    if (!form) return;
    ev.preventDefault();
    const campo = form.querySelector('#chat-campo');
    enviarMensagem(campo ? campo.value : '');
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (bandejaAberta) { ev.preventDefault(); fecharBandejaReacoes({ foco: true }); return; }
      if (modal) { ev.preventDefault(); fecharModal(); return; }
      if (estado && estado.gaveta) { ev.preventDefault(); fecharGaveta(); return; }
      if (estado && estado.confirmando) { ev.preventDefault(); cancelarJogada(); return; }
    }
    if (ev.key === 'Tab') {
      const container = modal ? modal.scrim : (estado && estado.gaveta ? gaveta : null);
      if (container) trapTab(container, ev);
    }
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'codigo') {
      ev.preventDefault();
      const b = $('[data-acao="entrar-sala"]');
      if (b) b.click();
    }
  });

  gavetaAbas.addEventListener('keydown', (ev) => {
    const aba = ev.target.closest('[role="tab"]');
    if (!aba) return;
    let indice = ABAS.findIndex((a) => a.id === aba.dataset.tab);
    if (ev.key === 'ArrowRight') indice = (indice + 1) % ABAS.length;
    else if (ev.key === 'ArrowLeft') indice = (indice - 1 + ABAS.length) % ABAS.length;
    else if (ev.key === 'Home') indice = 0;
    else if (ev.key === 'End') indice = ABAS.length - 1;
    else return;
    ev.preventDefault();
    trocarAba(ABAS[indice].id, { foco: true });
  });

  gavetaFechar.addEventListener('click', () => fecharGaveta());
  gavetaScrim.addEventListener('click', () => fecharGaveta());

  barra.addEventListener('click', (ev) => {
    const b = ev.target.closest('#barra-reagir');
    if (!b) return;
    ev.stopPropagation();
    if (bandejaAberta) fecharBandejaReacoes({ foco: true });
    else abrirBandejaReacoes();
  });

  function medirTudo() {
    const visivel = (el) => !!el && el.getClientRects().length > 0;
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    };
    const fonte = (sel) => {
      const el = $(sel);
      return el ? getComputedStyle(el).fontSize : null;
    };
    const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const assentos = $$('.assento').map((el) => {
      const nome = el.querySelector('.assento-nome');
      const cs = nome ? getComputedStyle(nome) : null;
      return {
        nome: nome ? nome.textContent.trim() : '',
        aria: el.getAttribute('aria-label'),
        rect: rect(el),
        nomeRect: nome ? rect(nome) : null,
        nomeScrollWidth: nome ? nome.scrollWidth : null,
        nomeClientWidth: nome ? nome.clientWidth : null,
        nomeScrollHeight: nome ? nome.scrollHeight : null,
        nomeClientHeight: nome ? nome.clientHeight : null,
        textOverflow: cs ? cs.textOverflow : null,
        whiteSpace: cs ? cs.whiteSpace : null,
        classe: el.className,
        current: el.getAttribute('aria-current') === 'true'
      };
    });
    const overlaps = [];
    for (let i = 0; i < assentos.length; i += 1) {
      for (let j = i + 1; j < assentos.length; j += 1) {
        if (intersects(assentos[i].rect, assentos[j].rect)) overlaps.push([assentos[i].nome, assentos[j].nome]);
      }
    }
    const centro = $('.centro, .prep-centro');
    if (centro) {
      const cr = rect(centro);
      assentos.forEach((a) => { if (intersects(cr, a.rect)) overlaps.push(['centro', a.nome]); });
    }
    const mesaEl = $('#mesa');
    const mesaRect = mesaEl ? rect(mesaEl) : null;
    const foraDaMesa = mesaRect ? assentos.filter((a) => (
      a.rect.x < mesaRect.x - 0.6 || a.rect.x + a.rect.w > mesaRect.x + mesaRect.w + 0.6
      || a.rect.y < mesaRect.y - 0.6 || a.rect.y + a.rect.h > mesaRect.y + mesaRect.h + 0.6
    )).map((a) => a.nome) : [];
    const lados = { topo: 0, base: 0, esquerda: 0, direita: 0 };
    assentos.forEach((a) => {
      if (a.classe.includes('assento--topo')) lados.topo += 1;
      else if (a.classe.includes('assento--base')) lados.base += 1;
      else if (a.classe.includes('assento--esq')) lados.esquerda += 1;
      else if (a.classe.includes('assento--dir')) lados.direita += 1;
    });
    const alvos = $$('button, a[href], input, select, textarea, [role="button"]')
      .filter(visivel)
      .map((el) => ({ rotulo: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60), rect: rect(el) }))
      .filter((t) => t.rect.w < 44 || t.rect.h < 44);
    const cartas = $$('.mao .carta').map((el) => ({ rotulo: el.getAttribute('aria-label'), rect: rect(el) }));
    const telaRolavel = $('.tela-rolavel, .tela-home, .tela-prep, .tela-resultado, .tela-erro, .tela-mesa, .tela-espera');
    const texto = document.body.innerText;
    return {
      rota: estado && estado.rota,
      tela: estado && estado.tela,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      scroll: {
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        bodyW: document.body.scrollWidth,
        bodyH: document.body.scrollHeight,
        appW: app.scrollWidth,
        appH: app.scrollHeight,
        palcoW: palco.scrollWidth,
        palcoH: palco.scrollHeight,
        palcoClientH: palco.clientHeight,
        telaW: telaRolavel ? telaRolavel.scrollWidth : null,
        telaH: telaRolavel ? telaRolavel.scrollHeight : null,
        telaClientW: telaRolavel ? telaRolavel.clientWidth : null,
        telaClientH: telaRolavel ? telaRolavel.clientHeight : null
      },
      fontes: {
        vez: fonte('.vez-nome'),
        sentido: fonte('.sentido-valor'),
        contaNum: fonte('.conta-num'),
        contaRot: fonte('.conta-rot'),
        assentoNome: fonte('.assento-nome'),
        cartaNome: fonte('.carta-nome'),
        corRotulo: fonte('.cor-rotulo'),
        corpo: fonte('.botao'),
        naVez: fonte('.tag-na-vez'),
        status: fonte('.assento-status')
      },
      cartas,
      assentos,
      assentoCount: assentos.length,
      assentoLados: lados,
      assentosForaDaMesa: foraDaMesa,
      mesaRect,
      compacto: window.matchMedia('(max-width: 380px) and (max-height: 700px)').matches,
      telaRolagemVertical: telaRolavel ? telaRolavel.scrollHeight > telaRolavel.clientHeight + 1 : null,
      maoConta: document.querySelector('.voce-conta') ? document.querySelector('.voce-conta').textContent.replace(/\s+/g, ' ').trim() : null,
      overlaps,
      alvosMenores: alvos,
      reacoes: $$('.reacao-btn').length,
      reacoesRotulos: $$('.reacao-btn .reacao-btn-rotulo').map((el) => el.textContent.trim()),
      ariaCurrent: $$('[aria-current="true"]').length,
      gavetaAberta: !!(estado && estado.gaveta),
      gavetaSecoes: $$('.sala-secao h3').map((el) => el.textContent.trim()),
      textoProibido: (texto.match(/provoc|taunt|30s|alvo|resposta/gi) || []),
      maoRolagem: !!$('.mao--rolagem'),
      filaReacoes: filaReacoes.map((r) => r.tipo),
      reacaoAtual: reacaoAtual ? Object.assign({}, reacaoAtual.dados) : null,
      ocultarReacoes: prefs.ocultarReacoes
    };
  }

  window.__T018 = {
    get estado() { return estado; },
    get prefs() { return JSON.parse(JSON.stringify(prefs)); },
    tempos: { reacao: DURACAO_REACAO_MS, limite: LIMITE_REACAO_MS, fila: MAX_FILA_REACAO },
    posicoes: (qtd, direcao = 1) => posicoesAssentos(qtd, direcao),
    medir: medirTudo,
    irPara,
    aplicarRota,
    abrirGaveta,
    fecharGaveta,
    abrirBandejaReacoes,
    fecharBandejaReacoes,
    enviarReacao: (tipo) => enviarReacao(tipo, { ignorarLimite: true }),
    simularReacao,
    mostrarReacao,
    limparReacoes,
    fila: () => filaReacoes.map((r) => ({ tipo: r.tipo, autor: r.autor })),
    reacaoAtual: () => (reacaoAtual ? Object.assign({}, reacaoAtual.dados) : null),
    fecharReacao
  };

  window.addEventListener('resize', agendarMedida);
  if ('ResizeObserver' in window) {
    const observador = new ResizeObserver(agendarMedida);
    observador.observe(palco);
    observador.observe(app);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(agendarMedida).catch(() => {});
  }

  window.addEventListener('hashchange', () => {
    aplicarRota(false);
  });

  const hashInicial = location.hash.replace(/^#/, '');
  if (!hashInicial) {
    try { history.replaceState(null, '', '#home'); } catch (erro) { /* hash opcional */ }
  } else if (!ROTAS.includes(hashInicial)) {
    try { history.replaceState(null, '', '#erro-link'); } catch (erro) { /* hash opcional */ }
  }
  aplicarPreferencias();
  aplicarRota(true);
})();
