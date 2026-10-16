# Report T001 — Ajustes: mãos e término da abertura

## Tarefa e resultado

- **Tarefa:** ajustes de T001 pedidos em [T001-adjustments.md](../T001-adjustments.md), a partir da [validação do orquestrador](T001.validation.md).
- **Resultado:** concluída pelo executor, sujeita à revalidação do orquestrador. Os dois achados foram corrigidos e reproduzidos antes e depois da mudança.
- **Modo:** execução manual, conforme `docs/work/status.md`. Nenhum commit foi criado.

## Alterações

Comportamento resultante:

- `hands` é um objeto sem protótipo, com uma propriedade própria por jogador. Ids como `__proto__`, `constructor` e `toString` aparecem em `Object.keys`, `Object.hasOwn`, JSON e consulta por id.
- A abertura termina para qualquer fonte em `[0, 1)`. Cada carta do topo é retirada uma vez; as não numéricas são reservadas até a primeira numérica, que vira o descarte. Só então as reservadas voltam à pilha de compra, que é reembaralhada uma única vez.
- Sem numérica na pilha de compra após a distribuição, a abertura lança `INSUFFICIENT_CARDS` explicitamente.
- `returnedDuringOpening` cobre todas as não numéricas retiradas antes da primeira numérica, na ordem de saída, sem repetição. Vazio quando o topo já era numérico.

Arquivos alterados:

| Arquivo | Alteração |
| --- | --- |
| `packages/rules/src/round.ts` | `hands` sem protótipo; busca com reserva e uma única devolução/reembaralhamento; documentação de `hands` e `returnedDuringOpening`. |
| `packages/rules/test/helpers.ts` | `guardedRandom`: limita chamadas à fonte aleatória nos testes para que um laço falhe em vez de travar. |
| `packages/rules/test/opening.test.ts` | Helper `expectOpeningInvariants`; novos testes de regressão; ajuste de dois testes existentes à nova semântica de `returnedDuringOpening`. |
| `docs/work/status.md` | Estado “aguardando revalidação do orquestrador”; links e modo manual mantidos. |
| `docs/work/reports/T001-adjustments.md` | Este report. |

Não alterados: `docs/work/T001.md`, `docs/work/T001-adjustments.md`, `docs/work/plan.md`, `docs/work/reports/T001.md`, `docs/work/reports/T001.validation.md`, `docs/product/`, `docs/reference/`, `AGENTS.md`. Os demais arquivos do working tree (`package.json`, `pnpm-lock.yaml`, `packages/`, `README.md`, `docs/work/setup.md` etc.) não foram tocados nesta tarefa.

## Evidência por critério de aceite

1. **Cada jogador tem mão como propriedade própria; enumeração e JSON preservam todas, inclusive ids especiais; conjunto de cartas sem perdas ou duplicações.** Atendido.
   - `guarda cada mão como propriedade própria, inclusive para ids especiais`: 8 ids incluindo `__proto__`, `constructor`, `toString`, `hasOwnProperty`, `valueOf`, `__defineGetter__`, `__lookupGetter__`, `ana`; verifica `Object.keys`, `Object.hasOwn`, 7 cartas por mão e 108 ids únicos.
   - `preserva todas as mãos na representação JSON, inclusive para ids especiais`: `JSON.parse(JSON.stringify(opening))` mantém as chaves e as mãos.
   - Antes da correção, esses dois testes falhavam com `__proto__` ausente nas chaves.
2. **Os dois loops terminam com descarte numérico e preservação; busca com progresso finito, sem teto arbitrário e sem erro quando há numérica.** Atendido.
   - `termina com a fonte periódica do relatório: 108 cartas, coringa inserido no índice 14`: fonte `calls++ % 93 === 0 ? 0 : 0.999`; passa com invariantes completas.
   - `termina no caso mínimo com fonte constante`: `() => 0`, 14 cartas nas mãos, uma ação, uma numérica; passa.
   - Progresso finito por construção: cada iteração remove uma carta da pilha, e a pré-checagem garante uma numérica na pilha. Não há contador de tentativas.
   - Antes da correção, os dois testes falhavam com `Fonte aleatória consultada mais de 10000 vezes: possível laço.`, mostrando que o laço existia.
