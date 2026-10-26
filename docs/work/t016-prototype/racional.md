# Racional — a mesa do Tretta

## A direção

Uma mesa de feltro verde-pinheiro sob luz quente de sala. A borda é madeira escura com um trilho de latão embutido, os lugares são placas de madeira e as cartas têm peso de marfim. Um peão de madeira, visto de cima, percorre o trilho e para ao lado de quem joga. O clima é de mesa de família: material, sombra e tempo de conversa, não de painel.

A direção existe para uma pessoa de quase 70 anos, com baixa visão, jogando no celular a 30–40 cm dos olhos. Por isso a mesa é grande, o contraste é alto, as cartas têm nome e forma além da cor, e nada importante fica atrás de textura. O grão do feltro é discreto e só aparece em áreas sem texto.

## Hierarquia

1. **Vez e sentido** ficam no alto. O título tem 20px (“Sua vez” ou “Vez de …”), a etiqueta “na vez” acompanha o assento ativo e a placa de sentido mostra “horário” ou “anti-horário” em 18px, com uma roseta.
2. **Mesa** vem em seguida. O monte fica à esquerda, com a quantidade em numeral de 26px, e o descarte à direita, com o número ampliado; a cor ativa aparece por nome e forma numa placa compacta. Os rótulos “monte” e “descarte” não existem: a carta fechada e a carta virada dizem o que são.
3. **Assentos** mostram apelido em 16px e quantidade em numeral de 26px com o rótulo “cartas” em 14px. Quem está na vez recebe placa de latão, etiqueta textual e `aria-current`.
4. **Ações** ficam logo abaixo da mesa, em 16px, com uma ação principal óbvia.
5. **Sua mão** fecha a hierarquia, com cartas de no mínimo 72px.
6. **Gaveta** é conteúdo secundário: conversa, histórico e sala, a um toque. **Reagir** fica na barra inferior, ao lado delas, e abre uma bandeja com doze reações.

## Como a ordem e a vez são lidas

A ordem não é uma fileira de setas. É um **trilho contínuo de latão embutido no feltro**, desenhado como um caminho fechado que passa por baixo das placas de lugar. Os assentos não se movem quando o sentido muda.

Um **peão de madeira** corre nesse trilho. Ele para no vão ao lado do assento de quem joga, deslocado no sentido da rodada, com um brilho quente sob a base. Quando a rodada inverte, o peão passa para o outro lado do mesmo assento e a roseta da placa gira; o texto “anti-horário” continua visível, sem depender do movimento.

Quem está na vez tem três confirmações: o título “Sua vez”/“Vez de …”, a etiqueta “na vez” presa ao assento e a placa de latão. A região `aria-live` anuncia a vez, a cor ativa e o descarte a cada troca de estado. Não há promessa de “próximo jogador”: a copy fala de ordem e sentido, porque Bloqueio e compras obrigatórias podem pular gente.

Quem avisou **“Última carta”** com uma carta na mão ganha uma etiqueta **“última”** no lugar do rótulo “cartas”, um anel amarelo no assento e o mesmo status no diálogo do assento e na lista da Sala. O aviso não depende de cor: a palavra e o `aria-label` dizem o mesmo.

Na Inversão, a placa muda de lado e de texto, o peão troca de lado, o histórico registra “sentido anti-horário” e um aviso textual aparece por alguns segundos. A leitura continua correta com `prefers-reduced-motion`, porque a informação é textual e está sempre na tela.

## Cor, forma e contraste

As quatro cores têm forma própria, repetida no canto da carta, na placa de cor ativa e na escolha do coringa:

| Cor | Forma | Hex |
| --- | --- | --- |
| Vermelho | círculo | `#C4322A` |
| Amarelo | losango | `#F0B93A` |
| Verde | triângulo | `#277147` |
| Azul | quadrado | `#2857B8` |

O nome da cor aparece no topo de toda carta e na placa de cor ativa. A forma é desenhada na tinta da carta (creme ou tinta escura), não na cor do fundo, para continuar legível.

Pares principais de contraste, calculados a partir dos tokens:

