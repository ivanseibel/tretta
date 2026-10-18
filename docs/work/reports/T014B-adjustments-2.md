# T014B — complemento de R2: report do executor

**Estado:** execução concluída em 18/10/2026; **aguardando revalidação do orquestrador**. Sem commit, push, deploy, restart ou faturamento; nenhuma sala pública/família. Ajuste restrito ao rastreador de tempo e seus testes; R1/R3 e todos os reports/evidências anteriores preservados. Fonte verificada em cópia isolada, registrada em [`assets/T014B-adjustments-2/00-origin.txt`](assets/T014B-adjustments-2/00-origin.txt).

**Contrato:** [T014B-adjustments-2.md](../T014B-adjustments-2.md). **Base:** [revalidação T014B](T014B.revalidation.md) (T014A e R1/R3 aceitos; R2 pendente).

---

## 1. Resultado e arquivos desta execução

**Resultado: concluída.** A perda de metadados válidos entre escopos foi corrigida: a referência comum de relógio não bloqueia mais o dado de outra categoria/alvo, e cada escopo compara a informação apenas com o próprio conhecimento (inclusive janela encerrada por estado autoritativo), sem renovar prazo na chegada.

**Arquivos alterados nesta execução:**

| Arquivo | Natureza |
| --- | --- |
| `apps/web/lib/moodTime.ts` | Separação entre **referência comum** (`clock`, só avança, não reancora em chegada tardia) e **conhecimento por escopo** (`ScopeKnowledge` por categoria de emissor ou id de alvo, com tombstone `nextSendAt: null`). Restante medido sempre na referência comum; replay idêntico idempotente; dado superado no próprio escopo rejeitado; `clearTarget` com `serverTime` grava liberação como conhecimento |
| `apps/web/test/mood-time.test.ts` | +6 regressões duráveis: dois casos do orquestrador (3500/14500 e 58500/59500), ordem adversa entre alvos, tombstone autoritativo sem ressurreição, expiração/recuperação, liberação×recusa por alvo e estado nulo no mesmo instante |

Nenhum consumidor precisou de ajuste: o provider continua chamando `noteSender`/`noteRetry`/`noteState`/`clearTarget` com os mesmos campos, e a assinatura de `clearTarget` segue compatível (parâmetro extra opcional). Sem alteração de contrato, servidor, UI, durações, preferências ou recuperação.

## 2. Reprodução inicial (cópia isolada)

Cópia física `tretta-t014b-adj2-verify-rS5UTw/tretta` do working tree completo; instalação congelada e build da base verdes antes da reprodução. Casos do orquestrador copiados para `apps/web/test/orchestrator-mood-scopes.test.ts` **somente na cópia**.

| Execução | Resultado | Log |
| --- | --- | --- |
| Dois casos de independência entre escopos (antes) | **2 falhas** | [`03-reproducao-inicial.log`](assets/T014B-adjustments-2/03-reproducao-inicial.log) |

Falhas: “ack válido de reação não desaparece por chegar após dado mais novo de provocação” → **0** em vez de **3500 ms**; “recusa válida do alvo Bia não desaparece por chegar após dado mais novo do alvo Cai” → **0** em vez de **58500 ms**. Causa: `acceptClock` bloqueava qualquer `serverTime` anterior à última amostra global antes de avaliar a ordem da categoria/alvo.

## 3. Correção aplicada

- **Referência comum (`clock`)** guarda `serverTime` + instante local da amostra mais nova já vista e **só avança**: dado atrasado mas válido entra no escopo sem retroceder a âncora e sem reiniciar janela na chegada (o restante é sempre `nextSendAt - (clock.serverTime + tempo local decorrido)`).
- **Conhecimento por escopo** (`sender[category]`, `targets[id]`) guarda o dado mais novo daquele escopo, inclusive `nextSendAt: null` quando um estado autoritativo encerrou a janela. A informação só é aplicada se for mais nova que o conhecimento do **próprio** escopo; portanto uma atualização de provocação não invalida reação e uma liberação/recusa de um alvo não invalida a de outro.
- **Tombstones**: o `null` autoritativo permanece como ordem do escopo, então um ack antigo não ressuscita a espera; `clearTarget(id, serverTime)` grava a liberação como conhecimento (sem `serverTime`, apenas descarta, comportamento legado dos testes).
- **Idempotência**: em instante idêntico, só informação diferente é novidade — replay bit a bit do mesmo ack/recusa não reancora nem altera o restante. (Isso preserva o caso real de estado e aceite no mesmo milissegundo do relógio falso.)
- Preservados: dados estruturados de ack/recusa/estado, recuperação dos dois intervalos, relógio do aparelho deslocado, ausência de renovação por replay e limites autoritativos.

