# Racional — protótipo estendido T018

## O que este protótipo é

Extensão navegável do protótipo aprovado em [`../t016-prototype/`](../t016-prototype/), sem build e sem backend. Ele cobre **home, preparação, espera/observador, mesa, resultado e recuperação**, mantém a metáfora da mesa posta e leva as **doze reações individuais** para todas as telas com sala. O protótipo original permanece intacto; os assets e as fontes foram copiados para `docs/work/t018-prototype/`.

A direção visual é a mesma: madeira, feltro verde-pinheiro, latão, papel creme, cartas de marfim, trilho contínuo e peão de madeira. Não há glassmorphism, gradiente roxo, dashboard, cards genéricos de SaaS nem micro-setas entre assentos.

## Telas e rotas

| Rota | Estado |
| --- | --- |
| `#home` | Convite sobre a mesa: criar sala, entrar com código, apelido, avatar e treino. |
| `#preparacao` | Dois jogadores, anfitrião, você pronto, Bia aguardando, convite e pessoa aguardando a próxima rodada. |
| `#preparacao-pronta` | Dois jogadores prontos; “Iniciar rodada” habilitado. |
| `#preparacao-cheia` | Oito jogadores, seis prontos, dois aguardando; convite e duas pessoas na próxima rodada. |
| `#preparacao-paineis` | Preparação rolada até os painéis de convite, mesa, espera e regras. |
| `#preparacao-sala` | Preparação com a gaveta Sala aberta. |
| `#espera` | Observador sem mão, mesa pública de seis jogadores, vez, sentido, barra e reação. |
| `#mesa` | Quatro jogadores, sua vez, oito cartas, monte, descarte vermelho 6 e cor vermelha. |
| `#mesa-2` … `#mesa-8` | Mesa com 2 a 8 assentos, sua vez, para conferir a geometria do trilho. |
| `#mesa-cheia` | Oito jogadores, vez de Rita, nomes longos, Tio Juca com 12 cartas e Léo com 1 sem aviso. |
| `#inversao` | Inversão azul, sentido anti-horário, vez de Léo e peão do outro lado. |
| `#carta` | Carta selecionada e confirmação “Jogar …?” sobre a mão. |
| `#cor` | Coringa jogado e escolha de cor em sobreposição. |
| `#conversa` | Gaveta Conversa aberta. |
| `#sala` | Gaveta Sala aberta nas seções Sala e Jogadores. |
| `#sala-apresentacao` | Gaveta Sala rolada até Apresentação. |
| `#sala-anfitriao` | Gaveta Sala rolada até Anfitrião. |
| `#pausada` | Pausa com decisões do anfitrião: substituir, continuar ou encerrar sem vencedor. |
| `#ausente` | Oito assentos com pessoa desconectada, substituto e bot. |
| `#ultima` | Duas cartas na mão, Bia com uma anunciada e ação “Avisar última”. |
| `#denuncia` | Sua vez, Bia com uma carta sem aviso e ação “Denunciar”. |
| `#treino` | Treino com três bots. |
| `#resultado` | Tela dedicada com vencedor, placar de oito pessoas e volta à preparação pelo anfitrião; topo só “Rodada encerrada”. |
| `#resultado-convidado` | Mesmo placar, sem o botão do anfitrião; a pessoa aguarda. |
| `#resultado-sem-vencedor` | Resultado de encerramento sem vencedor. |
| `#erro-conexao` | Conexão perdida, retomada e volta ao início. |
| `#erro-sala` | Sala expirada, criar nova sala ou entrar com código. |
| `#erro-link` | Link inválido, entrar com código ou voltar ao início. |
| `#reacoes` | Bandeja de reações aberta na mesa. |
| `#reacao` | Reação fixa de Bia para inspeção da apresentação central. |

Qualquer hash desconhecido abre `#erro-link`. A barra inferior tem **Conversa / Reagir / Histórico**, como no escopo aprovado. A gaveta tem as abas **Conversa / Histórico / Sala**; na preparação, o botão “Abrir Sala” leva direto à aba. O topo não carrega nome nem código da sala: nas telas de rodada mostra apenas a vez (20px) e o sentido (18px); no resultado, só “Rodada encerrada”. Nome e código ficam na gaveta.

## Mesa e assentos

O trilho é um caminho fechado de latão desenhado em SVG a partir do tamanho real da mesa. O peão de madeira para no vão ao lado do assento de quem joga, deslocado no sentido da rodada. Não há setas entre assentos. A inversão é legível por três canais: o texto “anti-horário” no topo, a roseta e o peão do outro lado; o histórico também registra a jogada.

A geometria é calculada para 2–8 assentos, sempre com a pessoa na base e a pessoa mais próxima do lado oposto no topo:

