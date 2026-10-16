# T004 — Ajustes: report do executor

Executado em 14 de outubro de 2026 no working tree deste clone, sem commit. Corrige os cinco achados de [T004.validation.md](T004.validation.md). Report original, validação, prompt e evidências do orquestrador preservados; nenhum arquivo em `assets/T004-validation/` foi modificado.

## Tarefa e resultado

**Concluída**, aguardando revalidação do orquestrador. Os cinco achados foram corrigidos com regressões que falham antes e passam depois. Instalação congelada, build, suíte completa (123 motor + 7 protocolo + 77 servidor, 1 placeholder ignorado), typecheck de todos os pacotes, 10 E2E e `git diff --check` passam, executados sequencialmente.

## Correções por achado

### 1. Placar independente da ocupação de vaga (P1)

- `apps/server/src/rooms.ts`: a sala ganhou `history: Map<playerId, { nickname, avatar, wins }>`, alimentado na criação/entrada e incrementado apenas por vitória humana (`addWin`). `Participant.score` foi removido — o histórico é a única fonte. `snapshotOf` publica `scoreboard: ScoreboardEntry[]` (`playerId`, `nickname`, `avatar`, `wins`, `current`) e deriva `participants[].score` do histórico. Saída, remoção e retirada de substituto no fim da rodada não tocam no histórico; a expiração/reinício descarta a sala inteira, histórico incluso. Entradas históricas não ocupam capacidade, não exigem prontidão e não autorizam retorno (a busca por credencial continua restrita a `participants`); a chave é o `playerId`, então apelidos iguais nunca se fundem.
- `packages/protocol/src/index.ts`: novo tipo `ScoreboardEntry` e campo `scoreboard` no snapshot.
- `apps/web/components/Results.tsx`: placar renderizado a partir de `scoreboard`, com etiqueta “saiu da sala” para entradas históricas.
- `apps/web/components/Lobby.tsx`: seção “Placar da sala” com as entradas históricas, preservando o placar visível na nova preparação.

### 2. Replay preserva ack sem reassociar transporte (P1)

- `apps/server/src/rooms.ts` / `apps/server/src/server.ts`: `RoomTransport` ganhou `attach(socketId, roomCode)`; `createRoom`/`joinRoom` chamam `attach` **dentro da execução autorizada**. Os `socket.join` que ficavam nos handlers (fora do dedupe) foram removidos (`apps/server/src/handlers.ts`).
- Efeito: replay memorizado devolve exatamente o ack original sem reinscrever a conexão em sala antiga, revogada ou expirada; uma nova entrada com credencial válida usa o fluxo normal e reassocia pelo caminho autorizado.

### 3. Ack original de saída mesmo depois de desfazer o vínculo (P2)

- `apps/server/src/handlers.ts`: o handler de `client:leaveRoom` consulta o cache da conexão **antes** de exigir participante. Na primeira execução, a autorização atual é consultada dentro do cálculo memorizado; o replay devolve o ack original sem vínculo. A resposta cacheada é pública e imutável (`{ ok, version }`), sem o objeto `Room`. Assinatura divergente no mesmo escopo continua recusada com `INTENT_REUSED`; repetir a saída antiga após entrar em outra sala não remove a nova identidade.

### 4. Liberação de dados ao expirar com conexão ainda viva (P2)

- Consequência de 2 e 3: os registros retidos da conexão (criação, entrada, saída) são tombstones com apenas os campos do ack original (`roomCode`, `playerId`, `credential`, `version`, `rejoined`). Não guardam `Room`, participantes, histórico, aleatoriedade ou estado privado.
- `expireRoom` (já existente) libera `rooms`, `participantsById`, `participantsBySocket` e timers mesmo com sockets vivos; com os tombstones públicos, a sala expirada deixa de ser alcançável em memória. Replays devolvem o ack original sem recriar sala nem restaurar transporte/autoridade; registros válidos de outra sala da mesma conexão permanecem (sem teto por quantidade, como em T003).

### 5. Invalidação do agendamento do bot (P2)

- `apps/server/src/rooms.ts`: cada agendamento captura `botGeneration` (monotônica, incrementada em todo `cancelBot`) e a `version` vigente. `runBot` confere geração **e** versão antes de tocar em timer, motor, versão ou eventos; um callback antigo já entregue à fila retorna sem zerar o timer atual.
- Ordem `bump` → `syncPause`/`syncBot` corrigida em todas as transições que agendam (entrada por credencial, desconexão, saída na rodada, saída fora da rodada, `substituteAbsent`, `continueRound`); `startRound`, `applyRoundCommand` e `runBot` já agendavam após o `bump`. Verificações de rodada, vez, controle, pausa e presença humana preservadas em `botTarget`/`runBot`.
- `apps/server/test/helpers.ts`: `FakeClock` arquiva todos os callbacks e ganhou `deliver(handle)`, que executa um callback cancelado como trabalho já enfileirado, sem avançar o relógio.

