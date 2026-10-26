# T016 — exploração da transição entre assentos

25/10/2026 · Três propostas para escolha visual. A2 e v1 permanecem intactas. Estes estudos não implementam o produto nem declaram aceite.

A comparação mantém exatamente os mesmos jogadores, nomes, contagens, descarte, cor ativa e cartas da A2. Em s02, Josefina está na vez; em s01, é sua vez. A primeira pessoa fica na primeira célula e a segunda fileira segue da direita para a esquerda. A direção continua por extenso no cabeçalho, em 18px.

| Conceito | 8 assentos · 412×915 | 8 assentos · 1280×800 | 4 assentos / sua vez · 412×915 | Transição e virada · 2× |
| --- | --- | --- | --- | --- |
| A — Trilha e peão | [Mesa](concepts/a-412-s02.png) | [Mesa](concepts/a-1280-s02.png) | [Mesa](concepts/a-412-s01.png) | [Recorte](concepts/a-closeup.png) |
| B — Leque de mesa | [Mesa](concepts/b-412-s02.png) | [Mesa](concepts/b-1280-s02.png) | [Mesa](concepts/b-412-s01.png) | [Recorte](concepts/b-closeup.png) |
| C — Fita de cartas | [Mesa](concepts/c-412-s02.png) | [Mesa](concepts/c-1280-s02.png) | [Mesa](concepts/c-412-s01.png) | [Recorte](concepts/c-closeup.png) |

Os recortes são capturados novamente a DPR 2, incluindo toda a faixa e sua virada, com margem para não cortar peão, fita ou curvas. Não são imagens pequenas interpoladas: 808px de largura para um recorte de 404px CSS.

## A — Trilha e peão

**Metáfora:** miniatura de um tabuleiro sobre o feltro. Uma pista larga de latão, casas claras e ramais liga os lugares. Os assentos escuros têm bordas curvas e a sombra de peças apoiadas na mesa. Um peão de 42×50px ocupa a estação da pessoa da vez.

**Direção:** o caminho corre sob a primeira fileira, faz a curva física pela direita e retorna junto à segunda. A cabeça larga está ligada ao fim da pista; a curva contém uma indicação escavada no próprio material. Não há pequenos símbolos soltos entre nomes e números.

**Vez:** peão grande alinhado à estação de Josefina, além de assento dourado, numeral escuro, etiqueta textual e cabeçalho. O peão não invade nome ou contagem.

**Inversão proposta:** a indicação de fluxo e a cabeça da pista passam a apontar no percurso oposto; o peão só muda de estação quando a vez mudar. As posições dos jogadores ficam fixas. O movimento deve acompanhar a pista e respeitar reduzir movimento. Os PNGs mostram o estado horário, não uma animação já implementada.

**Resto da UI:** centro demarcado como uma área oval discreta no feltro, mantendo pilhas e mão. Nenhuma mudança de comando ou carta.

**Força:** objeto físico grande dá uma âncora imediata para a vez; pista de 18px é muito mais presente que as setas da A2. **Custo:** é o estudo mais próximo de um jogo de tabuleiro; o peão e as estações competem um pouco com o descarte e precisam de 248px de faixa no estado de oito assentos.

## B — Leque de mesa

**Metáfora:** lugares de papel ligeiramente arqueados, como um leque aberto em torno da área de jogo. As curvas dos cartões, suas inclinações de até 3° e as duas linhas arqueadas criam uma mesa compartilhada, sem depender de um anel de assentos.

**Direção:** um medalhão de 60px, com ponteiro circular de alto contraste, fica entre as fileiras; o arco contínuo guia o olhar até a curva da direita e a volta. O ponteiro explicita o sentido global em escala grande. A cabeça terminal pertence ao arco.

**Vez:** lugar dourado elevado pelo contorno, peso tipográfico e “vez/na vez”; o medalhão indica o sentido e não muda de posição para fingir que é o jogador.

**Inversão proposta:** o ponteiro varre no sentido contrário e o fluxo visual do arco inverte, com as pessoas nos mesmos lugares. Em reduzir movimento, trocar o estado sem rotação animada. A transição ainda depende de implementação posterior.

**Resto da UI:** a área de compra/descarte ganha um friso oval dourado, como uma marca de mesa; mão e ações conservam os componentes da A2.

**Força:** é o estudo mais caloroso e orgânico; papel claro facilita leitura e o sentido tem um sinal central grande. **Custo:** o medalhão exige mais altura (258px de faixa); a direção global é forte, mas a passagem entre duas pessoas fica menos literal que na trilha. Inclinações e retorno do arco devem passar por avaliação humana de leitura.

## C — Fita de cartas

**Metáfora:** cartões de lugar presos a uma guirlanda de cetim dourado. A fita tem costura decorativa, dobra na ponta e presilhas de papel. São lugares com aparência de cartas, não blocos de um painel.