| Pessoas | Distribuição |
| ---: | --- |
| 2 | base + topo, frente a frente |
| 3 | base + topo + 1 lateral; a lateral fica à esquerda no sentido horário e à direita no anti-horário |
| 4 | base + topo + 1 esquerda + 1 direita |
| 5 | base + topo + 2 à esquerda + 1 à direita |
| 6 | base + topo + 2 à esquerda + 2 à direita |
| 7 | base + topo + 3 à esquerda + 2 à direita |
| 8 | base + topo + 3 à esquerda + 3 à direita |

O índice 0 ocupa a base; o índice oposto (`ceil(n/2)`) ocupa o topo. Os demais mantêm a ordem do sentido no perímetro: descem/sobem pela esquerda, cruzam o topo e continuam pela direita. Para 3 pessoas, a lateral única troca de lado quando o sentido é anti-horário, preservando a leitura base → lateral → topo. O peão fica no trilho, encostado na borda externa do assento da vez, com folga para não cobrir avatar, nome, contagem ou etiqueta.

O layout compacto de 360×640 reduz paddings, vãos, avatar, centro, monte e cartas (74px), sem baixar nenhum piso de fonte. As posições laterais usam faixas de 22%, 50% e 78% para três assentos por lado, 30% e 70% para dois, e 50% para um. A mesa continua sem rolagem vertical; a mão continua em duas fileiras de quatro porque oito cartas cabem sem corte nem sobreposição. As medições de assento, sobreposição, moldura e rolagem estão no report.

## Nomes

- Nomes com **até 12 caracteres** não usam reticências: podem ocupar uma ou duas linhas. “Vó Cida”, “Seu Nilton”, “Bia”, “Rita”, “Léo” e “Tio Zeca” são medidos no DOM.
- Nomes acima de 12 caracteres usam uma linha com reticências quando não cabem; o nome completo aparece no diálogo do assento, aberto por toque, clique ou teclado. “Tio Juca do Sítio” e “Fernanda Albuquerque” são os casos de prova; em 1280, “Tio Juca do Sítio” cabe inteiro.
- Cada assento é um botão com avatar, apelido, quantidade, “na vez”, “última”, bot, substituto ou ausente. O `aria-label` repete o nome completo e o estado.

## Reações

A reação é **individual e sem destinatário**. A bandeja abre pela barra “Reagir” na preparação, espera, mesa (inclusive pausa) e resultado. Ela tem 4×3 botões, emoji + frase, sem campo de texto e sem escolha de alvo. A apresentação é central: emoji grande (~100px), anel, faíscas e pílula “quem · reação”; entra, fica **4 segundos** e sai suave. `pointer-events: none`, sem escurecer a mesa.

A fila interna aceita **até 3** reações; a quarta é descartada com aviso textual. Cada emissor respeita **5 segundos** entre reações. As reações são **silenciosas**. “Ocultar reações” fica em Sala → Apresentação: ocultar remove as apresentações locais e o envio passa a ter confirmação textual; reativar mostra apenas reações novas. A preferência é persistida no navegador.

### Copy final das doze reações

As quatro frases com alvo implícito do catálogo original foram reescritas. A copy final é:

| # | Emoji | Frase | Origem/observação |
| ---: | :---: | --- | --- |
| 1 | 😂 | Eita! | substitui “Se ferrou!” |
| 2 | 😭 | Que injustiça! | expressão própria |
| 3 | 😈 | Aí eu gostei! | substitui “Toma essa!” |
| 4 | 🤬 | Não acredito! | substitui “Sacanagem!” |
| 5 | 👏 | Boa jogada! | mantida |
| 6 | 🤡 | Que comédia! | substitui “Palhaço!” |
| 7 | 🥱 | Que tédio! | mantida |
| 8 | 😱 | Uau! | expressão própria |
| 9 | 💀 | Já era! | mantida |
| 10 | 🤔 | Suspeito... | mantida |
| 11 | 😘 | Com carinho! | mantida |
| 12 | 🔥 | Tá pegando fogo! | mantida |

Nenhuma opção pergunta “para quem?”. A dica da bandeja diz “individual, sem destinatário”. Não existe provocação, resposta, aviso de 30 segundos nem “ocultar provocações” em nenhuma tela.

## Gaveta Sala

A gaveta é uma sobreposição fixa: abrir e fechar não muda a altura da mesa. O foco fica preso, Escape fecha e devolve o foco ao controle de origem. As abas são Conversa, Histórico e Sala. Em Sala, as quatro seções são:

