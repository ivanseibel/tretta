# T019F-prep — harness de verificação da nova UI

**Status: entregue para validação. Este report não declara aceite.** Execução em 26/10/2026 no working tree atual, sem commit, push, deploy ou restart. Nenhum arquivo de `apps/web`, `packages`, servidor, protocolo, suíte existente ou configuração foi criado/editado por esta tarefa; a única escrita é em `docs/work/reports/assets/T019F/**` e neste report.

## 1. Entregável

| Arquivo | Função |
| --- | --- |
| [`run.mjs`](assets/T019F/run.mjs) | CLI standalone: abre URL, ajusta viewport, mede DOM, captura PNG, roda teclado/reduced-motion, avalia checks e grava JSON/HTML |
| [`compare.mjs`](assets/T019F/compare.mjs) | Comparação visual T018 → execução atual: diff, SSIM, bounding box, captura em branco e diferenças estruturais |
| [`make-baseline.mjs`](assets/T019F/make-baseline.mjs) | Congela/valida o manifesto das 105 capturas T018 |
| [`baseline.json`](assets/T019F/baseline.json) | Manifesto com SHA-256, dimensões e métricas estruturais das capturas T018 |
| [`lib/config.mjs`](assets/T019F/lib/config.mjs) | Matriz de estados, viewports, pisos, seletores, limites e texto proibido |
| [`lib/measure.mjs`](assets/T019F/lib/measure.mjs) | Medição no DOM: assentos, cartas, fontes, alvos, contraste, nomes, reações, ARIA, gaveta e scroll |
| [`lib/assertions.mjs`](assets/T019F/lib/assertions.mjs) | Checks `pass/fail/review/skip` |
| [`lib/browser.mjs`](assets/T019F/lib/browser.mjs) | Playwright isolado, teclado, foco, gaveta e `prefers-reduced-motion` |
| [`lib/contrast.mjs`](assets/T019F/lib/contrast.mjs) | Fórmulas WCAG 2.1 canônicas no Node |
| [`lib/scenario.mjs`](assets/T019F/lib/scenario.mjs), [`scenarios/`](assets/T019F/scenarios/) | Contrato de cenário de jogo e helpers de home/treino |
| [`README.md`](assets/T019F/README.md) | Comandos, dependências, contrato de seletores, saída e limites |
| [`smoke/`](assets/T019F/smoke/) | Evidências de calibração: 33 medições com captura, 81 sem captura, zoom 640×800, preview real e comparação visual |

O harness é Node/Playwright **fora da suíte**: não é `*.spec.ts`, não é descoberto por `playwright test` e não altera `package.json`, `pnpm-lock.yaml`, `vitest` ou `playwright.config`. Todas as escritas passam por `assertInsideHarness()` e ficam sob `docs/work/reports/assets/T019F/`.

## 2. Objetivo

Preparar o que a T019F executa depois das ondas 2 e 3: medir a UI nova em viewports reais, provar os pisos de leitura e os alvos, verificar as 12 reações e a ausência de provocações, preservar pausa/última/denúncia/prontidão/treino/bots/observador e comparar visualmente com as capturas T018 de referência.

O harness **não decide aceite**: ele produz evidência, falhas e itens de revisão. A decisão continua na T019F e no orquestrador.

## 3. Matriz

### Viewports

| id | Tamanho | DPR | Uso | Rolagem da mesa |
| --- | --- | ---: | --- | --- |
| `412x915` | 412×915 | 1 | celular principal | proibida |
| `360x640` | 360×640 | 1 | celular compacto | proibida |
| `1280x800` | 1280×800 | 1 | desktop | proibida |
| `640x800` | 640×800 | 1 | zoom 200% equivalente (1280×800 ÷ 2) | proibida |
| `640x400` | 640×400 | 1 | suplementar de altura curta | permitida para não esconder informação |

A matriz padrão usa os quatro primeiros. `640x400` é opcional (`--viewports=640x400`) e não substitui o aceite de zoom; documenta o comportamento já aprovado no T018.

### Estados `--set=core` (27 × 4 = 108 células)

