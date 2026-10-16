# T005C — Ajustes de cliente

15 de outubro de 2026. **Aguardando revalidação do orquestrador.** O working tree e as evidências anteriores foram preservados; nenhum commit foi criado. T006 permanece pendente.

## Correções e evidências

### 1. Apresentações automáticas consecutivas

`TauntOverlay` reutilizava o mesmo `EffectPresentation` ao avançar entre dois efeitos automáticos. Com a mesma variante CSS, o nó mantinha a animação anterior e seu `animation-fill-mode` deixava o segundo item transparente. Agora o nó da apresentação é identificado pelo id do item. Duplicatas continuam protegidas pela deduplicação existente e não reiniciam a fila, animação ou som.

Em [TauntOverlay.tsx](../../../apps/web/components/TauntOverlay.tsx), o E2E permanente em [effects.spec.ts](../../../apps/web/e2e/effects.spec.ts) faz duas jogadas reais com `twoSkipsDeck` e `brick-wall`. A segunda jogada é enviada enquanto o primeiro item continua ativo; o teste conserva referências ao nó e à `Animation`, verifica que ambos mudam no segundo item, que a opacidade passa de 0,9 e que cada item termina. O cenário de movimento reduzido também percorre `penaltyDraw` e `blocked`, duas categorias que usam `mood-fade`. O modo desligado, deduplicação, fila e sequências existentes seguem cobertos.

Antes, a reprodução suplementar observava `sameNode: true`, `sameAnimation: true` e o segundo efeito terminava transparente. Depois, [browser-result.txt](assets/T005C-validation/browser-result.txt) registra nó e animação diferentes; a amostra inicial de opacidade `0.0878851` é tomada durante o fade-in, e o runner aguarda a fase acima de 0,9 antes de passar. A regressão permanente e a suíte E2E completa passaram. Capturas complementares: [primeiro item completo](assets/T005C-adjustments/consecutive-full-first.png), [segundo item completo](assets/T005C-adjustments/consecutive-full-second.png), [penalidade reduzida](assets/T005C-adjustments/consecutive-reduced-penalty.png) e [bloqueio reduzido](assets/T005C-adjustments/consecutive-reduced-blocked.png).

### 2. Isolamento de `server:events.effects` por sala e rodada

O listener `server:events` verificava apenas o código da sala, então um lote tardio ainda não visto podia inserir sua linha e efeito depois que o snapshot já refletia outra rodada. Agora valida a sala e o `roundId` da mensagem antes de anexar suas linhas e o lote `effects` (`server:events.effects`), comparando ambos com o último snapshot refletido. A troca de rodada limpa feed e ids de efeitos vistos e cancela apresentação/áudio anteriores; resultado final da mesma rodada preserva sua sequência. Trocar de sala limpa os ids de efeitos e provocações; recuperar a mesma sala mantém a proteção contra replay.

As regressões permanentes em [mood-sync.test.tsx](../../../apps/web/test/mood-sync.test.tsx) entregam um lote antigo de `r1` depois do snapshot de `r2`, verificam a ausência de item, feed e som, aceitam um lote válido de `r2` mesmo com versão inferior à do snapshot e cobrem preparação, remoção e reentrada na mesma rodada. O controle válido continua entrando uma vez. O suplemento do cliente registra 3/3; a prova é de entrega tardia controlada, não de retransmissão pelo servidor.

### 3. Ocultar a provocação ativa cancela somente o áudio antigo

Ocultar removia a provocação da fila, mas não parava seus nós WebAudio. Agora, ao ocultar, o provider chama `stopAllSounds()` sincronamente apenas quando a apresentação ativa é uma provocação e faz isso antes de remover itens da fila. Assim, os nós antigos são cortados antes de um automático seguinte começar; esconder apenas provocações pendentes não interrompe o automático ativo.

