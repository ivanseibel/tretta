# T016 — Mesa acessível: especificação visual

25/10/2026 · Proposta do executor, aguardando validação do orquestrador e aprovação visual do usuário. Somente documentação e mockups; não implementa a mesa.

[Galeria dos 40 PNGs](assets/T016/index.md) · [Medidas por estado](assets/T016/measurements.md) · [Contrastes calculados](assets/T016/contrast.md) · [Fonte de renderização](assets/T016/source/mesa.html).

## Ajuste A2

Etiqueta textual da vez em uma linha: “vez” quando a célula mede menos de 88px; “na vez” a partir de 88px. Sempre 14px, peso 800 e entrelinha 18px, com `white-space: nowrap`. Em tela baixa ocupa o canto direito da linha da contagem, sem cruzar numeral, rótulo, avatar ou nome. O nome acessível preserva “na vez”; o cabeçalho permanece completo. Não muda altura de célula, região, alvo ou carta. A1 preservada em [v1/a1](assets/T016/v1/a1/index.md).

## Ajustes A1

Revisão de composição solicitada pelo orquestrador: coluna desktop ampliada de 760 para 936px; oito cartas inteiras sem scroll; espera redundante passa a anúncio visualmente oculto; folga vertical distribuída entre regiões. [Antes/depois medido](assets/T016/measurements.md) e [v1 preservada](assets/T016/v1/index.md). Os pisos, estados e contrastes permanecem. Esta revisão substitui as decisões anteriores de janela de quatro cartas no desktop e de folga acumulada sob a mão.

## Intenção e identidade

Uma pessoa joga com a família pelo celular e precisa reconhecer imediatamente quem joga, em qual sentido e quais cartas tem. A referência é a jogadora de quase 70 anos que hoje precisa aproximar os olhos e rolar a página. A mesa deve lembrar feltro, papel de baralho e luz quente de casa.

O domínio visual reúne mesa, baralho, compra, descarte, vez, convivência e humor. As cores vêm de feltro verde, papel creme, madeira mel, dourado de uma luz sobre a vez e tintas das cartas. A assinatura é a serpente de assentos iluminando a pessoa da vez, acima de uma bandeja de papel para a mão. A moldura de madeira pertence à mesa; sombras pequenas levantam somente cartas e superfícies sobrepostas. O fundo dos textos é sempre liso. O verso listrado do monte não contém texto.

A prioridade visual é: **vez e sentido → mão → quantidades → descarte**. O dourado identifica a vez; o papel destaca a mão; numerais de 26px dão presença à quantidade. O descarte domina o centro pela largura e pela frente da carta, com o monte menor ao lado. Não há anel, painel de estatísticas, coluna lateral permanente nem textura sob texto.

## Grade e orçamento

Ordem única em todas as larguras: cabeçalho → faixa de assentos → centro → ações → mão → barra da gaveta. A shell usa a largura disponível no celular; no desktop os cinco blocos internos e a barra ocupam uma coluna central de 936px. A mesa de feltro continua de margem a margem da moldura. A gaveta lateral no desktop é uma sobreposição modal, sem reorganizar a mesa em duas colunas.

| Região / s02 (8 assentos, 8 cartas) | 360×640 | 412×915 | 430×932 | 1280×800 |
| --- | ---: | ---: | ---: | ---: |
| Cabeçalho | 52 | 56 | 56 | 60 |
| Faixa de assentos | 152 | 202 | 202 | 198 |
| Centro | 97 | 116 | 116 | 110 |
| Ações (sem espera visual) | 44 | 44 | 44 | 44 |
| Mão | 160.2 | 336 | 336 | 214 |
| Barra da gaveta | 52 | 52 | 52 | 52 |
| Soma dos gaps efetivos | 70.77 | 89.0 | 106.0 | 77.0 |
| Borda superior + padding vertical | 12 | 20 | 20 | 21 |
| Margem externa vertical | 0 | 0 | 0 | 24 |
| Total com espaços distribuídos | 639.97 | 915.0 | 932.0 | 800.0 |
| Folga residual sob a mão | 0 | 0 | 0 | 0 |

A linha contextual visível de 56px continua existindo quando há Comprar carta. Na vez de outra pessoa, só a linha secundária de 44px é visível; a espera permanece em anúncio acessível sem ocupar altura.

As somas são medidas do artefato, não estimativas; diferenças de até 0,05px decorrem do arredondamento da tabela. Bordas laterais não acrescentam altura. Nos celulares, a borda superior mede 4px, o padding vertical soma 8px em tela baixa e 16px nas altas. Desktop: 5px de borda superior + 16px de padding + 24px de margem externa. A barra de 52px está fora da shell, ancorada ao rodapé. O espaço restante é distribuído uniformemente entre as regiões, sem esticar cartas; não se acumula sob a mão. Com quatro assentos a faixa fica em uma fileira e libera altura.