- creme `#F7EDD8` sobre feltro `#123B2D`: **10,69:1**
- tinta `#1B1410` sobre latão `#D7AB63`: **8,57:1**
- creme sobre vermelho `#C4322A`: **4,71:1**
- creme sobre verde `#277147`: **5,10:1**
- creme sobre azul `#2857B8`: **5,74:1**
- tinta `#1B1410` sobre creme `#F7EDD8`: **15,65:1**
- borda `#8A6234` sobre creme: **4,66:1**; borda de botão secundário `--brass-deep` sobre página: **5,02:1**
- foco `#F2C766` sobre feltro: **7,78:1**; sobre madeira `#3B2418`: **9,05:1**

O anel de foco tem 3px, e o foco em superfícies claras usa `#7A3F0E`.

## Tipografia

- **Fraunces** para a voz da mesa: título da vez (20px), quantidades (26px), títulos de diálogo (22–26px) e o número grande da carta.
- **Atkinson Hyperlegible Next** para tudo que precisa ser lido rápido: corpo, ações, nomes, rótulos. Corpo e ações em 16px; apelidos em 16px; rótulos em 14px; nome dentro da carta em 14px; sentido em 18px.
- Nada de caixa alta em texto funcional. Nada de texto sobre o grão do feltro.

Os tamanhos fixos vivem na escala `--fs-11` a `--fs-32` em `assets/app.css`. As cartas usam `clamp()` para o número e largura mínima de 72px.

## Layout

O aplicativo é uma grade de cinco faixas: topo, mesa, ações, mão e barra da gaveta. A altura é `100dvh` com `overflow: hidden`, então a tela da mesa não rola em 412×915 nem em 360×640.

- **412×915 e 430×932**: layout completo, mão em duas fileiras de quatro.
- **360×640 e alturas até 780px**: a consulta `max-height: 780px` compacta topo, ações, cartas, descarte e cor ativa sem baixar nenhum piso de fonte. Os oito assentos continuam visíveis.
- **1280×800**: mesa até 1040px, mão em uma fileira de oito.
- **Acima de oito cartas**: a própria mão rola na horizontal; a página não.
- **Confirmação**: a barra fica absoluta acima da mão e não empurra a mesa.
- **Gaveta**: sobreposição fixa de até 78dvh; abrir e fechar não muda a altura da mesa.

A mesa desenha o trilho a partir do tamanho real do elemento e redesenha em `resize`/`ResizeObserver`. O peão é posicionado sobre o ponto mais próximo do assento ativo e deslocado no sentido da rodada; por isso a inversão fica visível sem mover ninguém.

## Interação

- **Jogar**: toque em uma carta jogável; a rota `#carta` abre a barra “Jogar …?”. Confirmar descarta a carta, atualiza a cor ativa, passa a vez e muda o peão. Cancelar volta à mesa.
- **Comprar**: o monte ou o botão “Comprar” puxa uma carta e acende “Passar”. A carta comprada fica com contorno tracejado.
- **Passar**: só habilita depois da compra.
- **Coringa**: ao confirmar, abre `#cor` com quatro opções grandes, cada uma com nome e forma. A escolha muda a cor ativa e passa a vez.
- **Denunciar**: aparece em `#mesa-cheia` porque Léo tem uma carta e não avisou; a denúncia soma duas cartas a ele.
- **Última carta**: o aviso contextual aparece quando a mão chega a uma carta; a regra também está na gaveta.
- **Gaveta**: Conversa (com selo de não lidas), Histórico e Sala (código, jogadores, regras, cópia do convite).
- **Reagir à jogada**: a barra inferior “Reagir” abre uma bandeja em grade 4×3 com doze emojis e frases curtas: “Se ferrou!”, “Injustiça!”, “Toma essa!”, “Sacanagem!”, “Boa jogada!”, “Palhaço!”, “Que tédio!”, “Não acredito!”, “Já era!”, “Suspeito...”, “Com carinho!” e “Tá pegando fogo!”. Um toque lança a reação; não há escolha de alvo nem texto a escrever. Os emojis vêm da fonte de emoji do sistema (Apple Color Emoji primeiro), por isso mantêm o desenho familiar do iOS e do Android; a frase é sempre exibida junto para não depender só da imagem.
- **Sala**: o botão “Sala” no topo esquerdo abre a gaveta na aba Sala, com código, jogadores, regras e convite.
- **Reação**: emoji grande (≈100px) com anel que se abre e três faíscas, mais uma pílula com “quem · reação”. Entra com quique, fica cerca de 3s e sai suave, deslocando o olhar sem escurecer a mesa. `pointer-events: none`: nada bloqueia o jogo, e todos veem a mesma reação. A rota `#reacao` mantém uma reação fixa para inspeção; `#provocacao` funciona como alias.
- **Pausa**: a mesa escurece, o cartão nomeia quem caiu e o botão “Voltar ao jogo” retoma.
- **Observador**: sem mão, com o título da vez, “Você observa” na linha de contexto e “Aguardando a próxima rodada” nas ações; o botão entra na fila.
- **Resultado**: diálogo com vencedor, placar de rodadas e “Jogar de novo”.

