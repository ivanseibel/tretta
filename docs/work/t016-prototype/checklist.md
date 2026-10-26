# Checklist de requisitos — protótipo Tretta

Arquivos: `index.html`, `assets/app.css`, `assets/app.js`, `assets/fonts/fraunces.woff2`, `assets/fonts/atkinson.woff2`. Copie o conjunto inteiro para abrir em qualquer navegador; não há build.

## 1. Produto e regras representadas

| Requisito | Onde está |
| --- | --- |
| Baralho de quatro cores, 0–9, Bloqueio, Inversão, Compra 2, Coringa e Compra 4 | `carta()` e `ICONE_TIPO` em `assets/app.js`; desenho em `cartaHtml()` |
| Sete cartas iniciais e descarte numérico | `cenarioMesa()`: mão de sete cartas, descarte vermelho 6 |
| Vez sorteada, sentido horário inicial | `estado.turno`, `estado.direcao`; `renderTopo()` e placa `sentido` |
| Combinar por cor, número ou símbolo | `combina()` em `assets/app.js` |
| Comprar e depois jogar ou passar | `comprarCarta()` libera “Passar”; `passarVez()` só age depois da compra |
| Bloqueio, Inversão, Compra 2, Compra 4, Coringa | faces de carta e regras na aba Sala; pilha de compra em `comprarCarta()` |
| Mão privada, só a quantidade é pública | assentos mostram apenas `.conta-num`; a mão fica em `#mao` |
| Terminar as cartas vence e há placar | estado `#resultado` com `.placar-lista` |
| Avisar “Última carta” e denunciar | `avisarUltima()` (contextual, com uma carta) e `denunciar()`/botão Denunciar em `#mesa-cheia` |
| Reagir com emoji | bandeja `#reacoes-bandeja` na barra inferior; doze reações com emoji + frase, um toque lança e todos veem |
| Ordem e sentido, sem prometer o próximo | trilho, peão e placa; nenhum texto de “próximo jogador” |

## 2. Público, dispositivos e mesa

| Requisito | Onde está |
| --- | --- |
| Celular como principal, uso a uma mão | layout em coluna, mão ao alcance, alvos ≥44px |
| 412×915 de referência | `--card-w`/`--discard-w` completo; mesa com oito assentos |
| 430×932 | mesmas faixas com `min-width: 480px` |
| Mínimo 360×640 | consulta `max-height: 780px` em `assets/app.css`; topo 48, ações 44, cartas 72–88 |
| Desktop 1280×800 | `min-width: 900px`: mão em uma fileira, mesa até 1040px |
| Salas de 2 a 8 pessoas | `slot-0` a `slot-7`; estados com 4, 8 e 8 assentos |
| Mesa de 8 sem esconder ninguém | `#mesa-cheia`, `#inversao` e `#observador` usam os oito slots |
| Nomes longos | “Tio Juca do Sítio” e “Fernanda Albuquerque”; reticências de uma linha no assento e nome completo no diálogo do assento |
| Observadores | `#observador`, sem mão e com fila |
| Bots substitutos | fora dos dez estados obrigatórios; o modelo de assento aceita um jogador sem mão local, mas não há estado de bot no protótipo |
| Pessoa desconectada | `#pausada`: assento de Bia tracejado, etiqueta “caiu” e cartão de pausa |

## 3. Entendimento em cinco segundos

| Informação | Onde está |
| --- | --- |
| De quem é a vez | `.vez-nome` (20px) + `.tag-na-vez` no cabeçalho e no assento; `.assento[aria-current="true"]`; `#live` |
| Sentido da rodada | `.sentido-placa`: rótulo “sentido” + valor 18px, com roseta |
| Ordem e passagem | `.trilho` de latão + `.peao` no vão do assento ativo; assentos fixos |
| Quantas cartas cada jogador tem | `.conta-num` 26px + `.conta-rot` 14px em cada assento |
| Quem avisou “Última carta” | etiqueta `.tag-ultima` no assento, anel `.assento.ultima` e status no diálogo/Sala |
| Carta do descarte | `.carta--descarte` à direita do monte, com número ampliado |
| Cor ativa | `.cor-ativa` com nome e forma |
| Ações disponíveis | `#acoes` (Comprar, Passar, Denunciar, Entrar na fila, Ver placar), o monte clicável e “Reagir” na barra inferior |
| Cartas da mão | `#mao`, cartas de 72px ou mais, com nome da cor e número/figura |