| Estado | Baseline T018 | Asserções específicas |
| --- | --- | --- |
| `home` | `home` | fontes, alvos, contraste, sem provocação |
| `preparacao` | `preparacao` | 2 assentos, pronto/não pronto, iniciar pelo anfitrião |
| `preparacao-8` | `preparacao-cheia` | 8 assentos, prontidão, iniciar |
| `espera` | `espera` | mesa pública sem mão, 2–8 assentos, vez/sentido, reações |
| `observador` | `espera` | observador na mesa pública, sem mão |
| `mesa-2` … `mesa-8` | `mesa-2` … `mesa-8` | N assentos, sem rolagem, cartas, nomes, `aria-current` |
| `mesa-cheia` | `mesa-cheia` | 8 cartas; 2×4 no celular, 1 fileira no desktop |
| `pausa` | `pausada` | substituir por bot, continuar sem, encerrar sem vencedor |
| `ultima` | `ultima` | aviso/etiqueta de última |
| `denuncia` | `denuncia` | denúncia na própria vez |
| `treino` | `treino` | treino + três bots |
| `bots` | `treino` | bots identificados |
| `substituto` | `ausente` | ausente + bot + substituto |
| `resultado` | `resultado` | tela dedicada, vencedor, placar, volta à preparação |
| `resultado-sem-vencedor` | `resultado-sem-vencedor` | encerramento sem vencedor |
| `erro-conexao`, `erro-sala`, `erro-link` | mesmos nomes | recuperação/link inválido |
| `reacoes` | `reacoes` | 12 reações, 4×3, sem alvo/destinatário |
| `sala` | `sala` | gaveta, abas, quatro seções, foco |
| `inversao` | `inversao` | sentido invertido, `aria-live` |

`--set=full` (34 estados, 136 células) acrescenta `sala-apresentacao`, `sala-anfitriao`, `conversa`, `historico`, `reacao`, `carta` e `cor`. `historico` não tem captura T018 equivalente; fica como `no-reference` no comparador, não como regressão.

`--set=smoke` (11 × 3 = 33 células) é a calibração do próprio harness contra o protótipo T018; não é a matriz de aceite.

## 4. Asserções

### Bloqueantes (`fail`)

- **Viewport exato:** `innerWidth/innerHeight` e DPR medidos iguais ao alvo.
- **Scroll:** página sem overflow horizontal; mesa/espera sem rolagem vertical nos viewports garantidos. Rola apenas a mão acima de oito cartas, a gaveta e telas com rolagem explicitamente permitida.
- **Assentos:** contagem exata/faixa 2–8; em mesa/espera todos inteiros no viewport (preparação pode rolar, conforme o produto); sem sobreposição com assento ou centro; dentro da moldura; `aria-current` em exatamente um assento no turno.
- **Pisos de fonte:** vez 20, sentido 18, contagem 26/14, nome 16, nome na carta 14, corpo 16, rótulo 14, “na vez” 14; nenhum texto funcional abaixo de 14 px.
- **Cartas:** largura ≥ 72 px; oito cartas em duas fileiras de quatro em 412/360 e uma fileira no desktop; acima de oito, rolagem horizontal local da mão.
- **Alvos:** todo controle interativo visível ≥ 44×44 px. Checkbox/radio é medido pelo label que o envolve.
- **Contraste de texto:** ≥ 4,5:1 (3:1 para texto grande), incluindo o pior ponto de gradientes; fundo com imagem sem cor declarada vai para `review`.
- **Nomes:** até 12 caracteres sem reticências/clipping; nomes longos com reticências quando não cabem; nome completo no nome acessível.
- **Reações:** 12 rótulos aprovados, sem atributo de alvo/destinatário, bandeja 4×3, apresentação central.
- **Provocações:** nenhuma ocorrência de `provoc`, `taunt`, “se ferrou”, “toma essa”, “palhaço”, “sacanagem”, “30s” ou “ocultar provocações” no texto visível ou em classes/atributos.
- **ARIA/teclado:** `aria-live` com anúncio no turno, controles com nome acessível, foco visível com anel ≥ 3:1, foco preso e Escape na gaveta, regra CSS de `prefers-reduced-motion`.
- **Copy de estado:** rótulos mandatados pelo produto (pausa, última, denúncia, início, treino, substituto, resultado, seções da gaveta).
- **Runtime:** erro de página/console não bloqueia sozinho, mas é registrado; falha de execução do estado bloqueia.

