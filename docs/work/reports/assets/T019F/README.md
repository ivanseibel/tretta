# T019F — harness de verificação da UI

Harness **standalone** para a T019F medir a UI nova depois das ondas 2 e 3. Não é uma spec da suíte, não importa `apps/web` e só escreve em `docs/work/reports/assets/T019F/**`.

O harness não declara aceite. Ele produz medições, capturas, falhas e uma comparação visual contra o T018 para revisão humana.

## Requisitos

- Node.js 22 (`node -v` → `v22.x`).
- Dependências já instaladas no repositório (`pnpm install --frozen-lockfile`).
- Playwright disponível via `apps/web/node_modules/@playwright/test` (dependência de desenvolvimento do web).
- Chromium do Playwright ou Google Chrome instalado. O harness usa processo e perfil temporários próprios; não toca no navegador pessoal.

O harness não altera `package.json`, `pnpm-lock.yaml`, `apps/web`, `packages` nem a configuração de testes.

## Comandos

### 1. Baseline T018

```sh
node docs/work/reports/assets/T019F/make-baseline.mjs
node docs/work/reports/assets/T019F/make-baseline.mjs --check
```

Gera/valida `baseline.json`: 105 capturas T018 (35 rotas × 412×915, 360×640, 1280×800), hash SHA-256, dimensões e métricas estruturais do `measurements.json` do T018.

### 2. Smoke do próprio harness no protótipo T018

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=prototype \
  --set=smoke \
  --out=docs/work/reports/assets/T019F/smoke/prototype
```

Abre o protótipo por HTTP local (o harness sobe um servidor efêmero em `127.0.0.1`), mede 11 estados × 3 viewports e salva capturas/JSON. Serve para calibrar o medidor e provar que o script executa sem depender do app.

Inclui o viewport de zoom 200% quando pedido:

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=prototype --state=mesa-cheia --viewports=640x800 \
  --out=docs/work/reports/assets/T019F/smoke/zoom
```

### 3. Preview da base web

Com o app local ou preview já no ar (sem iniciar servidor pelo harness):

```sh
pnpm --filter @tretta/web dev --port 3100
# ou: pnpm --filter @tretta/web build && pnpm --filter @tretta/web start --port 3100

node docs/work/reports/assets/T019F/run.mjs \
  --mode=preview \
  --url=http://127.0.0.1:3100 \
  --out=docs/work/reports/assets/T019F/runs/preview
```

Mede `/preview`, confere se os frames de 412/1280 existem, fontes carregadas e overflow horizontal; não aplica pisos de tela de produto ao preview.

### 4. Matriz completa no app

A matriz completa precisa de estados de jogo reais. Há duas formas:

**a) Cenário de jogo** (recomendado para a T019F). Escreva um `scenarios/t019f.mjs` que prepara salas de 2 a 8 pessoas, prontidão, pausa, última, denúncia, treino, observador, resultado e gaveta. Veja [scenarios/README.md](scenarios/README.md).

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=app \
  --url=http://127.0.0.1:3100 \
  --set=core \
  --scenario=docs/work/reports/assets/T019F/scenarios/t019f.mjs \
  --out=docs/work/reports/assets/T019F/runs/t019f-core
```

**b) URLs preparadas** para estados que já estão na tela:

```sh
cat > /tmp/t019f-states.json <<'JSON'
{
  "home": "/",
  "preview": "/preview",
  "treino": "/sala/ABC234"
}
JSON

node docs/work/reports/assets/T019F/run.mjs \
  --mode=app --url=http://127.0.0.1:3100 \
  --state=home,preview,treino \
  --states-file=/tmp/t019f-states.json
```

`--state-url` funciona para um único estado. `--states-file` pode apontar para uma URL absoluta ou relativa à `--url`.

### 5. Comparação visual T018 → atual

```sh
node docs/work/reports/assets/T019F/compare.mjs \
  --run=docs/work/reports/assets/T019F/runs/t019f-core \
  --out=docs/work/reports/assets/T019F/runs/t019f-core/compare
