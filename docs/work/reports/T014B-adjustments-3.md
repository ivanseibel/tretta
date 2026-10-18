# T014B — ajuste de monotonicidade e empates: report do executor

**Estado:** execução concluída em 18/10/2026; **aguardando revalidação do orquestrador**. Sem commit, push, deploy, restart ou faturamento; nenhuma sala pública/família. Ajuste restrito ao rastreador de tempo e aos testes. T014A, R1/R3 e S1 permanecem aceitos; reports/evidências anteriores preservados. Fonte verificada em cópia isolada, registrada em [`assets/T014B-adjustments-3/00-origin.txt`](assets/T014B-adjustments-3/00-origin.txt).

**Contrato:** [T014B-adjustments-3.md](../T014B-adjustments-3.md). **Base:** [revalidação do complemento R2](T014B.revalidation-2.md) (S1 aceito; S2 pendente).

---

## 1. Resultado e arquivos desta execução

**Resultado: concluída.** As três falhas de relógio/empates foram corrigidas: a referência comum não retrocede com amostra de timestamp ligeiramente maior, e replays no mesmo timestamp não desfazem fatos posteriores (estado nulo × aceite e liberação × recusa), sem reintroduzir a filtragem global entre escopos.

**Arquivos alterados nesta execução:**

| Arquivo | Natureza |
| --- | --- |
| `apps/web/lib/moodTime.ts` | `ScopeKnowledge` ganhou a origem do fato (`state` < `refusal` < `accept` < `release`) para desempatar timestamps idênticos; `advanceClock` agora usa a estimativa corrente como piso (não retrocede, mas timestamp realmente adiantado avança); `clearTarget` mantém a liberação como conhecimento prioritário sem tocar na referência comum |
| `apps/web/test/mood-time.test.ts` | +5 regressões duráveis: timestamp ligeiramente maior não retrocede (1000 ms), timestamp adiantado avança, replay de estado nulo não apaga aceite no mesmo ms (4500 ms) e repetições intercaladas, replay de recusa não ressuscita liberação (0) com recusa posterior ainda bloqueando, estado autoritativo mais novo encerrando janela |

Nenhum consumidor/UI/protocolo mudou; nenhuma regra, limite, duração, preferência ou recuperação foi alterada.

## 2. Reprodução inicial (cópia isolada)

Cópia física `tretta-t014b-adj3-verify-Un76HX/tretta`; instalação congelada e build da base verdes. Casos do orquestrador copiados para `apps/web/test/orchestrator-mood-clock-ties.test.ts` somente na cópia.

| Execução | Resultado | Log |
| --- | --- | --- |
| Três casos de relógio/empates (antes) | **3 falhas** | [`03-reproducao-inicial.log`](assets/T014B-adjustments-3/03-reproducao-inicial.log) |

Valores observados: **4999** em vez de **1000 ms** (ack de provocação com timestamp 10001 reancorou a referência já em 14000); **0** em vez de **4500 ms** (replay do estado nulo no mesmo timestamp apagou o aceite); **59500** em vez de **0** (replay da recusa no mesmo timestamp ressuscitou o alvo liberado).

## 3. Correção aplicada

- **Referência comum monotônica:** `advanceClock(serverTime, localAt)` calcula a estimativa corrente (`âncora.serverTime + tempo local decorrido`) e grava `max(serverTime, estimativa)` como nova referência. Um fato com timestamp maior que o da âncora, mas atrasado em relação ao tempo já decorrido, não retrocede a estimativa (U1); um timestamp realmente adiantado avança. Os prazos absolutos continuam medidos nessa referência, sem iniciar janela inteira na chegada.
- **Empates por origem do fato:** timestamps idênticos são resolvidos por prioridade `state < refusal < accept < release`; mesma prioridade é idempotente e não alterna por replay. Assim:
  - estado nulo inicial → aceite no mesmo ms funciona (`accept` > `state`);
  - replay do estado nulo não apaga o aceite posterior (U2);
  - liberação de alvo prevalece sobre a repetição da recusa superada, inclusive no mesmo timestamp (U2);
  - recusa realmente posterior (timestamp maior) continua bloqueando;
  - estado autoritativo com timestamp maior continua encerrando a janela.
- **Sem filtragem global:** a referência comum não serve mais para aceitar/rejeitar escopos; cada categoria/alvo compara apenas com o próprio conhecimento (S1 preservado). `clearTarget` não altera a referência — o aceite que originou a liberação já avançou o relógio; aqui só o conhecimento do alvo muda.

## 4. Verificação final (cópia isolada, fonte corrigida)