3. **Não numéricas reservadas voltam à pilha de compra, aparecem uma vez cada em `returnedDuringOpening` e não entram no descarte.** Atendido.
   - `devolve não numéricas na ordem em que saíram e reembaralha uma única vez`: `returnedDuringOpening` igual às duas primeiras não numéricas na ordem de saída; descarte é a numérica encontrada.
   - `expectOpeningInvariants` confere, nos três casos novos de loop/devolução: ids únicos em `returnedDuringOpening`, cada uma presente em `drawPile`, ausente de `discardPile`, e não numérica.
   - `cartas não numéricas no topo voltam à pilha de compra` foi ajustado para derivar a expectativa do próprio baralho: as devoluções são exatamente as não numéricas antes da primeira numérica (os dois primeiros são Coringa e Bloqueio inseridos pelo teste).
4. **Critérios originais de T001 permanecem; instalação congelada, testes e tipos passam.** Atendido.
   - `pnpm install --frozen-lockfile` após `rm -rf node_modules packages/rules/node_modules`: exit 0.
   - `pnpm test`: exit 0, 3 arquivos, **51 testes** passando (deck 5, random 7, opening 39).
   - `pnpm typecheck`: exit 0.

## Verificação

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @tretta/rules test` (antes da correção, com testes novos) | 6 falhas nos testes de regressão e nos ajustados; 45 passando. As falhas de laço aparecem como erro da guarda após 10000 chamadas, sem travar. |
| `pnpm test` (após a correção) | Exit 0. 51 testes passando. |
| `pnpm typecheck` | Exit 0, sem saída de erro. |
| `rm -rf node_modules packages/rules/node_modules && pnpm install --frozen-lockfile` | Exit 0. "Lockfile is up to date". |
| `node -v` / `pnpm -v` | v22.23.1 / 11.14.0. |

Usei `pnpm` diretamente, não o wrapper `rtk`, para evitar o exit 1 espúrio do `typecheck` relatado na validação.

Falhas: nenhuma após a correção.

Limitações:

- Não rodei o processo original com timeout externo. A guarda de chamadas nos testes faz a falha ocorrer em milissegundos; o comportamento de laço foi confirmado por essa guarda antes da correção, e a validação do orquestrador já havia observado o processo sem término.
- Testado somente no macOS (darwin) com Node 22.23.1.
- Não houve clone limpo em outra máquina; o store global do pnpm foi reutilizado.

## Decisões, suposições e desvios

- **Objeto sem protótipo para `hands`:** escolha local permitida pelo ajuste. A representação JSON é a mesma para ids comuns, e a consulta por id continua `hands[id]`.
- **Pré-checagem de numérica mantida:** antes da busca, se a pilha de compra não tiver numérica, lança `INSUFFICIENT_CARDS`. Assim a busca termina por construção.
- **Guarda de chamadas nos testes (`guardedRandom`, 10000):** limite apenas do harness de teste, para transformar laço em falha. Não é um teto do algoritmo, que não tem contador de tentativas.
- **Ordem do descarte e do reembaralhamento:** a numérica inicial sai da pilha antes do reembaralhamento, que ocorre uma vez sobre o restante mais as devoluções. Antes, o reembaralhamento incluía a própria carta rejeitada a cada tentativa.
- **Semântica de `returnedDuringOpening`:** agora pode conter mais de uma carta (todas as não numéricas antes da primeira numérica), não apenas a primeira. Documentada em `round.ts`.
- **Versões fixadas:** mantidas, conforme aceite do orquestrador.
- **Commit:** não criado. Os arquivos continuam no working tree.

## Pendências

- Revalidação do orquestrador sobre os ajustes deste report.
- Commit ou patch, conforme a forma de validação (inalterado desde T001).

## Próximo passo

Aguardar revalidação do orquestrador. T002 só será preparada após a aceitação de T001 com estes ajustes.