```

Gera `visual-diff.json`, `diff/*.png` e `index.html` com T018, captura atual e diff lado a lado. A comparação é de **revisão**: a UI nova usa outra stack, então igualdade pixel a pixel não é o critério.

## Matriz

Viewports padrão: **412×915**, **360×640**, **1280×800** e **640×800** (zoom 200% equivalente). `640×400` é suplementar e permite rolagem na mesa.

Estados `--set=core`:

| Estado | Asserções principais |
| --- | --- |
| `home` | fontes, alvos, contraste, sem provocação |
| `preparacao`, `preparacao-8` | 2/8 assentos, pronto/não pronto, iniciar pelo anfitrião |
| `espera`, `observador` | mesa pública sem mão, vez, sentido, reações, sem rolagem |
| `mesa-2`…`mesa-8` | 2–8 assentos, sem rolagem vertical, cartas, alvos, nomes, contraste, aria-current |
| `mesa-cheia` | 8 cartas na mão, duas fileiras no celular, uma no desktop |
| `pausa` | substituir por bot, continuar sem, encerrar sem vencedor |
| `ultima` | aviso de última e etiqueta “última” |
| `denuncia` | denúncia na própria vez |
| `treino`, `bots` | treino e três bots |
| `substituto` | ausente, bot e substituto no mesmo estado |
| `resultado` | tela dedicada, vencedor, placar, volta à preparação |
| `resultado-sem-vencedor` | encerramento sem vencedor |
| `erro-conexao`, `erro-sala`, `erro-link` | recuperação e link inválido |
| `reacoes` | 12 reações, grade 4×3, sem alvo, sem destinatário |
| `sala`, `sala-apresentacao`, `sala-anfitriao` | gaveta, abas, seções, preferências, anfitrião |
| `inversao` | sentido invertido e anúncio aria-live |
| `carta`, `cor` | confirmação de jogada e escolha de cor |

`--set=full` inclui também `conversa`, `historico` e `reacao`.

## Asserções

- **Rolagem:** página sem overflow horizontal; mesa/espera sem rolagem vertical em 412×915, 360×640, 1280×800 e 640×800. Em `640×400`, rolagem é permitida para não esconder informação.
- **Assentos:** contagem exata ou faixa 2–8; inteiros no viewport; sem sobreposição com assento/centro; dentro da mesa; `aria-current` exatamente em um assento durante o turno.
- **Pisos de fonte:** vez 20, sentido 18, contagem 26/14, nome 16, nome na carta 14, corpo 16, rótulo 14, “na vez” 14. Nenhum texto funcional abaixo de 14 px.
- **Cartas:** largura ≥ 72 px; 8 cartas em 2×4 no celular e 1 fileira no desktop; acima de 8, rolagem local da mão.
- **Alvos:** todo controle visível ≥ 44×44 px.
- **Contraste:** texto ≥ 4,5:1 (3:1 para texto grande); foco e limites ≥ 3:1. Gradientes são avaliados no pior ponto; fundos com imagem sem cor declarada vão para `review`.
- **Nomes:** até 12 caracteres sem truncar, reticências e clipping; nome completo no nome acessível; nomes longos com reticências quando não cabem.
- **Reações:** 12 rótulos aprovados, sem atributos de alvo/destinatário, bandeja 4×3, apresentação central.
- **Provocações:** nenhuma ocorrência de `provoc`, `taunt`, “se ferrou”, “toma essa”, “palhaço”, “sacanagem”, “30s” ou “ocultar provocações” no texto visível ou em classes/atributos.
- **ARIA/teclado:** `aria-live` com anúncio no turno, nomes acessíveis, foco visível com anel ≥ 3:1, foco preso e Escape na gaveta, `prefers-reduced-motion` com regra CSS.
- **Preview:** não é tela de produto; só valida frames e fontes.

## Saída

```
runs/<id>/
  summary.json          # matriz, totais, exit code, ambiente
  measurements.json     # uma entrada por estado × viewport
  failures.json         # somente checks fail
  index.html            # tabela legível do run
  screenshots/*.png     # viewport exato, DPR 1
  raw/*.json            # medição bruta + checks
  compare/
    visual-diff.json
    index.html
    diff/*.png
```

Códigos de saída do `run.mjs`: `0` sem falhas; `1` falha de asserção; `2` erro fatal de runtime; `3` matriz incompleta com `--require-complete`. `--soft` força `0` e mantém o resultado no JSON. `compare.mjs`: `1` para dimensão/captura em branco/erro; `3` com `--require-all` e estados sem baseline.

## Contrato de seletores

O harness lê primeiro os hooks recomendados e depois cai para classes/ARIA do protótipo. A implementação **não é obrigada** a usar os hooks, mas eles reduzem ambiguidade:

| Grupo | Hooks preferidos |
| --- | --- |
| tela | `data-tv2-screen="home\|preparation\|waiting\|table\|result\|error"` |
| mesa | `data-tv2-table`, `data-tv2-center` |
| assento | `data-tv2-seat`, `data-tv2-seat-name`, `data-tv2-count`, `data-tv2-count-label`, `data-tv2-on-turn` |
| topo | `data-tv2-turn`, `data-tv2-direction` |
| mão/carta | `data-tv2-hand`, `data-tv2-card`, `data-tv2-card-name` |
| reação | `data-tv2-reaction`, `data-tv2-reaction-tray`, `data-tv2-reaction-overlay` |
| gaveta | `data-tv2-drawer` |
| gaveta/diálogo | `role="dialog"`, `aria-modal="true"`, nome acessível |

Fallbacks atuais: `.assento`, `.mao`, `.carta`, `.reacao-btn`, `.gaveta`, `#mesa`, `#mao` e a base T019C (`.tv2-seat`, `.tv2-seat-name`, `.tv2-seat-count`, `.tv2-card`, `.tv2-hand-cards`, `.tv2-table-stage`, `.tv2-table-center`, `.tv2-btn`, `.tv2-drawer`). Se a T019F usar outros nomes, ajuste `lib/config.mjs` (SELECTORS) e documente no report.

## Baseline e revisão visual

`baseline.json` congela as 105 capturas T018. `compare.mjs` calcula:

- percentual de pixels alterados (canal máximo > 16);
- diferença absoluta média, p95 e SSIM por blocos de 8×8;
- bounding box e imagem de diff;
- captura em branco/ilegível;
- diferenças estruturais (assentos, cartas, largura mínima e reações).

Limites padrão: `changedPct ≤ 12%` e `SSIM ≥ 0,90` para `ok`; acima disso, `review`. Dimensão diferente, captura em branco ou erro são `fail`. A T019F deve revisar todos os `review` no `index.html` do comparador.

## Isolamento do navegador

- Playwright inicia um Chromium/Chrome próprio com perfil temporário e porta de depuração efêmera; não usa o perfil pessoal, cookies, extensões ou sessões.
- O modo protótipo sobe um servidor HTTP efêmero em `127.0.0.1` e o encerra no fim.
- Nenhum servidor de aplicação é iniciado/reiniciado pelo harness. O usuário/T019F fornece a URL.
- Limpeza: contextos e navegador são fechados em `finally`; o servidor estático também. Se o processo for interrompido, verifique processos órfãos de Chromium antes de repetir.

## Limites conhecidos

- A matriz de jogo (2–8 assentos, pausa, última, denúncia, resultado) depende de cenário ou URL preparada; o cenário padrão cobre home, preview, treino/bots e link inválido.
- Fila de 3, 4 s e limite de 5 s de reação são comportamento; o harness estático mede 12 reações sem alvo, não o tempo. A T019F deve cobrir a fila/limite em cenário ou teste E2E próprio.
- O comparador visual não substitui leitura humana em 412/360/1280 nem teste em aparelho físico/leitor de tela.
- Contrastes de bordas decorativas podem aparecer como `review`; isso é intencional para não transformar acabamento em falso bloqueio.
- O harness não faz commit, push, deploy ou restart.