1. **Sala:** código, convite e resumo das regras com chevron e prévia curta quando fechado.
2. **Jogadores:** nome completo, cartas, presença, bot/substituto, silenciar participante; remover na preparação quando for anfitrião.
3. **Apresentação:** animações (completa/reduzida/desligada), silenciar sons, aviso sonoro da vez, ocultar reações.
4. **Anfitrião:** iniciar rodada na preparação; encerrar sem vencedor durante o jogo.

“Sair da sala” fica ao fim da aba, depois de Sala, Jogadores, Apresentação e Anfitrião; pede confirmação. “Remover” também pede confirmação e só aparece na preparação. A lista de jogadores usa o nome completo e a etiqueta de presença; o diálogo do assento repete o nome completo e permite silenciar/remover.

## Preparação, espera e resultado

- A preparação é a mesa posta com assentos e prontidão. O anfitrião vê “Iniciar rodada”; a ação fica no topo do conteúdo, sticky. Quem aguarda a próxima rodada aparece em painel próprio e entra automaticamente; não existe “Entrar na fila”.
- A espera é a mesa pública sem mão. A barra inferior e “Reagir” continuam disponíveis.
- O resultado é tela dedicada, não overlay. O topo mostra só “Rodada encerrada”, sem placa de sentido. O anfitrião vê “Voltar à preparação”; quem não é anfitrião vê “Aguardando o anfitrião voltar à preparação”. Não existe “Jogar de novo”.
- A pausa mantém as decisões do anfitrião (substituir por bot, continuar sem a pessoa, encerrar sem vencedor). O retorno da conexão retoma a rodada automaticamente; não existe “Voltar ao jogo” genérico.
- A recuperação cobre conexão perdida, sala expirada e link inválido. O link inválido é o destino de qualquer hash desconhecido.

## Acessibilidade

- Foco visível de 3px; no escuro, `#F2C766`; no papel, `#7A3F0E`.
- Gaveta e diálogos prendem o foco; Escape fecha e devolve o foco ao controle de origem.
- `aria-live` anuncia vez, cor ativa, descarte, inversão, pausa, resultado e reação.
- `aria-current="true"` no assento de quem joga.
- `prefers-reduced-motion` reduz animações; a inversão continua legível por texto.
- A preferência de animações permite completa, reduzida ou desligada.
- Alvos de toque com no mínimo 44px; cartas com no mínimo 72px de largura.
- Zoom de 200% (640px de largura) sem overflow horizontal; em 640×400 a mesa passa a rolar para não esconder informação.
- Não há texto funcional em caixa alta, apertado ou sobre a textura do feltro.

## Contraste

Pares calculados a partir dos tokens (WCAG 2.1):

| Par | Contraste |
| --- | ---: |
| Creme `#F7EDD8` / feltro `#123B2D` | 10,69:1 |
| Tinta `#1B1410` / latão `#D7AB63` | 8,57:1 |
| Creme / vermelho `#C4322A` | 4,71:1 |
| Creme / verde `#277147` | 5,10:1 |
| Creme / azul `#2857B8` | 5,74:1 |
| Tinta / creme | 15,65:1 |
| Borda `#8A6234` / creme | 4,66:1 |
| Borda `#8A7660` / gaveta `#14100C` | 4,36:1 |
| Borda `#8A7660` / interruptor `#2A221A` | 3,61:1 |
| Borda do assento `#B08A54` / feltro | 3,91:1 |
| Foco `#F2C766` / feltro | 7,78:1 |
| Foco `#F2C766` / madeira `#3B2418` | 9,05:1 |
| Foco escuro `#7A3F0E` / papel `#FBF3E2` | 7,47:1 |
| Papel muted `#5A4430` / papel | 8,25:1 |

O detalhamento por elemento e as medições de fonte, alvo, carta e assento estão em [`../reports/T018.md`](../reports/T018.md).

## Limites conhecidos

- Dados estáticos e simulação local; não há backend, login, persistência de partida ou dados reais.
- As preferências de apresentação são persistidas em `localStorage`; “silenciar sons” e “aviso sonoro da vez” são estados de interface, sem reprodução de áudio neste protótipo. As reações são silenciosas por definição.
- A fila de reações é interna e limitada a três; a apresentação de cada reação usa 4s e o limite de envio é 5s. O protótipo não tem relógio de servidor.
- Os tempos observados em navegador podem variar com throttling de aba em segundo plano; os valores de contrato estão no código (`DURACAO_REACAO_MS = 4000`, `LIMITE_REACAO_MS = 5000`).
- Não há aparelho físico, leitor de tela real ou teste com participantes humanos nesta entrega; a verificação é em navegador dedicado, com viewport exato.
- O protótipo não altera `apps/web`, `packages`, servidor, protocolo, configuração ou regras.
