# Mesa de jogo, reações e telas

**Escopo aprovado em 25/10/2026**, após entrevista `grill-with-docs` em quatro rodadas. Substitui, na parte de humor, [provocações pelo avatar e reações](provocacoes-e-reacoes.md), e incorpora os requisitos de leitura de [acessibilidade visual](acessibilidade-visual.md). O desenho da faixa linear do [ADR 0001](../adr/0001-faixa-de-assentos-substitui-o-anel.md) é substituído pelo trilho do [ADR 0002](../adr/0002-trilho-de-mesa-substitui-a-faixa.md); a troca de provocações por reações está no [ADR 0003](../adr/0003-reacoes-substituem-provocacoes.md).

## Objetivo

Redesenhar **todas as telas** do Tretta a partir do protótipo criado pelo usuário, com uma mesa de jogo legível para baixa visão, uma única metáfora visual e uma forma mais simples de humor: cada pessoa reage ao que aconteceu, sem escolher alvo.

O protótipo de referência está em [`docs/work/t016-prototype/`](../work/t016-prototype/). Ele cobre a mesa e seus overlays; a extensão para home, preparação, espera e resultado é a primeira tarefa desta feature.

## Direção visual

**Mesa posta.** Todas as telas pertencem ao mesmo mundo: madeira, feltro verde, latão, papel creme e tipografia expressiva. A home é um convite sobre a mesa; a preparação é a mesa posta com assentos e estado de prontidão; a espera é a mesa sem mão; o resultado é o placar de papel sobre a mesa.

- **Fontes:** Fraunces para títulos, números e coringa; Atkinson Hyperlegible Next para corpo, nomes e rótulos. Ambas locais, licença OFL, com fallback de sistema.
- **Mesa:** moldura de madeira, feltro, trilho contínuo de latão, assentos em placa de madeira, peão de madeira na vez.
- **Cartas:** creme, número grande, nome da cor e símbolo de forma; cor nunca sozinha.
- **Sem:** glassmorphism, gradiente roxo, cards genéricos de SaaS, micro-setas, barras de progresso, texto sobre textura.

## Telas

| Tela | Conteúdo | Rolagem |
| --- | --- | --- |
| Home | Criar sala, entrar com código, apelido/avatar, treino | Pode rolar; ação principal sempre visível |
| Preparação | Assentos com jogadores, pronto/não pronto, anfitrião inicia, convite, espera de participantes | Pode rolar; ação principal sticky |
| Espera / observador | Mesa pública sem mão, vez e sentido, barra inferior, reações | Mesa sem rolagem |
| Mesa | Jogo, pausa, gaveta, reações, confirmação de jogada | **Sem rolagem vertical** em 412×915 e 360×640 |
| Resultado | Vencedor, placar de rodadas, volta à preparação | Tela dedicada; pode rolar; ação do anfitrião sticky |
| Erros e recuperação | Conexão perdida, retomada, sala expirada, link inválido | Pode rolar |

- A barra inferior **Conversa / Reagir / Histórico** é compartilhada por preparação, espera, mesa e resultado. A home fica fora, porque ainda não há sala.
- A gaveta “Sala” é compartilhada entre essas telas.
- O resultado é **tela dedicada**, não overlay: o app atual já separa `finished`; o placar de até oito pessoas precisa de espaço e o fluxo de prontidão continua.
- O requisito de **sem rolagem** vale para a mesa durante a jogada; nas outras telas, rolagem é permitida com ação principal fixa.

## Mesa

- Trilho contínuo em volta da mesa, com peão ao lado de quem joga. A ordem e o sentido são lidos pelo caminho, pelo peão e pelo texto de 18px no topo.
- **2–8 assentos** visíveis em todos os tamanhos garantidos. Você fica na base; com 2, frente a frente; com 3, em triângulo; de 4 a 8, distribuídos pelo perímetro. Nenhum jogador é escondido.
- Cada assento: avatar, apelido em 16px, quantidade em numeral de 26px + “cartas” em 14px, etiqueta “na vez” em 14px, “última”, bot, substituto ou ausente.
- Nomes curtos (até ~12 caracteres) não truncam; nomes longos usam reticências e o nome completo abre em diálogo.
- Topo: vez em 20px e sentido em 18px. Nome/código da sala saem do topo e vão para “Sala”.
- Centro: monte com quantidade em numeral, descarte dominante, cor ativa com nome e símbolo.
- Ações: principal de 56px; secundárias de 44px. Comprar, passar, avisar última e denunciar seguem as regras atuais.
- Mão: duas fileiras de quatro em 412/430; uma fileira de oito no desktop; rolagem horizontal só acima de oito cartas. Confirmação de jogada é sobreposição, não muda a altura.
- Pausa: mantém as decisões do anfitrião (substituir, continuar, encerrar) e o retorno automático de quem caiu.
- Resultado: mantém a volta à preparação pelo anfitrião e a confirmação de prontidão de todos.

## Gaveta “Sala”

Três abas: **Conversa**, **Histórico** e **Sala**. Dentro de Sala, seções:

- **Sala:** código, convite, resumo curto das regras, sair.
- **Jogadores:** lista com nome completo, cartas, presença, bot/substituto, silenciar participante e controles do anfitrião (remover na preparação).
- **Apresentação:** animações (completa/reduzida/desligada), silenciar sons, aviso sonoro da vez, ocultar reações. “Ocultar provocações” deixa de existir.
- **Anfitrião:** iniciar rodada na preparação e encerrar sem vencedor durante o jogo.