### Revisão humana (`review`)

- **Limites decorativos:** bordas de carta/assento/botão podem ficar abaixo de 3:1 sem impedir o uso; entram como `review`, não como falha, para não transformar acabamento em falso bloqueio. O anel de foco é medido separadamente e é bloqueante.
- **Diff visual:** `changedPct` e SSIM acima do limite entram como `review`; a comparação não exige igualdade pixel a pixel porque a UI nova usa outra stack e outro build de navegador.
- **Termos ambíguos** de alvo/resposta e fundo com imagem sem cor declarada.

## 5. Harness: modos e comandos

Dependências: Node 22, dependências do repositório instaladas, Playwright 1.64.1 via `apps/web/node_modules/@playwright/test` e Chromium/Chrome com perfil temporário. Não há dependência nova.

### Baseline

```sh
node docs/work/reports/assets/T019F/make-baseline.mjs
node docs/work/reports/assets/T019F/make-baseline.mjs --check
```

### Calibração no protótipo (serve HTTP efêmero em 127.0.0.1)

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=prototype --set=smoke \
  --out=docs/work/reports/assets/T019F/smoke/prototype
```

### Preview da base web

```sh
pnpm --filter @tretta/web dev --port 3100
# ou build/start já no ar

node docs/work/reports/assets/T019F/run.mjs \
  --mode=preview --url=http://127.0.0.1:3100 \
  --out=docs/work/reports/assets/T019F/runs/preview
```

### Matriz no app

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=app --url=http://127.0.0.1:3100 \
  --set=core \
  --scenario=docs/work/reports/assets/T019F/scenarios/t019f.mjs \
  --out=docs/work/reports/assets/T019F/runs/t019f-core
```

O cenário de jogo é o único ponto que a T019F precisa completar para 2–8 assentos, pausa, última, denúncia e resultado; o contrato e os helpers estão em [`scenarios/README.md`](assets/T019F/scenarios/README.md). Para uma tela já aberta, `--state` + `--states-file` mede a URL atual sem montar a partida.

### Comparação visual

```sh
node docs/work/reports/assets/T019F/compare.mjs \
  --run=docs/work/reports/assets/T019F/runs/t019f-core \
  --out=docs/work/reports/assets/T019F/runs/t019f-core/compare
```

Saída: `summary.json`, `measurements.json`, `failures.json`, `index.html`, `screenshots/`, `raw/` e, no comparador, `visual-diff.json`, `diff/` e `index.html`.

Códigos: `run.mjs` 0 sem falhas, 1 falha de asserção, 2 erro fatal, 3 matriz incompleta com `--require-complete`; `compare.mjs` 1 para dimensão/captura em branco/erro, 3 para `--require-all` com estado sem baseline. `--soft` não altera os JSONs.

### Contrato de seletores

O harness prefere `data-tv2-*` e cai para a base T019B/C e para o protótipo:

- `.tv2-table-root` / `.tv2-table-stage`, `.tv2-table-center`, `.tv2-hand-cards` / `[data-testid="my-hand"]`;
- `.tv2-seat`, `.tv2-seat-name`, `.tv2-seat-count strong`, `.tv2-seat-count > span`, `.tv2-seat-now`, `aria-current`;
- `.tv2-card`, `.tv2-card-rank`, `.tv2-card-action-name`;
- `.tv2-btn`, `.tv2-chip`, `.tv2-drawer`;
- fallback T018: `.assento`, `.assento-nome`, `.conta-num`, `.conta-rot`, `.mao`, `.carta`, `.reacao-btn`, `.gaveta`, `#mesa`, `#mao`.

Se a T019D/E usar outros nomes, ajuste `lib/config.mjs` (SELECTORS) e registre no report da T019F. Não é necessário editar app para o harness funcionar.

## 6. Baseline visual

`baseline.json` foi gerado a partir de `docs/work/reports/assets/T018/`:

- **105 capturas**: 35 rotas × 412×915, 360×640 e 1280×800, DPR 1.
- Cada entrada tem caminho, bytes, dimensões, SHA-256 e métricas estruturais do `measurements.json` do T018 (assentos, lados, sobreposições, cartas, largura mínima, reações, fontes, scroll, alvos e texto proibido).
- `--check` valida contagem e hashes; executado com sucesso após a geração. SHA-256 de `measurements.json`: `b8c9cf3426b0bc301dee08b8675bc308d848cba6010e7d1d493e3da9cf16acf6`.
- Fonte: [T018.md](T018.md) e `assets/T018/`; nenhuma captura T018 foi regravada.

O comparador produz T018 × atual × diff, percentual de pixels alterados, diferença média, p95, SSIM por blocos de 8×8, bounding box, detecta captura em branco e compara métricas estruturais. Limites padrão: `changedPct ≤ 12%` e `SSIM ≥ 0,90` para `ok`; acima disso, `review`. Dimensão diferente, captura em branco ou erro são `fail`. O T018 só tem 412×915, 360×640 e 1280×800; `640×800` aparece como `no-reference` no comparador e **não é tratado como regressão** (a matriz de medias continua valendo).

A comparação é de **revisão**, não de igualdade: o T018 foi capturado em Chrome 155 e o smoke usa o Chromium 156 do Playwright; há diferença de perfil de cor e antialiasing mesmo quando o layout é o mesmo. No smoke, 30 pares ficaram `ok` e 3 ficaram `review` (mesa cheia em 412 com 15,31% de diff e SSIM 0,9604; reações em 412/360 com SSIM 0,8454/0,814 por causa do overlay animado). Nenhum `fail`, `no-reference` ou erro.

## 7. Verificação executada

| Execução | Comando | Células | Resultado |
| --- | --- | ---: | --- |
| Smoke do harness | `--mode=prototype --set=smoke` | 33/33 | 1.185 pass, **0 fail**, 27 review, 93 skip |
| Matriz core sem captura | `--mode=prototype --set=core --no-screenshots` | 81/81 | 2.871 pass, **0 fail**, 69 review, 243 skip |
| Zoom 200% | `mesa-cheia @ 640x800` | 1/1 | 41 pass, **0 fail**, 1 review |
| Preview da base web | `--mode=preview --url=http://127.0.0.1:3000` | 2/2 | 28 pass, **0 fail**, 2 review (HMR do dev server), 26 skip |
| Comparação visual | `compare.mjs` sobre o smoke | 33 pares | 30 ok, 3 review, **0 fail**, 0 sem baseline |

Medições do smoke (as três larguras):

| Medida | 412×915 | 360×640 | 1280×800 |
| --- | ---: | ---: | ---: |
| Cartas da mão | 89 px | 74 px | 92 px |
| Linhas da mão (8 cartas) | 2×4 | 2×4 | 1×8 |
| `docH / innerH` na mesa | 915 / 915 | 640 / 640 | 800 / 800 |
| Pisos medidos | 20/18/26/14/16/14/16/14/14 | iguais | iguais |
| Alvos abaixo de 44 | 0 | 0 | 0 |

- **Contraste:** 1.402 pares de texto conferidos no smoke, 0 falhas e 0 revisões de texto. 63 pares de limite decorativo ficaram abaixo de 3:1 e geraram 27 checks `review` (um por célula com pelo menos um par); não bloqueiam.
- **Nomes:** 96 nomes curtos no smoke, 0 truncados; 12 nomes longos, 0 cortados sem reticências; nome completo no `aria-label` do assento.
- **Assentos:** 2–8 no `core-check`, 81/81 células; sem sobreposição, fora da mesa ou corte; `aria-current` exatamente em um.
- **Reações:** 12/12 nas três larguras, nenhum atributo de alvo/destinatário, copy “sem destinatário”.
- **Provocações:** 0 ocorrências duras no texto e 0 tokens no DOM no smoke.
- **Gaveta:** seções Sala/Jogadores/Apresentação/Anfitrião, `role=dialog`, abas, foco preso e Escape passaram nas três larguras. O retorno de foco só é verificado quando o cenário registra o opener em `window.__t019fOpener`; sem isso o harness não inventa o resultado e o item fica como `null`.
- **Teclado/reduced-motion:** foco visível com anel; `prefers-reduced-motion` com regra CSS; `aria-live` presente nos estados de mesa/espera.
- **Runtime:** 0 erros de console/página e 0 requisições falhas no smoke.
- **Preview real:** `/preview` no dev server já existente em `http://127.0.0.1:3000` respondeu 200; 14 frames (`data-largura`) medidos, Fraunces e Atkinson carregadas, sem overflow horizontal. Os dois checks `review` são o aviso de WebSocket HMR do próprio dev server, não a UI.
- **Isolamento:** Chromium 156.0.8078.4 do Playwright, processo/perfil temporários, servidor T018 efêmero em 127.0.0.1; nenhum navegador pessoal, porta fixa ou servidor de aplicação foi iniciado/reiniciado pelo harness. O preview usou um dev server local já em execução. Contextos, navegador e servidor efêmero foram fechados em `finally`.

