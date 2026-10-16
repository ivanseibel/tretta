# T005B — Idempotência após recuperação e isolamento do painel

## Papel e objetivo

Você é o executor do Tretta em modo manual. Corrija os dois achados de cliente da validação de T005B e complete a evidência visual das quatro provocações. T001–T004 e T005A estão aceitas; T005B requer estes ajustes antes de T005C.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo/status/plano, `docs/work/T005B.md`, `docs/work/reports/T005B.md` e **`docs/work/reports/T005B.validation.md`**. A validação contém cenários, locais e limites da evidência. Teste suplementar e runner em `docs/work/reports/assets/T005B-validation/`.

Preserve o working tree, prompts/reports/aceites do orquestrador e as correções anteriores. Nenhum commit solicitado. Use RTK e as skills aplicáveis, observe `apps/web/AGENTS.md` e consulte documentação de biblioteca quando pertinente. Trabalhe no cliente e na cobertura/evidência necessária; limites e canal autoritativo atuais já passaram na revisão e nas suítes. Qualquer necessidade de alterar produto/critério volta ao orquestrador com cenário concreto.

## Ajustes e critérios de aceite

### 1. Recuperar vínculo sem esquecer eventos apresentados

`clearTauntEffects` também apaga `seenTauntIdsRef`; a reentrada da mesma identidade chama essa rotina. Duplicata que era ignorada no vínculo original reaparece depois da recuperação. O contrato exige apresentação única também em sessão recuperada.

Separar limpeza da apresentação transitória da proteção contra duplicatas/replays, ou usar solução equivalente. Preservar a proteção no escopo correto de sala/identidade, com limpeza apropriada de timers/estado visual e sem misturar salas. Documentar a vida útil e o tratamento de replay após recuperação/reload. Eventos novos do vínculo autorizado continuam sendo apresentados normalmente.

Regressões permanentes, com provider/painel/overlay reais e transporte controlado:

- Evento apresentado e encerrado; duplicata no mesmo vínculo não reaparece (controle já passa).
- Após reconexão e reentrada autorizada da mesma sala/identidade, duplicata do evento encerrado e replay de seu ack não reapresentam; um evento novo aparece exatamente uma vez.
- Recuperação/troca/remoção limpam efeitos pendentes; eventos antigos não atravessam salas nem ressuscitam uma sala removida. Ack/broadcast nas duas ordens continuam idempotentes e o envio continua bloqueado até confirmação do vínculo.

O teste suplementar injeta duplicata controlada: não há achado de retransmissão pelo servidor. A correção deve atender à garantia do cliente sem inventar retransmissão de histórico transitório.

### 2. Operação antiga sem efeitos sobre loading/erros atuais

`TauntPanel.handleSend` aplica a conclusão do `await` mesmo depois de mudar a geração do vínculo. Na reconexão com envio pendente, o vínculo recuperado continua preso ao loading anterior; ao timeout antigo, o painel mostra `STALE_CONTEXT`. Após troca de sala, o provider evita o efeito antigo, mas o painel exibe o erro dessa operação antiga na sala nova.

Associar operação/loading/erro ao contexto pertinente e invalidar operações anteriores na mudança do vínculo. Ao confirmar o vínculo novo, o loading de uma operação antiga não pode impedir uma tentativa nova. Conclusão antiga não altera seleção, loading ou erro atuais; uma operação nova só é concluída pela própria resposta. Preservar escolhas ainda válidas e a indicação/bloqueio durante recuperação, sem habilitar envios antes da autorização.

Regressões permanentes:

- Envio pendente → desconexão → ack de reentrada autorizado: disponibilidade do envio deixa de depender da operação antiga; o timeout antigo não mostra erro no painel recuperado.
- Envio em A → troca para B → ack antigo de sucesso/recusa: nenhum efeito, erro ou alteração de controles em B.
- Depois da recuperação/troca, iniciar um envio novo e entregar o resultado antigo primeiro: ele não libera o loading nem substitui/limpa erro da operação nova. Concluir o envio novo normalmente.
- Recusa legítima no contexto atual ainda informa o erro e preserva tipo/alvo. Saída/remoção/sala inexistente mantêm a invalidação correta.

Apenas ignorar `STALE_CONTEXT` ao exibir erro não resolve, por si só, o loading herdado nem conclusões antigas que liberam operações novas. Escolhas locais de geração/ref/remontagem cabem ao executor; demonstrar o comportamento completo.

### Evidência e preservação

Completar capturas legíveis das quatro apresentações em `docs/work/reports/assets/T005B-adjustments/`, com legenda correspondente visível, incluindo **choro dramático** e **torta na cara no celular**. Preservar PNGs anteriores. Ajustar sincronização das capturas se necessário, sem transformar esta tarefa em polimento geral de interface.

Os 11 testes de chat, limites de 15 s/3 por minuto, privacidade, autorização, motor/versão/bot e 14 E2E anteriores continuam corretos. Preservar o comportamento aceito; fila, efeitos automáticos, sons e preferências completas permanecem em T005C.

## Verificação

Registrar regressões antes/depois. O runner suplementar pode ser reexecutado sem alteração como referência:

```sh
rtk proxy node docs/work/reports/assets/T005B-validation/run-client-check.mjs
```

Ele cria/remove somente um teste temporário próprio e deve executar **isolado**, inclusive de build/tipos. Preservar os artefatos históricos; acrescentar regressões permanentes à suíte adequada. Executar instalação congelada, build, suíte completa, tipos após build (`rtk proxy pnpm -r --if-present typecheck`), E2E e diff-check em sequência. Registrar falhas/intermitências e limitações honestamente.

## Retorno

Salvar `docs/work/reports/T005B-adjustments.md` no formato do protocolo, com causa/correção, arquivos, evidência por critério, antes/depois, verificação e decisões locais. Precisar quais casos estão cobertos e como a proteção contra reapresentação sobrevive à recuperação. README atualizado se o contrato documentado mudar.

Atualizar `docs/work/status.md` para **“T005B aguardando revalidação do orquestrador”**, preservando os aceites e o modo manual. Nenhum commit solicitado. Parar após report; T005C depende do aceite de T005B.