## 4. Layout e leitura

### Uma tela sem rolagem

- `.app` usa `height: 100dvh` e `overflow: hidden`; a mesa é a faixa `1fr`.
- 412×915 e 360×640: topo, mesa, ações, mão e barra da gaveta cabem; a consulta `max-height: 780px` compacta sem reduzir fontes abaixo dos pisos.
- Abaixo de 360×640 ou de 600px de altura, `@media (max-height: 600px)` permite rolagem como exceção.
- `.mao-wrap` só rola quando passa de oito cartas (`.mao--rolagem`); a página não rola.
- `.bandeja` é absoluta acima da mão; confirmar não altera a altura da mesa.
- `.gaveta` é `position: fixed`; abrir e fechar não altera a altura da mesa.

### Os oito assentos

- `slot-0` a `slot-7` em `.assentos`; `#mesa-cheia`, `#inversao` e `#observador` mostram os oito.
- Cada assento é um `<button>` com avatar, apelido e quantidade.
- Apelidos usam `.assento-nome` com reticências; o nome completo abre em `abrirModalAssento()`.
- Quantidade, vez e sentido usam `white-space: nowrap` e não são truncados.
- A vez tem destaque textual e visual: etiqueta “na vez”, placa de latão, `aria-current="true"` e anúncio em `#live`.
- Quem avisou “Última carta” recebe a etiqueta `última` no assento (no lugar de “cartas”), anel amarelo e o mesmo status no diálogo e na lista da Sala; o `aria-label` também anuncia o aviso.
- A Inversão mantém os assentos nas mesmas posições; só o peão troca de lado e a placa muda.

### Pisos de tipo

| Elemento | Piso | Token/seletor |
| --- | --- | --- |
| Vez | 20px | `--fs-20` em `.vez-nome` |
| Sentido | 18px | `--fs-18` em `.sentido-valor` |
| Quantidade | 26px + 14px | `--fs-26`/`--fs-14` em `.conta-num`/`.conta-rot` |
| Nome do jogador | 16px | `--fs-16` em `.assento-nome` |
| Nome na carta | 14px | `--fs-14` em `.carta-nome` |
| Rótulo “cor ativa” | 14px | `--fs-14` em `.cor-rotulo` |
| Corpo, ações e rótulos | 16px | `--fs-16` em `.botao`, `.acoes-status`, `.campo-rotulo`, `.msg-texto` etc. |
| Etiqueta “na vez” | 14px | `--fs-14` em `.tag-na-vez` |

- Carta da mão: `--card-w` tem mínimo 72px.
- Alvos de toque: `.botao`, `.barra-item`, `.aba`, `.assento`, `.monte`, `.reacao-btn` e `.cor-opcao` têm 44px ou mais; a mão tem vão de 8px.
- Contraste declarado: creme/feltro 10,69; tinta/latão 8,57; creme/vermelho 4,71; creme/verde 5,10; creme/azul 5,74; tinta/creme 15,65; borda #8A6234/creme 4,66; borda secundária brass-deep/página 5,02; foco/feltro 7,78; foco/madeira 9,05.
- Cor nunca é o único indicador: nome da cor nas cartas, forma no canto, forma e nome na cor ativa e nas opções do coringa.
- Sem caixa alta em texto funcional e sem texto sobre o grão do feltro.

### Mão

- 412×915: quatro colunas, duas fileiras para até oito cartas (7 no estado principal).
- 360×640: mesma grade, cartas de 72–77px.
- Acima de oito: `.mao--rolagem` rola somente a mão.
- 1280×800: `min-width: 900px` coloca oito cartas em uma fileira, centralizadas.
- A barra de confirmação e a mão nunca saem da tela; a barra é sobreposição.

### Centro

- Descarte à direita (`--discard-w`, 72–94px), legível e com número ampliado.
- Monte à esquerda, com carta fechada e quantidade em numeral 26px + “cartas”; sem rótulo “monte”.
- Cor ativa com nome e forma, em `.cor-ativa`.
- Sem rótulos “monte” e “descarte”: a carta fechada e a carta virada bastam.
- Ações principais em `#acoes`, com “Comprar” e “Passar” no estado 1, escolha de cor no estado 5, denúncia no estado 2.

### Conteúdo secundário

