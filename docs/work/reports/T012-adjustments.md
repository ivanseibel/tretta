# T012 (ajustes) — report do executor

**Data:** 17/10/2026 · **Executor:** manual · **Estado proposto:** ajustes aguardando validação do orquestrador · **HEAD de referência:** `3ae459e`, sem commit, push, deploy ou restart remoto.

## Tarefa e resultado

Executar os ajustes A1–A3 de [T012-adjustments.md](../T012-adjustments.md), respondendo ao diagnóstico de [T012.validation.md](T012.validation.md), preservando os critérios C1–C7 já aceitos (ordem cíclica, vez autoritativa, dois assentos, público, treino, pausa/reload e privacidade).

| Ajuste | Resultado |
| --- | --- |
| A1 — leitura e conteúdo dos assentos no celular | Fontes restauradas ao padrão auxiliar da mesa (nome 12,48 px, badges 9,6 px, contagem 10,56 px), chips com largura definida, nomes completos em até três linhas no celular, badges com quebra/hifenização dentro do chip, anel mais alto (celular 512–544 px; tablet/desktop 464 px) e trilho/setas afastados dos chips. Nomes com prefixos iguais (“Participante 1”…“Participante 6”) ficam completos e distinguíveis; o nome longo degenerado (24 caracteres) mantém consulta por toque e teclado |
| A2 — alternativa textual do percurso | O resumo acessível descreve o percurso **no sentido vigente**, da base de volta à base (privado: “Você (…)” da própria pessoa; público: base pública), sem prever turnos. Posições visuais e referências permanecem |
| A3 — falha de oito clientes | Causa demonstrada com dump no ponto da falha: a espera do teste lia o indicador de vez que **deixa de existir quando a rodada termina** (tela de resultado) e travava sem limite; a condição de rodada encerrada era conferida apenas na página do anfitrião. Sincronização do teste corrigida com leituras limitadas e estado encerrado em qualquer cliente; o defeito foi **reproduzido na UI anterior com a spec histórica** (1 de 4 tentativas), comprovando que é anterior à T012 |

Verificação em cópia isolada do working tree completo: build e tipos verdes, unitários web 145/145, E2E T012 6/6, E2E dos ajustes 3/3, **prova suplementar do orquestrador 2/2**, regressões pertinentes 34/34 e T007 6/6 com a espera corrigida nas duas UIs. Motor, servidor, protocolo e dependências intocados.

## Arquivos alterados

| Arquivo | Mudança |
| --- | --- |
| `apps/web/components/SeatCircuit.tsx` | Nome do assento virou botão de consulta (`aria-expanded`/`aria-controls`, Enter/Espaço alternam, Escape fecha, foco preservado), região `seat-details` com nome completo e rótulos, resumo do percurso no sentido vigente, trilho/setas em anel maior (`TRACK_SCALE = 1.3`) |
| `apps/web/app/globals.css` | Fontes móveis restauradas ao padrão auxiliar; chips de largura definida (`min(18vw, 7rem)` e `min(17vw, 6.5rem)`); nome com até 3 linhas no celular; badges com `min-width: 0`, quebra e `hyphens: auto`; anéis mais altos; estilos do botão/consulta nos dois temas; variantes `.table` |
| `apps/web/test/seat-circuit.test.tsx` | Texto do resumo atualizado e 4 casos novos: percurso nos dois sentidos com a própria pessoa fora do índice 0, inversões consecutivas com atualização por snapshot, mesa pública, consulta (toque/teclado/Escape) e identidade por id com apelidos coincidentes |
| `apps/web/e2e/t012-adjustments.spec.ts` (novo) | Provas A1/A2 com servidor real: oito assentos em 320 px com prefixos iguais, pausa, substituto e consulta; quatro assentos em 320/390/768/1280; percurso antes/depois de duas Inversões e na mesa pública; medidas de conteúdo, fontes, setas e largura salvas em JSON |
| `apps/web/e2e/t007-eight-seat.spec.ts` | Diagnóstico durável (dump sanitizado por cliente: tela, vez, mão, pilhas, erro, pausa, recuperação, vencedor, último evento, erros de página/console; trilha de passos) + sincronização corrigida (leituras limitadas; rodada encerrada reconhecida em qualquer cliente) + teto de ação de 10 s para a espera travada virar falha explicada |
| `docs/work/reports/T012.md` | Correção do único link relativo quebrado (`../product/` → `../../product/`); conteúdo do report preservado |
| `docs/work/status.md`, `docs/work/plan.md` | Entradas de T012 para “ajustes aguardando validação do orquestrador” |
| `docs/work/reports/assets/T012-adjustments/` (novo) | 30 arquivos: 9 capturas, 9 medidas JSON, rotas e diagnósticos A3 |

