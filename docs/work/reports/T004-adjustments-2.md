# T004 — Ajustes 2: report do executor

Executado em 14 de outubro de 2026 no working tree deste clone, sem commit. Corrige a pendência P1 da [revalidação](T004.revalidation.md): entrada nova durante a rodada invalidava o timer do substituto sem reagendar, parando a vez. As cinco correções anteriores foram preservadas. Documentos do orquestrador e reports anteriores intactos; nenhum arquivo em `assets/T004-validation/` foi modificado.

## Tarefa e resultado

**Concluída**, aguardando revalidação final do orquestrador. Instalação congelada, build, suíte completa (123 motor + 7 protocolo + 83 servidor, 1 placeholder ignorado), typecheck de todos os pacotes, 10 E2E, `git diff --check` e as duas reproduções do orquestrador (original e suplementar) passam, executados sequencialmente.

## Causa e correção

- **Causa**: em `RoomStore.joinRoom`, o caminho de entrada nova sem credencial fazia `bump(room)` e publicava snapshot, mas não chamava `syncBot`. O timer vigente guardava a versão anterior; ao ser entregue, a guarda de geração/versão de `runBot` o recusava corretamente e nenhum agendamento novo existia — a vez do substituto ficava parada até outra mutação.
- **Correção** (`apps/server/src/rooms.ts`): após `bump` nesse caminho, `syncBot(room)` refaz o agendamento com a versão nova. Mudança limitada ao necessário; nenhuma regra de produto alterada.
- **Revisão dos demais caminhos** que incrementam versão durante rodada ativa: `joinRoom` por credencial, `handleDisconnect`, `leaveRoom` (rodada e fora dela), `substituteAbsent`, `continueRound`, `startRound`, `applyRoundCommand` e `runBot` já sincronizavam após o `bump`; `endRoundWithoutWinner`, `removeParticipant`, `setReady`, `returnToLobby` e `createRoom` não têm bot ativo (lobby/finished) ou cancelam o agendamento em `finishRound`. Nenhum outro ajuste foi necessário.
- Guardas contra callback obsoleto (geração + versão capturadas no agendamento) permanecem; replay de entrada continua sendo um hit de deduplicação que não executa `attach`, `bump` nem `syncBot`.

## Arquivos alterados

- `apps/server/src/rooms.ts`: `syncBot` no caminho de entrada nova.
- `apps/server/test/bot-entry.test.ts` (novo): 6 regressões de continuidade, replay de entrada, fase after-draw, pausa/retenção e expiração.
- `README.md`: nota de que o agendamento é refeito também na entrada de quem aguarda a próxima rodada.

## Evidência antes/depois

### Reprodução suplementar do orquestrador (sem modificação)

Antes (dist pré-correção desta pendência): cenário “bot após nova entrada para aguardar” — `versionAfterDelay: 7` (parada na versão 7), `handAfterDelay: 7` (nenhuma ação), `currentSeatStillBot: true`, `staleTimerReferenceRemains: true`. Controle sem entrada funcionava (`versionAfterDelay: 7`, `handAfterDelay: 6`).

Depois:

```json
{"scenario":"placar histórico público após vitória e saída","humanWinsBefore":1,"publicWinsAfter":1,"historicalWinner":true,"winnerOccupiesSeat":false}
{"scenario":"controle: bot sem nova entrada","newcomerInRound":null,"scheduleVersionBeforeJoin":6,"roomVersionBeforeDelay":6,"versionAfterDelay":7,"handBefore":7,"handAfterDelay":6,"handAfterAdditional7s":6,"timersPendingAfterDelay":0,"roomPlaying":true,"currentSeatStillBot":false,"staleTimerReferenceRemains":false}
{"scenario":"bot após nova entrada para aguardar","newcomerInRound":false,"scheduleVersionBeforeJoin":6,"roomVersionBeforeDelay":7,"versionAfterDelay":8,"handBefore":7,"handAfterDelay":6,"handAfterAdditional7s":6,"timersPendingAfterDelay":0,"roomPlaying":true,"currentSeatStillBot":false,"staleTimerReferenceRemains":false}
```

Com a entrada de Cai: versão 7→8, mão 7→6 no prazo, vez deixa de ser do bot, nenhuma referência de timer obsoleta — continuidade idêntica ao controle. Placar histórico/controle inalterados.

