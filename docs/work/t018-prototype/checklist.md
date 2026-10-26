# Checklist de verificação — protótipo estendido T018

Arquivos: `index.html`, `assets/app.css`, `assets/app.js`, `assets/fonts/fraunces.woff2`, `assets/fonts/atkinson.woff2`, `racional.md` e este checklist. Não há build. Abra `index.html` na pasta `docs/work/t018-prototype/`; as rotas são hashes.

Evidências: [`../reports/T018.md`](../reports/T018.md) e [`../reports/assets/T018/`](../reports/assets/T018/). Este checklist descreve verificações; **não declara aceite**. O orquestrador e o usuário validam o protótipo antes de qualquer código em `apps/web`.

## D1 — Telas

| Tela | Rotas | Capturas |
| --- | --- | --- |
| Home | `#home` | 412×915, 360×640, 1280×800 |
| Preparação | `#preparacao`, `#preparacao-pronta`, `#preparacao-cheia`, `#preparacao-paineis`, `#preparacao-sala` | três larguras; painéis e gaveta |
| Espera/observador | `#espera` | três larguras |
| Mesa | `#mesa`, `#mesa-cheia`, `#inversao`, `#carta`, `#cor`, `#conversa`, `#sala`, `#pausada`, `#ausente`, `#ultima`, `#denuncia`, `#treino`, `#mesa-2`…`#mesa-8` | três larguras |
| Resultado | `#resultado`, `#resultado-convidado`, `#resultado-sem-vencedor` | três larguras; topo só “Rodada encerrada” |
| Erros/recuperação | `#erro-conexao`, `#erro-sala`, `#erro-link` | três larguras |

Qualquer hash desconhecido abre `#erro-link`. A home não tem barra inferior porque ainda não há sala. As demais telas com sala compartilham **Conversa / Reagir / Histórico** e a gaveta **Conversa / Histórico / Sala**.

## D2 — Mesa

- 2 a 8 assentos visíveis em 412×915, 360×640 e 1280×800; a pessoa fica na base. Distribuição: 2 = base+topo; 3 = base+topo+1 lateral (esquerda no horário, direita no anti-horário); 4 = base+topo+1+1; 5 = base+topo+2+1; 6 = base+topo+2+2; 7 = base+topo+3+2; 8 = base+topo+3+3.
- Medições de `assentoCount`, `assentoLados`, `overlaps` e `assentosForaDaMesa` em `measurements.json`: 2, 3, 4, 5, 6, 7 e 8 assentos, zero sobreposições e zero assentos fora da mesa nas três larguras.
- Sem rolagem vertical da tela da mesa em 412×915 e 360×640: `telaH == telaClientH` e `telaRolagemVertical: false` em todos os estados de mesa medidos. A rolagem interna da gaveta, da mão acima de oito cartas e de telas baixas é separada.
- 1280×800: oito cartas em uma fileira; carta de 92px. Em 412, oito cartas em duas fileiras de quatro com 89px. Em 360, duas fileiras de quatro com **74px**; o modo compacto reduz paddings, vãos, avatar, centro e monte, mantendo os pisos de fonte.
- Oito cartas não rolam; acima de oito, a própria mão rola na horizontal (`.mao--rolagem`), sem rolar a página. No 360, a contagem “8 cartas” permanece visível no cabeçalho da mão.
- O trilho é contínuo; o peão fica no vão ao lado de quem joga, encostado na borda externa do assento, e troca de lado na inversão. Não há micro-setas entre assentos.

## D3 — Leitura

Pisos medidos no DOM (mesma tabela nas três larguras):

| Elemento | Piso | Medido |
| --- | ---: | ---: |
| Vez | 20px | 20px |
| Sentido | 18px | 18px |
| Contagem | 26px + 14px | 26px / 14px |
| Nome do jogador | 16px | 16px |
| Nome na carta | 14px | 14px |
| Rótulo de cor | 14px | 14px |
| Corpo e ações | 16px | 16px |
| “na vez” | 14px | 14px |
| Rótulos e status (`.tag`) | 14px | 14px (CSS) |

