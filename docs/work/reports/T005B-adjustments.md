# T005B — Idempotência após recuperação e isolamento do painel — report do executor

Executado em 15 de outubro de 2026 no working tree deste clone, sem commit. Instruções lidas: `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo, status/plano, `docs/work/T005B.md`, `docs/work/T005B-adjustments.md`, `docs/work/reports/T005B.md` e `docs/work/reports/T005B.validation.md`. T001–T004 e T005A continuam aceitas; as correções anteriores, os reports e os prompts do orquestrador foram preservados. T005C não foi tocada; nenhum commit foi solicitado ou criado.

## Tarefa e resultado

**Concluída**, aguardando revalidação do orquestrador. Os dois achados de cliente da validação foram corrigidos: a proteção contra reapresentação de provocações sobrevive à recuperação do vínculo da mesma sala, e loading/erro do painel ficam associados à operação e ao vínculo correntes. Seis regressões permanentes entraram na suíte web (13 testes de provocação, antes 7); o teste suplementar do orquestrador passou de 3 falhas para **4/4 verdes** sem alteração. As quatro apresentações têm captura legível com a própria legenda em `docs/work/reports/assets/T005B-adjustments/`, incluindo choro dramático e torta na cara no celular. Instalação congelada, build, suíte completa (**267 testes**: 127 regras + 11 protocolo + 105 servidor + 24 web, 1 pulado), typecheck de todos os pacotes, **14 E2E** e `git diff --check` passam, executados em sequência.

## Causa e correção

### 1. Reentrada apagava a proteção contra reapresentação

**Causa.** `clearTauntEffects` (`apps/web/app/providers.tsx`) misturava duas responsabilidades: limpar a apresentação transitória (timers + `activeTaunts`) e apagar `seenTauntIdsRef`. `bumpChatLink` chamava essa rotina em toda mudança de vínculo — inclusive no `resetRoomState` de uma reentrada autorizada na mesma sala/identidade. O vínculo recuperado esquecia que já tinha apresentado `t_old` e a duplicata reaparecia.

**Correção.** Separação das duas limpezas com escopo por sala nesta aba:

- `clearTauntEffects` agora limpa **apenas** timers e `activeTaunts` (a tela nunca herda efeito de vínculo anterior).
- `seenTauntIdsRef` só é descartado quando a sala muda: em `resetRoomState` quando o código difere do anterior (troca de sala) e em `clearRoomState` (saída, remoção, sala inexistente, credencial inválida). Reentrada na mesma sala/identidade preserva o conjunto; eventos novos seguem apresentando normalmente (ids nunca vistos passam pelo mesmo caminho).
- Salvaguarda de isolamento: `server:taunt` já filtrava por `lastRoomRef`; com a limpeza em `clearRoomState`, broadcasts da sala antiga ficam sem sala ativa e ids de sala antiga morrem na troca — nenhum evento atravessa sala nem ressuscita sala removida.

**Vida útil da proteção (documentada no README, seção Provocações):** memória local por sala nesta aba; sobrevive à perda/reconexão/reentrada da mesma sala; morre na troca/saída/remoção/sala inexistente; um reload zera a memória sem risco porque o servidor nunca retransmite efeitos antigos (o handler devolve o ack memorizado sem novo broadcast — o achado era garantia de idempotência do cliente, não retransmissão do servidor, conforme o limite da evidência da validação).

### 2. Operação antiga mantinha loading e contaminava o vínculo novo

**Causa.** `TauntPanel.handleSend` (`apps/web/components/TauntPanel.tsx`) aplicava a conclusão do `await` (`setSending(false)`, sucesso ou erro) sem associar a resposta à geração do vínculo. Na reconexão com envio pendente, o vínculo recuperado ficava preso ao `sending` anterior; ao resolver pelo timeout de 6 s, o painel transformava o `STALE_CONTEXT` do provider em erro visível — no vínculo recuperado ou, após troca de sala, na sala nova.

**Correção.** Operação identificada por contador (`sendOpRef`) + invalidação na mudança do vínculo:

- `handleSend` incrementa o contador antes de emitir e só aplica `setSending`/`setTauntError` se ainda for a operação corrente. Conclusão antiga (timeout, ack de A em B, resposta anterior à reentrada) não toca loading, erro nem seleção do contexto atual.
- Um `useEffect` sobre `room.chatLinkEpoch` invalida qualquer operação em voo e zera `sending`/`tauntError` a cada mudança de vínculo: recuperar/trocar o vínculo devolve o botão ao estado real (bloqueio passa a depender só de `chatLinkReady`/transporte, não da operação antiga) e nenhum erro de contexto anterior sobrevive.
- A operação nova só é concluída pela própria resposta: uma resposta antiga que chegue depois do erro novo não substitui nem limpa esse erro, e não libera o `sending` da operação em voo.
- Recusa legítima no contexto atual continua informando erro e preservando tipo/alvo; o gate de envio (`chatLinkReady`) não foi afetado — nada é habilitado antes da autorização.

Apenas ignorar `STALE_CONTEXT` na exibição não bastava (o `sending` herdado continuaria preso e uma conclusão antiga ainda liberaria operações novas); a invalidação por operação/vínculo cobre o ciclo completo.

## Regressões (antes → depois)

**Antes:** cenários equivalentes reprovados na validação independente do orquestrador (JSON citado em `T005B.validation.md`: `presentedIds: ["t_old"]` na reentrada; `blockedAfterRejoin: true` + erro após timeout; erro de A no painel de B) e runner suplementar **exit 1 (3 falhas, 1 controle verde)**. **Depois:** seis testes permanentes novos em `apps/web/test/taunt-sync.test.tsx` (13/13 no arquivo) e runner **exit 0 (4/4)** com as mesmas observações corrigidas (`presentedIds: []`, `blockedAfterRejoin: false`, `errorAfterOldTimeout: null`, `error: null`).

| Regressão permanente (teste novo) | Antes (validação) | Depois |
| --- | --- | --- |
| Reentrada na mesma sala preserva ids apresentados | duplicata de evento encerrado reaparecia após recuperação (`presentedIds: ["t_old"]`) | duplicata não reapresenta; evento novo com broadcast repetido aparece exatamente uma vez |
| Envio pendente com timeout após reentrada | botão preso (`blockedAfterRejoin: true`) e “A sala mudou antes da confirmação” no vínculo recuperado | botão liberado na reentrada; timeout antigo não mostra erro |
| Ack antigo de A após trocar para B | mensagem antiga de A exibida no painel de B | nenhum efeito, erro ou alteração de controles em B |
| Resultado antigo não libera loading da operação nova | — (caso coberto pela invalidação por operação; antes o `sending` antigo era o bloqueio) | resposta antiga chega primeiro: loading da nova segue ativo, sem efeito; nova conclui com recusa própria (erro + tipo/alvo preservados) |
| Resultado antigo posterior não toca no erro da nova | — | sucesso antigo não substitui nem limpa o erro da operação nova; envio seguinte conclui normalmente |
| Recuperação/remoção limpam efeitos; sala inexistente não ressuscita | reapresentação na recuperação | efeito em tela some na recuperação mas o id segue protegido; remoção zera efeitos e broadcasts da sala antiga não ressuscitam; `ROOM_NOT_FOUND` invalida o envio antigo sem erro novo |

Os sete testes anteriores de `taunt-sync.test.tsx` permanecem verdes: bloqueio até o vínculo, idempotência ack/broadcast nas duas ordens, filtro de outra sala, troca de sala, recusa com seleção preservada e auto-ocorrência do efeito.

**Teste suplementar do orquestrador** (`rtk proxy node docs/work/reports/assets/T005B-validation/run-client-check.mjs`, executado sem alteração, isolado): **exit 0 — 4/4**, incluindo o controle. O runner grava `client-context-result.txt` a cada execução (comportamento inerente ao comando prescrito); o arquivo agora contém a execução pós-correção e a evidência das três falhas originais permanece citada em `docs/work/reports/T005B.validation.md`. Nenhum teste temporário restou (`apps/web/test/` contém `chat-sync.test.tsx` e `taunt-sync.test.tsx`).

## Evidência por critério do contrato

1. **Recuperar vínculo sem esquecer eventos apresentados:** testes “reentrada na mesma sala…”, “recuperação e remoção…”, “resultado antigo não libera o loading…” (ack antigo com evento não reapresenta) e caso 2 do runner. Duplicata no mesmo vínculo continua coberta pelos testes anteriores; ack/broadcast nas duas ordens idempotentes; envio bloqueado até a confirmação do vínculo (teste de bloqueio existente verde).
2. **Operação antiga sem efeitos sobre loading/erros atuais:** testes “envio pendente com timeout após reentrada”, “ack antigo de A após trocar para B” (sucesso), os dois testes de resultado antigo (primeiro e depois; recusa e sucesso) e casos 3/4 do runner. Recusa legítima e invalidação por saída/remoção/sala inexistente cobertas nos mesmos testes.
3. **Evidência visual** em `docs/work/reports/assets/T005B-adjustments/` (inspecionadas):
   - `desktop-tomate-legenda.png` — “Ana mandou tomate voador em Bia!”, desktop;
   - `mobile-torta-legenda.png` — “Bia mandou torta na cara em Ana!”, celular (Pixel 7);
   - `desktop-risadas-legenda.png` — “Cai mandou chuva de risadas em Ana!”, desktop;
   - `desktop-choro-legenda.png` — “Ana mandou choro dramático em Bia!”, desktop.
   PNGs anteriores em `assets/T005B/` e em `assets/T005B-validation/` preservados.

## Arquivos alterados

- `apps/web/app/providers.tsx`: `clearTauntEffects` só limpa timers/efeitos; `seenTauntIdsRef` descartado só em troca de sala (`resetRoomState` com código diferente) e em `clearRoomState`; comentários de vida útil.
- `apps/web/components/TauntPanel.tsx`: contador de operação (`sendOpRef`), invalidação/reset em `chatLinkEpoch`, conclusão de `handleSend` condicionada à operação corrente.
- `apps/web/test/taunt-sync.test.tsx`: seis regressões novas no describe “recuperação do vínculo e isolamento de operações”, com helpers `recoverSameRoom` e `respondLast`.
- `apps/web/e2e/taunt.spec.ts`: diretório `T005B-adjustments/` e helper `captureTaunt` (legenda da apresentação isolada + espera do efeito assento — opacidade ≥ 0,95 e translação < 40 px — antes do PNG).
- `README.md`: vida útil da proteção e isolamento por operação na seção Provocações; diretório de capturas e cobertura dos testes web na seção de E2E.
- `docs/work/status.md`; evidências em `docs/work/reports/assets/T005B-adjustments/` (4 PNGs).
- Nada mudou em `packages/*`, `apps/server`, nem nos reports e prompts anteriores.

## Verificação executada

- `rtk pnpm install --frozen-lockfile`: exit 0.
- `rtk pnpm build`: exit 0.
- `rtk pnpm test`: exit 0 — 127 (regras), 11 (protocolo), 105 (servidor; 1 pulado), **24 (web: 11 chat + 13 provocações)** = 267 passando.
- `rtk proxy pnpm -r --if-present typecheck`: exit 0 após build (reexecutado após as edições finais do spec de E2E).
- `rtk pnpm --filter @tretta/web e2e`: exit 0 — **14 testes** em 1,1 min; o teste de provocações passou isolado também em duas execuções intermediárias de ajuste da captura.
- `rtk git diff --check`: exit 0.
- Runner suplementar do orquestrador: exit 0 (4/4), executado isolado.

Ambiente macOS/Node 22.23.1/pnpm 11.14.0. A intermitência de `recovery.spec.ts` registrada no report original de T005B não se repetiu em nenhuma das execuções desta tarefa; isso não estabelece sua causa. A captura visual exigiu dois ajustes de sincronização (o tomate foi fotografado em pleno voo e o choro em fase de fade na primeira tentativa); o poll de assentamento resolveu e as quatro capturas finais foram inspecionadas. Limites conhecidos permanecem: `browser-harness` sem Chrome/daemon, efeitos e limites em memória por sala, sem lint no projeto.

## Decisões e desvios

- **Escopo da proteção:** `seen` indexado só pela sala, não por identidade — troca de identidade passa por `clearRoomState`/saída, que já limpam o conjunto; a mesma aba na mesma sala preserva. Nenhuma exigência de produto foi alterada.
- **Contador de operação em vez de só comparar a geração no `handleSend`:** uma única fonte de verdade cobre invalidação por mudança de vínculo e substituição por envio novo, e o reset de `sending`/erro no efeito de `chatLinkEpoch` resolve o loading herdado sem depender do instante em que a resposta antiga chega.
- **Sem retransmissão inventada:** a correção atende à garantia de idempotência do cliente; o servidor não foi alterado (handler continua devolvendo o ack memorizado sem novo broadcast).
- **Captura de evidência:** `captureTaunt` espera a apresentação anterior sumir (legenda isolada) e o efeito assentar na fase legível da keyframe; é sincronização de evidência, não polimento de interface.
- Fila, efeitos automáticos, sons e preferências completas permanecem em T005C, como definido.

## Próximo passo

Revalidação do orquestrador sobre [T005B-adjustments.md](../T005B-adjustments.md). Sem pendências de implementação dentro do escopo; T005C depende do aceite de T005B.
