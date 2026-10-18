# T014B — ajustes R1–R3: report do executor

**Estado:** execução concluída em 18/10/2026; **aguardando revalidação do orquestrador**. Este report é a entrega do executor e não declara aceite nem revalidação. Sem commit, push, deploy, restart ou alteração de faturamento; nenhuma sala pública/família. Ajustes executados sobre a fonte completa do working tree, verificados em cópia isolada registrada em [`assets/T014B-adjustments/00-origin.txt`](assets/T014B-adjustments/00-origin.txt). O [report original](T014B.md) e as [evidências T014B-validation](assets/T014B-validation/) foram preservados.

**Contrato:** [T014B-adjustments.md](../T014B-adjustments.md). **Base:** T014A aceita ([validação](T014A.validation.md)) e achados da [validação T014B](T014B.validation.md).

---

## 1. Resultado e arquivos desta execução

**Resultado: concluída.** R1 (validade de operações de menu/apresentação), R2 (ordenação e idempotência das amostras de tempo) e R3 (deduplicação do aviso de resposta) corrigidos; as **seis reproduções do orquestrador passam** (ao final) e regressões duráveis equivalentes foram incorporadas à suíte entregue.

**Arquivos alterados nesta execução:**

| Arquivo | Natureza |
| --- | --- |
| `apps/web/lib/moodTime.ts` | R2: âncora de tempo monotônica por escopo; amostra repetida é idempotente, amostra mais antiga é ignorada, categoria/alvo têm ordem própria e aceite antigo não apaga recusa mais nova (`clearTarget` com `serverTime`) |
| `apps/web/app/providers.tsx` | R1: `seq` por abertura de menu + `isMoodMenuCurrent`; conclusão de envio só apresenta/edita/foca se o vínculo e o token de contexto continuarem válidos, separando troca de vínculo/sala (não anota limites) de queda/rodada nova (limites da mesma identidade preservados). R3: `seenNoticeIdsRef` deduplica o aviso por id |
| `apps/web/components/MoodMenu.tsx` | R1: cada opção captura a `seq` do menu; sucesso/recusa atrasados não fecham, não escrevem erro/escolha, não liberam o envio nem devolvem foco de um menu fechado/substituído |
| `apps/web/components/TauntPanel.tsx` | R1: conclusão descartada (`STALE_CONTEXT`) não vira erro no painel do contexto novo |
| `apps/web/test/mood-time.test.ts` | +5 regressões: replay curto idempotente, snapshot antigo não apaga janela, estado novo encerra só a categoria própria, ordem/aceite por alvo e ordem adversa |
| `apps/web/test/mood-avatar.test.tsx` | +7 regressões: ack de menu fechado não fecha o novo (nem rouba foco), recusa atrasada não escreve no novo, it.each queda/rodada nova/saída não restauram reação/feedback, repetição de aviso antigo não substitui o mais recente, limpeza/ocultação não reapresenta |
| `docs/work/status.md`, `docs/work/plan.md` | Estado atual dos ajustes → “aguardando revalidação do orquestrador” |
| `docs/work/reports/T014B-adjustments.md`, `docs/work/reports/assets/T014B-adjustments/**` | Este report e evidências novas |

Nenhuma alteração em protocolo/servidor/motor/preferências/durações; nenhum código do produto foi tocado fora de `apps/web`.

## 2. Reprodução inicial (cópia isolada)

Cópia física `tretta-t014b-adj-verify-GsVxwG/tretta` do working tree completo, com os casos do orquestrador acrescentados **somente na cópia** (avatar ao final de `test/mood-avatar.test.tsx`; tempo como arquivo standalone). Instalação congelada exit 0 e build da base exit 0 antes da reprodução.

| Execução | Resultado | Log |
| --- | --- | --- |
| Reproduções do orquestrador (antes das correções) | **6 falhas | 12 passando** | [`02-reproducao-inicial.log`](assets/T014B-adjustments/02-reproducao-inicial.log) |

Falhas iniciais (nomes do orquestrador): “replay após 500 ms preserva o prazo restante, sem renovar a janela” (5000 em vez de 4500), “snapshot 500 ms mais antigo não apaga intervalo confirmado depois dele” (0 em vez de 5000), “ack de menu já fechado não encerra o menu novo”, “ack atrasado não restaura apresentação depois de disconnect/new-round” e “repetição de provocação antiga não substitui o aviso mais recente”.