## Acessibilidade

- Link “Ir para a mesa”, foco visível de 3px, controles semânticos e nomes acessíveis.
- Ordem de foco: pular → Sala → monte (quando habilitado) → assentos → pausa (quando presente) → ações → cartas da mão → barra da gaveta. Nas sobreposições o foco fica preso e Escape fecha.
- `aria-live` anuncia vez, cor, descarte, compras, inversão e resultado.
- Assentos são botões: o apelido pode encurtar no assento, mas o nome completo aparece no diálogo do assento.
- `prefers-reduced-motion` reduz transições e mantém a Inversão legível por texto.
- Alvos de toque têm no mínimo 44px; a mão usa vão de 8px entre cartas.

## Rotas dos dez estados

| Rota | Estado |
| --- | --- |
| `#mesa` | Quatro jogadores, sua vez, sete cartas, descarte vermelho 6, cor vermelha |
| `#mesa-cheia` | Oito jogadores, vez de Rita, Tio Juca com 12 cartas, apelidos longos, cor verde |
| `#inversao` | Inversão azul jogada, sentido anti-horário, vez de Léo |
| `#carta` | Carta selecionada com a barra de confirmação |
| `#cor` | Coringa jogado, escolha entre as quatro cores |
| `#conversa` | Gaveta de conversa aberta, mensagens, campo e selo de não lidas |
| `#observador` | Observador aguardando a próxima rodada, sem mão |
| `#pausada` | Rodada pausada porque Bia caiu da conexão |
| `#reacao` | Nena · “Toma essa!”: reação sobre a mesa (alias `#provocacao`) |
| `#resultado` | Rodada encerrada, Vó Cida vencedora e placar |

## Tokens

- Cor: `--page`, `--page-2`, `--felt`, `--felt-lit`, `--felt-deep`, `--wood`, `--wood-lit`, `--wood-deep`, `--brass`, `--brass-light`, `--brass-deep`, `--cream`, `--ink`, `--muted`, `--red`, `--yellow`, `--green`, `--blue`, `--focus`, `--focus-no-claro`.
- Tipo: `--fonte-display`, `--fonte-ui`, `--fs-11` a `--fs-32`.
- Espaço: `--pad`, `--gap`, `--top-h`, `--actions-h`, `--drawer-h`, `--hand-head`, `--safe-top`, `--safe-bottom`.
- Cartas: `--card-w`, `--card-h`, `--discard-w`, `--discard-h`, `--monte-w`, `--monte-h`.
- Raio e sombra: `--r-card`, `--r-plate`, `--r-btn`, `--shadow-carta`, `--shadow-plate`.

## Limites conhecidos

- Os frames de 412×915, 1280×800 e 360×640 são atendidos pelo próprio protótipo responsivo, sem capturas PNG.
- Os dados são estáticos e locais; chat, reações, fila de observador e reconexão são simulações de interface. Não há backend nem login.
- As fontes são servidas localmente em `assets/fonts/`; sem elas, a pilha de sistema preserva a leitura.
- “Avisar última carta” é contextual e só aparece com uma carta na mão; os dez estados usam mãos de sete cartas. A denúncia está visível no estado de oito jogadores.