Não foram executados `pnpm test`, `pnpm build` ou a suíte Playwright existente nesta tarefa, para não disputar o working tree com as ondas paralelas nem criar artefatos de build. Os scripts passaram em `node --check`; o baseline passou em `--check`.

## 8. Checklist de aceite da T019F (a executar, não aceito)

- [ ] `make-baseline.mjs --check` continua íntegro (105 capturas).
- [ ] Cenário `scenarios/t019f.mjs` monta 2, 3, 4, 5, 6, 7 e 8 assentos reais e os estados de pausa, última, denúncia, treino, bots, substituto, observador, resultado e resultado sem vencedor.
- [ ] `run.mjs --mode=app --set=core` cobre 27 × 4 = 108 células sem estado pulado (`--require-complete`).
- [ ] Nenhum `fail` em viewport, scroll, assentos, fontes, cartas, alvos, contraste de texto, nomes, reações, provocações, ARIA/teclado, foco ou gaveta.
- [ ] Os `review` de contraste de limite e todos os `review` do diff visual foram inspecionados e explicados.
- [ ] 412×915, 360×640, 1280×800 e 640×800 sem rolagem vertical da mesa; 640×400 documentado.
- [ ] 2–8 assentos visíveis; base própria, topo oposto e laterais; nenhum corte/sobreposição.
- [ ] Pisos de fonte conferidos no DOM; nenhum texto funcional <14 px.
- [ ] Cartas ≥72 px; 8 cartas em 2×4 no celular e 1 fileira no desktop; acima de 8 só a mão rola.
- [ ] Alvos ≥44×44; foco visível e contraste do anel ≥3:1.
- [ ] Nomes curtos sem truncar; longos com reticências e nome completo acessível.
- [ ] 12 reações sem alvo; fila de 3, 4 s e limite de 5 s cobertos por cenário/E2E complementar.
- [ ] Nenhuma provocação, resposta, aviso de 30 s ou preferência de ocultar provocações na UI, protocolo, servidor ou testes.
- [ ] Pausa, última, denúncia, prontidão, treino, bots, substitutos e observador preservados.
- [ ] `aria-live`, `aria-current`, nomes acessíveis, gaveta com foco preso/Escape e `prefers-reduced-motion` sem regressão.
- [ ] Comparação visual revisada em `compare/index.html`; nenhuma captura em branco ou dimensão divergente.
- [ ] Suíte existente, tipos e build verdes na T019F; nenhuma spec antiga alterada só para passar.
- [ ] Sem commit, push, deploy ou restart sem autorização específica.