## 3. Correções aplicadas

### R1 — Validade das operações de menu e apresentação
- **Menu:** `MoodMenuState` ganhou `seq` (ordem de abertura no provider) e o contexto expõe `isMoodMenuCurrent(seq)`. Cada conclusão verifica a `seq` antes de tocar em erro, escolha, liberação de envio ou foco; sucesso antigo não fecha o menu novo e recusa antiga não escreve nele. `sendingRef` continua sendo o guarda de envio em voo da instância, e o menu novo reseta o próprio estado ao abrir.
- **Provider:** a conclusão compara `chatLinkRef` (vínculo/sala/identidade) e `moodPendingTokenRef` (queda, rodada nova, limpeza). Sucesso/recusa antigos **não** apresentam reação/provocação, não dão feedback e não fecham menu; limites autoritativos da **mesma identidade** continuam sendo anotados quando só o token mudou (queda/rodada nova), e são descartados quando o vínculo mudou (troca de sala/identidade/saída) ou após `clearTarget` protegido por `serverTime`. `TauntPanel` ignora `STALE_CONTEXT` para não herdar erro de operação descartada.
- Preservado: pausa/resultado/preparação mantêm apresentações válidas até o prazo; nova rodada/queda/saída limpam; sem reenvio automático e sem reset de intervalo.

### R2 — Ordenação e idempotência dos metadados de tempo
- A âncora de relógio do servidor (`serverTime`+instante local) só **avança**: amostra mais antiga é descartada por inteiro e amostra com o mesmo instante não reposiciona a âncora. Cada categoria de emissor e cada alvo guardam a própria ordem e só aceitam amostra **estritamente mais nova** que a sua; repetir o mesmo ack é no-op. Estado autoritativo novo aplica `null` por categoria sem derrubar a vizinha; `clearTarget` só limpa se o aceite não for anterior a uma recusa mais nova. Tolerância de 1 s foi removida (não deslocada).
- Preservado: dados estruturados de ack/recusa/estado, recuperação dos dois intervalos, relógio do aparelho deslocado e ausência de renovação por replay.

### R3 — Deduplicação do aviso de resposta
- `receiveTaunt` agora deduplica por id em `seenNoticeIdsRef`, marcado antes de qualquer decisão (destinatário/ocultação). Repetição não troca o aviso vigente, não renova `receivedAt`, não reaparece após ocultar/limpar/saída do emissor e não recria aviso limpo. O conjunto é limpo apenas em troca de sala/identidade (como as demais proteções por id), não na limpeza transitória.
- Preservado: foco, menu com alvo fixo, exclusividade de quem recebeu, ocultação e saída do emissor; fila/áudio/intervalos das reações intactos.

## 4. Verificação final (cópia isolada, fonte corrigida)

| Verificação | Comando | Resultado | Log |
| --- | --- | --- | --- |
| Build do workspace | `pnpm build` | exit 0 | [`06-build.log`](assets/T014B-adjustments/06-build.log) |
| Tipos do workspace | `pnpm typecheck` | exit 0 | [`07-typecheck.log`](assets/T014B-adjustments/07-typecheck.log) |
| Regras | `pnpm --filter @tretta/rules test` | 11 arquivos, 127/127 | [`08-rules-test.log`](assets/T014B-adjustments/08-rules-test.log) |
| Protocolo | `pnpm --filter @tretta/protocol test` | 13/13 | [`09-protocol-test.log`](assets/T014B-adjustments/09-protocol-test.log) |
| Web (unitários da entrega) | `pnpm --filter @tretta/web test` | 20 arquivos, **169/169** (157 + 12 regressões duráveis) | [`10-web-test.log`](assets/T014B-adjustments/10-web-test.log) |
| Reproduções do orquestrador (verbatim na cópia) | `vitest run mood-time + mood-avatar (+ casos do orquestrador)` | **30/30** | [`04-reproducao-final.log`](assets/T014B-adjustments/04-reproducao-final.log), [`05-reproducao-final-verbose.log`](assets/T014B-adjustments/05-reproducao-final-verbose.log) |
| E2E completo | `playwright test` | **49/49**, exit 0 | [`11-e2e-full.log`](assets/T014B-adjustments/11-e2e-full.log) |
| Servidor/pacotes × T014A aceita | comparação sha256 com `assets/T014A-validation/source-before.json` | **81/81 iguais**, 0 alterados/ausentes | [`T014A-backend-equality.json`](assets/T014B-adjustments/T014A-backend-equality.json) |
| Chrome real | `browser-harness` na cópia | menu, envio com feedback, badge e contagem “Aguarde 5s”; sem erros | [`browser-harness-menu-reacao.png`](assets/T014B-adjustments/browser-harness-menu-reacao.png), [`browser-harness-reacao.png`](assets/T014B-adjustments/browser-harness-reacao.png), [`browser-harness-contagem.png`](assets/T014B-adjustments/browser-harness-contagem.png) |