## Evidência antes/depois

### Script do orquestrador (mesmo script, sem modificação)

Antes (executado sobre o `dist` pré-correção preservado):

```json
{"scenario":"placar após vitória humana e saída","winsBefore":1,"winsAfter":0,"roomStillExists":true,"winnerStillListed":false}
{"scenario":"replay de criação e de saída após outra sala","leaveFirstOK":true,"leaveReplayOK":false,"leaveReplayError":"NOT_IN_ROOM","originalCreationAck":true,"boundToNewRoom":true,"subscribedToOldRoom":true}
{"scenario":"replay de entrada após remoção","subscribedImmediatelyAfterRemoval":false,"originalJoinAck":true,"authorizedOnlyInNewRoom":true,"subscribedToRevokedRoom":true,"eventsReceivedFromRevokedRoom":1}
{"scenario":"expiração com socket vivo","roomExpired":true,"socketAlive":true,"cachedIntents":2,"cachedRoomReferences":1,"timersRemaining":0,"subscribedToExpiredCodeAfterReplay":true}
{"scenario":"callback de bot cancelado após retorno e nova saída","canceledHandleDifferentFromCurrent":true,"versionBefore":8,"versionAfter":9,"handBefore":7,"handAfter":6,"validCurrentTimerStillScheduled":true,"otherHumanStillConnected":true,"staleCallbackRanBeforeDelay":true}
```

Depois (build atual):

```json
{"scenario":"placar após vitória humana e saída","winsBefore":null,"winsAfter":0,"roomStillExists":true,"winnerStillListed":false}
{"scenario":"replay de criação e de saída após outra sala","leaveFirstOK":true,"leaveReplayOK":true,"originalCreationAck":true,"boundToNewRoom":true,"subscribedToOldRoom":false}
{"scenario":"replay de entrada após remoção","subscribedImmediatelyAfterRemoval":false,"originalJoinAck":true,"authorizedOnlyInNewRoom":true,"subscribedToRevokedRoom":false,"eventsReceivedFromRevokedRoom":0}
{"scenario":"expiração com socket vivo","roomExpired":true,"socketAlive":true,"cachedIntents":2,"cachedRoomReferences":0,"timersRemaining":0,"subscribedToExpiredCodeAfterReplay":false}
{"scenario":"callback de bot cancelado após retorno e nova saída","canceledHandleDifferentFromCurrent":true,"versionBefore":8,"versionAfter":8,"handBefore":7,"handAfter":7,"validCurrentTimerStillScheduled":true,"otherHumanStillConnected":true,"staleCallbackRanBeforeDelay":true}
```

Leitura: replays deixam de reassinar (`subscribedToOldRoom`/`subscribedToRevokedRoom`/`subscribedToExpiredCodeAfterReplay` = false; `eventsReceivedFromRevokedRoom` = 0), o ack de saída é memorizado, o cache não referencia a sala (`cachedRoomReferences` = 0) e o callback antigo não altera versão/mão. No cenário 1, o script mede apenas a **lista de participantes** (`p.score`) e o objeto interno do participante não guarda mais placar (`winsBefore: null`); a conservação do histórico é verificada pela nova suíte e pelo snapshot `scoreboard`, que o script não lê. O `observations.json` do orquestrador permanece intacto.

### Regressões novas (falham antes, passam depois)

14 testes em quatro arquivos novos. Para registrar o antes, as correções 2–5 foram temporariamente revertidas no fonte (backup em `/tmp`, restaurado em seguida) e a suíte nova foi executada: **7 falhas** exatamente nos cenários dos achados — `replay-transport.test.ts` (4: criação/entrada/expiração reassinavam e a saída devolvia `NOT_IN_ROOM`), `expiry-cache.test.ts` (2: cache com referência à sala), `bot-callback.test.ts` (1: callback antigo alterava versão 8→9 e mão 7→6). `scoreboard.test.ts` passou no revert parcial porque o achado 1 é uma mudança de modelo; seu antes está no script/observações do orquestrador (vitória some com a vaga). Com as correções: **14/14 passam**.