O teste permanente de [mood-sync.test.tsx](../../../apps/web/test/mood-sync.test.tsx) verifica as duas ordens: provocação ativa seguida de automático, e automático ativo com provocação pendente. A prova suplementar usa o `sounds.ts` real e substitui apenas WebAudio por osciladores observáveis. O resultado anterior em [audio-result.txt](assets/T005C-validation/audio-result.txt) mostrava `oldCuts: [false, false]`, `newCuts: [false]` e `presented: ["fx_next"]`. A nova variante em [audio-cancel-adjustments.test.tsx](assets/T005C-validation/audio-cancel-adjustments.test.tsx) reflete `r1` com snapshot versão 2 antes do cenário e exige `oldCuts: [true, true]`, `newCuts: [false]` e a apresentação do automático; [audio-adjustments-result.txt](assets/T005C-validation/audio-adjustments-result.txt) passou 1/1.

O artefato [audio-cancel.test.tsx](assets/T005C-validation/audio-cancel.test.tsx), o runner histórico [run-audio-check.mjs](assets/T005C-validation/run-audio-check.mjs) e sua saída não foram alterados. Essa fixture antiga entra na sala ainda no lobby e injeta `fx_next` de `r1` sem refletir snapshot de `r1`. Com o filtro de contexto correto, o evento deve ser recusado; [audio-legacy-fixture-result.txt](assets/T005C-validation/audio-legacy-fixture-result.txt) registra `oldCuts: [true, true]` e nenhum novo efeito/som. A variante mínima preserva a intenção do teste sem enfraquecer o filtro. A evidência observa corte de nós reais via WebAudio controlado; não é confirmação auditiva física.

## Arquivos e escolhas locais

- Produção: [providers.tsx](../../../apps/web/app/providers.tsx) e [TauntOverlay.tsx](../../../apps/web/components/TauntOverlay.tsx).
- Regressões permanentes: [mood-sync.test.tsx](../../../apps/web/test/mood-sync.test.tsx) e [effects.spec.ts](../../../apps/web/e2e/effects.spec.ts).
- Fixture/runner suplementar de áudio e quatro PNGs novos em `docs/work/reports/assets/T005C-validation/` e `docs/work/reports/assets/T005C-adjustments/`.
- Estado e plano atualizados para aguardar revalidação; modo automático `gpt-6-luna` com reasoning `max` preservado. Nenhuma alteração no servidor, protocolo ou motor de regras.

## Verificações

Executadas em sequência; os três runners suplementares foram isolados de build, tipos, suítes e E2E.

| Comando ou cenário | Resultado |
| --- | --- |
| `rtk pnpm install --frozen-lockfile` | exit 0 |
| `rtk pnpm build` | exit 0 |
| Suítes unitárias após correção | 329 testes passaram e 1 foi pulado: 127 rules, 11 protocolo, 120 servidor e 71 web |
| `rtk proxy pnpm --workspace-concurrency=1 -r --if-present typecheck` | exit 0, após build |
| `rtk pnpm --filter @tretta/web e2e` | exit 0, 22/22 em 2,2 min |
| `rtk proxy node docs/work/reports/assets/T005C-validation/run-client-check.mjs` | exit 0, 3/3 |
| `rtk proxy node docs/work/reports/assets/T005C-validation/run-browser-check.mjs` | exit 0, 1/1; servidor/navegador reais |
| `rtk proxy node docs/work/reports/assets/T005C-validation/run-audio-adjustments-check.mjs` | exit 0, 1/1; `sounds.ts` real e WebAudio observável |
| `rtk git diff --check` | exit 0 |

O primeiro `rtk pnpm test` terminou com exit 1: o sandbox bloqueou `listen` do servidor com `EPERM`, e uma regressão nova consultava a legenda curta do overlay (`Bia perdeu a vez`) dentro do feed; o texto real do `EventFeed` é `Bia foi bloqueado e perde a vez`. Corrigimos a asserção e sincronizamos o harness de reentrada com o `emit` assíncrono. O servidor passou 120 testes (mais 1 skip) na suíte isolada após escalada local, e web passou 71/71 isolada após a correção; rules e protocolo passaram 127/127 e 11/11 no agregado inicial, formando 329 pass e 1 skip. O E2E completo passou após a correção. Nenhuma instalação ou serviço externo foi usado.

O teste permanente de efeitos foi ajustado para enviar a segunda jogada antes de esperar pelo fade-in ou capturar screenshot, provando que ela chega enquanto a apresentação inicial segue ativa. Nenhum tempo de produção foi aumentado. Não se alterou o histórico da validação nem o runner de áudio original.