**Direção:** a fita atravessa a primeira fileira, dobra continuamente na direita e passa acima da segunda em retorno. A cabeça grande da ponta é parte da própria fita; sua dobra mostra que o percurso prossegue. As presilhas ligam fisicamente cada lugar ao mesmo trajeto.

**Vez:** o cartão de Josefina se ergue 6px, gira apenas 2° e recebe ouro e sombra de carta jogada; nome, quantidade, etiqueta e cabeçalho continuam legíveis. O gesto sugere que aquela carta entrou na rodada.

**Inversão proposta:** a dobra/cabeça e o fluxo da fita passam a indicar o sentido contrário; os cartões permanecem presos nos mesmos lugares. A carta da vez apenas sobe/desce ao trocar a pessoa. Nenhum jogador é reordenado ou ocultado.

**Resto da UI:** o descarte tem leve inclinação e uma borda de papel deslocada, como carta recém-jogada; o resto da mesa fica mais sóbrio para a faixa e a mão continuarem protagonistas.

**Força:** é a proposta mais específica de cartas, com material e gesto lúdico, sem exigir um objeto adicional para explicar a vez. A faixa de 236px usa menos altura que A/B. **Custo:** presilhas e dobras acrescentam detalhes; a costura é decoração e não pode virar a única pista de direção. A continuidade da fita e a cabeça grande precisam sobreviver à futura redução para 360px.

## Comparação e recomendação

| Dimensão | A · Trilha | B · Leque | C · Fita |
| --- | --- | --- | --- |
| Objeto dominante | Peão sobre pista | Ponteiro em medalhão | Cartão erguido preso à fita |
| Leitura da vez | Objeto + estação + ouro | Cartão + ouro | Carta erguida + ouro |
| Leitura da direção | Caminho físico com virada | Giro global + arcos | Fita contínua com dobra |
| Caráter | Tabuleiro de família | Mesa acolhedora e orgânica | Baralho, papel e gesto de jogar |
| Faixa com oito assentos | 248px | 258px | 236px |
| Faixa com quatro assentos | 150px | 150px | 150px |
| Principal risco | Informação visual adicional | Sentido global sem passagem tão literal | Detalhe de fita em tela menor |

**Recomendo C para a próxima avaliação visual**, pela ligação direta com o baralho e pelo espaço menor. A é a alternativa mais literal para testar reconhecimento da passagem e da vez. B é uma exploração deliberadamente mais orgânica, útil se o usuário preferir a sensação de lugares à mesa. Não recomendo misturar os três antes de escolher a metáfora: isso somaria enfeites e enfraqueceria a leitura.

Essa recomendação é de design, não evidência de compreensão por usuários. A pergunta para a avaliação humana é se o percurso e o próximo lugar são reconhecidos sem consultar esta explicação; essa prova ainda não ocorreu.

## Pisos, contraste e encaixe

As nove mesas completas mantêm cabeçalho 20/18px, nomes 16px, contagem 26/14px, etiqueta de vez 14px, carta/pilha 14px, corpo 16px, cartas da mão >=72px e botões >=44px. Em 412px, as cartas continuam com 82,5×122px em duas fileiras; no desktop, 96×136px e oito cartas completas em uma fileira. Todos os oito assentos continuam visíveis. Não há textura atrás dos textos.

[Verificação](concepts/verification.json): nove viewports completos, três recortes 2×, zero falhas em encaixe, contagem de assentos, limites, dimensões, fontes, tamanho de cartas/toque e scroll desktop. [Medidas brutas](concepts/measurements.json) registram as regiões e fontes.

[Contrastes calculados](concepts/contrast.md): 37 pares aprovados, incluindo os 31 da A2 e seis das novas superfícies/materiais. Texto mínimo 5,405:1; novo limite/fluxo mínimo 3,170:1. Anéis de foco claros no feltro e escuros no papel permanecem. A sombra do latão/fita é o ponto mais baixo do gradiente; os outros tons são mais claros. Costuras, sombras e frisos não são o único indicador de estado.

## Limites da exploração

Artefatos estáticos em Chrome isolado, DPR 1 para as mesas e DPR 2 para os recortes. Não são animações implementadas nem testes de teclado/leitor de tela, inversão real ou compreensão humana. Esta exploração cobre somente os três enquadramentos pedidos por conceito; não revalida 360px nem todos os estados A2 com as novas metáforas. A2 continua como histórico intacto, sem substituir a escolha estética do usuário.

[Fontes de renderização](concepts/source/concepts.html), [script](concepts/source/render.py), [verificador](concepts/source/verify.py), [isolamento](concepts/browser-session.json) e [hashes A2 preservados](concepts/preserved-A2-hashes.json). Nenhum código de aplicação ou infraestrutura foi alterado.