## Evidência A1–A3

### A1 — leitura e conteúdo dos assentos

Medidas antes/depois (mesma prova: oito clientes em 320 px, uma ausência real):

| Medida | Antes (validação) | Depois |
| --- | --- | --- |
| Fonte do nome | 10,88 px | **12,48 px** (0,78 rem, igual à base da mesa) |
| Fonte de badges | 8 px | **9,6 px** (0,6 rem, igual aos demais badges) |
| Fonte da contagem | 9,28 px | **10,56 px** (0,66 rem, igual à base) |
| Badge “desconectado” | 67,09 px ultrapassando um chip de 54,39 px | Cabe dentro do chip (quebra/hífen: “desco-necta-do”) |
| Filhos fora do chip | 1 caso | **0** em todos os estados medidos |
| Setas cobertas por chips | não medido | **0** colisões seta×chip, setas dentro do anel |
| Nomes “Participante 1…” | indistinguíveis (“Partic…”) | **completos e distinguíveis** no celular (“Particip … / ante 1”); só o nome de 24 caracteres trunca, com consulta |

- Medidas registradas em `medidas-oito-320-{ativo,desconectado,substituto}.json`, `medidas-quatro-{320,390,768,1280}.json` e `medidas-publico-320.json` (fontes, caixas de chips e filhos, colisões seta×chip, setas fora do anel, largura do documento).
- Consulta: botão no nome de cada assento — clique/toque abre, Enter alterna, Escape fecha, o foco permanece no botão e o nome completo já está no DOM (o `title` deixou de ser a única via). A consulta mostra nome, rótulos e contagem e identifica o assento pelo id mesmo com apelidos iguais.
- Capturas inspecionadas no tamanho real: `oito-320-{ativo,desconectado,substituto}.png`, `quatro-{320,390,768,1280}.png` e `publico-320.png`. Na menor largura, mão, compra/passe e ações seguem utilizáveis (regressões de `t012-circuit` verdes).
- A prova suplementar do orquestrador (`t012-review.spec.ts`, seção A1, oito assentos em 320 px com desconexão) passou com `outside` vazio.
- Combinações reais cobertas: “Você”, “na vez” (assento atual), “bot” (treino), “desconectado” (pausa por ausência) e “substituto” (após o prazo, com o assento acumulando os dois últimos rótulos).

### A2 — percurso textual no sentido vigente

Textos reais capturados em `rotas.json` (quatro assentos, base Ana):

| Estado | Resumo |
| --- | --- |
| Antes da Inversão | “Ordem dos assentos no circuito, a partir da base onde você está: Você (Ana), Bia, Cai, Davi, de volta a Você (Ana). Sentido horário da rodada.” |
| Após a primeira | “Você (Ana), Davi, Cai, Bia, de volta a Você (Ana). Sentido anti-horário da rodada.” |
| Após a segunda | idêntico ao primeiro |
| Mesa pública (observadora) | “a partir da base: Ana, Bia, Cai, Davi, de volta a Ana. Sentido horário da rodada.” |

- Sem prever turnos (o texto não usa “próximo”/“jogar”); a vez continua vindo só do estado. As posições visuais não se movem ao inverter (`ringSnapshot` idêntico antes/depois) e a própria pessoa fora do índice 0 é coberta nos unitários (`p2` na base com lista projetada `[p3,p1,p4,p2]`).
- A prova suplementar do orquestrador (seção A2) passou: após a Inversão o resumo casa `Ana … Davi … Cai … Bia`.

### A3 — diagnóstico e prova de oito clientes

Tentativas registradas (cada linha é uma rodada completa; logs em `tentativas-*.log`):

| Configuração | Spec | Resultado |
| --- | --- | --- |
| Nova UI (ajustes), primeira leva | original | 4 passam / 2 travam no teto de 180 s |
| Nova UI, com diagnóstico | original + dumps | 4 passam (13,1 s) / 2 falham (43 s) |
| Nova UI, com dump robusto | original + dumps | 3 passam (13,0 s) / 3 falham (27,1 s) |
| Nova UI, **espera corrigida** | corrigida | **6/6** (14,8–14,9 s) |
| UI anterior (`3ae459e`), espera corrigida | corrigida | **6/6** (14,0–14,1 s) |
| UI anterior, **spec histórica** | histórica | 3 passam (12,5 s) / **1 falha (27,3 s)** |