- Cartas: 74px em 360×640 (compacto), 89px em 412×915 e 92px em 1280×800; todas ≥72px.
- Alvos: zero controles visíveis abaixo de 44×44 nas 105 medições de rota/largura (`alvosMenores: []`).
- Nomes curtos: **333/333** medições de nomes com até 12 caracteres sem reticências e sem estouro horizontal. “Vó Cida”, “Seu Nilton”, “Bia”, “Rita”, “Léo”, “Tio Zeca” e “Você” podem ocupar duas linhas, mas não truncam.
- Nomes longos: **36/42** ocorrências usam reticências quando não cabem; as demais cabem inteiras. O nome completo abre no diálogo do assento. Em 1280, “Tio Juca do Sítio” cabe inteiro; “Fernanda Albuquerque” usa reticências. Os três diálogos medidos mostram “Fernanda Albuquerque”.
- Contraste: `contrasts.json`; todos os pares de texto ≥4,5:1; foco e limites ≥3:1. Exemplos: creme/feltro 10,69:1; tinta/latão 8,57:1; creme/vermelho 5,18:1; borda de assento/feltro 3,91:1; foco/feltro 7,78:1; foco escuro/papel 7,47:1.
- Cor nunca é o único indicador: nome da cor, forma no canto, forma + nome na cor ativa e nas opções do coringa.
- Sem caixa alta em texto funcional e sem texto sobre a textura do feltro.

## D4 — Reações

- **12 opções** em grade 4×3: Eita!, Que injustiça!, Aí eu gostei!, Não acredito!, Boa jogada!, Que comédia!, Que tédio!, Uau!, Já era!, Suspeito..., Com carinho!, Tá pegando fogo!.
- Reação **individual, sem destinatário**: nenhum botão tem `data-jogador`; a bandeja diz “individual, sem destinatário”.
- Overlay central: emoji grande (~84–108px), anel, faíscas, pílula “quem · reação”; `pointer-events: none`; sem scrim.
- Fila de até **3**; a quinta tentativa (com uma em exibição e três na fila) é descartada com aviso.
- Apresentação de **4s** (`DURACAO_REACAO_MS = 4000`) + saída suave; a próxima entra depois. O log do navegador registrou adição, remoção após a saída e a próxima adição.
- Limite de **5s** por emissor (`LIMITE_REACAO_MS = 5000`); a segunda reação em menos de 5s mostra “Calma: uma reação a cada 5 segundos.”
- Reações **silenciosas**: nenhum áudio é reproduzido.
- **Ocultar reações** em Sala → Apresentação: ocultar remove a apresentação local e o envio mostra confirmação textual; reativar mostra apenas reações novas. A preferência persiste.
- “Reagir” disponível na preparação, espera, mesa (inclusive pausa) e resultado.
- Nenhuma provocação, resposta, aviso de 30s ou preferência de ocultar provocações em nenhuma tela. O texto renderizado foi varrido nas 105 medições (`textoProibido: []`).

## D5 — Sala

A gaveta tem as abas **Conversa**, **Histórico** e **Sala**. Em Sala, as quatro seções estão presentes em `gavetaSecoes`:

1. **Sala:** código `TRT-4821`, convite `tretta.app/sala/TRT-4821` e resumo das regras com chevron e prévia curta quando fechado.
2. **Jogadores:** nome completo, cartas, presença, bot/substituto, silenciar; remover na preparação quando for anfitrião.
3. **Apresentação:** animações completa/reduzida/desligada, silenciar sons, aviso sonoro da vez, ocultar reações.
4. **Anfitrião:** iniciar rodada na preparação; encerrar sem vencedor durante o jogo.

- **Sair da sala** fica ao fim da aba, depois de Sala, Jogadores, Apresentação e Anfitrião; é o último item e mantém a confirmação modal.
- O resumo das regras é um `details` nativo: chevron visível, prévia de 14px quando fechado e conteúdo completo quando aberto; clique e Espaço abrem/fecham.
- A gaveta é `position: fixed`; abrir/fechar não muda `telaH` da mesa.
- Foco preso: último → primeiro e primeiro → último; Escape fecha e devolve o foco ao controle de origem. Na aba Sala, o último foco é “Sair da sala”.
- O código e o nome da sala ficam na gaveta; o topo das telas de rodada só tem vez e sentido; no resultado, só “Rodada encerrada”.

## D6 — Regras e estados

- **Pausa:** decisões do anfitrião “Substituir por bot”, “Continuar sem Bia” e “Encerrar sem vencedor”. O texto diz que o retorno da conexão retoma sozinho; não há “Voltar ao jogo” genérico.
- **Última carta:** `#ultima` mostra “Avisar última” antes do descarte que deixa uma carta; depois do descarte, o assento mostra “última”.
- **Denúncia:** `#denuncia` mostra “Denunciar” na própria vez; `#mesa-cheia` mostra a denúncia na vez de outra pessoa. A denúncia soma duas cartas.
- **Preparação:** pronto/não pronto, anfitrião inicia, convite, participantes aguardando a próxima rodada e entrada automática. Não existe “Entrar na fila”.
- **Resultado:** tela dedicada com vencedor, placar de oito pessoas e “Voltar à preparação” pelo anfitrião; quem não é anfitrião aguarda. O topo mostra só “Rodada encerrada”, sem placa de sentido. Não existe “Jogar de novo”.
- **Treino/bots/substitutos/observador:** `#treino`, `#ausente` e `#espera` representam os três casos; `#ausente` mostra caiu, bot e substituto no mesmo estado.
- **Encerrar sem vencedor:** `#resultado-sem-vencedor` e o fluxo da pausa.