O orçamento inicialmente citado de aproximadamente 830px não cobre estes oito assentos e oito cartas com todos os pisos: o orçamento efetivo em 412×915 é 915px incluindo os espaços distribuídos. A margem livre foi convertida em gaps; a implementação deve medir a fonte e a área segura reais antes de qualquer aceite funcional. As alturas CSS incluem bordas e padding.

## Comportamento por tamanho

- **360×640:** cabeçalho de 52px, intervalos mínimos de 2px acrescidos da distribuição de folga, avatar de 20px, assentos de 72px de altura e duas fileiras para 5–8 pessoas. A mão vira uma fileira horizontal de cartas de 72×102,24px. Quatro cartas cabem; a borda da próxima comunica continuidade. Todos os oito assentos e suas contagens permanecem visíveis. A etiqueta “vez” fica em uma linha no canto direito da célula de 80px, mantendo 14px; células a partir de 88px usam “na vez”.
- **412×915:** duas fileiras de quatro cartas; largura medida de 82,5px e altura de 122px. O cartão fica perto da referência de 86px, preservando pelo menos 72px. Oito assentos usam 4+4; nenhuma contagem sai da tela. A folga se distribui entre as regiões. A região da mão mede 336px com oito cartas.
- **430×932:** mesma composição, cartas de 86×122px e respiro distribuído entre regiões. É a referência para a futura prova humana no iPhone 15 Pro Max; este artefato não substitui essa prova.
- **1280×800:** coluna de 936px, cartas de 96×136px. As oito cartas cabem inteiras em uma fileira: 768px de cartas + 98px de gaps = 866px dentro dos 908px úteis da mão. Não há rolagem horizontal nem segunda coluna. Assentos usam células de até 222px; o centro continua centralizado, com 48px entre pilhas/cor ativa. Os intervalos verticais são distribuídos e medem no máximo 26,75px nesta matriz.


A escada segue a decisão enviada pelo coordenador nesta execução: título da sala na gaveta; comprimir cabeçalho, respiros e centro; mão de duas fileiras para uma com rolagem horizontal; avatar de 24 para 20px; remover arte e espaço supérfluos do centro. **A faixa usa uma fileira somente com até quatro assentos. Nunca esconder pessoas para ganhar altura.** O documento de produto foi atualizado pelo coordenador; este executor não o editou.

Para mais de oito cartas, a zona da mão conserva sua altura e rola horizontalmente, com agrupamento em até duas fileiras nas telas altas. Cartas focadas entram na janela por rolagem local. Abaixo de 360px de largura ou 640px de altura, a página pode rolar verticalmente: preservar fonte, contagem e alvos, sem esconder conteúdo com overflow. Em largura equivalente a 640px por zoom de 200%, manter a coluna fluida, quebra de texto e navegação por teclado; se a altura CSS cair abaixo de 640px, vale a exceção de rolagem. Zoom, teclado virtual e áreas seguras precisam da prova funcional T018.

## Tokens

| Papel | Token / valor |
| --- | --- |
| Feltro | `--felt: #194832` |
| Assento e placa escura | `--seat-bg: #123526` |
| Papel | `--paper: #fffaf0` |
| Papel rebaixado / mensagem | `--paper-shade: #ece4d2` |
| Mensagem própria | `#dfeee2` |
| Tinta principal | `--ink: #203a2f` |
| Tinta secundária | `--ink-muted: #4d5e54` |
| Texto claro auxiliar | `--mist: #dce9d7` |
| Vez e ação primária | `--lamp: #ffd36c` |
| Contorno de assento | `--seat-line: #93b596` |
| Madeira | `--wood: #d6bd78`; sombra `#a88a45`; luz `#f3e2a8` |
| Vermelho | `#b83c2b`, símbolo ● |
| Amarelo | `#e8b941`, tinta `#342a10`, símbolo ◆ |
| Verde | `#2e6542`, símbolo ▲ |
| Azul | `#236394`, símbolo ■ |
| Coringa | `#574276`, símbolo ✦ |
| Seleção e selo de não lidas | `#b84331` |
| Contorno exterior das cartas | `#5b4a22` |
| Carta jogável | `#7a5200`, sobre papel |
| Campo de mensagem | Fundo `#fffdf7`, limite `#6f7f72` |

Os demais frisos, sombras e brilhos são decoração; não indicam disponibilidade ou foco. A paleta funcional usa cores sólidas. Cor ativa: texto de 18px e símbolo, inclusive no amarelo com tinta escura.

