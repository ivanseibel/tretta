# T010 — ajustes pós-validação (execução local)

**Estado:** ajustes concluídos e verificados; **aguardando revalidação do orquestrador**. Nada publicado: produção continua em T008, sem commit, push, deploy ou reinício de Render. HEAD segue `8967e94`; o working tree acumulado (T008–T010) foi preservado. Report T010 e validação do orquestrador mantidos como estavam.

**Contrato:** [T010-adjustments.md](../T010-adjustments.md). **Achados corrigidos:** [T010.validation.md](T010.validation.md). **Base:** [T010.md](T010.md) + [assets/T010](assets/T010/) (evidências originais preservadas).

---

## 1. Resultado por achado

| Achado da validação | Correção | Antes (registro) | Depois (registro) |
| --- | --- | --- | --- |
| **P2 — deadline não encerrava com ack em voo** | O ciclo tem vencimento próprio (`Promise.race` com timer de 60 s criado no início do ciclo, limpo em `finally`): o prazo vence mesmo com um ack em voo ou cadência pendente; resposta depois do limite não aplica nada (nem `resetRoomState`, nem `saveIdentity`). Efeitos de falhas definitivas preservados. | `orchestrator-before.txt`: 3 falhas (inclui “encerra o ciclo em 60 s mesmo com um ack em voo” — veio `recovering`); `red-before.txt`: nova regressão falha | `orchestrator-after-adjusted.txt`: 12/12; `green-after.txt`: caso passa (ciclo vence exatamente aos 60 s; sucesso tardio com `cred_tardia` ignorado: sem vínculo, sem estado, credencial intacta) |
| **P1 — ack podia habilitar vínculo de transporte caído** | Cada tentativa fica presa à **geração do transporte** (`transportEpochRef`, incrementada na queda): ack/recusa de transporte caído não habilita UI/APIs nem grava identidade; queda/reconexão apenas **acordam** a espera (wake), sem reiniciar o ciclo nem o prazo. | `orchestrator-before.txt`: falha “não autoriza ack de um transporte que desconectou” (`linkWhileOffline: true`, `newJoinAttempts: 0`); `red-before.txt` | `orchestrator-after-as-written.txt`: caso passa (10/12; ver §4 sobre o 12º); `green-after.txt`: vínculo falso nos dois lados da reconexão, 1 e exatamente 1 join pendente no transporte novo, convergência com ack válido |
| **P1 — resultado incerto prendia a recuperação (`ALREADY_IN_ROOM` eterno)** | **Recusa conhecida** (envelope do servidor no transporte vigente) consome a intenção: tentativa nova com `intentId` novo. **Resultado incerto** (timeout local de 6 s, `OFFLINE`, transporte caído) preserva o payload exato: o reenvio da mesma intenção recebe a **resposta memorizada do dedupe do servidor** (inclusive sucesso) em vez de recusa nova. Nada de capturar ack tardio; protocolo e servidor intocados. | Harness pré-correção com servidor real (`pre-fix/harness-output.json`): ack de join aceito derrubado pelo proxy → estado retido na página, banner de retomada, chat bloqueado com rascunho — e o ciclo **esgotou aos 60.046 ms** sem retomar (recovery `null`) | Harness pós-correção (`post-fix/harness-output.json`): mesma topologia → **recuperação automática aos 6.877 ms**, mesma mão (digest igual), credencial preservada, sem participante duplicado, sem reload extra; ações bloqueadas na janela incerta e habilitadas só depois da confirmação válida |
| **Histórico — 88 caminhos regenerados** | 87 caminhos restaurados byte a byte a partir de blobs do HEAD (hash atual conferido com `workingSha256` e blob com `headSha256`/`publishedSha256`); versões regeneradas preservadas antes, com índice/hash. 1 divergência (não restaurada, por contrato): `T007/ten-room-load.json` — ver §5. | `git-status-before-restore.txt`: 88 caminhos modificados | `historical-restore-report.json`: 87 restaurados, 1 divergência relatada, 1 pendência de status explicada; `regenerated/` com 87 originais + `regenerated-index.json`; E2E rodou em cópia isolada |