## 4. Verificação final (cópia isolada, fonte corrigida)

| Verificação | Comando | Resultado | Log |
| --- | --- | --- | --- |
| Casos de escopo do orquestrador (verbatim) | `vitest run test/orchestrator-mood-scopes.test.ts` | **2/2** | [`04-escopos-final.log`](assets/T014B-adjustments-2/04-escopos-final.log) |
| Seis reproduções anteriores (verbatim, avatar acrescentado) | `vitest run orchestrator-mood-time + mood-avatar` | **20/20** | [`05-seis-anteriores-verbatim.log`](assets/T014B-adjustments-2/05-seis-anteriores-verbatim.log) |
| Build do workspace | `pnpm build` | exit 0 | [`06-build.log`](assets/T014B-adjustments-2/06-build.log) |
| Tipos do workspace | `pnpm typecheck` | exit 0 | [`07-typecheck.log`](assets/T014B-adjustments-2/07-typecheck.log) |
| Web (unitários da entrega) | `pnpm --filter @tretta/web test` | 20 arquivos, **175/175** (169 + 6 regressões) | [`08-web-test.log`](assets/T014B-adjustments-2/08-web-test.log) |
| E2E pertinente | `playwright test mood.spec.ts recovery.spec.ts taunt.spec.ts` | **5/5** | [`09-e2e-pertinente.log`](assets/T014B-adjustments-2/09-e2e-pertinente.log) |
| Servidor/pacotes × T014A aceita | sha256 contra `assets/T014A-validation/source-before.json` | **81/81 iguais** | [`T014A-backend-equality.json`](assets/T014B-adjustments-2/T014A-backend-equality.json) |

**S1 — Escopos independentes:** os dois casos do orquestrador passam com os valores exatos (3500/14500 e 58500/59500 ms); a ordem adversa entre alvos também preserva os dois (teste novo “recusa válida do alvo Bia…” com inversão).
**S2 — Prazo e ordem:** replay/chegada tardia não reancoram (o mesmo teste confere 3500 → 3000 ms com o tempo correndo); âncora não retrocede; dado superado no próprio escopo é rejeitado, inclusive após `null` autoritativo (“janela encerrada por estado autoritativo…”) e após liberação por aceite mais novo (“liberação e recusa de alvo…”); expiração/recuperação e estado nulo no mesmo instante cobertos; duas ordens de chegada, repetições e as regressões anteriores verdes.
**S3 — Regressões e preservação:** seis reproduções anteriores verbatim 20/20, R1/R3 e demais unitários 175/175, build/tipos verdes, E2E de humor/recuperação/provocação 5/5; servidor/pacotes 81/81 iguais à base T014A; código fonte × cópia 166/166 (excluído o gerado `next-env.d.ts`, ignorado pelo git — [`code-equality.log`](assets/T014B-adjustments-2/code-equality.log) vazio); históricos intactos.

## 5. Proveniência e preservação

- Origem/versões em [`00-origin.txt`](assets/T014B-adjustments-2/00-origin.txt). Preservação contra a fonte da revalidação (1.230 arquivos, [`preservation.json`](assets/T014B-adjustments-2/preservation.json)): **1.222 iguais, 0 ausentes**; **alterados por esta execução: 2** (`apps/web/lib/moodTime.ts`, `apps/web/test/mood-time.test.ts`); as 6 diferenças restantes são documentos atualizados pela preparação do orquestrador às 19:33, antes desta execução (status/plan/T014B/adjustments/backlog/escopo).
- Reports/evidências anteriores (`T014B.md`, `T014B.validation.md`, `T014B-adjustments.md`, `T014B.revalidation.md` e respectivos `assets/`) permanecem iguais; este report e `assets/T014B-adjustments-2/` são acréscimos. Suítes reescreveram capturas/métricas históricas apenas na cópia.
- `git diff --check` limpo na fonte.

**Limitações:** alteração restrita à biblioteca de tempo; nenhuma inspeção de navegador foi necessária (UI intocada) e o E2E foi o pertinente ao contrato (humor/recuperação/provocação). Servidor/regras não foram reexecutados por permanecerem idênticos à base T014A aceita (comprovação por sha256). Sem aparelho físico ou leitor de tela.

## 6. Próximo passo

1. Revalidar S1–S3 e B4/C4 afetados contra este report e `assets/T014B-adjustments-2/`.
2. O aceite da feature continua pertencendo ao orquestrador; publicação permanece etapa posterior e não autorizada.
3. Sem pendências declaradas pelo executor além da revalidação.