## 9. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Seletores mudarem na T019D/E | `data-tv2-*` + fallbacks `.tv2-*`; ajuste somente em `lib/config.mjs`, documentado no report |
| Cenário de jogo não cobrir mesa real | helpers de home/treino e contrato de cenário; T019F cria uma sala por viewport/estado, sem mocks de DOM |
| Salas destrutivas/reutilizadas | uma sala por estado sensível; `teardownState` fecha contextos extras |
| PDF/print, zoom real vs largura emulada | 640×800 emulado é equivalente de largura; registrar que zoom de navegador real não foi usado |
| Diferença de renderização no diff | `review` + SSIM/estrutura; revisão humana; não igualdade pixel a pixel |
| Falso positivo de contraste em borda decorativa | contraste de limite é `review`; foco e texto são bloqueantes |
| Animação/overlay alterar captura | `animations: 'disabled'`, espera de 450 ms no fechamento da gaveta, captura antes do teclado |
| Servidor lento/reconexão | timeouts de 20 s, `waitForURL`, `settle`; repetir a execução uma vez, manualmente, antes de registrar falha |
| Build/teste vermelho por causa do harness | harness não é spec, não importa app e só escreve em docs; suíte roda separadamente |
| Dados pessoais nas capturas | assets locais, sem commit; sanitizar nomes antes de publicar qualquer evidência |

## 10. Critérios de parada

Parar a T019F e reportar, sem “ajustar” a medição para passar, quando:

1. Um check bloqueante falhar em qualquer viewport/estado (scroll, assento, piso, carta, alvo, contraste de texto, nome, reação, provocação, ARIA/teclado, gaveta).
2. O cenário não chegar ao estado esperado, montar menos assentos que o pedido ou medir uma tela diferente da declarada.
3. Uma captura estiver em branco, com dimensão diferente do viewport ou sem baseline correspondente em estado que deveria ter.
4. `pnpm build`, `pnpm typecheck` ou a suíte existente ficarem vermelhos; não mascarar alterando teste antigo.
5. For necessário editar app fora do dono da T019F, protocolo, servidor ou configuração para o harness passar.
6. Houver pedido de commit/push/deploy/restart sem autorização específica.
7. A única evidência restante for emulação; aparelho físico/leitor de tela continuam pendentes e devem ser declarados, não substituídos por captura.

## 11. Limitações e desvios

- **App Next não foi iniciado por esta preparação.** Nenhum `next dev`/build foi iniciado para não escrever em `apps/web` nem disputar o working tree com as ondas paralelas. O modo app foi exercitado contra o protótipo servido por HTTP e o `/preview` real foi medido no dev server local que já estava no ar em `127.0.0.1:3000`; os seletores foram ampliados para a base T019C que apareceu no working tree durante a tarefa (`.tv2-seat`, `.tv2-card`, `.tv2-hand-cards`, `.tv2-table-stage`, `.tv2-drawer`, `.tv2-btn`), mas a execução contra a UI final é da T019F.
- **Cenário de jogo é o trabalho restante da T019F.** O cenário padrão cobre home, preview, treino/bots e link inválido. 2–8 assentos, pausa, última, denúncia, resultado e gaveta precisam do `scenarios/t019f.mjs` descrito no README; sem ele, o harness marca `scenario.available` como `skip` e `--require-complete` falha com exit 3.
- **Fila/4 s/5 s de reação** não são medidos estaticamente. O harness mede 12 reações, ausência de alvo e overlay; a fila e o limite temporal devem ser cobertos por cenário ou E2E complementar da T019F.
- **`640×800` é emulação de largura**, não zoom real de navegador. `640×400` é suplementar e permite rolagem, como o T018.
- **Contraste de limite:** 27 células do smoke têm bordas decorativas abaixo de 3:1; ficaram em `review`. O anel de foco e o texto passaram. A T019F deve olhar as capturas e decidir se alguma borda é funcional.
- **Diff visual:** 3 pares ficaram em `review` por renderização/overlay; não são falha de layout. A comparação estrutural e as capturas devem ser revisadas.
- **Sem aparelho físico, leitor de tela real, áudio real ou teste com participantes.** O harness usa emulação de viewport, foco e movimento reduzido.
- **Working tree concorrente:** T019C e outros arquivos de app apareceram/foram modificados por agentes paralelos durante a tarefa. Esta tarefa não escreveu neles; o report não presume que o diff de app seja desta entrega.

## 12. Próximo passo

A T019F deve completar o cenário de jogo, rodar `--set=core` nos quatro viewports com `--require-complete`, revisar o comparador visual e os `review` de limite, corrigir somente o que for do dono da integração e então executar a suíte/build existentes. Este report e as evidências em [`assets/T019F/`](assets/T019F/) ficam como base; **este report não declara aceite.**
