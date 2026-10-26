# Acessibilidade visual da mesa

**Incorporado em 25/10/2026** por [mesa-e-reacoes.md](mesa-e-reacoes.md). Os requisitos de leitura, no-scroll, contraste e alvos continuam válidos; o desenho de faixa foi substituído pelo trilho do [ADR 0002](../adr/0002-trilho-de-mesa-substitui-a-faixa.md).

Escopo aprovado em 25/10/2026, após entrevista `grill-with-docs`. O pedido veio do relato de uma jogadora de quase 70 anos: a quantidade de cartas dos jogadores, o sentido da rodada e outros elementos pequenos são difíceis de ler, e a mesa exige rolar a tela para alternar entre as próprias cartas e o estado do jogo. A decisão registrada em [ADR 0001](../adr/0001-faixa-de-assentos-substitui-o-anel.md) substitui o anel de assentos pela faixa descrita aqui.

## Objetivo

Manter visíveis ao mesmo tempo, sem rolagem vertical: vez, sentido da rodada, todos os assentos com nome e quantidade de cartas, descarte, monte, cor ativa, ações e a mão inteira. Elevar o texto funcional a tamanhos legíveis para baixa visão, preservando a identidade visual aprovada em T008.

O problema é de escala e densidade, não de estilo. A mesa deve continuar parecendo uma mesa aconchegante, e não um painel compacto que apenas coube.

## Público e calibração

- Referência principal: **Moto G9 Plus**, viewport CSS de aproximadamente **412×915 px**.
- Teste humano final: **iPhone 15 Pro Max**, **430×932 px**, feito pelo usuário.
- Garantia de mesa sem rolagem vertical: **a partir de 360×640 px**. Abaixo disso, a página pode rolar, como exceção documentada.
- Desktop de referência: **1280×800 px**.
- Aumento de zoom do navegador até **200%** (largura equivalente a 640 px) não pode quebrar o layout nem esconder informação funcional.

## Composição aprovada

Uma única composição em coluna, do celular ao desktop. Não há duas colunas nem anel de assentos.

| Região | Conteúdo |
| --- | --- |
| Cabeçalho | Vez em 20px e sentido da rodada em 18px, no mesmo bloco; menu com sair. O título da sala vai para a gaveta “Sala”. |
| Faixa de assentos | 2–8 assentos, avatar, nome, quantidade de cartas e marca textual da vez. |
| Centro | Descarte maior, monte com contagem e cor ativa. |
| Ações | Um botão primário contextual de 56px e a linha secundária de 44px com “Avisar última” e “Denunciar”. |
| Mão | Duas fileiras de até quatro cartas, título “Sua mão” e indicador da vez. |
| Barra da gaveta | 52px, fixa, com Chat, Eventos, Humor e Sala. |

### Faixa de assentos

- Sua pessoa é sempre a primeira célula; as demais seguem a ordem dos assentos.
- Com 5–8 assentos, a faixa usa duas fileiras em **serpente**: a primeira da esquerda para a direita, a segunda da direita para a esquerda, com seta de descida na ponta direita e de retorno na ponta esquerda. Com 2–4 assentos, uma fileira só.
- Divisão equilibrada entre as fileiras: 4+4, 4+3, 3+3, 3+2.
- Posições fixas durante a rodada. Inversão troca apenas o sentido das setas; ninguém muda de lugar.
- A vez é marcada por preenchimento dourado, nome em negrito e etiqueta textual “na vez” em 14px, além do cabeçalho.
- Nome em uma linha com reticências; o nome completo, a contagem e a presença ficam a um toque.
- Quem apenas assiste não recebe posição inventada; a faixa informa que a pessoa acompanha a rodada.

### Centro da mesa

- Descarte em destaque, como a carta que decide a jogada.
- Monte menor, com a contagem em numeral de 20px.
- Cor ativa em texto de 18px, acompanhada do símbolo da cor.

### Mão

- Cartas entre 72 e 96px de largura, proporção 1:1,42: cerca de 86×122 px em 412 px de largura e 96×136 px no desktop.
- Quatro cartas por fileira; até oito cartas visíveis em duas fileiras.
- Acima de oito cartas, ou em largura menor que 360 px, a mão rola na horizontal, mantendo o tamanho da carta.
- A barra de confirmação da jogada é sobreposição dentro da zona da mão. Selecionar uma carta não altera a altura da tela.
- O texto de ajuda sai da mesa e passa a um botão “?” ao lado do título.

### Gaveta

