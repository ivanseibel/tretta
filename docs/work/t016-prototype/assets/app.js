(() => {
  'use strict';

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  const app = $('#app');
  const topoVez = $('#topo-vez');
  const topoSentido = $('#topo-sentido');
  const mesaEl = $('#mesa');
  const trilhoBase = $('#trilho-base');
  const trilhoLuz = $('#trilho-luz');
  const assentosEl = $('#assentos');
  const centroEl = $('#centro');
  const pausaEl = $('#pausa');
  const brilhoVez = $('#brilho-vez');
  const acoesEl = $('#acoes');
  const toastEl = $('#toast');
  const maoWrap = $('#mao-wrap');
  const maoCabeca = $('#mao-cabeca');
  const maoEl = $('#mao');
  const bandejaEl = $('#bandeja');
  const gaveta = $('#gaveta');
  const gavetaTitulo = $('#gaveta-titulo');
  const gavetaAbas = $('#gaveta-abas');
  const gavetaCorpo = $('#gaveta-corpo');
  const gavetaScrim = $('#gaveta-scrim');
  const gavetaFechar = $('#gaveta-fechar');
  const overlays = $('#overlays');
  const live = $('#live');
  const seloConversa = $('#selo-conversa');
  const barraConversa = $('[data-abrir="conversa"]');
  const barraReagir = $('#barra-reagir');
  const reacoesBandeja = $('#reacoes-bandeja');
  const reacoesGrade = $('#reacoes-grade');

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
    { id: 'sala', rotulo: 'Sala', icone: 'ic-mesa' }
  ];

  const REACOES = {
    'se-ferrou': { emoji: '😂', rotulo: 'Se ferrou!' },
    injustica: { emoji: '😭', rotulo: 'Injustiça!' },
    'toma-essa': { emoji: '😈', rotulo: 'Toma essa!' },
    sacanagem: { emoji: '🤬', rotulo: 'Sacanagem!' },
    'boa-jogada': { emoji: '👏', rotulo: 'Boa jogada!' },
    palhaco: { emoji: '🤡', rotulo: 'Palhaço!' },
    tedio: { emoji: '🥱', rotulo: 'Que tédio!' },
    'nao-acredito': { emoji: '😱', rotulo: 'Não acredito!' },
    'ja-era': { emoji: '💀', rotulo: 'Já era!' },
    suspeito: { emoji: '🤔', rotulo: 'Suspeito...' },
    carinho: { emoji: '😘', rotulo: 'Com carinho!' },
    fogo: { emoji: '🔥', rotulo: 'Tá pegando fogo!' }
  };
  const REACAO_PADRAO = 'se-ferrou';

  let estado = null;
  let selecaoPendente = null;
  let suprimirRota = false;
  let modal = null;
  let reacaoAtual = null;
  let reacaoTimers = [];
  let bandejaReacoesAberta = false;
  let bandejaFoco = null;
  let gavetaAberta = false;
  let gavetaAbridor = null;
  let abaGaveta = 'conversa';
  let toastTimer = null;
  let anuncioTimer = null;
  let uid = 0;
  let peaoEl = null;
  let peaoPosicionado = false;

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

  function plural(valor) {
    return valor === 1 ? 'carta' : 'cartas';
  }

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

  function jogador(id, nome, iniciais, slot, cartas, extra = {}) {
    return Object.assign({
      id, nome, iniciais, slot, cartas,
      avisou: cartas !== 1,
      status: 'ok',
      voce: false,
      venceu: false
    }, extra);
  }

  function mensagensBase() {
    return [
      { autor: 'Vó Cida', hora: '20:36', texto: 'Boa noite, gente. A mesa tá posta.' },
      { autor: 'Bia', hora: '20:37', texto: 'Vó, quantas cartas a senhora tem?' },
      { autor: 'Vó Cida', hora: '20:37', texto: 'Sete. Igual todo mundo, minha filha.' },
      { autor: 'Seu Nilton', hora: '20:38', texto: 'Essa rodada vai longe.' },
      { autor: 'Bia', hora: '20:38', texto: 'Alguém viu meu tomate?' }
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

  function baseJogadores() {
    return [
      jogador('voce', 'Você', 'VC', 7, 7, { voce: true }),
      jogador('cida', 'Vó Cida', 'CD', 1, 6),
      jogador('nilton', 'Seu Nilton', 'SN', 3, 8),
      jogador('bia', 'Bia', 'BI', 5, 5)
    ];
  }

  function cenarioMesa() {
    const jogadores = baseJogadores();
    const mao = [
      n('vermelho', 9),
      n('amarelo', 6),
      esp('vermelho', 'bloqueio'),
      esp('coringa', 'coringa'),
      n('verde', 3),
      esp('azul', 'compra2'),
      n('azul', 7)
    ];
    jogadores[0].cartas = mao.length;
    jogadores[3].cartas = 1;
    jogadores[3].avisou = true;
    return {
      jogadores, turno: 0, direcao: 1,
      corAtiva: 'vermelho', descarte: n('vermelho', 6),
      deck: 79, mao,
      compraFila: [n('azul', 4), n('verde', 1), esp('amarelo', 'compra2'), n('vermelho', 2)],
      selecionado: null, comprada: false, compradaId: null,
      observador: false, pausado: null, resultado: null, reacao: null, naFila: false,
      mensagens: mensagensBase(), naoLidas: 3,
      eventos: eventosBase().concat([
        { hora: '20:41', texto: '<strong>Bia</strong> avisou “Última carta”.' }
      ]),
      sala: { nome: 'Sala da Vó Cida', codigo: 'TRT-4821', rodada: 8 },
      anuncio: 'Sua vez. Cor ativa vermelha. Descarte vermelho seis. Sete cartas na mão.'
    };
  }

  function cenarioMesaCheia() {
    const jogadores = [
      jogador('voce', 'Você', 'VC', 7, 7, { voce: true }),
      jogador('juca', 'Tio Juca do Sítio', 'JU', 0, 12),
      jogador('bia', 'Bia', 'BI', 1, 5),
      jogador('cida', 'Vó Cida', 'CD', 2, 9),
      jogador('rita', 'Rita', 'RI', 3, 8),
      jogador('fernanda', 'Fernanda Albuquerque', 'FA', 4, 6),
      jogador('leo', 'Léo', 'LE', 5, 1),
      jogador('nilton', 'Seu Nilton', 'SN', 6, 7)
    ];
    const mao = [
      n('azul', 2),
      esp('verde', 'bloqueio'),
      n('amarelo', 2),
      esp('coringa', 'compra4'),
      n('vermelho', 5),
      n('verde', 8),
      esp('azul', 'inversao')
    ];
    return {
      jogadores, turno: 4, direcao: 1,
      corAtiva: 'verde', descarte: n('verde', 4),
      deck: 71, mao,
      compraFila: [n('verde', 6), esp('vermelho', 'compra2'), n('azul', 9), n('amarelo', 1)],
      selecionado: null, comprada: false, compradaId: null,
      observador: false, pausado: null, resultado: null, reacao: null, naFila: false,
      mensagens: mensagensBase(), naoLidas: 3,
      eventos: eventosBase().concat([
        { hora: '20:41', texto: '<strong>Tio Juca do Sítio</strong> comprou e ficou com 12 cartas.' }
      ]),
      sala: { nome: 'Sala da Vó Cida', codigo: 'TRT-4821', rodada: 8 },
      anuncio: 'Vez de Rita. Cor ativa verde. Descarte verde quatro. Você tem sete cartas.'
    };
  }

  function cenarioInversao() {
    const e = cenarioMesaCheia();
    e.turno = 6;
    e.direcao = -1;
    e.corAtiva = 'azul';
    e.descarte = esp('azul', 'inversao');
    e.deck = 55;
    e.mao = [
      n('vermelho', 4),
      n('amarelo', 8),
      esp('azul', 'bloqueio'),
      n('verde', 6),
      esp('coringa', 'coringa'),
      n('azul', 1),
      esp('verde', 'compra2')
    ];
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: 'Você jogou <strong>Inversão azul</strong>. O sentido virou anti-horário.' }
    ]);
    e.anuncio = 'Sentido anti-horário. Inversão jogada. Vez de Léo. Cor ativa azul.';
    e.toast = 'Inversão! Agora o sentido é anti-horário.';
    return e;
  }

  function cenarioObservador() {
    const jogadores = [
      jogador('bia', 'Bia', 'BI', 0, 5),
      jogador('juca', 'Tio Juca do Sítio', 'JU', 1, 9),
      jogador('cida', 'Vó Cida', 'CD', 2, 7),
      jogador('rita', 'Rita', 'RI', 3, 8),
      jogador('fernanda', 'Fernanda Albuquerque', 'FA', 4, 6),
      jogador('leo', 'Léo', 'LE', 5, 4),
      jogador('nilton', 'Seu Nilton', 'SN', 6, 11),
      jogador('zeca', 'Tio Zeca', 'ZE', 7, 7)
    ];
    return {
      jogadores, turno: 2, direcao: 1,
      corAtiva: 'amarelo', descarte: n('amarelo', 7),
      deck: 48, mao: [],
      compraFila: [],
      selecionado: null, comprada: false, compradaId: null,
      observador: true, pausado: null, resultado: null, reacao: null, naFila: false,
      mensagens: mensagensBase(), naoLidas: 3,
      eventos: eventosBase().concat([
        { hora: '20:41', texto: '<strong>Vó Cida</strong> jogou Amarelo 7.' }
      ]),
      sala: { nome: 'Sala da Vó Cida', codigo: 'TRT-4821', rodada: 8 },
      anuncio: 'Você está observando. Vez de Vó Cida. A próxima rodada começa quando esta terminar.'
    };
  }

  function cenarioPausada() {
    const e = cenarioMesa();
    e.turno = 3;
    e.jogadores[3].status = 'offline';
    e.pausado = { id: 'bia', nome: 'Bia' };
    e.eventos = eventosBase().concat([
      { hora: '20:41', texto: '<strong>Bia</strong> caiu da conexão. Rodada pausada.' }
    ]);
    e.anuncio = 'Rodada pausada. Bia caiu da conexão. A mesa espera por ela.';
    return e;
  }

  function cenarioConversa() {
    const e = cenarioMesa();
    e.naoLidas = 3;
    e.anuncio = 'Conversa aberta. Três mensagens não lidas.';
    return e;
  }

  function cenarioCor() {
    const e = cenarioMesa();
    e.descarte = esp('coringa', 'coringa');
    e.corAtiva = null;
    e.anuncio = 'Coringa jogado. Escolha a cor para a próxima jogada.';
    return e;
  }

  function cenarioCarta() {
    const e = cenarioMesa();
    e.anuncio = 'Carta selecionada. Confirme para jogar ou cancele.';
    return e;
  }

  function cenarioReacao() {
    const e = cenarioMesa();
    e.reacao = { tipo: 'toma-essa', autor: 'Nena' };
    e.anuncio = 'Nena reagiu: “Toma essa!”. Todos na mesa veem.';
    return e;
  }

  function cenarioResultado() {
    const e = cenarioMesa();
    e.turno = null;
    e.jogadores[1].cartas = 0;
    e.jogadores[1].venceu = true;
    e.resultado = {
      rotulo: 'Rodada 8 encerrada',
      titulo: 'Vó Cida venceu a rodada',
      sub: 'Primeira a ficar sem cartas · 3ª vitória da noite',
      vencedor: 'Vó Cida',
      placar: [
        { nome: 'Vó Cida', rodadas: 3, venceu: true },
        { nome: 'Seu Nilton', rodadas: 2, venceu: false },
        { nome: 'Bia', rodadas: 1, venceu: false },
        { nome: 'Você', rodadas: 1, venceu: false }
      ]
    };
    e.anuncio = 'Rodada encerrada. Vó Cida venceu com três rodadas.';
    return e;
  }

  const CENARIOS = {
    mesa: cenarioMesa,
    'mesa-cheia': cenarioMesaCheia,
    inversao: cenarioInversao,
    carta: cenarioCarta,
    cor: cenarioCor,
    conversa: cenarioConversa,
    observador: cenarioObservador,
    pausada: cenarioPausada,
    reacao: cenarioReacao,
    resultado: cenarioResultado
  };

  const ROTAS = Object.keys(CENARIOS);

  function rotaAtual() {
    const bruta = location.hash.replace(/^#/, '');
    const rota = bruta === 'provocacao' ? 'reacao' : bruta;
    return ROTAS.includes(rota) ? rota : 'mesa';
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

  function combina(c) {
    if (!estado) return false;
    if (c.tipo === 'coringa' || c.tipo === 'compra4') return true;
    const d = estado.descarte;
    if (estado.corAtiva && c.cor === estado.corAtiva) return true;
    if (d && d.tipo === 'numero' && c.tipo === 'numero' && c.valor === d.valor) return true;
    if (d && d.tipo !== 'numero' && c.tipo === d.tipo) return true;
    return false;
  }

  function minhaVez() {
    return !!estado && estado.turno != null && estado.turno === idxVoce() && !estado.pausado && !estado.resultado;
  }

  function podeComprar() {
    return minhaVez() && !estado.comprada && estado.rota !== 'carta' && estado.rota !== 'cor';
  }

  function avancarTurno() {
    if (!estado || estado.turno == null) return;
    const total = estado.jogadores.length;
    estado.turno = (estado.turno + (estado.direcao < 0 ? -1 : 1) + total) % total;
  }

  function cartaHtml(c, opts = {}) {
    const cor = CORES[c.cor] || CORES.coringa;
    const classes = ['carta'];
    if (opts.descarte) classes.push('carta--descarte');
    if (opts.selecionada) classes.push('carta-selecionada');
    if (opts.comprada) classes.push('carta-comprada');
    const estilo = `--cor:${cor.hex};--tinta:${cor.tinta}`;
    const topo = `<span class="carta-topo"><span class="carta-cor">${cor.nome}</span></span>`;
    const centro = c.tipo === 'numero'
      ? `<span class="carta-centro"><span class="carta-rank">${c.valor}</span></span>`
      : `<span class="carta-centro"><span class="carta-icone">${icone(ICONE_TIPO[c.tipo] || 'ic-coringa')}</span><span class="carta-nome">${esc(c.nome)}</span></span>`;
    const pe = c.cor === 'coringa'
      ? `<span class="carta-pe"><span class="forma-quatro">${['vermelho', 'amarelo', 'verde', 'azul'].map((x) => formaSvg(x, 'forma-mini')).join('')}</span></span>`
      : `<span class="carta-pe">${formaSvg(c.cor, 'forma', cor.tinta)}</span>`;
    const conteudo = `${topo}${centro}${pe}`;
    if (opts.descarte) {
      return `<div class="${classes.join(' ')}" data-cor="${c.cor}" style="--cor:${cor.hex};--tinta:${cor.tinta}" role="img" aria-label="Descarte: ${esc(falaCarta(c))}">${conteudo}</div>`;
    }
    return `<button class="${classes.join(' ')}" type="button" data-cor="${c.cor}" data-carta="${c.id}" data-jogavel="${opts.jogavel ? 'true' : 'false'}" style="${estilo}" aria-label="${esc(falaCarta(c))}${opts.jogavel ? ', pode jogar' : ''}">${conteudo}</button>`;
  }

  function classePosicao(slot) {
    if (slot === 7) return 'assento--base';
    if (slot === 2 || slot === 3 || slot === 4) return 'assento--topo';
    return 'assento--lado';
  }

  function rosaSentido(anti) {
    return `<svg class="sentido-rosacea${anti ? ' anti' : ''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.4" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".7"/>
      <path d="M10 2.6 12.6 10.1 10 8.9 7.4 10.1Z" fill="currentColor"/>
      <path d="M10 17.4 7.9 11.7 10 12.6 12.1 11.7Z" fill="currentColor" opacity=".5"/>
    </svg>`;
  }

  function renderTopo() {
    const sentido = estado.direcao < 0 ? 'anti-horário' : 'horário';
    let titulo = 'Mesa';
    let etiqueta = '';
    let sub = estado.sala.nome;

    if (estado.observador) {
      const j = estado.turno != null ? estado.jogadores[estado.turno] : null;
      titulo = j ? `Vez de ${j.nome}` : 'Você observa';
      sub = `Você observa · ${estado.sala.nome} · ${estado.jogadores.length} jogadores`;
    } else if (estado.pausado) {
      titulo = 'Rodada pausada';
      sub = `${estado.pausado.nome} caiu da conexão · ${estado.sala.nome}`;
    } else if (estado.resultado) {
      titulo = 'Rodada encerrada';
      sub = `${estado.resultado.vencedor} venceu · ${estado.sala.nome}`;
    } else if (estado.turno != null) {
      const j = estado.jogadores[estado.turno];
      titulo = j.voce ? 'Sua vez' : `Vez de ${j.nome}`;
      etiqueta = 'na vez';
      sub = `${estado.sala.nome} · rodada ${estado.sala.rodada}`;
    }

    topoVez.innerHTML = `
      <div class="vez-linha">
        <span class="vez-nome">${esc(titulo)}</span>
        ${etiqueta ? `<span class="tag-na-vez">${etiqueta}</span>` : ''}
      </div>
      <div class="vez-sub">${esc(sub)}</div>`;

    topoSentido.innerHTML = `
      <div class="sentido-placa">
        ${rosaSentido(estado.direcao < 0)}
        <span class="sentido-textos">
          <span class="sentido-rotulo">sentido</span>
          <span class="sentido-valor">${sentido}</span>
        </span>
      </div>`;
  }

  function renderAssentos() {
    assentosEl.innerHTML = estado.jogadores.map((j, i) => {
      const atual = estado.turno === i && !estado.resultado;
      const ultima = j.cartas === 1 && j.avisou && j.status !== 'offline';
      const classes = ['assento', `slot-${j.slot}`, classePosicao(j.slot)];
      if (atual) classes.push('atual');
      if (j.status === 'offline') classes.push('offline');
      if (ultima) classes.push('ultima');
      const info = [
        j.nome,
        `${j.cartas} ${plural(j.cartas)}`,
        atual ? 'na vez' : '',
        ultima ? 'avisou última carta' : '',
        j.status === 'offline' ? 'desconectado' : '',
        j.voce ? 'você' : ''
      ].filter(Boolean).join(', ');
      const marca = j.venceu
        ? `<span class="assento-marca" aria-hidden="true">${icone('ic-coroa')}</span>`
        : j.status === 'offline'
          ? `<span class="assento-marca" aria-hidden="true">${icone('ic-caiu')}</span>`
          : '';
      return `<button class="${classes.join(' ')}" type="button" data-jogador="${j.id}"${atual ? ' aria-current="true"' : ''} aria-label="${esc(info)}. Toque para ver detalhes.">
        ${atual ? '<span class="tag-na-vez">na vez</span>' : ''}
        <span class="assento-topo">
          <span class="avatar" aria-hidden="true">${esc(j.iniciais)}</span>
          <span class="assento-nome">${esc(j.nome)}</span>
          ${marca}
        </span>
        <span class="assento-conta${ultima ? ' assento-conta--ultima' : ''}"><span class="conta-num">${j.cartas}</span>${ultima ? '<span class="tag-ultima">última</span>' : `<span class="conta-rot">${plural(j.cartas)}</span>`}</span>
        ${j.status === 'offline' ? '<span class="tag-offline">caiu</span>' : ''}
      </button>`;
    }).join('');
  }

  function renderCentro() {
    const ativa = estado.corAtiva ? CORES[estado.corAtiva] : null;
    const corPlate = ativa
      ? `${formaSvg(estado.corAtiva, 'cor-forma')}<span class="cor-nome">${ativa.nome}</span>`
      : `${icone('ic-coringa', 'cor-forma')}<span class="cor-nome">a escolher</span>`;
    const comprarOk = podeComprar();
    centroEl.innerHTML = `
      <div class="mesa-centro">
        <button class="monte" type="button" data-acao="comprar"${comprarOk ? '' : ' disabled'} aria-label="Comprar uma carta. ${estado.deck} cartas no monte.">
          <span class="monte-verso" aria-hidden="true"></span>
          <span class="monte-conta" aria-hidden="true"><span class="num">${estado.deck}</span><span class="rot">cartas</span></span>
        </button>
        ${cartaHtml(estado.descarte, { descarte: true })}
      </div>
      <div class="cor-ativa" role="group" aria-label="Cor ativa: ${ativa ? ativa.nome : 'a escolher'}">
        <span class="cor-rotulo">cor ativa</span>
        ${corPlate}
      </div>`;
  }

  function renderAcoes() {
    const eu = idxVoce();
    const botoes = [];
    let status = '';
    let iconeId = 'ic-cartas';

    if (estado.observador) {
      iconeId = 'ic-olho';
      status = estado.naFila
        ? '<strong>Na fila</strong> · aguardando a próxima rodada'
        : 'Aguardando a próxima rodada';
      botoes.push({
        rotulo: estado.naFila ? 'Na fila' : 'Entrar na fila',
        acao: 'entrar-fila',
        tipo: 'primario',
        desabilitado: estado.naFila,
        aria: 'Entrar na fila da próxima rodada'
      });
    } else if (estado.pausado) {
      iconeId = 'ic-pausa';
      status = `<strong>Rodada pausada</strong> · aguardando ${esc(estado.pausado.nome)}`;
    } else if (estado.resultado) {
      iconeId = 'ic-coroa';
      status = `<strong>Rodada encerrada</strong> · ${esc(estado.resultado.vencedor)} venceu`;
      botoes.push({ rotulo: 'Ver placar', acao: 'ver-resultado', tipo: 'primario' });
    } else if (estado.turno === eu) {
      iconeId = 'ic-cartas';
      status = estado.comprada
        ? '<strong>Você comprou</strong> · jogue ou passe'
        : '<strong>Sua vez</strong> · jogue uma carta ou compre';
      botoes.push({
        rotulo: 'Comprar',
        acao: 'comprar',
        tipo: 'primario',
        desabilitado: !podeComprar(),
        aria: 'Comprar uma carta do monte'
      });
      botoes.push({
        rotulo: 'Passar',
        acao: 'passar',
        tipo: 'secundario',
        desabilitado: !estado.comprada,
        aria: 'Passar a vez'
      });
      if (estado.mao.length === 1 && estado.jogadores[eu] && !estado.jogadores[eu].avisou) {
        botoes.push({ rotulo: 'Última', acao: 'avisar-ultima', tipo: 'atencao', aria: 'Avisar última carta' });
      }
    } else {
      iconeId = 'ic-cartas';
      status = `<strong>Vez de ${esc(nomeVez())}</strong> · aguarde`;
      const alvo = estado.jogadores.find((j) => !j.voce && j.cartas === 1 && !j.avisou && j.status !== 'offline');
      if (alvo) {
        botoes.push({
          rotulo: 'Denunciar',
          acao: 'denunciar',
          tipo: 'atencao',
          aria: `Denunciar ${alvo.nome} por não avisar última carta`
        });
      }
    }

    acoesEl.innerHTML = `
      <p class="acoes-status">${icone(iconeId)}<span>${status}</span></p>
      ${botoes.map((b) => `<button class="botao botao--${b.tipo}" type="button" data-acao="${b.acao}"${b.desabilitado ? ' disabled' : ''}${b.aria ? ` aria-label="${esc(b.aria)}"` : ''}>${b.rotulo}</button>`).join('')}`;
  }

  function renderMao() {
    const eu = idxVoce();
    if (estado.observador || eu < 0) {
      maoWrap.hidden = true;
      maoCabeca.innerHTML = '';
      maoEl.innerHTML = '';
      return;
    }
    maoWrap.hidden = false;
    const total = estado.mao.length;
    maoCabeca.innerHTML = `
      <div class="voce">
        <span class="avatar" aria-hidden="true">VC</span>
        <span class="voce-nome">Você</span>
      </div>
      <div class="voce-conta"><span class="num">${total}</span><span class="rot">${plural(total)}</span></div>`;
    const ativo = minhaVez() && estado.rota !== 'cor';
    maoEl.classList.toggle('mao--rolagem', total > 8);
    maoEl.innerHTML = estado.mao.map((c) => cartaHtml(c, {
      jogavel: ativo && combina(c),
      selecionada: c.id === estado.selecionado,
      comprada: c.id === estado.compradaId
    })).join('');
  }

  function renderPausa() {
    if (!estado.pausado) {
      pausaEl.hidden = true;
      pausaEl.innerHTML = '';
      return;
    }
    pausaEl.hidden = false;
    pausaEl.innerHTML = `
      <div class="pausa-cartao">
        <p class="pausa-rotulo">Rodada pausada</p>
        <h2 class="pausa-titulo">${esc(estado.pausado.nome)} caiu da conexão</h2>
        <p class="pausa-texto">A mesa espera por ${esc(estado.pausado.nome)}. A rodada continua de onde parou, sem perder a vez.</p>
        <button class="botao botao--primario" type="button" data-acao="voltar-jogo">Voltar ao jogo</button>
      </div>`;
  }

  function renderBandeja() {
    const c = estado.mao.find((x) => x.id === estado.selecionado);
    if (estado.rota !== 'carta' || !c) {
      bandejaEl.hidden = true;
      bandejaEl.innerHTML = '';
      return;
    }
    const cor = CORES[c.cor] || CORES.coringa;
    bandejaEl.hidden = false;
    bandejaEl.innerHTML = `
      <span class="bandeja-carta" style="--cor:${cor.hex};--tinta-mini:${cor.tinta}" aria-hidden="true">${miniCarta(c)}</span>
      <span class="bandeja-texto">Jogar ${esc(tituloCarta(c))}?<small>A carta vai para o descarte. Sem pressa.</small></span>
      <button class="botao botao--primario" type="button" data-acao="confirmar-jogada">Jogar</button>
      <button class="botao botao--secundario" type="button" data-acao="cancelar-jogada">Cancelar</button>`;
  }

  function renderSelo() {
    const total = estado ? estado.naoLidas : 0;
    if (seloConversa) {
      seloConversa.hidden = total <= 0;
      seloConversa.textContent = total;
    }
    if (barraConversa) {
      barraConversa.setAttribute('aria-label', total > 0 ? `Conversa, ${total} mensagens não lidas` : 'Conversa');
    }
  }

  function render() {
    if (!estado) return;
    const eu = idxVoce();
    if (eu >= 0 && estado.jogadores[eu]) estado.jogadores[eu].cartas = estado.mao.length;
    app.classList.toggle('modo-observador', !!estado.observador);
    app.classList.toggle('pausado', !!estado.pausado);
    renderTopo();
    renderAssentos();
    renderCentro();
    renderAcoes();
    renderMao();
    renderPausa();
    renderBandeja();
    renderSelo();
    requestAnimationFrame(() => {
      desenharTrilho();
      posicionarPeao();
      medirMao();
    });
  }

  function medirMao() {
    app.style.setProperty('--hand-h', `${Math.round(maoWrap.offsetHeight)}px`);
  }

  function desenharTrilho() {
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
    $('#trilho').setAttribute('viewBox', `0 0 ${w} ${h}`);
    trilhoBase.setAttribute('d', d);
    trilhoLuz.setAttribute('d', d);
  }

  function garantirPeao() {
    if (peaoEl) return peaoEl;
    peaoEl = document.createElement('div');
    peaoEl.className = 'peao';
    peaoEl.hidden = true;
    peaoEl.setAttribute('aria-hidden', 'true');
    mesaEl.appendChild(peaoEl);
    return peaoEl;
  }

  function posicionarPeao() {
    if (!estado) return;
    const token = garantirPeao();
    const idx = estado.turno;
    if (idx == null || idx < 0 || !estado.jogadores[idx]) {
      token.hidden = true;
      brilhoVez.style.opacity = '0';
      return;
    }
    const assento = assentosEl.children[idx];
    if (!assento) {
      token.hidden = true;
      return;
    }
    const mr = mesaEl.getBoundingClientRect();
    const ar = assento.getBoundingClientRect();
    const cx = ar.left - mr.left + ar.width / 2;
    const cy = ar.top - mr.top + ar.height / 2;
    const comprimento = trilhoBase.getTotalLength();
    if (!comprimento) return;

    let melhor = 0;
    let melhorDist = Infinity;
    const amostras = 360;
    for (let i = 0; i < amostras; i += 1) {
      const t = (comprimento * i) / amostras;
      const p = trilhoBase.getPointAtLength(t);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = dx * dx + dy * dy;
      if (dist < melhorDist) {
        melhorDist = dist;
        melhor = t;
      }
    }

    const passo = 0.6;
    const p1 = trilhoBase.getPointAtLength((melhor - passo + comprimento) % comprimento);
    const p2 = trilhoBase.getPointAtLength((melhor + passo) % comprimento);
    let tx = p2.x - p1.x;
    let ty = p2.y - p1.y;
    const tam = Math.hypot(tx, ty) || 1;
    tx /= tam;
    ty /= tam;
    const desvio = (Math.abs(tx) * ar.width + Math.abs(ty) * ar.height) / 2 + 4;
    const sinal = estado.direcao < 0 ? -1 : 1;
    const t = (melhor + sinal * desvio + comprimento) % comprimento;
    const p = trilhoBase.getPointAtLength(t);

    if (!peaoPosicionado) token.style.transition = 'none';
    token.hidden = false;
    token.style.left = `${p.x}px`;
    token.style.top = `${p.y}px`;
    if (!peaoPosicionado) {
      void token.offsetWidth;
      token.style.transition = '';
      peaoPosicionado = true;
    }
    brilhoVez.style.left = `${p.x}px`;
    brilhoVez.style.top = `${p.y}px`;
    brilhoVez.style.opacity = '1';
  }

  function aoRedimensionar() {
    desenharTrilho();
    posicionarPeao();
    medirMao();
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
    fecharBandejaReacoes();
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
      if (opts.aoFechar) {
        opts.aoFechar();
      } else if (anterior && anterior.isConnected) {
        try { anterior.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
      }
    };
    modal = { scrim, caixa, fechar };
    scrim.addEventListener('mousedown', (ev) => {
      if (ev.target === scrim) fechar();
    });
    const alvo = (opts.focoSeletor && caixa && caixa.querySelector(opts.focoSeletor))
      || (caixa && caixa.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled])'))
      || caixa;
    if (alvo && alvo.focus) requestAnimationFrame(() => alvo.focus({ preventScroll: true }));
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
      aoFechar: () => { if (estado && estado.rota === 'cor') irPara('mesa'); }
    });
  }

  function abrirModalResultado() {
    if (!estado || !estado.resultado) return;
    const r = estado.resultado;
    const tid = `res-titulo-${++uid}`;
    const linhas = r.placar.map((l) => `<div class="placar-linha${l.venceu ? ' vencedor' : ''}">
      <span class="placar-nome">${esc(l.nome)}</span>
      <span class="placar-pontos" aria-label="${l.rodadas} rodadas vencidas">${l.rodadas}</span>
    </div>`).join('');
    abrirModal(`<div class="modal modal--resultado" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div class="resultado-topo">
          <span class="resultado-coroa" aria-hidden="true">${icone('ic-coroa')}</span>
          <p class="resultado-rotulo">${esc(r.rotulo)}</p>
          <h2 class="resultado-titulo" id="${tid}">${esc(r.titulo)}</h2>
          <p class="resultado-sub">${esc(r.sub)}</p>
        </div>
        <button class="modal-fechar" type="button" data-acao="fechar-resultado" aria-label="Fechar resultado">${icone('ic-fechar')}</button>
      </div>
      <p class="modal-sub" style="text-align:left">Rodadas vencidas</p>
      <div class="placar-lista">${linhas}</div>
      <div class="resultado-botoes">
        <button class="botao botao--primario" type="button" data-acao="jogar-de-novo">Jogar de novo</button>
        <button class="botao botao--secundario" type="button" data-acao="fechar-resultado">Fechar</button>
      </div>
    </div>`, {
      focoSeletor: '[data-acao="jogar-de-novo"]',
      aoFechar: () => { if (estado && estado.rota === 'resultado') irPara('mesa'); }
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
      : atual
        ? 'Na vez'
        : j.voce
          ? 'Sua mão'
          : 'Aguardando a vez';
    const texto = j.voce
      ? 'Esta é a sua mão. Só você vê estas cartas.'
      : j.status === 'offline'
        ? 'A mesa espera a conexão voltar. Ninguém perde a vez.'
        : 'Só a quantidade de cartas é pública. O conteúdo da mão é privado.';
    abrirModal(`<div class="modal" aria-labelledby="${tid}">
      <div class="modal-topo">
        <div class="assento-modal" style="flex:1 1 auto">
          <div class="assento-modal-topo">
            <span class="avatar" aria-hidden="true">${esc(j.iniciais)}</span>
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
      <div class="modal-acoes">
        <button class="botao botao--secundario" type="button" data-acao="fechar-modal">Fechar</button>
      </div>
    </div>`, { focoSeletor: '[data-acao="fechar-modal"]' });
  }

  function renderBandejaReacoes() {
    if (!reacoesGrade) return;
    reacoesGrade.innerHTML = Object.entries(REACOES).map(([id, r]) =>
      `<button class="reacao-btn" type="button" data-reacao="${id}" aria-label="Reagir: ${esc(r.rotulo)}"><span class="reacao-glifo" aria-hidden="true">${r.emoji}</span><span class="reacao-btn-rotulo">${esc(r.rotulo)}</span></button>`
    ).join('');
  }

  function abrirBandejaReacoes() {
    if (!reacoesBandeja || bandejaReacoesAberta) return;
    bandejaFoco = document.activeElement;
    reacoesBandeja.hidden = false;
    bandejaReacoesAberta = true;
    barraReagir.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      const b = reacoesGrade.querySelector('.reacao-btn');
      if (b) b.focus({ preventScroll: true });
    });
  }

  function fecharBandejaReacoes(opts = {}) {
    if (!bandejaReacoesAberta) return;
    bandejaReacoesAberta = false;
    reacoesBandeja.hidden = true;
    barraReagir.setAttribute('aria-expanded', 'false');
    const foco = bandejaFoco;
    bandejaFoco = null;
    if (opts.foco && foco && foco.isConnected) {
      try { foco.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
    }
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

  function fecharReacao() {
    if (!reacaoAtual) return;
    const wrap = reacaoAtual.el;
    reacaoAtual = null;
    limparTimersReacao();
    if (!wrap) return;
    wrap.classList.add('reacao--saindo');
    const remover = () => { if (wrap.isConnected) wrap.remove(); };
    wrap.addEventListener('animationend', (ev) => {
      if (ev.target === wrap) remover();
    });
    setTimeout(remover, 420);
  }

  function mostrarReacao(dados = {}) {
    const tipo = REACOES[dados.tipo] ? dados.tipo : REACAO_PADRAO;
    const info = REACOES[tipo];
    const autor = dados.autor || 'Você';
    const fixa = Boolean(dados.fixa);
    removerReacao();
    const wrap = document.createElement('div');
    wrap.className = `reacao${fixa ? ' reacao--fixa' : ''}`;
    wrap.innerHTML = `<div class="reacao-palco">
        <span class="reacao-faisca reacao-faisca--a" aria-hidden="true">${info.emoji}</span>
        <span class="reacao-faisca reacao-faisca--b" aria-hidden="true">${info.emoji}</span>
        <span class="reacao-faisca reacao-faisca--c" aria-hidden="true">${info.emoji}</span>
        <div class="reacao-emoji" aria-hidden="true">${info.emoji}</div>
        <p class="reacao-nome"><strong>${esc(autor)}</strong><span class="reacao-ponto" aria-hidden="true">·</span>${esc(info.rotulo)}</p>
      </div>`;
    overlays.appendChild(wrap);
    reacaoAtual = { el: wrap };
    anunciar(`${autor} reagiu: “${info.rotulo}”. Todos na mesa veem.`);
    if (!fixa) reacaoTimers.push(setTimeout(fecharReacao, 2700));
  }

  function abrirGaveta(aba = 'conversa', opts = {}) {
    fecharBandejaReacoes();
    const foco = opts.foco !== false;
    const alvo = aba === 'mesa' ? 'sala' : aba;
    abaGaveta = ABAS.some((a) => a.id === alvo) ? alvo : 'conversa';
    if (!gavetaAberta) gavetaAbridor = document.activeElement;
    gavetaAberta = true;
    gaveta.classList.add('aberta');
    gaveta.setAttribute('aria-hidden', 'false');
    gavetaScrim.hidden = false;
    renderAbas();
    renderCorpo();
    if (foco) {
      requestAnimationFrame(() => {
        const t = gavetaAbas.querySelector('[aria-selected="true"]');
        (t || gavetaFechar).focus({ preventScroll: true });
      });
    }
  }

  function fecharGaveta(opts = {}) {
    if (!gavetaAberta) return;
    gavetaAberta = false;
    gaveta.classList.remove('aberta');
    gaveta.setAttribute('aria-hidden', 'true');
    gavetaScrim.hidden = true;
    const abridor = gavetaAbridor;
    gavetaAbridor = null;
    if (opts.silencioso) return;
    if (estado && estado.rota === 'conversa') {
      irPara('mesa');
      setTimeout(() => {
        const b = document.querySelector('[data-abrir="conversa"]');
        if (b) b.focus({ preventScroll: true });
      }, 90);
    } else if (abridor && abridor.isConnected) {
      try { abridor.focus({ preventScroll: true }); } catch (erro) { /* ignora */ }
    }
  }

  function renderAbas() {
    if (!estado) return;
    gavetaAbas.innerHTML = ABAS.map((a) => {
      const ativa = a.id === abaGaveta;
      const selo = a.id === 'conversa' && estado.naoLidas > 0
        ? `<span class="selo">${estado.naoLidas}</span>`
        : '';
      return `<button class="aba${ativa ? ' ativa' : ''}" type="button" role="tab" id="aba-${a.id}" aria-controls="gaveta-corpo" aria-selected="${ativa}" tabindex="${ativa ? 0 : -1}" data-tab="${a.id}">
        ${icone(a.icone)}<span>${a.rotulo}</span>${selo}
      </button>`;
    }).join('');
  }

  function conteudoConversa() {
    const lista = estado.mensagens.length
      ? estado.mensagens.map((m) => `<div class="msg${m.voce ? ' msg--voce' : ''}">
          <div class="msg-linha"><span class="msg-autor">${esc(m.autor)}</span><span class="msg-hora">${esc(m.hora)}</span></div>
          <p class="msg-texto">${esc(m.texto)}</p>
        </div>`).join('')
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

  function conteudoSala() {
    const linhas = estado.jogadores.map((j) => {
      const ultima = j.cartas === 1 && j.avisou && j.status !== 'offline';
      const tag = j.status === 'offline' ? 'caiu' : ultima ? 'última' : plural(j.cartas);
      return `<div class="jogador">
      <span class="avatar" aria-hidden="true">${esc(j.iniciais)}</span>
      <span class="jogador-nome">${esc(j.nome)}${j.voce ? ' (você)' : ''}</span>
      <span class="jogador-tag${ultima ? ' jogador-tag--ultima' : ''}">${tag}</span>
      <span class="jogador-pontos">${j.cartas}</span>
    </div>`;
    }).join('');
    return `<div class="mesa-info">
      <div class="mesa-codigo">
        <div><span>Código da sala</span><br><strong>${esc(estado.sala.codigo)}</strong></div>
        <button class="botao botao--secundario" type="button" data-acao="copiar">Copiar convite</button>
      </div>
      <div>
        <p class="campo-rotulo">Na mesa · ${estado.jogadores.length} jogadores</p>
        <div class="jogadores-lista">${linhas}</div>
      </div>
      <div class="mesa-botoes">
        <button class="botao botao--secundario" type="button" data-acao="copiar">Convidar alguém</button>
        <button class="botao botao--perigo" type="button" data-acao="sair">Sair da sala</button>
      </div>
      <details class="regras">
        <summary>Resumo das regras</summary>
        <p>Combine por <strong>cor, número ou símbolo</strong>. Bloqueio pula a pessoa seguinte. Inversão troca o sentido. Compra 2 e Compra 4 fazem a pessoa seguinte comprar e perder a vez. Coringa escolhe a cor. Quem fica sem cartas vence a rodada.</p>
        <p>Antes do último descarte, avise <strong>Última carta</strong>. Quem não avisar pode ser denunciado e compra duas.</p>
      </details>
      <p class="dica">Observadores: 2 · a próxima rodada começa quando esta terminar.</p>
    </div>`;
  }

  function renderCorpo() {
    if (!estado) return;
    const rotulos = { conversa: 'Conversa', historico: 'Histórico', sala: `Sala da ${estado.sala.nome.replace(/^Sala da /, '')}` };
    gavetaTitulo.textContent = rotulos[abaGaveta] || 'Conversa';
    gavetaCorpo.setAttribute('aria-labelledby', `aba-${abaGaveta}`);
    if (abaGaveta === 'conversa') gavetaCorpo.innerHTML = conteudoConversa();
    else if (abaGaveta === 'historico') gavetaCorpo.innerHTML = conteudoHistorico();
    else gavetaCorpo.innerHTML = conteudoSala();
    if (abaGaveta === 'conversa') {
      requestAnimationFrame(() => { gavetaCorpo.scrollTop = gavetaCorpo.scrollHeight; });
    } else {
      gavetaCorpo.scrollTop = 0;
    }
  }

  function trocarAba(id, opts = {}) {
    if (!ABAS.some((a) => a.id === id) || id === abaGaveta) {
      if (opts.foco) {
        const atual = gavetaAbas.querySelector(`[data-tab="${id}"]`);
        if (atual) atual.focus();
      }
      return;
    }
    abaGaveta = id;
    renderAbas();
    renderCorpo();
    if (opts.foco) {
      const t = gavetaAbas.querySelector(`[data-tab="${id}"]`);
      if (t) t.focus({ preventScroll: true });
    }
  }

  function enviarMensagem(texto) {
    const limpo = String(texto || '').trim().slice(0, 240);
    if (!limpo) return;
    estado.mensagens.push({ autor: 'Você', hora: horaAgora(), texto: limpo, voce: true });
    estado.naoLidas = 0;
    renderSelo();
    renderAbas();
    renderCorpo();
    anunciar('Mensagem enviada para a mesa.');
    requestAnimationFrame(() => {
      const campo = document.getElementById('chat-campo');
      if (campo) campo.focus({ preventScroll: true });
    });
  }

  async function copiarConvite() {
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
    estado.rota = 'mesa';
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
    estado.rota = 'mesa';
    finalizarRota('mesa');
    mostrarToast(`Você passou. Vez de ${nomeVez()}.`);
    anunciar(`Você passou. Vez de ${nomeVez()}.`);
  }

  function selecionarCarta(id) {
    if (!estado) return;
    const indice = estado.mao.findIndex((c) => c.id === id);
    if (indice < 0) return;
    const c = estado.mao[indice];
    if (estado.observador) {
      mostrarToast('Você está observando esta rodada.');
      return;
    }
    if (estado.pausado) {
      mostrarToast('A rodada está pausada.');
      return;
    }
    if (!minhaVez()) {
      mostrarToast(`Aguarde a vez de ${nomeVez()}.`);
      return;
    }
    if (!combina(c)) {
      const d = estado.descarte;
      mostrarToast(`${falaCarta(c)} não combina com a mesa (${falaCarta(d)}). Use cor, número ou símbolo.`);
      anunciar(`${falaCarta(c)} não combina com a mesa. Use cor, número ou símbolo.`);
      return;
    }
    selecaoPendente = indice;
    irPara('carta');
  }

  function cancelarJogada() {
    if (!estado) return;
    selecaoPendente = null;
    estado.selecionado = null;
    finalizarRota('mesa');
    mostrarToast('Jogada cancelada.');
  }

  function confirmarJogada() {
    if (!estado) return;
    const c = estado.mao.find((x) => x.id === estado.selecionado);
    if (!c) {
      irPara('mesa');
      return;
    }
    if (c.tipo === 'coringa' || c.tipo === 'compra4') {
      selecaoPendente = estado.mao.indexOf(c);
      irPara('cor');
      return;
    }
    const eu = idxVoce();
    estado.mao = estado.mao.filter((x) => x.id !== c.id);
    estado.descarte = c;
    estado.corAtiva = c.cor;
    estado.selecionado = null;
    estado.comprada = false;
    estado.compradaId = null;
    if (eu >= 0) {
      estado.jogadores[eu].cartas = estado.mao.length;
      estado.jogadores[eu].avisou = estado.mao.length !== 1;
    }
    avancarTurno();
    estado.rota = 'mesa';
    finalizarRota('mesa');
    mostrarToast(`Você jogou ${falaCarta(c)}. Vez de ${nomeVez()}.`);
    anunciar(`Você jogou ${falaCarta(c)}. Restam ${estado.mao.length} cartas na sua mão. Vez de ${nomeVez()}.`);
  }

  function escolherCor(cor) {
    if (!estado || !CORES[cor] || estado.rota !== 'cor') return;
    const c = estado.mao.find((x) => x.id === estado.selecionado)
      || estado.mao.find((x) => x.tipo === 'coringa' || x.tipo === 'compra4');
    if (!c) {
      fecharModal({ silencioso: true });
      irPara('mesa');
      return;
    }
    fecharModal({ silencioso: true });
    estado.mao = estado.mao.filter((x) => x.id !== c.id);
    estado.descarte = c;
    estado.corAtiva = cor;
    estado.selecionado = null;
    estado.comprada = false;
    estado.compradaId = null;
    const eu = idxVoce();
    if (eu >= 0) {
      estado.jogadores[eu].cartas = estado.mao.length;
      estado.jogadores[eu].avisou = estado.mao.length !== 1;
    }
    avancarTurno();
    estado.rota = 'mesa';
    finalizarRota('mesa');
    mostrarToast(`Cor ${CORES[cor].nome.toLowerCase()} escolhida. Vez de ${nomeVez()}.`);
    anunciar(`Você jogou ${falaCarta(c)} e escolheu ${CORES[cor].nome}. Vez de ${nomeVez()}.`);
  }

  function avisarUltima() {
    const eu = idxVoce();
    if (!estado || eu < 0) return;
    if (estado.mao.length > 1) {
      mostrarToast('O aviso “Última carta” vale quando sobra uma carta na mão.');
      return;
    }
    estado.jogadores[eu].avisou = true;
    render();
    mostrarToast('Você avisou “Última carta”.');
    anunciar('Você avisou última carta.');
  }

  function denunciar() {
    if (!estado) return;
    const alvo = estado.jogadores.find((j) => !j.voce && j.cartas === 1 && !j.avisou && j.status !== 'offline');
    if (!alvo) return;
    alvo.cartas += 2;
    alvo.avisou = true;
    estado.eventos.push({ hora: horaAgora(), texto: `<strong>${esc(alvo.nome)}</strong> não avisou “Última carta” e comprou duas.` });
    render();
    mostrarToast(`${alvo.nome} comprou 2 cartas por não avisar “Última carta”.`);
    anunciar(`${alvo.nome} comprou duas cartas por não avisar última carta.`);
  }

  function entrarNaFila() {
    if (!estado || !estado.observador) return;
    estado.naFila = true;
    render();
    mostrarToast('Você está na fila. Avisamos quando a rodada terminar.');
    anunciar('Você entrou na fila da próxima rodada.');
  }

  function finalizarRota(rota) {
    if (!estado) return;
    estado.rota = rota;
    if (location.hash !== `#${rota}`) {
      suprimirRota = true;
      location.hash = rota;
    }
    render();
    requestAnimationFrame(aoRedimensionar);
  }

  function irPara(rota, opts = {}) {
    if (!estado) return;
    const alvo = `#${rota}`;
    if (opts.manterEstado) {
      finalizarRota(rota);
      return;
    }
    if (location.hash === alvo) {
      aplicar(false);
      return;
    }
    location.hash = rota;
  }

  function fecharTudo() {
    fecharModal({ silencioso: true });
    removerReacao();
    fecharBandejaReacoes();
    fecharGaveta({ silencioso: true });
    esconderToast();
  }

  function tituloRota(rota) {
    const titulos = {
      mesa: 'sua vez',
      'mesa-cheia': 'mesa cheia',
      inversao: 'inversão',
      carta: 'confirmar jogada',
      cor: 'escolher cor',
      conversa: 'conversa',
      observador: 'observando',
      pausada: 'rodada pausada',
      reacao: 'reação',
      resultado: 'resultado'
    };
    return titulos[rota] || 'mesa';
  }

  function aplicar(inicial = false) {
    const rota = rotaAtual();
    fecharTudo();
    estado = (CENARIOS[rota] || CENARIOS.mesa)();
    estado.rota = rota;

    if (rota === 'carta') {
      let indice = Number.isInteger(selecaoPendente) ? selecaoPendente : 0;
      if (!estado.mao[indice]) indice = 0;
      estado.selecionado = estado.mao[indice] ? estado.mao[indice].id : null;
    }
    if (rota === 'cor') {
      const curinga = estado.mao.find((c) => c.tipo === 'coringa' || c.tipo === 'compra4');
      estado.selecionado = curinga ? curinga.id : null;
    }
    selecaoPendente = null;

    render();

    if (rota === 'conversa') abrirGaveta('conversa');
    if (rota === 'cor') abrirModalCor();
    if (rota === 'resultado') abrirModalResultado();
    if (rota === 'reacao') {
      mostrarReacao(Object.assign({ tipo: 'toma-essa', autor: 'Nena' }, estado.reacao || {}, { fixa: true }));
    }

    if (!inicial) {
      if (rota === 'carta') {
        requestAnimationFrame(() => {
          const b = bandejaEl.querySelector('[data-acao="confirmar-jogada"]');
          if (b) b.focus({ preventScroll: true });
        });
      }
      if (rota === 'pausada') {
        requestAnimationFrame(() => {
          const b = pausaEl.querySelector('button');
          if (b) b.focus({ preventScroll: true });
        });
      }
      if (rota === 'observador') {
        requestAnimationFrame(() => {
          const b = acoesEl.querySelector('button');
          if (b) b.focus({ preventScroll: true });
        });
      }
    }

    if (estado.toast) mostrarToast(estado.toast, 6000);
    anunciar(estado.anuncio);
    document.title = `Tretta — ${tituloRota(rota)}`;
  }

  function tratarAcao(botao) {
    const acao = botao.dataset.acao;
    switch (acao) {
      case 'comprar': comprarCarta(); break;
      case 'passar': passarVez(); break;
      case 'denunciar': denunciar(); break;
      case 'avisar-ultima': avisarUltima(); break;
      case 'entrar-fila': entrarNaFila(); break;
      case 'voltar-jogo': irPara('mesa'); break;
      case 'ver-resultado': abrirModalResultado(); break;
      case 'confirmar-jogada': confirmarJogada(); break;
      case 'cancelar-jogada': cancelarJogada(); break;
      case 'cancelar-cor': fecharModal(); break;
      case 'fechar-resultado': fecharModal(); break;
      case 'jogar-de-novo': fecharModal({ silencioso: true }); irPara('mesa'); break;
      case 'fechar-modal': fecharModal(); break;
      case 'copiar': copiarConvite(); break;
      case 'sair': {
        fecharGaveta({ silencioso: true });
        mostrarToast('Saída simulada nesta demonstração. A mesa continua.');
        break;
      }
      default: break;
    }
  }

  document.addEventListener('click', (ev) => {
    if (bandejaReacoesAberta && !ev.target.closest('#reacoes-bandeja') && !ev.target.closest('#barra-reagir')) {
      fecharBandejaReacoes();
    }
    const botaoAcao = ev.target.closest('[data-acao]');
    if (botaoAcao) {
      tratarAcao(botaoAcao);
      return;
    }
    const card = ev.target.closest('[data-carta]');
    if (card && maoEl.contains(card)) {
      selecionarCarta(card.dataset.carta);
      return;
    }
    const assento = ev.target.closest('[data-jogador]');
    if (assento) {
      abrirModalAssento(assento.dataset.jogador);
      return;
    }
    const abrir = ev.target.closest('[data-abrir]');
    if (abrir) {
      abrirGaveta(abrir.dataset.abrir);
      return;
    }
    const aba = ev.target.closest('[data-tab]');
    if (aba) {
      trocarAba(aba.dataset.tab, { foco: true });
      return;
    }
    const cor = ev.target.closest('[data-cor]');
    if (cor && cor.classList.contains('cor-opcao')) {
      escolherCor(cor.dataset.cor);
      return;
    }
    const reacao = ev.target.closest('[data-reacao]');
    if (reacao) {
      const tipo = reacao.dataset.reacao;
      const info = REACOES[tipo] || REACOES[REACAO_PADRAO];
      fecharBandejaReacoes({ foco: true });
      mostrarReacao({ tipo, autor: 'Você' });
      if (estado) {
        estado.eventos.push({
          hora: horaAgora(),
          texto: `Você reagiu com <strong>${esc(info.rotulo)}</strong>.`
        });
      }
      return;
    }
    if (ev.target === gavetaScrim) fecharGaveta();
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('#chat-form');
    if (!form) return;
    ev.preventDefault();
    const campo = form.querySelector('#chat-campo');
    enviarMensagem(campo ? campo.value : '');
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (bandejaReacoesAberta) { ev.preventDefault(); fecharBandejaReacoes({ foco: true }); return; }
      if (modal) { ev.preventDefault(); fecharModal(); return; }
      if (gavetaAberta) { ev.preventDefault(); fecharGaveta(); return; }
      if (estado && estado.rota === 'carta') { ev.preventDefault(); cancelarJogada(); return; }
    }
    if (ev.key === 'Tab') {
      const container = modal ? modal.scrim : gavetaAberta ? gaveta : null;
      if (container) trapTab(container, ev);
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

  barraReagir.addEventListener('click', () => {
    if (bandejaReacoesAberta) fecharBandejaReacoes({ foco: true });
    else abrirBandejaReacoes();
  });

  renderBandejaReacoes();

  let rafMedida = 0;
  function agendarMedida() {
    cancelAnimationFrame(rafMedida);
    rafMedida = requestAnimationFrame(aoRedimensionar);
  }

  window.addEventListener('resize', agendarMedida);
  if ('ResizeObserver' in window) {
    const observador = new ResizeObserver(agendarMedida);
    observador.observe(mesaEl);
    observador.observe(maoWrap);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(agendarMedida).catch(() => {});
  }

  window.addEventListener('hashchange', () => {
    if (suprimirRota) {
      suprimirRota = false;
      return;
    }
    aplicar(false);
  });

  const hashInicial = location.hash.replace(/^#/, '');
  if (!hashInicial || !(ROTAS.includes(hashInicial) || hashInicial === 'provocacao')) {
    try { history.replaceState(null, '', '#mesa'); } catch (erro) { /* hash opcional */ }
  }
  aplicar(true);
})();