Aceite combinado: **reproduções novas** falharam antes e passam depois (registros acima); **critérios originais de T010 preservados** — os 9 testes originais seguem verdes dentro da suíte web 104/104 e os 9 primeiros casos do runner seguem verdes (as-written: 10/12; ajustado: 12/12); **histórico restaurado** com artefatos novos separados.

## 2. Decisão sobre confirmação de resultado incerto

Reconhecimento no servidor (**sem mudanças**): `joinRoom` responde `ALREADY_IN_ROOM` quando o socket já tem vínculo (`apps/server/src/rooms.ts`, verificação por socket antes do dedupe); `dedupeSocket`/`dedupe` memorizam a resposta por (socket, `intentId`, assinatura) e **repetem a resposta guardada** — inclusive o sucesso — para a mesma intenção. `INTENT_REUSED` só aparece com assinatura divergente para o mesmo id.

Desenho adotado no cliente:
- **Nova tentativa após recusa conhecida:** `intentId` novo (comportamento anterior, preservado).
- **Resultado incerto** (o servidor pode ter aceitado e só a confirmação se perdeu): reenvio com o **mesmo payload**, contando com o replay do dedupe. Sem captura de ack tardio (a promessa local já liquidadou) e sem esperar ack além do deadline.
- **Ack de transporte caído:** nunca aplica sucesso (vínculo contextual ao transporte); falhas definitivas (`CREDENTIAL_INVALID`, `ROOM_NOT_FOUND`) continuam valendo, pois são decisões do servidor sobre identidade/sala.

## 3. Mudanças de código

- `apps/web/app/providers.tsx` — motor de retomada:
  - `transportEpochRef` (geração do transporte, avança na queda) e `transportWaitersRef` (esperas acordáveis); `wakeTransport`/`waitTransport` com `dispose` (nenhum resolvedor sobrevive à tentativa/ciclo).
  - Queda (`disconnect`) invalida respostas em voo e acorda a espera; reconexão (`connect`) acorda para retomar de imediato; cancelamento e desmontagem acordam todas as esperas.
  - Laço do ciclo reescrito: vencimento próprio de 60 s em corrida com ack/espera (timer limpo em `finally`); tentativa com payload preservado ou consumida; sucesso só com geração atual e antes do prazo; recusa definitiva aplicada mesmo de transporte caído; espera cancelável (timer do passo limpo quando o wake/prazo vence).
  - `sleep` do laço removido (substituído pela espera cancelável).
- `apps/web/test/recovery-wait.test.tsx` — 6 regressões novas (deadline com ack em voo + sucesso tardio; ack→queda→continuação; replay da mesma intenção; recusa conhecida × incerto; queda/reconexão não reiniciam o prazo; recusa definitiva de transporte caído) e **ajuste de contabilidade** no caso existente do prazo: a tentativa abandonada no vencimento é drenada (resposta inerte) antes de aferir “nenhuma tentativa nova” e o novo ciclo do “Tentar novamente” — mesma justificativa registrada no artefato do runner ajustado.
- `apps/web/test/recovery-page.test.tsx` — mesmo ajuste de contabilidade em `driveToExhausted` (tentativa em voo no vencimento é drenada; resposta tardia inerte).
- Artefatos de revalidação: `assets/T010-adjustments/orchestrator-recovery-adjusted.test.tsx` (cópia do runner do orquestrador com os dois ajustes justificados no topo), `recovery-browser.mjs` (harness com cenários A e B), `historical-restore.mjs` (restauração por blob com provas).

Nenhuma mudança em servidor, protocolo, persistência, hospedagem, dependências ou env pública. Heartbeat de produção intocado.

## 4. Antes e depois — evidências

**Runner do orquestrador (cópia isolada, código do produto sem/; com correção):**

