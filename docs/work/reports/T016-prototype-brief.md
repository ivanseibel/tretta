# Brief de protótipo — Tretta, mesa de jogo legível e com alma

Você vai criar um protótipo **completamente novo** para o Tretta, um jogo de cartas no navegador para famílias e amigos. Este é um redesign greenfield: **não existe referência visual a seguir**. Não imite, não preserve e não se inspire em nenhuma interface anterior do produto. A herança são apenas as regras, o comportamento e os requisitos abaixo.

Entregue **uma direção visual forte e autoral**, não uma média segura. O resultado precisa parecer um jogo que dá vontade de abrir — uma mesa de cartas acolhedora, tátil e divertida —, e não um painel de dados.

## 1. O produto

Tretta é um jogo de cartas estilo Uno para 2 a 8 pessoas, jogado no navegador, em salas privadas por link. Cada pessoa entra com apelido e avatar, sem cadastro. Amigos e familiares jogam de casas diferentes, no celular ou no computador. Há chat da sala, provocações animadas (tomate, torta na cara, risada, choro), reações, placar de rodadas, reconexão e uma mesa de treino contra bots.

O clima é de mesa de família: conversa, zoação leve, partidas rápidas. O jogo não é competitivo, não é corporativo e não é um dashboard.

### Regras mínimas para os dados do protótipo

- Baralho de 108 cartas: quatro cores (vermelho, amarelo, verde, azul), números de 0 a 9, Bloqueio, Inversão, Compra 2, Coringa e Compra 4.
- Cada pessoa começa com 7 cartas. Uma carta numérica abre o descarte; a primeira pessoa é sorteada; o sentido inicial é horário.
- Na sua vez, você pode descartar uma carta que combine por cor, número ou símbolo, ou comprar uma carta. Depois de comprar, pode jogar a carta comprada ou passar.
- Bloqueio pula a pessoa seguinte. Inversão troca o sentido; com duas pessoas, funciona como Bloqueio. Compra 2 e Compra 4 fazem a pessoa seguinte comprar e perder a vez. Coringas permitem escolher a cor.
- Quem termina as cartas vence a rodada. Há placar de rodadas vencidas. Antes do último descarte, a pessoa pode avisar “Última carta”; quem não avisar pode ser denunciado e compra duas cartas.
- As mãos adversárias são privadas: você vê apenas a sua mão e a quantidade de cartas de cada pessoa.
- Efeitos podem pular pessoas. A interface mostra a ordem e o sentido da rodada, **não uma promessa de quem joga depois**.

## 2. Quem joga e onde

- Famílias e amigos, incluindo uma pessoa de quase 70 anos com baixa visão.
- O celular é o dispositivo principal; uso com uma mão, a tela a 30–40 cm dos olhos.
- Referência de celular: **412×915 CSS px** (Moto G9 Plus). Também precisa funcionar em **430×932** (iPhone 15 Pro Max) e no mínimo em **360×640**.
- Referência de desktop: **1280×800**.
- Salas de 2 a 8 pessoas. A mesa de 8 é o pior caso e não pode esconder ninguém.
- Pode haver observadores aguardando a próxima rodada, bots substitutos, pessoas desconectadas e nomes longos.

## 3. O que precisa ser entendido sem explicação

Em menos de cinco segundos, sem rolar a tela e sem legenda, a pessoa precisa saber:

1. De quem é a vez.
2. Qual é o sentido da rodada — horário ou anti-horário.
3. A ordem dos jogadores e como a vez passa de um para o seguinte.
4. Quantas cartas cada jogador tem.
5. Qual é a carta do descarte.
6. Qual é a cor ativa.
7. Quais ações ela pode tomar agora.
8. Quais são as cartas da mão dela.

Se for preciso explicar a transição entre jogadores, o desenho falhou.

## 4. Requisitos duros de layout e leitura

### Uma tela, sem rolagem vertical

- Em **412×915** e **360×640**, a tela da mesa não pode rolar na vertical.
- Cabeçalho, todos os assentos com nome e quantidade, centro da mesa, ações, mão e barra da gaveta ficam visíveis ao mesmo tempo.
- Abaixo de 360×640, rolagem vertical é permitida como exceção.
- A gaveta de conteúdo secundário é sobreposição; abrir e fechar não muda a altura da mesa.
- Selecionar uma carta e mostrar a confirmação é sobreposição; não empurra o layout.