- `apps/server/test/scoreboard.test.ts` (4): vitória humana permanece após saída e nova pessoa na vaga; remoção no lobby; retirada de substituto com vitória anterior; identidades distintas com mesmo apelido.
- `apps/server/test/replay-transport.test.ts` (4): criação/entrada sem reassinar após saída, remoção, outra sala e expiração; ausência de eventos da sala revogada; saída com replay imediato, após nova sala e conflito de assinatura; tombstones sem referências internas.
- `apps/server/test/expiry-cache.test.ts` (2): limite exato de 15 minutos com socket vivo — sala, índices e timers liberados, cache sem referências, replays sem ressurreição; ciclos repetidos sem acumular objetos internos e preservando os registros de outra sala válida.
- `apps/server/test/bot-callback.test.ts` (4): callback cancelado após retorno e nova saída não altera nada e o timer atual segue válido (uma única ação no prazo); callback antigo em pausa/retomada; após encerramento e rodada nova; após expiração.

### Interface

`apps/web/e2e/scoreboard.spec.ts`: rodada completa em desktop/celular, Ana vence, sai na tela de resultado — o placar de Bia segue mostrando “Ana 1 rodada” com “saiu da sala”; Bia vira anfitriã, reabre a preparação e o placar histórico aparece na seção da sala; Cai entra na vaga liberada e o placar conservado permanece. Screenshots em `docs/work/reports/assets/T004/` (`mobile-placar-apos-saida.png`, `mobile-lobby-placar-conservado.png`).

## Verificação executada

- `rtk pnpm install --frozen-lockfile`: exit 0.
- `rtk pnpm build`: exit 0.
- `rtk pnpm test`: exit 0 — 123 motor, 7 protocolo, 77 servidor (19 arquivos; 1 placeholder ignorado; `process.test.ts` e `restart.test.ts` rodaram sobre o compilado). Executado sem E2E/tipos em paralelo.
- `rtk proxy pnpm -r --if-present typecheck`: exit 0 após o build.
- `rtk pnpm --filter @tretta/web e2e`: exit 0, 10 testes.
- `rtk proxy node docs/work/reports/assets/T004-validation/reproduce.mjs`: exit 0, saída acima; script não modificado.
- `rtk git diff --check`: exit 0.

## Decisões, esclarecimentos e desvios

- **Histórico do placar**: chaveado por `playerId`; entradas históricas com `wins = 0` não são exibidas depois que a pessoa deixa a sala (o placar é de vitórias), mas continuam no mapa até a expiração. `participants[].score` e `scoreboard[].wins` leem o mesmo mapa — sem fonte duplicada.
- **Tombstones de intenção**: distinção pedida no achado 4 — o registro retido guarda somente a resposta pública imutável da operação (inclusive a credencial devolvida ao próprio autor, necessária para o replay idêntico exigido em T003); nunca guarda estado interno. Vida útil: enquanto a conexão existir (`handleDisconnect` limpa o cache da conexão); sem truncamento por quantidade.
- **Transferência de anfitrião**: usa **menor `connectedSince`**, isto é, maior duração da conexão atual; empate pela ordem de entrada e depois pelo id. O código sempre esteve correto (`host.test.ts` ordena crescente); o report original de T004 dizia “maior `connectedSince`” — erro documental, corrigido aqui sem reescrever o original.
- **`deliver` no FakeClock**: entrega callbacks cancelados sem avançar o relógio, simulando trabalho já na fila; os testes anteriores, que apenas removiam o timer, continuam válidos e foram mantidos.
- Nenhuma mudança de regra de produto: prazos, elegibilidade inclusiva, retenção até decisão explícita, vitória automática sem ponto pessoal e política do bot permanecem como aprovados.

## Limitações e pendências

- O cenário 1 do script do orquestrador mede a lista de participantes e por isso não observa o histórico; a evidência da conservação está nas regressões e no E2E. O script não foi alterado, conforme a instrução.
- E2E usa prazos encurtados por env de teste; os limites exatos (90 s/15 min) são cobertos pela integração com relógio controlado.
- Carga, oito navegadores reais, aparelho físico, HTTPS e publicação seguem em T007; chat/humor em T005; polimento de UI em T006.

## Como reproduzir

```sh
rtk pnpm install --frozen-lockfile
rtk pnpm build
rtk pnpm test
rtk proxy pnpm -r --if-present typecheck
rtk pnpm --filter @tretta/web e2e
rtk proxy node docs/work/reports/assets/T004-validation/reproduce.mjs
```

- Placar histórico: `test/scoreboard.test.ts` e `e2e/scoreboard.spec.ts`.
- Replays e transporte: `test/replay-transport.test.ts` (observa `io.sockets.sockets.get(id).rooms` e eventos por sala).
- Expiração com socket vivo: `test/expiry-cache.test.ts` (inspeciona `socketIntents` internos e `clock.pendingTimers()`).
- Callback de bot: `test/bot-callback.test.ts` com `FakeClock.deliver(handle)`.

## Próximo passo

Revalidação do orquestrador. Nenhum commit criado; T005 não iniciada.