### Reprodução original do orquestrador (sem modificação)

Reexecutada após a correção: replays sem reassociação (`subscribedToOldRoom`/`subscribedToRevokedRoom`/`subscribedToExpiredCodeAfterReplay` = false; `eventsReceivedFromRevokedRoom` = 0), ack de saída memorizado (`leaveReplayOK: true`), cache sem referências à sala (`cachedRoomReferences: 0`) e callback antigo inerte (`versionBefore`/`versionAfter` 8→8; mão 7→7). Comportamentos anteriores preservados.

### Regressões novas (falham antes, passam depois)

`apps/server/test/bot-entry.test.ts` — com a correção temporariamente revertida (backup restaurado em seguida), **4 de 6 falharam** exatamente na continuidade: entrada nova antes do timer (sem ação no prazo), replay da entrada (timeout aguardando a ação), after-draw sem segunda compra e compra válida sem descarte. Com a correção: **6/6 passam**. Cobertura por critério do prompt:

1. Ana/Bia jogando, Ana sai, bot na vez e agendado, Cai entra sem credencial: a entrada não altera o motor; no prazo ocorre exatamente uma ação (versão +1, mão −1, vez passa ao humano), cartas conservadas (108/108 únicas) e o humano segue jogando.
2. Callback anterior entregue pelo harness (`FakeClock.deliver`) após o cancelamento não altera versão/motor/timer atual; o agendamento válido age no prazo.
3. Replay da intenção de entrada devolve o ack original sem duplicar associação/participante/snapshot e sem reiniciar o agendamento (mesmo handle de timer); o timer segue válido e age.
4. Entrada entre a compra e a ação mantém `after-draw`: sem segunda compra; passa quando a recém-comprada não serve e descarta a recém-comprada quando válida; quem aguarda continua sem assento/mão.
5. Entrada com a sala pausada/retenção não destrava o bot (versão estável com o relógio avançando); retomada por `continueRound` (feita pelo anfitrião atual, que passou a ser Cai — Bia estava desconectada) volta a permitir a ação. Expiração após a entrada zera timers e invalida os callbacks antigos. As regressões anteriores de callbacks, replays, placar e privacidade continuam passando.

## Verificação executada

- `rtk pnpm install --frozen-lockfile`: exit 0.
- `rtk pnpm build`: exit 0.
- `rtk pnpm test`: exit 0 — 123 motor, 7 protocolo, 83 servidor (20 arquivos; 1 placeholder ignorado). Sequencial, sem E2E/tipos em paralelo.
- `rtk proxy pnpm -r --if-present typecheck`: exit 0 após o build.
- `rtk pnpm --filter @tretta/web e2e`: exit 0, 10 testes.
- `rtk proxy node docs/work/reports/assets/T004-validation/revalidate.mjs`: exit 0 (saída acima).
- `rtk proxy node docs/work/reports/assets/T004-validation/reproduce.mjs`: exit 0 (saída acima).
- `rtk git diff --check`: exit 0.

## Decisões, limites e pendências

- Correção mínima no ponto exato da transição; nenhuma mudança de regra de produto, de prazos ou de placar.
- No cenário 5, a transferência de anfitrião seguiu a regra vigente: com Bia desconectada, a entrada de Cai fez dele o conectado há mais tempo e o novo anfitrião; a retomada foi exercida por ele. Nenhuma mudança necessária.
- `bot-entry.test.ts` depende do relógio injetado e de internos da sala (`botTimer`, versão, assentos) como os demais testes de concorrência; E2E não cobre este caso por depender de prazos reais.
- Carga/oito navegadores/aparelho físico/HTTPS/publicação permanecem em T007; T005 não iniciada.

## Como reproduzir

```sh
rtk pnpm install --frozen-lockfile
rtk pnpm build
rtk pnpm test
rtk proxy pnpm -r --if-present typecheck
rtk pnpm --filter @tretta/web e2e
rtk proxy node docs/work/reports/assets/T004-validation/revalidate.mjs
rtk proxy node docs/work/reports/assets/T004-validation/reproduce.mjs
```

- Continuidade do bot após entrada: `apps/server/test/bot-entry.test.ts` (relógio controlado, `FakeClock.deliver` para callbacks cancelados).

## Próximo passo

Revalidação final do orquestrador. Nenhum commit criado; T005 não iniciada.