- Dump do ponto da falha (nova UI): passo 48, ação “jogar green-1-1” pelo cliente 0; **os oito clientes na tela de resultados**, mão 0, `vencedorVisivel` verdadeiro; o erro interno da espera foi `locator.textContent: Timeout` ao ler `turn-indicator` — a ação **se completou** (a carta saiu da mão) e a condição de espera é que não correspondia ao estado real.
- Causa demonstrada: ao terminar a rodada, a tela do assento dá lugar ao resultado e `turn-indicator` deixa de existir; `currentTurnIndices` lia cada indicador **sem limite de leitura** e travava durante a troca de tela, consumindo o orçamento da espera; a saída “rodada encerrada” olhava apenas a página do anfitrião.
- Correção (sincronização do teste, não do produto): leituras de indicador com teto de 2 s que devolvem “sem vez ativa” quando a tela não tem indicador, rodada encerrada reconhecida em **qualquer** cliente, e teto de 10 s para ações, convertendo espera travada em falha explicada. Nenhum timeout foi aumentado, nenhum retry foi adicionado, nenhuma asserção foi removida nem enfraquecida — a prova de rodada completa (vencedor, placar, `1 rodada(s)`) permanece.
- O defeito é **anterior à T012**: com a UI de `3ae459e` e a spec histórica, o mesmo cenário falhou em 1 de 4 tentativas (27,3 s), sem qualquer código do circuito na página.
- Logs completos: `tentativas-1-nova-ui.log` … `tentativas-6-ui-anterior-spec-historica.log`; estado em `t007-estado-nova-ui.json` (sanitizado: sem URL, sala ou credencial).

## Comandos e resultados

Cópia isolada `…/tretta-t012-adj/copy` (rsync do working tree excluindo `node_modules`, `.next`, `dist`, `coverage`, `.turbo`, `test-results`, `playwright-report`, `.git`; `pnpm install --frozen-lockfile`), processos próprios (web 3000, servidor 3100):

| Comando | Resultado |
| --- | --- |
| `pnpm -r typecheck` | 4 projetos, verde |
| `pnpm build` | servidor + web verdes (Next 16.4.1) |
| `pnpm --filter @tretta/web test` | 18 arquivos, **145/145** (eram 140; +5 casos do resumo/consulta) |
| `pnpm exec playwright test e2e/t012-adjustments.spec.ts e2e/t012-circuit.spec.ts e2e/t012-review.spec.ts` | **11/11** (3 ajustes + 6 T012 + 2 da prova suplementar do orquestrador) |
| `pnpm exec playwright test e2e/interface-visual.spec.ts e2e/refinements.spec.ts e2e/effects.spec.ts e2e/training.spec.ts e2e/pause.spec.ts e2e/two-players.spec.ts e2e/leave-host.spec.ts e2e/interface-keyboard.spec.ts e2e/chat.spec.ts e2e/taunt.spec.ts e2e/scoreboard.spec.ts e2e/recovery-wait.spec.ts` | **34/34** (3,9 min), incluindo modo reduzido/desligado de efeitos e teclado/foco |
| `pnpm exec playwright test e2e/t007-eight-seat.spec.ts` (loops) | ver tabela de A3 |
| Cópia de comparação (UI anterior) | rsync + `git show 3ae459e` de `globals.css`, `GameTable.tsx` e `WaitingRoom.tsx` + install/build próprios; logs `baseline-instalacao.log`/`baseline-build.log` |
| Fonte testada × entregue | `rsync -rcn` sem diferenças de código/configuração; diferem apenas `apps/web/tsconfig.tsbuildinfo` (gerado) e, depois das suítes, os documentos deste report/status/plano |
| Históricos | 442 anteriores + 20 de `assets/T012/` + 15 de `assets/T012-validation/` = **477 byte-idênticos**; `assets/T012-adjustments/` com 30 arquivos novos |
| `git diff --check` | limpo |

## Falhas e intermitências