- Abas Chat, Eventos, Humor e Sala, abertas por barra fixa com ícone e rótulo.
- Cobre cerca de 60% da altura no celular; no desktop abre como painel lateral.
- Selo de mensagens não lidas; fecha com swipe ou Escape e devolve o foco ao botão de origem.
- “Sala” reúne título/código, controles do anfitrião e sair. O chat passa a existir a um toque, sem rolar — absorvendo o candidato “chat acessível durante a jogada” do backlog.

## Escala e pisos

| Elemento | Antes | Piso aprovado |
| --- | --- | --- |
| Vez | 16px | 20px, peso 700 |
| Sentido da rodada | 13,6px | 18px |
| Quantidade de cartas | 10,56px | numeral 26px + rótulo 14px |
| Nome do jogador | 12,48px | 16px |
| Nome dentro da carta | 8,96–9,92px | 14px |
| Rótulo de pilha | 11,52px | 14px |
| Corpo, rótulos e ações | 16px | 16px (piso) |
| Marca “na vez” | 9,6px | 14px |

Exceção única e registrada: o nome dentro da carta pode ficar em 14px, abaixo do piso de 16px, porque a identidade principal da carta é dada por cor, símbolo e valor em 24px. Nenhum outro texto funcional fica abaixo de 16px.

Cartas da mão não ficam abaixo de 72px de largura. Alvos de toque não ficam abaixo de 44px.

## Contraste e foco

- Texto: mínimo **4,5:1**.
- Limites, foco e indicadores não textuais: mínimo **3:1**.
- O anel de foco atual das cartas dá 1,37:1 (amarelo sobre papel creme) e precisa ser corrigido para escuro sobre papel e claro sobre feltro.

## Orçamento vertical e degradação

Em 412×915, o desenho ocupa cerca de 830px, com aproximadamente 85px de folga. Quando faltar altura, a ordem de sacrifício é fixa:

1. Título da sala para a gaveta.
2. Compressão de cabeçalho, respiros e centro da mesa.
3. Título “Sua mão” compactado.
4. Mão de duas fileiras para uma, com rolagem horizontal.
5. Faixa de assentos de duas fileiras para uma — **somente com 2–4 assentos**.
6. Avatar de 24px para 20px.
7. Arte do centro: textura e espaçamento.

Com 5–8 assentos, a faixa mantém duas fileiras em qualquer altura. Nunca são escondidos assento, jogador, vez ou sentido da rodada, nem reduzidos a carta abaixo de 72px de largura ou o alvo de toque abaixo de 44px. Texto que não couber quebra em duas linhas, sem reticências. Abaixo de 360×640, rolagem vertical é permitida como exceção documentada; a partir de 360×640, não.

## Feedback de vez e Inversão

- Faixa transitória de 2,5s no topo da mesa, em 20px e alto contraste: “Agora é a vez de Ana” e “Sentido anti-horário”.
- A faixa é controlada pela preferência de aviso de vez já existente, reaproveitada em vez de criar novo controle.
- O estado persistente (assento dourado, etiqueta e cabeçalho) permanece depois que a faixa some.

## Identidade visual

- Preservar a paleta de T008: feltro verde, papel creme, dourado, borda de madeira e títulos em serifa.
- Redesenhar a composição, removendo textura ou ruído atrás de texto pequeno.
- O aceite estético é feito sobre mockups antes de qualquer código.

## Limites

Somente `apps/web`: CSS, componentes e textos da mesa. Regras, motor, servidor, protocolo, estratégia dos bots, mãos privadas, recuperação, sons, chat, provocações e infraestrutura permanecem no comportamento aceito.

Treino e mesa pública usam a mesma composição. Sobreposições de provocação e reação ficam dentro da shell e não geram rolagem. Teclado, foco e regiões `aria-live` não podem regredir.

Publicação é etapa posterior e exige autorização específica. Este aceite não autoriza commit, push, deploy ou restart de serviços.

## Verificação e aceite

- Matriz automatizada: 360×640, 412×915, 430×932, 768×1024, 1280×800 e 640px de largura como equivalente a 200% de zoom.
- Asserções: ausência de rolagem vertical na tela da mesa nos tamanhos garantidos; pisos de fonte; contraste; ausência de sobreposição e de corte; tamanho mínimo de carta e de alvo; teclado e foco preservados.
- Teste manual final no iPhone 15 Pro Max do usuário, com capturas antes/depois.
- Teste com a mãe do usuário não é exigido para o aceite.

## Continuidade

| Etapa | Entrega |
| --- | --- |
| [T016](../work/T016.md) | Especificação visual e mockups em 412, 430, 1280 e 360px, com estados e tokens |
| T017A–T017D | Shell de uma tela, faixa de assentos, centro/ações e mão/gaveta, em incrementos aceitos um a um |
| T018 | Verificação da matriz, evidências e aceite local |
| Publicação | Tarefa separada, somente com autorização do usuário |
