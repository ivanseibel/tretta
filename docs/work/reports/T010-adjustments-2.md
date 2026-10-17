# T010 — confirmação de resultado incerto entre ciclos explícitos (execução local)

**Estado:** caso entre ciclos corrigido e verificado; **aguardando revalidação final do orquestrador**. Nada publicado: produção continua em T008; sem commit, push, deploy ou reinício de Render. HEAD segue `8967e94`; working tree acumulado (T008–T010) preservado. O único histórico divergente (`assets/T007/ten-room-load.json`) foi restaurado a partir do blob do HEAD ao final, conforme autorização expressa do contrato.

**Contrato:** [T010-adjustments-2.md](../T010-adjustments-2.md). **Achado de origem:** [T010.revalidation.md](T010.revalidation.md). **Base preservada:** [T010-adjustments.md](T010-adjustments.md), [T010.md](T010.md), [T010.validation.md](T010.validation.md).

---

## 1. Causa e correção

**Causa (achado da revalidação):** quando o primeiro ciclo esgotava o prazo de 60 s com o join **aceito** no servidor, mas com todos os acks indisponíveis, o clique em *Tentar novamente* iniciava uma **intenção nova** (`intentId` novo). No mesmo socket já autorizado, o servidor recusa com `ALREADY_IN_ROOM` (vínculo verificado por socket, antes do dedupe) — e o ciclo novo podia ficar preso nessa recusa, sem convergir. O resultado incerto (o payload exato que o servidor já pode ter aceitado e memorizado) não atravessava o limite entre ciclos.

**Correção:** **preservar a intenção incerta entre ciclos explícitos** e reenviá-la no ciclo novo, contando com o **replay memorizado do dedupe do servidor** (que repete a resposta guardada — inclusive o sucesso). `ALREADY_IN_ROOM` isolado **nunca** habilita nada: a adoção só ocorre quando o ciclo novo ainda não tem tentativa e o contexto bate integralmente.

- `apps/web/app/providers.tsx` (12 edições, 8 usos de `uncertainIntentRef`):
  - `uncertainIntentRef: useRef<{ roomCode, attempt } | null>` grava a última intenção com resultado incerto em `finishDeadline()` — cobrindo os 4 pontos de retorno do vencimento do ciclo (tentativa em voo, cadência, ack, sucesso);
  - **adoção** no ponto em que o ciclo novo forjaria tentativa: apenas com `attempt === null` e match de `roomCode` + `credential` + `nickname` + `avatar`; adotar **consome** o guardado (zera o ref);
  - **descarte**: `cancelRecovery` (cancelamento e desmontagem), troca de sala/identidade (`clearRoomState`/mismatch), branch de sucesso e mismatch de identidade na adoção; recusa conhecida consome a tentativa e a próxima é id novo (o guardado já foi consumido na adoção);
  - a confirmação do ciclo novo é o **ack da emissão do próprio ciclo novo** (geração de transporte vigente, dentro do prazo desse ciclo) — um callback espontâneo do ciclo vencido continua inerte (a promessa local já liquidou e os guardas de geração/prazo são por ciclo).
- `apps/web/test/recovery-wait.test.tsx`: novo bloco permanente **“resultado incerto entre ciclos explícitos”** com 5 casos (ROOMC1–5):
  1. retomada explícita após o vencimento confirma a intenção incerta com o replay exato;
  2. callback do ciclo vencido não encerra nem habilita o ciclo novo;
  3. intenção incerta não contamina outra sala;
  4. troca de identidade na mesma sala descarta a intenção incerta;
  5. ciclo explícito que retoma a intenção incerta continua limitado ao próprio prazo.

Nenhuma mudança em servidor, protocolo, deduplicação, persistência, dependências ou env pública. Heartbeat de produção intocado.

## 2. Estratégia entre ciclos (justificativa do desenho)

Reconhecimento no servidor (comprovado, **sem alterações**): `joinRoom` verifica por socket e responde `ALREADY_IN_ROOM` só quando o **mesmo socket** já tem vínculo; `dedupeSocket` memoriza a resposta por (socket, `intentId`, assinatura) e **repete a resposta guardada** — inclusive o sucesso — para a mesma intenção reenviada.