Os controles específicos de pausa continuam no overlay de pausa. A gaveta não muda a altura da mesa; foco preso, Escape fecha e devolve o foco.

## Reações

- **Doze reações**, em grade 4×3, abertas pela barra inferior “Reagir” em preparação, espera, mesa (inclusive pausa) e resultado.
- Reação é **individual, sem destinatário**, para expressar o que a pessoa sente sobre a jogada. Não altera regras. Não há escolha de alvo nem texto livre.
- As frases com alvo implícito do protótipo — “Se ferrou!”, “Toma essa!”, “Palhaço!” e “Sacanagem!” — serão reescritas para expressão própria; a copy final é aprovada junto com a extensão do protótipo.
- **Apresentação:** overlay central com emoji grande (~100px), anel, faíscas e pílula “quem · reação”. Entra, fica **4 segundos** e sai suave.
- **Simultaneidade:** fila de até 3 reações; o excedente é descartado. O overlay não bloqueia a mesa (`pointer-events: none`) e não escurece o jogo.
- **Limite:** uma reação a cada **5 segundos** por emissor, independente de outros limites. Reações são **silenciosas**.
- **Preferência:** “Ocultar reações” continua, persistida no navegador; ocultar remove as apresentações locais e mantém o envio com confirmação textual. Reativar mostra apenas reações novas.
- **Provocações com alvo saem do produto**: UI, protocolo, servidor, limites, aviso de resposta, preferência e testes. A ideia futura de reagir a alguém (torta etc.) fica no backlog como desenho novo.

## Preservado

- Regras do Clássico, motor, autoridade do servidor, mãos privadas e projeções.
- Pausa, retorno do ausente, substituto, encerramento sem vencedor, transferência de anfitrião.
- Última carta e denúncia conforme o comportamento atual, inclusive na própria vez e na janela antes/depois do descarte.
- Preparação com prontidão, início pelo anfitrião, entrada automática de quem aguarda a próxima rodada (sem fila opt-in).
- Treino contra bots, mesa pública, observadores, chat, silenciar participante, recuperação e reconexão.
- Preferências de animação, som, aviso de vez e ocultar reações; “ocultar provocações” é removida.

## Protocolo e servidor

- `REACTION_TYPES` passa de 3 para **12**; servidor valida, aplica o limite de 5s e transmite para a sala.
- Remover tipos, comandos, eventos, limites, avisos de resposta e testes de provocação.
- Web e servidor sobem **juntos**; a mudança não é compatível com cliente antigo. Publicação exige janela e autorização específica.
- Nenhuma regra de carta muda.

## Acessibilidade

- Pisos: vez 20px; sentido 18px; contagem 26/14px; nome 16px; nome na carta 14px; rótulos 14px; corpo 16px; “na vez” 14px.
- Cartas ≥72px; alvos ≥44px; contraste de texto ≥4,5:1 e de foco/limites ≥3:1.
- Mesa sem rolagem em 412×915 e 360×640; desktop 1280×800 com oito cartas em uma fileira.
- Teclado, foco visível, armadilha de foco na gaveta/diálogos, `aria-live` para vez/cor/descarte/inversão, `aria-current` no assento.
- Movimento reduzido respeitado; Inversão legível sem animação; zoom de 200% (640px de largura) sem esconder informação.

## Fora de escopo

- Reações com alvo (torta, etc.) — backlog.
- Novas regras de cartas, pontuação por cartas, campeonatos.
- Contas, ranking global, persistência após reinício, voz integrada, hospedagem paga.
- Publicação: tarefa separada, com autorização e janela.

## Aceite

1. Todas as telas redesenhadas na mesma linguagem, em 412×915, 360×640 e 1280×800.
2. Mesa sem rolagem vertical nos tamanhos garantidos; 2–8 assentos visíveis; nomes curtos sem truncar.
3. Pisos, contraste, cartas, alvos e foco medidos no DOM.
4. Vez, sentido, ordem e passagem compreendidos sem explicação; nenhuma micro-seta.
5. Doze reações individuais, sem alvo, com fila de 3, 4s, limite de 5s e preferência de ocultar.
6. Nenhuma provocação com alvo na UI, no protocolo, no servidor ou nos testes.
7. Pausa, última carta, denúncia, prontidão, entrada automática, treino, bots, substitutos e observador preservados.
8. Teclado, foco, `aria-live`, nomes acessíveis e movimento reduzido sem regressão.

## Continuidade

| Etapa | Entrega |
| --- | --- |
| T018 | Extensão do protótipo: home, preparação, espera, mesa, resultado, erros; 12 reações; Sala; 2–8 assentos |
| T019A | Protocolo e servidor: 12 reações, remoção das provocações |
| T019B | Base web: tokens, fontes, casca compartilhada |
| T019C | Mesa: trilho, assentos, centro, mão, ações |
| T019D | Gaveta, Sala, preferências, anfitrião, reações |
| T019E | Home, preparação, espera, resultado, erros |
| T019F | Verificação, comparação visual e aceite local |
| Publicação | Tarefa separada, somente com autorização |

Execução pelo Orca, com **opencode** como executor. Cada etapa é aceita antes da seguinte.