1. **Sobreposição de setas com o chip de dois rótulos (A1)**: com “desconectado” sublinhado por “substituto”, o chip de 145,5 px no celular encostava nas setas vizinhas; resolvido elevando o anel móvel (480 → 512–544 px) e mantendo o trilho em 1,3× o raio dos assentos. Reexecutado verde.
2. **Texto do nome escapando do chip no desktop**: ao virar botão, o `span` do nome deixou de ser item flex e voltou a `inline`, ignorando `max-width`/`ellipsis` (filho de 254,6 px em chip de 112 px); corrigido com `display: block` no nome e largura definida no chip.
3. **Consulta fechando um assento já aberto (teste)**: o clique alterna; o utilitário do teste passou a fechar com Escape ao fim de cada consulta.
4. **Espera de oito clientes (A3)**: causa e correção na seção A3; sem novas intermitências nas execuções finais (T007 6/6 + 6/6, E2E T012 11/11, regressões 34/34).
5. Nenhum erro de página/console inesperado nos E2E novos (monitorados).

## Decisões e desvios

- **Ler, não encolher**: as fontes móveis voltaram ao padrão auxiliar da mesa em vez de permanecerem reduzidas; o espaço foi resolvido por largura definida, reflow (até 3 linhas de nome, badges com quebra/hífen) e **altura** — explicitamente permitida pelo contrato.
- **Chips uniformes**: `width: min(18vw, 7rem)` no desktop e `min(17vw, 6.5rem)` no celular (antes `max-content` com teto). Uniformiza a leitura e foi o que devolveu efeito ao `text-overflow` do nome.
- **Trilho e setas fora da órbita dos chips** (`TRACK_SCALE = 1.3`, mesma direção tangente — rotações de seta inalteradas): sem isso, chips altos cobririam as setas.
- **Consulta sempre disponível** (botão no nome + parágrafo de detalhes) em vez de detectar truncamento por medição: mais simples, determinística e testável; o nome completo já está no DOM e a região **não** é `aria-live` (atualização passiva, sem repetir anúncios nem roubar foco).
- **A3**: corrigir a sincronização do teste em vez do produto, com causa demonstrada por dump e reprodução na UI anterior; diagnóstico permanente com dumps sanitizados gravados apenas quando há falha, em pasta de evidência nova.
- **Desvios de escopo:** nenhum. Nada de motor/servidor/protocolo/dependências; sem commit/push/deploy/restart; a única mudança em arquivo histórico foi o link quebrado do report original.

## Proveniência da cópia e preservação

- Cópia de ajustes: `/private/var/folders/r_/…/T012/tretta-t012-adj/copy`; cópia de comparação: `…/tretta-t012-adj/baseline` (UI de `3ae459e` em `globals.css`, `GameTable.tsx` e `WaitingRoom.tsx`, com o mesmo install/build congelados).
- A prova suplementar `t012-review.spec.ts` foi copiada **somente para a cópia isolada**, com o destino de evidências adaptado para diretório temporário; a fonte entregue não a inclui (a cobertura permanente equivalente está em `t012-adjustments.spec.ts` e nos unitários).
- Nenhuma suíte rodou na árvore entregue; o spec de T007 escreve capturas próprias apenas na cópia. Os 477 arquivos de evidência anteriores permanecem byte-idênticos (SHA-256) e as 30 evidências novas vivem em `docs/work/reports/assets/T012-adjustments/`.
- Emulação Playwright com viewports de 320/390/768/1280 px; **sem** aparelho físico e **sem** inspeção interativa por browser-harness (limite de permissão já registrado) — a leitura foi julgada pelas capturas em tamanho real e pelas medidas numéricas.

## Critérios parciais e limites

- **A3 (parcial por amostragem):** a falha anterior foi reproduzida em 1 de 4 tentativas com a spec histórica na UI anterior; a correção passou 6/6 em cada UI, mas nenhuma amostra finita prova ausência de outras causas. Como a rodada completa de oito clientes é preservada e a causa demonstrada é de sincronização, não há mudança de produto; se uma nova falha ocorrer, o dump sanitizado aponta o passo, a ação, a mão e a tela de cada cliente.
- **A1 (emulação):** a legibilidade foi verificada por medições (fontes, caixas, colisões) e capturas emuladas; leitura em aparelho físico não foi testada.
- **A1 (altura):** o anel móvel chega a 512–544 px em 320–390 px para acomodar badges legíveis — troca deliberada de compactação por leitura, com rolagem vertical permitida pelo contrato.
- **A2:** o resumo descreve o percurso dos assentos; efeitos de cartas que alteram a vez continuam fora do texto por decisão do contrato.
- A conclusão do executor é proposta; aceite e publicação são etapas posteriores do orquestrador.