- **Replay da intenção incerta (adotado)** × disconnect controlado: o replay alinha com o dedupe já existente e com o transporte vivo (parte essencial da prova), sem flash de reconexão, sem expor uma janela em que o servidor perde o vínculo do socket (o que poderia aceitar um join como participante novo). O servidor permanece a fonte de verdade: a confirmação vem da resposta memorizada à mesma intenção no mesmo transporte.
- **Isolamento mantido:** recusa conhecida no transporte vigente → tentativa lógica nova (`id` novo); resultado incerto → mesmo payload. Troca de sala/identidade, remoção, invalidação, saída e cancelamento **não** reutilizam o guardado. Nenhum caminho habilita vínculo por `ALREADY_IN_ROOM` isolado nem aceita callback do ciclo vencido; um ciclo fica ativo por contexto (a adoção acontece uma única vez e consome).

## 3. Regressões antes e depois

| Execução | Arquivo | Antes | Depois |
| --- | --- | --- | --- |
| Suíte permanente (5 casos novos; 3 falhavam pré-correção, 2 são guardas já verdes) | `red-before.txt` / `green-after.txt` | **3 falhas / 17 passes** (20) | **20/20** |
| Runner do orquestrador (caso novo 16) | `orchestrator-before.txt` / `orchestrator-after.txt` | **1 falha / 15 passes** (16) | **16/16** |
| Runner ajustado de continuidade (T010-adjustments) | `orchestrator-adjusted-after.txt` | — | **12/12** |

Os dois guardas (callback vencido inerte; não contaminação entre salas/identidades) passam antes e depois; as 3 regressões de comportamento novo falham sem a correção e passam com ela.

## 4. Prova integrada real (servidor real, entre ciclos)

**Método** (`cross-cycle-browser.mjs`, cenário C; cópia isolada): web de produção da cópia → proxy TCP armado → servidor real. O proxy **derruba somente os acks do join do socket novo** durante a janela armada (70 s); nenhum frame de heartbeat é tocado. **Sem aceleração de tempo:** ~76 s reais. Heartbeat padrão (sem `TRE_TTA_*`): `results.heartbeat = "padrao (sem TRE_TTA_* de ping)"`.

Sequência comprovada: 1º join aceito e memorizado no servidor → 8 acks derrubados na janela (UI esgota aos **60.210 ms** pós-reload, credencial intacta) → janela fecha e um ack volta a passar → clique em *Tentar novamente* → **banner de retomada visível aos 26 ms** → **vínculo restabelecido aos 63 ms** com o replay exato da mesma intenção.

| Medida | Valor (rodada limpa) |
| --- | --- |
| Esgotamento do 1º ciclo | 60.210 ms pós-reload (janela de 55–70 s ✓) |
| Acks derrubados / ack pós-janela passou | 8 ✓ / sim (resposta do replay) |
| Intenções de join distintas em todo o cenário | **1** (fingerprint `207150ae9c6061cf`) — mesmo payload no 1º ciclo e no retry |
| Recuperação após o clique | **63 ms** (≤ 15 s ✓) |
| Mão | 7 cartas antes = 7 depois; digest `c5bc32b4…` igual ✓ |
| Credencial | presente (43 chars, checksum `2000398649`) igual antes/depois ✓ |
| Participantes | sem duplicado; roster 1 adversário/0 aguardando antes = depois (Ana e Bia) ✓ |
| Ações | bloqueadas no esgotamento (placeholder “Recuperando a conexão com a sala…”; envio desabilitado); após retomada: placeholder “Escreva uma mensagem” e envio habilita com rascunho ✓ |
| Reloads | 1 (o reload que monta o cenário; nenhum reload extra após o retry) ✓ |
| Erros de página | 0 (`pageErrors: []`) ✓ |

Os 12 critérios de aceite do cenário C ficaram todos `true` (`cross-cycle-browser.json` → `results.scenarioC.acceptance`). Capturas sem cartas/credenciais: `harness-c/ana-cross-cycle-exhausted.png` (painel de vencimento sobre a mesa).

**Nota de método (rodada 1 descartada):** a primeira execução acusou recuperação aos 35.051 ms — artefato do **script**, não do app: o `getByTestId('recovering')` não existe no modo sala (o banner chama-se `recovering-banner`) e o `.screenshot()` seguinte esperou o timeout padrão de 30 s, **bloqueando o laço de detecção**. O ack do replay já tinha passado aos 36 ms naquela rodada. O script foi corrigido (captura do banner com timeout curto, detecção com `recoveringBanner`, prova de ação por rascunho) e o parser do proxy passou a pular o cabeçalho HTTP do upgrade (o contador de intenções acusava 0 por isso). A rodada 1 ficou preservada como histórico: `cross-cycle-browser-run1.json`, `harness-c-run1/`.