## D7 — Acessibilidade

- Foco visível de 3px; `--focus` no escuro e `--focus-no-claro` no papel.
- Teclado: botões, cartas, assentos, abas, gaveta e diálogos. As abas respondem a setas/Home/End; Escape fecha gaveta, diálogo e bandeja; a gaveta prende o foco.
- `aria-live` anuncia vez, cor ativa, descarte, inversão, pausa, resultado e reação.
- `aria-current="true"` no assento de quem joga (1 por estado de mesa medido).
- `prefers-reduced-motion: reduce` reduz a animação para ~0,001ms e a reação continua visível. A preferência de animações também oferece completa/reduzida/desligada.
- Zoom de 200% (640px): sem overflow horizontal; 640×800 e 640×400 medidos. Em 640×400, a mesa passa a rolar para não esconder informação.
- Nomes acessíveis incluem o nome completo; o diálogo do assento mostra o nome completo e o estado.

## D8 — Entrega

- `index.html`, `assets/app.css`, `assets/app.js`, `assets/fonts/`, `racional.md` e `checklist.md` em `docs/work/t018-prototype/`.
- 105 capturas de viewport em `docs/work/reports/assets/T018/`, em 412×915, 360×640 e 1280×800, DPR 1; nenhuma full-page. Todas foram regeradas no A2.
- `measurements.json` (105 medições), `names.json` (nomes), `contrasts.json` (34 pares), `reactions.json`, `keyboard.json`, `zoom.json` e `a2.json` (posições 2–8, modo compacto, regressão). `a1.json` permanece como histórico.
- `docs/work/reports/T018.md` com D1–D8, evidências, limites, isolamento do navegador e o bloco “Ajustes A2”.
- `docs/work/t016-prototype/` preservado; apenas leitura e cópia das duas fontes.
- Nenhum arquivo de `apps/web`, `packages`, servidor, protocolo, configuração ou regras foi alterado por esta tarefa.
- Sem commit, push, deploy ou restart.

## Como abrir e testar

1. Abra `docs/work/t018-prototype/index.html` em um navegador com JavaScript.
2. Use o hash para ir direto a um estado; exemplos: `#home`, `#preparacao`, `#mesa-cheia`, `#sala`, `#reacoes`, `#resultado`, `#erro-link`.
3. Home: preencha apelido, escolha avatar, “Criar sala” ou “Treinar com bots”; “Entrar” valida o código.
4. Preparação: “Estou pronto” alterna a prontidão; “Iniciar rodada” só habilita com todos prontos e pelo menos duas pessoas. “Abrir Sala” abre a gaveta na aba Sala.
5. Mesa: clique/toque em uma carta jogável; confirme ou cancele. Compre, passe, avise última e denuncie conforme o estado. O monte também compra.
6. Gaveta: abra por Conversa/Histórico e troque para Sala; ou use “Abrir Sala” na preparação. Escape fecha e devolve o foco.
7. Reações: “Reagir” abre a bandeja; escolha uma. Abra de novo em menos de 5s para ver o limite; use `#reacoes` para a bandeja e `#reacao` para a apresentação fixa.
8. Pausa: use `#pausada` e escolha uma decisão do anfitrião. “Encerrar sem vencedor” pede confirmação.
9. Resultado: `#resultado` (anfitrião) e `#resultado-convidado` (convite).
10. Para inspecionar sem interface, `window.__T018` expõe `medir()`, `estado`, `prefs`, `fila()`, `reacaoAtual()`, `tempos`, `posicoes(qtd, direcao)`, `enviarReacao()`, `simularReacao()`, `abrirGaveta()` e `fecharGaveta()`.

## Limites

- Simulação local; não há backend, login, persistência de partida ou dados reais.
- As preferências de som são estados de interface; o protótipo não reproduz áudio. As reações são silenciosas.
- A fila e os tempos são de cliente; não há relógio de servidor.
- O teste foi em navegador dedicado com emulação de viewport, não em aparelho físico, leitor de tela real ou teste com participantes.
- A captura de 360×640 mostra o topo da home; a ação “Criar sala” é sticky e o restante do formulário exige rolagem, como previsto para telas que não são a mesa.
- Em 360×640 e 412×915, a ação fixa do resultado cobre a parte inferior do placar até a rolagem; é o comportamento de ação sticky previsto, não uma tela cortada.