### Os 8 assentos

- Todos os jogadores ficam visíveis em qualquer tamanho garantido. Nada de “ver mais”, nada de esconder jogador para caber.
- Cada assento mostra avatar, apelido e quantidade de cartas.
- Apelidos longos podem usar reticências em uma linha; o nome completo aparece a um toque. Quantidade, vez e sentido nunca são truncados.
- A pessoa da vez tem destaque **textual e visual**, não apenas cor: etiqueta “na vez” e cabeçalho “Vez de …” ou “Sua vez”.
- A ordem e o sentido precisam sobreviver à Inversão com as pessoas nas mesmas posições.

### Tamanhos e contraste

| Elemento | Piso |
| --- | --- |
| Vez | 20px, peso forte |
| Sentido da rodada | 18px |
| Quantidade de cartas | numeral 26px + rótulo 14px |
| Nome do jogador | 16px |
| Nome dentro da carta | 14px |
| Rótulos de monte, descarte e cor ativa | 14px |
| Corpo, ações e rótulos | 16px |
| Etiqueta “na vez” | 14px |

- Carta da mão: no mínimo **72px de largura**.
- Alvo de toque: no mínimo **44×44px**.
- Contraste de texto: **≥ 4,5:1**; limites, foco e indicadores não textuais: **≥ 3:1**.
- Nada de texto funcional em caixa alta, com pouco espaçamento ou atrás de textura.
- Cor nunca é o único indicador: use símbolo, forma ou texto.

### Mão

- Em 412×915: até 8 cartas visíveis em duas fileiras de quatro.
- Acima de 8 cartas, a própria mão rola na horizontal, sem rolar a página.
- No desktop 1280×800: as 8 cartas cabem inteiras em uma fileira, sem rolagem horizontal.
- A mão e a confirmação da jogada nunca saem da tela.

### Centro da mesa

- Descarte legível e dominante.
- Monte de compra com a quantidade em numeral grande.
- Cor ativa com nome e símbolo, não só uma bolinha colorida.
- As ações principais ficam grandes e óbvias: comprar, passar, avisar “Última carta”, denunciar, escolher cor.

### Conteúdo secundário

- Chat, histórico de eventos, provocações/humor, ajuda e informações da sala ficam em uma **gaveta de um toque**, com abas e indicador de mensagens não lidas.
- O chat precisa ser alcançável sem rolar a página.
- Provocações e reações aparecem como sobreposições curtas, divertidas e que não deslocam a mesa.

### Acessibilidade de uso

- Navegação por teclado com foco visível; ordem de foco documentada.
- Anúncio da vez por `aria-live`; a informação visual não pode depender de animação.
- Respeitar `prefers-reduced-motion`; a Inversão continua compreensível sem movimento.
- Zoom de 200% (largura equivalente a 640px) não pode esconder informação funcional.

## 5. A passagem entre jogadores

Este é o ponto mais importante do redesign e o motivo da reprovação da interface anterior.

- A passagem de um jogador para o seguinte deve ser um **elemento contínuo e integrado à cenografia da mesa**, não uma fileira de micro-setas entre chips.
- Trate a ordem e o sentido como parte do jogo: pode ser um caminho, uma sequência de lugares, um marcador físico, um gesto dos assentos ou outra invenção sua. O critério é: **entender sem explicação e sentir que pertence a um jogo de cartas**.
- A solução precisa ser bonita, evidente e divertida. Nada de triângulos soltos, chevrons, barras de progresso ou setas de UI genérica.
- A Inversão precisa ser perceptível na hora e continuar visível depois, sem depender só de animação.
- Não mostre “próximo jogador” como promessa: Bloqueio e compras obrigatórias podem pular gente. Mostre a ordem e o sentido vigentes.

## 6. Estados obrigatórios do protótipo