- `.gaveta-barra` abre a gaveta em um toque; abas Conversa, Histórico e Sala. O item “Reagir” abre a bandeja de emojis.
- O botão “Sala” no topo esquerdo abre a gaveta na aba Sala (código, jogadores, regras e convite).
- Selo de não lidas em `#selo-conversa` e na aba Conversa.
- Chat com mensagens, campo rotulado e botão Enviar; o chat é alcançável sem rolar a página.
- Histórico de eventos; mesa com código, jogadores, regras e convite.
- A bandeja `.reacoes-bandeja` fica acima da barra inferior, em grade 4×3 com botões de 80px (emoji de 26px e frase de 14px); abre por um toque, fecha ao lançar, no Esc ou ao tocar fora.
- A reação é `.reacao` fixa e sem fundo escurecido: emoji de ≈100px, anel, faíscas e pílula “quem · reação”. Entra com animação, some em cerca de 3s com saída suave e não recebe foco (`pointer-events: none`).
- Os doze emojis são nativos da plataforma (`--fonte-emoji`, Apple Color Emoji primeiro), escolhidos pelo usuário; a frase acompanha sempre o emoji e o anúncio em `aria-live` nomeia a reação.
- Toda reação é pública: o anúncio em `aria-live` diz “Todos na mesa veem”, e a rota `#reacao` deixa uma reação fixa para inspeção.

### Acessibilidade de uso

- Foco visível de 3px em `:focus-visible`.
- Ordem de foco: pular → Sala → monte (quando habilitado) → assentos → pausa (quando presente) → ações → cartas da mão → barra da gaveta. Em diálogos e gaveta, o foco fica preso; Escape fecha.
- `aria-live` em `#live` anuncia vez, cor ativa, descarte, compra, inversão e resultado.
- `prefers-reduced-motion` reduz transições; a Inversão é textual.
- Zoom de 200% cai no layout de 640px; abaixo de 600px de altura a rolagem vertical é a exceção prevista.

## 5. Passagem entre jogadores

- `.trilho` é um caminho fechado de latão embutido no feltro; nenhuma seta, chevron ou triângulo entre assentos.
- `.peao` (peão de madeira visto de cima) para no vão ao lado do assento ativo, deslocado no sentido da rodada.
- `.sentido-placa` mostra “sentido” e “horário/anti-horário” em texto de 18px; a roseta gira sem ser a única informação.
- Na Inversão (`#inversao`), o peão troca de lado, a roseta gira, o histórico registra a inversão e um aviso textual aparece; tudo continua legível com movimento reduzido.
- A interface não promete “próximo jogador”; fala de ordem e sentido, porque Bloqueio e compras podem pular gente.

## 6. Dez estados obrigatórios

| # | Rota | O que mostra |
| --- | --- | --- |
| 1 | `#mesa` | 4 jogadores, sua vez, 7 cartas, descarte vermelho 6, cor vermelha |
| 2 | `#mesa-cheia` | 8 jogadores, vez de Rita, Tio Juca com 12 cartas, nomes longos, cor verde |
| 3 | `#inversao` | Inversão azul, sentido anti-horário, peão do outro lado, vez de Léo |
| 4 | `#carta` | Carta selecionada e `.bandeja` de confirmação |
| 5 | `#cor` | Coringa e as quatro cores com nome e forma |
| 6 | `#conversa` | Gaveta de chat aberta, mensagens, campo, selo de não lidas |
| 7 | `#observador` | Observador sem mão, mesa pública, “Aguardando a próxima rodada” |
| 8 | `#pausada` | Rodada pausada, Bia desconectada, sem convite a jogar |
| 9 | `#reacao` | Nena · “Toma essa!”, reação pública sobre a mesa (alias `#provocacao`) |
| 10 | `#resultado` | Vó Cida vencedora, placar de rodadas e “Jogar de novo” |

## 7. Direção de experiência

- Metáfora material: feltro verde, madeira, latão, marfim; sombras e profundidade em `.mesa`, `.assento`, `.carta` e `.pilha`.
- Textura de feltro apenas em `.feltro::after`, atrás de conteúdo, nunca em texto.
- Tipografia expressiva: Fraunces em títulos, números e coringa; Atkinson Hyperlegible Next no corpo.
- Hierarquia: vez e sentido → mesa/descarte → mão → quantidades → gaveta.
- Microinterações curtas no peão, na roseta e na reação; todas com alternativa sem movimento.
- Sem glassmorphism, gradiente roxo, cards genéricos de SaaS ou estética de dashboard.