## 5. Verificações, repetições e limites

| Verificação | Resultado | Arquivo |
| --- | --- | --- |
| Tipos web | 0 erros | `typecheck-web.txt` |
| Tipos servidor | 0 erros | `typecheck-server.txt` |
| Suíte web (árvore principal) | **109/109** (11 arquivos) | `web-suite-main-after.txt` |
| Suíte web (cópia, com os 2 runners) | **137/137** (13 arquivos) | `web-suite-after.txt` |
| Servidor — recuperação/deduplicação pertinentes (dedupe, dedupe-retention, recovery, replay-transport) | **25/25** | `server-pertinent-after.txt` |
| Build (root, cópia) | exit 0; `apps/web` ok (`/`, `/_not-found`, `/sala/[code]`) | `build-copy.txt` |
| E2E pertinentes em cópia isolada, sequenciais (1 worker): recovery-wait, recovery, server-restart | **3/3** (10,8 s) | `e2e-recovery-after.txt` |
| `git diff --check` | limpo | (saída registrada no fluxo) |

**Repetições justificadas:** a correção ficou restrita à transição entre ciclos no cliente, então não foram repetidos o harness longo A, o E2E completo (32), o smoke de produção nem a instalação congelada — registros anteriores permanecem válidos (`assets/T010-adjustments/`, T008). O lockfile não mudou (`pnpm-lock.yaml` fora do `git status`), por isso o frozen install não foi repetido (`versions.txt`). Provas anteriores do heartbeat padrão mantidas; esta execução voltou a rodar com heartbeat padrão em tempo real.

**Limites:** os tempos de 60 s e ~70 s são de ambiente, não promessa; o heartbeat default não foi alterado. E2E/build locais em cópia isolada; sem medição de produção pública. A captura do banner de retomada não fecha arquivo (ele some em ~63 ms); o registro `retryBannerSeen: true` aos 26 ms está no JSON.

## 6. Restauração do histórico

- **Antes de restaurar:** versão atual preservada com índice/hash em `preserved/` (`preservation-index.json`; cópia em `preserved/ten-room-load-divergent-current.json`), confirmada com o hash da revalidação: `2fd39f6e…` (`matchesRevalidation: true`).
- **Proveniência conferida:** registry `assets/T010-validation/historical-artifacts.json` → `headSha256 == publishedSha256 == cacadfbb3bbd7624c21ccf244b48bd3e929ce660ef0aad8ef9c3a3e8c46299a9`.
- **Escrita:** somente `git cat-file blob HEAD:docs/work/reports/assets/T007/ten-room-load.json` → mesmo caminho (sem reset/clean/checkout/restore geral).
- **Depois:** hash final `cacadfbb…` ✓, 4.668 bytes ✓, `git status` limpo nesse caminho; total de entradas `git status` **62 → 61** (única diferença: o caminho restaurado). Os outros 87 históricos permanecem intocados (`git-status-pre-restore.txt`, `git-status-post-restore.txt`, `historical-restore-log.txt`).
- **Causa da divergência (já relatada):** `apps/server/test/ten-room-load.test.ts:196` reescreve o artefato com métricas voláteis a cada rodada de testes do servidor; por isso testes de servidor/E2E desta execução rodaram **apenas em cópia isolada**.

## 7. Arquivos desta execução

- `apps/web/app/providers.tsx` — correção entre ciclos (`uncertainIntentRef`; 12 edições, §1).
- `apps/web/test/recovery-wait.test.tsx` — 5 regressões permanentes novas (ROOMC1–5).
- `docs/work/reports/assets/T010-adjustments-2/` — `red-before.txt`, `green-after.txt`, `orchestrator-before.txt`, `orchestrator-after.txt`, `orchestrator-adjusted-after.txt`, `typecheck-web.txt`, `typecheck-server.txt`, `web-suite-main-after.txt`, `web-suite-after.txt`, `server-pertinent-after.txt`, `build-copy.txt`, `e2e-recovery-after.txt`, `versions.txt`, `cross-cycle-browser.mjs` (cenário C corrigido), `cross-cycle-browser.json` (+ `-run1` preservada), `harness-c/` e `harness-c-run1/`, `preserved/`, `preservation-index.json` (em `preserved/`), `git-status-pre-restore.txt`, `git-status-post-restore.txt`, `historical-restore-log.txt`.
- Evidências anteriores de T010/T010-adjustments/T010-validation/T007 intactas.