| Tipografia | Tamanho / entrelinha / peso |
| --- | --- |
| Vez | 20 / 24 / 700 |
| Sentido | 18 / 22 / 400–600 |
| Faixa transitória | 20 / 24 / 700, duas linhas |
| Nome do jogador | 16 / 20 / 600; na vez 800 |
| Quantidade | 26 / 28 / 800, numerais tabulares |
| “carta(s)” | 14 / 16 / 600 |
| “na vez” / “vez” | 14 / 18 / 800; uma linha em todos os tamanhos |
| Nome da carta | 14 / 16 / 600 |
| Valor da carta | 26 / 28 / 800; mínimo 24 no centro compacto |
| Rótulo de pilha | 14 / 18 / 700 |
| Monte | numeral 20 / 24 / 800 |
| Cor ativa | 18 / 22 / 800 |
| Corpo, ações, abas, chat | 16 / 22 / 400–700; botão principal 18 |
| Título da mão / observador | Georgia, 20–21 / 24 / 700 |

Demais textos usam `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`. A serifa identifica a bandeja da mão e a hospitalidade da mesa; a sans facilita leitura de estados e números. Não se reduz letra para fazer caber. Os pisos específicos de 14px são apenas os elementos aprovados na tabela do produto.

Espaçamento: unidade de 2px; escala 2, 4, 6, 8, 12, 16, 24px. Gaps mínimos declarados: 6px entre regiões nas telas altas, 14px entre fileiras da faixa e 12px entre fileiras da mão; na tela baixa: 2px, 8px e uma fileira de cartas. A folga livre se soma aos gaps entre regiões por distribuição uniforme; ver medidas efetivas na tabela A1. Padding da mão 8px no celular alto, 3px no baixo e 12px no desktop, com área interna reservada ao foco.

Raios: carta 11px; assento e botão 12px; placa 14px; mão 18px; shell 20px no celular e 26px no desktop; gaveta 22px no topo; cor ativa em cápsula de 22px. Contornos funcionais de 2px; foco de 3px; madeira de 4–5px.

## Regiões e estados

**Cabeçalho:** vez de 20px, sentido de 18px e menu de 48px. Sua vez recebe fundo dourado e texto escuro. Vez alheia usa primeiro nome no cabeçalho, identidade completa no botão do assento e no detalhe; nenhum nome é removido da faixa. Menu oferece sair; título/código e controles de anfitrião ficam em Sala.

**Faixa:** própria pessoa primeiro; demais na ordem fixa do servidor. Com 5–8, divisões 3+2, 3+3, 4+3 e 4+4; segunda fileira da direita para a esquerda. O espaço vazio em 3+2/4+3 recebe o retorno da seta, sem assento fictício. Com 2–4, uma fileira e retorno inferior quando couber. Inversão muda somente as setas e o texto; posições ficam fixas. O dourado, o negrito e “na vez” identificam o turno juntos. A mesma célula é o alvo de toque para nome completo, contagem, presença e acesso ao humor. Reticências se aplicam somente ao nome de uma linha; o nome completo aparece em um toque/Enter (s10).

**Centro:** monte menor com verso sem texto, numeral de 20px ao lado de Monte; descarte de 72px de largura e altura ajustada ao orçamento (76/90/88px). A proporção compacta do descarte é uma escolha de arte; a mão conserva o formato de baralho. Nome de 14px, valor de pelo menos 24px; cor ativa com símbolo e texto de 18px. Não confundir o monte com a ação: comprar é o botão de 56px.

**Ações:** quando houver compra, linha contextual de 56px com Comprar carta, intervalo de 4px e linha secundária de 44px. Na vez de outra pessoa, o estado de espera é apenas anúncio acessível visualmente oculto e não ocupa altura; fica somente a linha de 44px com Avisar última e Denunciar. Aplicar as permissões atuais do motor: ações indisponíveis não disparam comandos. Estado desabilitado conserva contraste de texto, usa borda tracejada e `aria-disabled`; não se baseia em baixa opacidade. Hover clareia o contorno; pressionado desloca 1px para dentro, sem alterar altura externa.

**Mão:** bandeja creme com título em serifa e botão “?” de 44×44px. Jogável recebe contorno dourado escuro sobre papel; seleção usa contorno vermelho, marca ✓ e barra textual de confirmação. Foco tem contorno escuro de 3px sobre papel e halo creme exterior para o feltro. Não basta uma borda amarela sobre creme. No desktop A1, a mão mostra até oito cartas inteiras em uma fileira, conforme a revisão de composição autorizada; nos celulares permanece o agrupamento descrito por altura. As cartas mantêm contraste ao aguardar outra pessoa; sem opacidade reduzida. A barra Jogar/Cancelar sobrepõe a parte inferior da mão (s04), cobre deliberadamente cartas dessa zona e nunca modifica a altura. Cancelar restaura a seleção/foco; Jogar aguarda confirmação do estado do jogo. A carta selecionada continua identificável pelo topo e pelo ✓.