| Verificação | Comando | Resultado | Log |
| --- | --- | --- | --- |
| Casos de relógio/empates (verbatim) | `vitest run orchestrator-mood-clock-ties` | **3/3** | [`04-clock-ties-final.log`](assets/T014B-adjustments-3/04-clock-ties-final.log) |
| Casos de escopo (verbatim) | `vitest run orchestrator-mood-scopes` | **2/2** | [`05-escopos-final.log`](assets/T014B-adjustments-3/05-escopos-final.log) |
| Seis reproduções anteriores (verbatim; avatar acrescentado) | `vitest run orchestrator-mood-time + mood-avatar` | **20/20** | [`06-seis-anteriores-verbatim.log`](assets/T014B-adjustments-3/06-seis-anteriores-verbatim.log) |
| Build do workspace | `pnpm build` | exit 0 | [`07-build.log`](assets/T014B-adjustments-3/07-build.log) |
| Tipos do workspace | `pnpm typecheck` | exit 0 | [`08-typecheck.log`](assets/T014B-adjustments-3/08-typecheck.log) |
| Web (unitários da entrega) | `pnpm --filter @tretta/web test` | 20 arquivos, **180/180** (175 + 5 regressões) | [`09-web-test.log`](assets/T014B-adjustments-3/09-web-test.log) |
| E2E pertinente | `playwright test mood.spec.ts recovery.spec.ts taunt.spec.ts` | **5/5** | [`10-e2e-pertinente.log`](assets/T014B-adjustments-3/10-e2e-pertinente.log) |
| Servidor/pacotes × T014A aceita | sha256 contra `assets/T014A-validation/source-before.json` | **81/81 iguais** | [`T014A-backend-equality.json`](assets/T014B-adjustments-3/T014A-backend-equality.json) |

**U1 — Relógio:** primeiro caso passa com **1000 ms**; a chegada com timestamp 10001 mantém a reação em 1000 e a provocação em 11001, sem reancorar; o teste de timestamp realmente adiantado avança a referência e o prazo corre normalmente.
**U2 — Empates:** replay do estado nulo no mesmo ms preserva **4500 ms** e repetições intercaladas não mudam o estado; replay da recusa no mesmo ms preserva **zero** e uma recusa de timestamp maior volta a bloquear; o caso já coberto de estado nulo inicial → aceite no mesmo instante continua verde.
**U3 — Regressões:** casos de escopo 2/2 (3500/14500 e 58500/59500), seis reproduções anteriores 20/20, R1/R3 e demais unitários 180/180, build/tipos verdes, E2E de humor/recuperação/provocação 5/5; servidor/pacotes 81/81 iguais à base T014A; código fonte × cópia 166/166 (excluído o gerado `next-env.d.ts`) conforme [`code-equality.log`](assets/T014B-adjustments-3/code-equality.log) vazio; históricos intactos.

## 5. Proveniência e preservação

- Origem em [`00-origin.txt`](assets/T014B-adjustments-3/00-origin.txt). Preservação contra a fonte da revisão final (1.263 arquivos, [`preservation.json`](assets/T014B-adjustments-3/preservation.json)): **1.255 iguais, 0 ausentes**; **alterados por esta execução: 2** (`apps/web/lib/moodTime.ts`, `apps/web/test/mood-time.test.ts`); as 6 diferenças restantes são documentos atualizados pela preparação do orquestrador às 19:43, antes desta execução (status/plan/T014B/adjustments-2/backlog/escopo).
- Reports/evidências anteriores (`T014B.md`, `T014B.validation.md`, `T014B-adjustments.md`, `T014B.revalidation.md`, `T014B-adjustments-2.md`, `T014B.revalidation-2.md` e respectivos `assets/`) permanecem iguais; este report e `assets/T014B-adjustments-3/` são acréscimos. Suítes reescreveram capturas/métricas históricas apenas na cópia.
- `git diff --check` limpo na fonte.

**Limitações:** alteração restrita à biblioteca de tempo; sem necessidade de inspeção de navegador (UI intocada); E2E pertinente ao contrato (humor/recuperação/provocação); servidor/regras não reexecutados por permanecerem idênticos à base T014A (sha256). Sem aparelho físico ou leitor de tela.

## 6. Próximo passo

1. Revalidar U1–U3 e B4/C4 afetados contra este report e `assets/T014B-adjustments-3/`.
2. O aceite final continua pertencendo ao orquestrador; publicação é etapa posterior e não autorizada.
3. Sem pendências declaradas pelo executor além da revalidação.