**R1–R4:**
- **R1** — `mood-avatar` (5 regressões novas, incluindo it.each queda/rodada nova/saída) e reproduções do orquestrador: menu novo permanece, erro/escolha/foco não migram, apresentação não reaparece após limpeza; limites da mesma identidade continuam e somem na troca de sala/identidade.
- **R2** — 10 casos em `mood-time.test.ts` (5 originais + 5 novos) e 2 do orquestrador: replay curto/longo idempotente, snapshot antigo não apaga/reduz, estado novo encerra a janela, cota por alvo com ordem própria, ordem adversa; recuperação e dados novos continuam aceitos.
- **R3** — repetição de aviso antigo mantém o mais recente e o `receivedAt`; repetir o mais recente não prolonga os 30 s; ocultação/limpeza/saída não são revertidas por repetição.
- **R4** — seis reproduções passam; web 169/169, build/tipos verdes, E2E 49/49 (humor, teclado, recuperação, treino e circuito incluídos); preservação e igualdade da fonte abaixo.

## 5. Proveniência, preservação e limites

- **Fonte testada × entrega:** `apps/`+`packages/` idênticos em **166/166 arquivos** após excluir `apps/web/next-env.d.ts`, gerado pelo Next e ignorado pelo git ([`code-equality-not-generated.log`](assets/T014B-adjustments/code-equality-not-generated.log) vazio; hashes em `source-code-not-generated.sha256`/`copy-code-not-generated.sha256`). O único byte diferente é o gerado `next-env.d.ts`.
- **Preservação** ([`preservation.json`](assets/T014B-adjustments/preservation.json), referência = fonte da validação T014B, 1.190 arquivos): 1.179 iguais; **alterados por esta execução**: 6 (`providers.tsx`, `MoodMenu.tsx`, `TauntPanel.tsx`, `lib/moodTime.ts`, dois testes web); **alterações preexistentes da preparação** (mtime 19:10, antes desta execução): `status.md`, `plan.md`, `T014B.md`, `backlog.md` e `provocacoes-e-reacoes.md`; nenhum ausente. Report original `reports/T014B.md` e todo `assets/T014B-validation/` permanecem iguais ao manifesto; o novo report/evidências são acréscimos.
- Suítes na cópia reescreveram capturas/métricas históricas apenas na cópia; a fonte não foi tocada. `git diff --check` limpo na fonte.
- Limitações: sem aparelho físico/leitor de tela; no Chrome real duas abas do mesmo perfil continuam bloqueadas pela proteção de identidade (T010), então a inspeção de navegador foi de um cliente e a prova multi-cliente segue nos contextos independentes do Playwright; a suíte de servidor não foi repetida porque 81/81 arquivos de servidor/pacotes permanecem iguais à base T014A aceita (comparação por sha256).
- Nenhum desvio de escopo. Decisões locais: `seq`/`isMoodMenuCurrent` no provider para validade de menu; distinção entre mudança de vínculo (descarta limites) e queda/rodada nova (preserva limites da mesma identidade); âncora monotônica no rastreador; dedupe do aviso em conjunto próprio; painel silencia `STALE_CONTEXT`.

## 6. Próximo passo

1. Revalidar R1–R4 e os critérios B1–B10/C1–C7 afetados (B3/B4/B6 com impacto em B1/B7/C3/C4/C6) contra este report e `assets/T014B-adjustments/`.
2. O aceite continua pertencendo ao orquestrador; publicação permanece etapa posterior e não autorizada.
3. Sem ajustes pendentes declarados pelo executor; nada em execução aguardando além da revalidação.
