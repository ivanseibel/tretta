# Prompt manual — T014B: ajustes R1–R3 após validação

**Estado: executado em 18/10/2026; R1 e R3 aceitos, R2 pendente**, conforme [revalidação](reports/T014B.revalidation.md). [Report dos ajustes](reports/T014B-adjustments.md) e contrato abaixo preservados. Próximo passo: [complemento R2](T014B-adjustments-2.md), prompt manual preparado, ainda não executado. Preferência `gpt-6-luna`, reasoning `max`.

## Papel e objetivo

Você é o executor dos ajustes **R1–R3 de T014B** do Tretta. Corrija as seis reproduções confirmadas de respostas obsoletas, intervalos e avisos duplicados. Entregue uma revisão delimitada da implementação existente e um novo report; não refaça a feature nem avance para publicação.

Trabalhe em `/Users/ivanseibel/dev/personal/tretta`, executando você mesmo, sem acionar outros agentes. Devolva o report ao usuário e pare para validação do orquestrador.

## Contexto obrigatório

Leia `AGENTS.md`, `apps/web/AGENTS.md`, instruções aplicáveis e `.agents/skills/orchestrate-work/SKILL.md`; estado/plano atuais; `docs/product/provocacoes-e-reacoes.md` e `CONTEXT.md`; `docs/work/T014B.md`, o report original e **`docs/work/reports/T014B.validation.md`**. T014A permanece aceita; consulte seu contrato efetivo se precisar interpretar os campos de tempo.

Use `coding-guidelines`; siga a documentação local Next.js e Context7 conforme AGENTS quando precisar de detalhes de biblioteca/API. Para navegador, use `browser-harness`; ao verificar interação/foco, aplique `accessibility`; ao editar instruções, use `writing-for-agents`.

Confira Git e preserve a fonte completa do working tree, não rastreados e alterações preexistentes. HEAD sozinho não contém a versão aceita. Nenhum código do produto foi corrigido pelo orquestrador: as reproduções estão apenas nos artefatos/cópia de validação.

## Reprodução inicial

1. Faça uma cópia física isolada do working tree completo e mantenha evidências próprias em `docs/work/reports/assets/T014B-adjustments/`.
2. Acrescente o conteúdo de `docs/work/reports/assets/T014B-validation/orchestrator-mood-avatar-cases.tsx` **ao final de** `apps/web/test/mood-avatar.test.tsx` na cópia. O trecho usa os helpers privados que já existem nesse teste; não é um arquivo standalone.
3. Copie `docs/work/reports/assets/T014B-validation/orchestrator-mood-time.test.ts` para `apps/web/test/` na cópia.
4. Execute os casos e registre o resultado inicial. Na fonte recebida, os seis casos novos falham e os sete originais de avatar passam; [log do orquestrador](reports/assets/T014B-validation/reproductions.log). A base completa de unitários web passa 157/157, e build/tipos passam.

Incorpore regressões equivalentes e duráveis à suíte entregue. Pode reorganizar o harness/testes se necessário, preservando o significado e as asserções das seis reproduções; não ajuste a expectativa para aceitar o comportamento incorreto. Faça alterações de produto na fonte e verifique sua cópia atualizada, com proveniência e igualdade registradas.

## Ajustes a executar

### R1 — Validade da operação de menu e apresentação

- `MoodMenu.tsx`: depois de um envio pendente, conclusão de um menu fechado/substituído não pode fechar outro menu, escrever erro/escolha nele, liberar seu estado de envio ou devolver foco a uma origem que já não pertence à interação atual. Cubra sucesso e recusa.
- Provider: a limpeza por queda de transporte, sala/identidade e rodada nova invalida os efeitos visuais das operações anteriores. Hoje o token protege apenas o `finally`, e o guard por `chatLinkRef` não cobre queda e rodada nova antes do rejoin. Aplique proteção antes de apresentar reação/provocação, feedback, aviso e demais efeitos da conclusão obsoleta.
- Preserve as regras aceitas: pausa/resultados/preparação mantêm apresentações já válidas até o prazo; nova rodada/queda/saída limpam. Manter limites autoritativos da mesma identidade é distinto de reapresentar o evento antigo. Sem reenvio automático nem reset de intervalo como solução.
- Casos mínimos: enviar para Bia → fechar → abrir Reagir → ack antigo não fecha o novo menu; reação pendente → queda ou nova rodada → ack antigo não restaura reação/feedback. Acrescente recusa atrasada e troca de sala/identidade para cobrir erro/foco/pendência.

### R2 — Ordenação e idempotência dos metadados de tempo

