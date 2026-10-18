# Prompt manual — T014B: monotonicidade e replay no mesmo timestamp

**Estado: executado manualmente e aceito U1–U3 em 18/10/2026**, conforme [validação final](reports/T014B.final-validation.md). T014B aceita localmente; nenhum ajuste de implementação pendente. Publicação segue separada e não autorizada. Preferência `gpt-6-luna`, reasoning `max`. Contrato executado abaixo preservado.

## Papel, objetivo e contexto

Você é o executor deste ajuste delimitado de **S2/R2 da T014B**. Corrija o retrocesso da estimativa de tempo e os replays conflitantes no mesmo timestamp. Preserve o isolamento entre categorias/alvos já aceito, a UI e os demais comportamentos.

Trabalhe em `/Users/ivanseibel/dev/personal/tretta`. Execute você mesmo, sem acionar outros agentes. Entregue o novo report ao usuário e pare para validação do orquestrador.

Leia `AGENTS.md`, `apps/web/AGENTS.md`, instruções aplicáveis e `.agents/skills/orchestrate-work/SKILL.md`; estado/plano; `docs/product/provocacoes-e-reacoes.md`; contrato `docs/work/T014B-adjustments-2.md`; **`docs/work/reports/T014B.revalidation-2.md`** e o report do complemento. Use `coding-guidelines`; documentação local/Context7 quando houver necessidade de API/biblioteca e `browser-harness` para eventual interação de navegador. O defeito é lógica de tempo; não exige atualização de framework.

Preserve working tree completo, arquivos não rastreados, reports e evidências anteriores. HEAD sozinho não reproduz a fonte aceita.

## Reprodução e condições da correção

Em cópia isolada, copie `docs/work/reports/assets/T014B-final-review/orchestrator-mood-clock-ties.test.ts` para `apps/web/test/` e registre o resultado inicial. São três falhas reproduzidas, detalhadas na revalidação:

1. Reação aceita em servidor 10000, liberação 15000, local 20000. No local 24000 restam **1000 ms**. Um ack de provocação com servidor 10001 recebido ali não pode aumentar essa espera para 4999 ms.
2. Estado nulo em servidor 10000 → aceite de reação no mesmo timestamp com liberação 15000 → replay do estado anterior em local 20500. Preservar **4500 ms**, não liberar para zero.
3. Recusa do alvo Bia em servidor 10000, liberação 70000 → liberação por aceite em servidor 10000 → replay da recusa em local 20500. Preservar **zero**, não ressuscitar 59500 ms.

### Referência comum

A estimativa corrente é `serverTimeDaAncora + tempoLocalDecorrido`. Uma amostra com timestamp maior que o guardado, mas menor que essa estimativa, não pode fazer o relógio estimado retroceder. Mantendo o tempo local não decrescente, a referência após uma atualização precisa ser pelo menos a estimativa imediatamente anterior; amostra de servidor realmente adiantada pode avançá-la. Use essa referência para os prazos absolutos, sem iniciar janela inteira na chegada.

### Empates e idempotência

Mesmo timestamp com conteúdo diferente não basta para considerar a informação nova: o replay de um fato anterior não pode desfazer o posterior. Defina tratamento de empate apropriado à origem/escopo da informação, preservando o contrato existente:

- Estado inicial nulo seguido de aceite no mesmo milissegundo continua funcionando; o replay desse estado não apaga a janela aceita.
- Liberação de alvo continua prevalecendo contra a repetição da recusa já superada, inclusive se os timestamps forem iguais; recusa realmente posterior continua podendo bloquear.
- Preservar tombstones e ordem de cada categoria/alvo; não restaurar a filtragem global que descartava dados válidos de outro escopo.
- Não resolver rejeitando indiscriminadamente tudo com timestamp igual: isso quebraria o caso inicial nulo → aceite, já testado.

A implementação cabe ao executor. Escopo esperado: `apps/web/lib/moodTime.ts` e `mood-time.test.ts`. Se faltar informação para uma solução dentro do contrato, explicite a lacuna ao orquestrador em vez de ampliar protocolo ou produto. Nenhuma UI, regra de carta, limite, duração, preferência, servidor ou recuperação deve mudar.

## Critérios de aceite e verificação

| ID | Evidência |
| --- | --- |
| U1 — Relógio | Primeiro caso passa com 1000 ms. Atualizações não aumentam uma espera por retrocesso do relógio estimado; chegada tardia não reancora janela. Informação realmente adiantada continua funcionando. |
| U2 — Empates | Dois casos de replay no mesmo timestamp passam com 4500 ms e zero. Preservar estado nulo inicial → aceite no mesmo instante e conhecimento posterior por escopo. Repetir fatos superados não alterna o estado. |
| U3 — Regressões | Dois casos de escopos (3500/14500, 58500/59500), seis reproduções originais e regressões R1/R3 continuam verdes. Build/tipos e unitários web passam; código testado corresponde à entrega e históricos intactos. |

Use `rtk` e o runtime do repositório. Verifique em **cópia física isolada do working tree completo**, sem symlinks de reports para a fonte. Incorpore regressões duráveis e confira sequências de repetição/intercalação das amostras, sem trocar expectativas para aceitar os defeitos. Registre o vermelho inicial e o verde final.

Execute build/tipos e unitários web; reexecute os casos anteriores preservados em `assets/T014B-validation/` e `assets/T014B-revalidation/` (avatar é trecho para acrescentar ao arquivo com seus helpers). Se restrito a biblioteca/testes, rode também o E2E de humor/recuperação pertinente; não é necessário repetir regras/servidor completos ou auditoria visual. Amplie checks somente se modificar outros caminhos.

Evidências novas em `docs/work/reports/assets/T014B-adjustments-3/`; manifeste origem, fontes testadas/entregues, igualdade de servidor/pacotes e preservação. Registre comandos/resultados, falhas/reexecuções, limitações e `git diff --check`. Sem salas públicas/família, commit, push, deploy, restart ou faturamento.

Entregue **`docs/work/reports/T014B-adjustments-3.md`**, preservando reports anteriores, com evidência U1–U3, arquivos alterados, decisões, origem e pendências. Atualize apenas o estado atual para **“aguardando revalidação do orquestrador”**, mantendo aceites T014A/R1/R3/S1. Pare após entregar; não declare aceite final nem publique.