## 8. Entregáveis

- Protótipo navegável em `index.html` com `assets/app.css` e `assets/app.js`; dez rotas de hash e ações reais.
- Tokens em `:root` no topo de `assets/app.css`: cores, `--fonte-*`, `--fs-11` a `--fs-32`, espaçamento, cartas, raios e sombras.
- `racional.md`: metáfora, hierarquia, leitura de ordem/sentido, Inversão e limites.
- Este `checklist.md`.
- Todo o texto em português do Brasil; dados estáticos; sem backend, login ou dados reais.
- Frames: atendidos pelo protótipo responsivo em 412×915, 1280×800 e 360×640 (estado de 8 jogadores); não há PNGs.

## 9. Critérios de aceite

1. **Leitura sem rolagem em 412×915**: topo com vez/sentido, assentos com quantidades, centro com descarte/cor, ações e mão na mesma tela; o estado `#mesa` é o caso base.
2. **Oito assentos visíveis**: `#mesa-cheia`, `#inversao` e `#observador` usam os oito slots; em 360×640 o layout compacto mantém os três topos, quatro laterais e a base.
3. **Sem rolagem vertical** em 412×915 e 360×640: `.app` tem altura fixa e `overflow: hidden`; a única rolagem interna permitida é a da mão acima de oito cartas.
4. **Desktop com oito cartas em uma fileira**: `@media (min-width: 900px)`; o estado base tem sete, que ficam centralizadas na mesma fileira.
5. **Pisos de fonte, carta e alvo**: tabela da seção 4; cartas ≥72px; botões ≥44px.
6. **Contraste**: valores da seção 4; foco e limites ≥3:1 (anel de 3px em `--focus`).
7. **Passagem como elemento de jogo**: trilho contínuo + peão + placas; nenhuma micro-seta.
8. **Inversão sem animação**: placa textual, histórico e peão do outro lado; a roseta é reforço.
9. **Texto funcional legível**: sem caixa alta, sem textura sob texto, sem sobreposição; nomes longos só encurtam com o nome completo a um toque.
10. **Gaveta em um toque**: `.gaveta-barra` e `#gaveta`; `position: fixed` não altera a mesa.
11. **Parece um jogo**: feltro, madeira, latão, cartas com peso, peão e placas; não há painel de dados.

## 10. O que reprova automaticamente

| Reprovador | Como foi evitado |
| --- | --- |
| Micro-setas/chevrons entre jogadores | nenhum; a passagem é o trilho de latão e o peão |
| Esconder assento ou “ver mais” | todos os slots 0–7 são renderizados; sem lista expansível de jogadores |
| Fonte/contagem/carta abaixo do piso | `--fs-*` e `--card-w` com mínimos; a compactação só ajusta alturas e cartas até 72px |
| Rolagem vertical em 412×915/360×640 | `.app` fixo; teste de encaixe descrito na seção 4 |
| Texto em caixa alta, apertado ou sobre textura | `.feltro` é a única textura e fica atrás de `.centro`/`.assentos`; nenhum `text-transform: uppercase` |
| Depender de cor/som/animação para vez ou sentido | etiqueta, texto, `aria-current`, placa e `aria-live` |
| Layout que muda ao selecionar/abrir gaveta | `.bandeja` absoluta; `.gaveta` fixa |
| Estética de dashboard/glass/roxo/SaaS | mesa material, sem glass nem roxo |
| Transição que só funciona explicada | texto permanente na placa e no histórico; peão é reforço |

## 11. Como abrir e testar

- Abra `index.html` no navegador (a pasta de entrega inclui `assets/`). As rotas podem ser digitadas na barra de endereço.
- Teclado: Tab percorre na ordem documentada; Escape fecha diálogo, bandeja de reações, gaveta ou cancela a seleção.
- Mouse/toque: assentos abrem o nome completo; monte compra; cartas abrem a confirmação; “Reagir” abre a bandeja e cada emoji lança a reação; a gaveta abre em um toque.
- Para ver a mão acima de oito cartas, compre uma carta no estado `#mesa` (a compra adiciona uma e a mão passa a oito) ou edite `cenarioMesa()`; não há backend.
- O estado `#inversao` mostra o texto anti-horário de forma persistente; recarregue a rota para repetir a entrada.