- Corrija `MoodLimitTracker` para que repetir a mesma amostra após 500 ms mantenha o prazo restante e um snapshot 500 ms mais antigo com `null` não apague o intervalo confirmado mais novo.
- Hoje o limiar de 1.000 ms aceita esses dados e reancora/substitui a amostra. Não resolva apenas mudando a tolerância: defina a ordem/idempotência das amostras de categoria/alvo e uma referência de tempo coerente. Categoria independente não deve perder seu dado válido por uma atualização da outra; cota de alvo continua separada por id.
- Preserve uso dos dados estruturados de servidor/acks/estado, recuperação dos dois intervalos, relógio do aparelho deslocado e ausência de renovação por replay. Dados autoritativos novos precisam continuar funcionando; não desabilite a contagem ou ignore todas as respostas como contorno.
- Casos mínimos: amostra de reação `serverTime=10000`, `nextSendAt=15000`, local `20000`; replay local `20500` mantém **4500**, não 5000. Snapshot `serverTime=9500`, prazos nulos, após o aceite mantém **5000**, não zero. Cubra também repetição/ordenação no escopo de alvo e um estado realmente novo encerrando janela.

### R3 — Deduplicação do aviso de resposta

- O efeito central é deduplicado em `presentTaunt`, mas `receiveTaunt` processa de novo. Corrija o processamento do aviso por id para que evento repetido não modifique sua chegada, reabra aviso limpo/oculto nem substitua uma provocação mais recente.
- Caso mínimo: Bia envia `old-notice`, Cai envia `new-notice`, repetir `old-notice` mantém o aviso de Cai e seu `receivedAt` original. Repetir `new-notice` não prolonga os 30 segundos.
- Preserve proteção de foco, menu com alvo fixo, exclusividade de quem recebeu, ocultação e saída do emissor. Não altere a deduplicação/áudio/fila existentes nem o intervalo das reações para corrigir o aviso.

## Escopo e critérios de aceite

Escopo: os três defeitos, os caminhos web diretamente relacionados e testes necessários. A modelagem interna da correção cabe ao executor. Preserve a experiência aprovada, a identidade dos alvos, preferências, durações, limites e comportamento de jogo. Servidor/protocolo T014A e motor permanecem como estão; uma necessidade de mudar contrato ou produto volta ao orquestrador.

| ID | Condição verificável |
| --- | --- |
| R1 | Resultados antigos não fecham/alteram menu novo, não roubam foco e não restauram apresentações após queda/nova rodada. Sucesso/recusa, contexto de sala/identidade e pendência do envio novo estão protegidos. Limites continuam preservados. |
| R2 | Replays curtos e longos não renovam prazo; amostras antigas não reduzem/apagam limite mais novo; dados novos e recuperação continuam aceitos. Categorias e alvos isolados, inclusive dados recebidos em ordem adversa. |
| R3 | Repetição de provocação não troca aviso mais recente nem renova o prazo; não reapresenta após limpeza/ocultação. Foco e menu de resposta mantêm a experiência aprovada. |
| R4 | As seis reproduções originais passam e regressões adicionais cobrem sucesso/recusa/foco/tempo. Build/tipos e unitários web passam; E2E pertinentes de humor, teclado, recuperação e circuito permanecem verdes. Fontes e evidências históricas preservadas, com comparação da cópia verificada à entrega. |

Revalidar os critérios originais B1–B10/C1–C7 afetados. O aceite continua pertencendo ao orquestrador.

## Verificação e preservação

Use `rtk` e o runtime fixado pelo repositório. Faça verificações em **cópia isolada do working tree completo**, sem symlinks de reports para a fonte. Suítes podem reescrever métricas/capturas históricas; registre as novas execuções somente em `assets/T014B-adjustments/`. Preserve portas/processos e execute em sequência quando compartilham gerados.

Use tempo/acks controlados para corridas; não espere minutos reais. Rode build/tipos, unitários web e os E2E pertinentes citados acima; amplie regressões se a correção modificar outros caminhos. Não é necessário repetir regras/servidor completos se não forem alterados; demonstre que permanecem iguais à base T014A aceita.

Registre antes/depois, igualdade da fonte entregue com a cópia testada, todos os resultados e limitações. Preserve o report/evidências T014B e T014B-validation como histórico. Execute `git diff --check`. Sem publicação, salas públicas/família, commit, push, deploy, restart ou alteração de faturamento; hooks de teste continuam desligados por padrão em produção.

## Report e parada

Entregue **`docs/work/reports/T014B-adjustments.md`**, sem sobrescrever o report original, com evidência por R1–R4, resultados iniciais/finais, arquivos desta execução, comandos, desvios, limites de verificação, fonte testada e preservação. Evidências novas em `docs/work/reports/assets/T014B-adjustments/`.

Atualize somente o estado atual dos ajustes no status/plano para **“aguardando revalidação do orquestrador”**, preservando o aceite T014A, o escopo e os achados anteriores. Pare após entregar; não declare aceite nem avance para publicação.