1. **4 jogadores, sua vez**, 7 cartas, descarte vermelho 6, cor ativa vermelha.
2. **8 jogadores, vez de outra pessoa**, um jogador com 12 cartas, apelidos longos, cor ativa verde.
3. **Sentido anti-horário** depois de uma Inversão, com a mudança perceptível.
4. **Carta selecionada** com a barra de confirmação sobreposta.
5. **Escolha de cor** de um Coringa, com as quatro cores e símbolos.
6. **Gaveta de chat aberta**, com mensagens, campo de texto e selo de não lidas.
7. **Observador** aguardando a próxima rodada, sem mão própria, vendo a mesa pública.
8. **Pessoa desconectada ou rodada pausada**, com o estado claro e sem convidar a jogar.
9. **Provocação** (tomate ou torta) sobre a mesa, divertida e sem deslocar o layout.
10. **Resultado da rodada**, com vencedor e placar.

Inclua também o pior caso de nomes longos e de quantidade alta de cartas.

## 7. Direção de experiência e estética

- Uma metáfora de mesa forte: material, profundidade, sombras, textura apenas em áreas sem texto.
- Tipografia expressiva e generosa; números de carta e quantidades com presença.
- Paleta com personalidade e alto contraste; evite a estética genérica de SaaS, cards de vidro, gradientes roxos e “dashboard”.
- Elementos lúdicos com propósito: marcador de vez, assentos com cara de lugar, cartas com peso, detalhes de mesa. Nada de enfeite que atrapalhe a leitura.
- Microinterações curtas para entrada da vez, Inversão e provocação; sempre com alternativa sem movimento.
- Hierarquia clara: vez e sentido → mão → quantidades → descarte.
- O protótipo deve ser **bonito de olhar parado** e **óbvio de usar em movimento**.

## 8. Entregáveis

- Protótipo navegável em alta fidelidade, com os 10 estados.
- Frames em **412×915** e **1280×800**; o estado de 8 jogadores também em **360×640**.
- Uma única direção visual coesa, não três variantes.
- Tokens de cor, tipografia, espaçamento, raios e sombras.
- Uma página curta de racional: metáfora, hierarquia, como a ordem/sentido é lida, como a Inversão é lida.
- Uma checklist ligando cada requisito desta lista ao lugar do protótipo onde ele foi atendido.
- Todo o texto em **português do Brasil**, com nomes e cartas realistas.
- Sem backend, sem login e sem dados reais; use dados estáticos.
- Se a ferramenta gerar código, use HTML/CSS/JS ou React, com HTML semântico, ARIA, foco e redução de movimento.

## 9. Critérios de aceite

1. Em 412×915, uma pessoa aponta sem rolar e sem explicação: de quem é a vez, o sentido, a quantidade de cada jogador, o descarte, a cor ativa, as ações e as próprias cartas.
2. Os 8 assentos ficam visíveis em 412×915 e 360×640.
3. Não há rolagem vertical da página em 412×915 nem em 360×640.
4. No desktop 1280×800, as 8 cartas cabem em uma fileira, sem rolagem horizontal da mão.
5. Todos os pisos de fonte, carta e alvo de toque são respeitados.
6. Contraste de texto ≥ 4,5:1 e de foco/limites ≥ 3:1, com valores declarados.
7. A passagem entre jogadores é um elemento de jogo contínuo, evidente e bonito; não há micro-setas soltas.
8. A Inversão é compreensível sem animação.
9. Nenhum texto funcional fica atrás de textura, cortado ou sobreposto.
10. A gaveta abre em um toque e não muda a altura da mesa.
11. O protótipo parece um jogo de cartas acolhedor, não um painel de controle.

## 10. O que reprova automaticamente

- Micro-setas, chevrons ou triângulos entre os jogadores.
- Esconder jogador, cortar assento ou usar “ver mais” para caber.
- Reduzir fonte, contagem ou carta abaixo dos pisos para ganhar espaço.
- Rolagem vertical na tela da mesa nos tamanhos garantidos.
- Texto funcional em caixa alta, apertado ou sobre textura.
- Depender de cor, som ou animação para entender a vez ou o sentido.
- Layout que muda de altura ao selecionar uma carta ou abrir a gaveta.
- Estética de dashboard, cards genéricos, vidro, gradiente roxo ou “SaaS”.
- Uma transição que só funciona depois de explicada.

Antes de entregar, faça esta checagem: **se a mesa parecer um painel de dados com cartas, refaça.** O alvo é uma mesa de jogo legível, com alma, que uma pessoa de quase 70 anos entende de primeira e uma família tem vontade de abrir no fim de semana.