| Execução | Arquivo | Resultado |
| --- | --- | --- |
| Como entregue, código antigo | `orchestrator-before.txt` | **3 falhas / 9 passes** (deadline 60 s com ack em voo; ack→queda; ack além do timeout local) |
| Como entregue, código corrigido | `orchestrator-after-as-written.txt` | **2 falhas / 10 passes** — resta apenas o caso 3 as-written, cujo fake responde `ALREADY_IN_ROOM` ao **replay da mesma intenção** (o servidor real nunca faz isso: devolve a resposta memorizada). Ajuste de fixture autorizado pelo contrato. |
| Fixture ajustado, código corrigido | `orchestrator-after-adjusted.txt` | **12/12** — o reenvio aferido usa o **mesmo payload** (`second.payload == first.payload`) e a resposta memorizada retoma o vínculo |

**Suíte permanente (árvore principal):**

| Execução | Arquivo | Resultado |
| --- | --- | --- |
| Código antigo | `red-before.txt` | 5 falhas / 10 passes (as 5 regressões novas exercitando deadline, transporte e intenção; a guarda de falha definitiva já passava) |
| Código corrigido | `green-after.txt` | **15/15** |

**Harness real (servidor real, web de produção, cópia isolada; proxy TCP sem tocar produção):**

| Medida | Antes (`pre-fix/harness-output.json`, cenário B) | Depois (`post-fix/harness-output.json`, A+B) |
| --- | --- | --- |
| Ack de join aceito derrubado | 4.593 ms (frame de 175 B; proxy, não servidor) | idem (4 ms após o reload; 175 B) |
| Estado retido / banner de retomada | 649 ms / 649 ms após o reload | 155 ms / 155 ms |
| Bloqueio de ações na janela (rascunho retido, envio desabilitado) | 826 ms ✓ | 327 ms ✓ |
| Retomada automática | **não** — esgotou aos 60.046 ms | **6.877 ms** (mesma mão, sem duplicar participante, sem reload extra; envio habilitado após a confirmação) |
| Cenário A (reprova principal: blackhole + reload, reconhecimento tardio) | — (não rodado pré-correção) | “Retomando…” em 28 ms; recuperação automática **46.074 ms** pós-corte (janela tardia ~45 s); mesma mão (7 cartas, digest igual); credencial preservada; pausa da Ana visível em 44.556 ms e limpa junto da retomada; sem esgotamento |
| Erros de página | 0 | 0 (`pageErrors: []`); capturas sem cartas/credenciais (`bia-recovering.png`) |

Nota de método: a primeira versão do filtro do proxy interpretava o stream desde o início e quebrava o cabeçalho HTTP `101` do upgrade (desincronização; a única execução afetada foi descartada e re-rodada). O artefato final pula o cabeçalho do upgrade e registra apenas tamanho/booleano dos frames (nada de conteúdo). Os números “antes” válidos são da segunda execução pré-correção.

## 5. Histórico restaurado

- **Método** (`historical-restore.mjs`): para cada caminho da lista: (1) hash do arquivo atual == `workingSha256` registrado; (2) blob `git cat-file blob HEAD:<path>` == `headSha256`/`publishedSha256`; (3) cópia do regenerado para `regenerated/<path>` + índice; (4) escrita do blob; (5) hash final == `headSha256`. Sem `reset`/`checkout`/`clean`; nenhum outro caminho tocado.
- **Resultado** (`historical-restore-report.json`): **87 restaurados**; lista/hashes registrados em `regenerated/regenerated-index.json` (87 arquivos, ~39 MB); `pendingStatusAfter` vazio para os 87 (`git status` limpo nesses caminhos).
- **Divergência relatada (1, não tocada na restauração, por contrato):** `docs/work/reports/assets/T007/ten-room-load.json`. O conteúdo atual (`2fd39f6e…`) não confere com o `workingSha256` registrado (`1ad8fa90…`) porque **a rodada obrigatória de testes do servidor reescreve esse artefato**: `apps/server/test/ten-room-load.test.ts:196` grava o JSON de carga a cada execução, com métricas não determinísticas (latências/p50/p95/memória mudam a cada rodada; diff vs HEAD é só de métricas). O contrato manda preservar alterações que não conferem com os hashes registrados e **relatar divergências** — por isso o arquivo foi mantido, com cópia da versão divergente em `regenerated-divergent/` e hash no relatório. A versão da sessão T010 do mesmo arquivo foi comprovada (`1ad8fa90…` = `workingSha256` do registro) na cópia isolada criada antes desta execução; qualquer nova rodada de testes do servidor volta a reescrevê-lo — é a única pendência previsível de `git status` nesses caminhos.
- E2E desta execução rodou **somente na cópia isolada** (a cópia tem `docs/`, então as capturas dela ficam na cópia; nenhum caminho da árvore principal foi regenerado).