**Aviso transitório:** dourado sobreposto somente ao bloco do cabeçalho, 2,5s, texto de 20px; mostra sentido e a nova vez em duas linhas. Ícone é dispensado para manter “Agora é a vez de Maria Aparecida” completo em 360px, sem cobrir assentos. Em nomes ainda maiores, quebrar texto e usar uma composição com espaço medido; nunca ocultar a identidade por reticências no aviso. A preferência existente controla a faixa; não há novo controle. O assento e cabeçalho continuam indicando o estado depois do aviso. Reduzir movimento preserva a informação, com troca sem animação.

**Gaveta:** barra de 52px com Chat, Eventos, Humor, Sala e selo de não lidas, rótulos de 16px. No celular, fundo modal de 60% do viewport; no desktop, painel lateral direito de 400px, sem deslocar a coluna. Chat tem mensagens recentes primeiro, autor em 16px, campo de 48px e Enviar de 48px. Conteúdo longo rola internamente; teclado virtual exige validação posterior. Fechar por botão de 44px, Escape ou swipe; devolver foco à aba que abriu. Fundo fica inerte enquanto a gaveta estiver aberta. Nenhuma funcionalidade do chat é alterada nesta proposta.

**Observador:** nenhuma célula “você” é inventada. Faixa informa “Você acompanha esta rodada”. A zona da mão mostra “Você está assistindo”, contexto da próxima rodada e Abrir Chat; não mostra mãos privadas ou compra/jogada. Humor permanece pela gaveta e pelos assentos, conforme as permissões existentes.

**Presença:** desconexão usa borda tracejada, nome e detalhe “desconectou”; cabeçalho Rodada pausada e ações bloqueadas (s09). O detalhe explica a espera de até 90s, sem prometer retomada automática. Substituto usa borda pontilhada e rótulo “robô” quando houver espaço, com explicação completa “substituto automático” no detalhe (s07); na tela baixa o detalhe e o nome acessível carregam esse estado. Não mudar contagem nem posição.

## Foco e anúncio

A ordem de Tab proposta é: menu → assentos na ordem fixa do servidor (serpente visual) → ação contextual disponível → Avisar última → Denunciar → ajuda da mão → mão com foco móvel → Chat → Eventos → Humor → Sala. Regiões não interativas, descarte, monte e títulos não criam paradas. A célula inteira é o alvo, nunca o avatar de 20px isolado.

Na mão, preservar o foco móvel já existente: uma parada Tab; setas percorrem cartas e trazem a focada à janela; Enter/Espaço selecionam carta permitida. Selecionada: foco na ação Jogar; Tab segue a Cancelar; Escape cancela e devolve à carta. Após confirmação do servidor, foco vai à carta remanescente prevista pelo comportamento atual, sem roubar foco se a pessoa navegou para outro controle.

Abrir detalhe de assento move foco para o conteúdo/Fechar; Escape/Fechar devolvem ao assento. Gaveta modal limita Tab ao painel: aba ativa → demais abas por setas → Fechar → histórico navegável → campo → Enviar. Escape restaura a aba de origem. Foco nos assentos aparece em s02/s10 e nas cartas em s01; todos os demais controles têm contorno de 3px, claro no feltro e escuro no papel.

Vez e Inversão usam anúncio `aria-live=polite`, com o mesmo texto do estado persistente, sem duplicar o anúncio da faixa visual. Estado pausado, retomada e resultado mantêm os anúncios existentes. Cor, símbolo, texto e desenho da borda se complementam; nenhum estado depende só da cor. Estes são requisitos da implementação futura, não interações funcionais já provadas por PNG.

## Evidências e limites

A [galeria](assets/T016/index.md) reúne s01–s10 em 360, 412, 430 e 1280px. [measurements.json](assets/T016/measurements.json) registra regiões, células, cartas, alvos e fontes em cada um dos 40 desenhos. [verification.json](assets/T016/verification.json) registra zero falhas nos pisos e encaixe dessa matriz. [contrast.md](assets/T016/contrast.md) traz 31 pares calculados: texto mínimo 5,405:1 e limite/foco mínimo 4,167:1, acima dos mínimos pedidos.

A prova foi renderizada em Chrome headless isolado, DPR 1. Não é prova em aparelho físico, em leitor de tela, com zoom real, com teclado virtual ou com todas as fontes dos sistemas móveis. O HTML é um artefato estático de desenho; botões, timers, retorno de foco e comandos não implementam o produto. A fonte histórica fica arquivada e não é normativa. A implementação e seus testes pertencem a T017/T018; aprovação estética continua com o usuário.