## 6. Arquivos desta execução

- `apps/web/app/providers.tsx` — correção do motor (§3).
- `apps/web/test/recovery-wait.test.tsx` — 6 regressões novas + ajuste de contabilidade.
- `apps/web/test/recovery-page.test.tsx` — ajuste de contabilidade do helper.
- `docs/work/reports/assets/T010-adjustments/` — `recovery-browser.mjs` (harness A/B), `recovery-browser` pré/pós (`pre-fix/`, `post-fix/`), `orchestrator-before.txt`, `orchestrator-after-as-written.txt`, `orchestrator-after-adjusted.txt`, `orchestrator-recovery-adjusted.test.tsx`, `red-before.txt`, `green-after.txt`, `web-suite-after.txt`, `server-tests-after.txt`, `typecheck-web.txt`, `historical-restore.mjs`, `historical-restore-report.json`, `historical-restore-log.txt`, `git-status-before-restore.txt`, `regenerated/` (+ índice), `regenerated-divergent/`, `typecheck-server.txt`, `frozen-install.txt`, `build.txt`, `git-diff-check.txt`, `e2e-copy.txt`, `e2e-production-copy.txt`.
- Evidências originais de T010/validação intactas.

## 7. Comandos e resultados

Passo a passo (Node `v22.23.1`, pnpm `11.14.0`, `rtk` nos comandos de shell):

1. `pnpm exec tsc --noEmit` (apps/web) e `pnpm --filter @tretta/server typecheck` — ok (`typecheck-web.txt`, `typecheck-server.txt`).
2. `pnpm --filter @tretta/web test` — **104/104** (11 arquivos; inclui 9 originais + 6 novas em `recovery-wait.test.tsx`).
3. `pnpm --filter @tretta/server test` — **125 + 1 pulado**.
4. Runner do orquestrador na cópia: antes 3/12 falhas → depois as-written 10/12 → ajustado **12/12**.
5. Harness real: pré-correção esgota em 60,046 s; pós-correção A recupera em 46,074 s e B em **6,877 s** com todas as flags de aceite verdadeiras.
6. `git diff --check` — limpo (`git-diff-check.txt`, 0 bytes).
7. `pnpm install --frozen-lockfile` — ok, “Already up to date” em 171 ms; lockfile intocado (`frozen-install.txt`).
8. `pnpm build` — ok: `rules`, `protocol`, `server` (`tsc -p tsconfig.build.json`) e `web` (Next) concluídos (`build.txt`).
9. E2E na cópia (`pnpm --filter @tretta/web e2e`): **32/32 em 2,9 min** (`e2e-copy.txt`).
10. Smoke de produção na cópia (`pnpm --filter @tretta/web e2e:production`): **1/1** — build compilado inicia a mesa sem hooks (`e2e-production-copy.txt`).

## 8. Limitações

- Os tempos de 60 s (prazo) e ~45 s (reconhecimento tardio padrão) são de ambiente e não são promessa; a janela real depende do heartbeat default, intocado.
- `ten-room-load.json` volta a divergir a cada rodada de testes do servidor (natureza volátil do artefato); decisão registrada em §5 para o orquestrador.
- O caso 3 do runner **as-written** permanece “vermelho por construção” no código corrigido (fake com semântica que o servidor real não tem); a cobertura equivalente na suíte permanente modela o replay real.
- Sem teste humano de som/celular nesta execução (pendência separada de T008).
- E2E/smoke locais; nenhuma medição de produção pública; nada publicado.
