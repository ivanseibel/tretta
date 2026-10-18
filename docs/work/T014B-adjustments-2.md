# Prompt manual — T014B: complemento de R2

**Estado: executado manualmente; S1 aceito na revisão anterior e S2 encerrado após o complemento de relógio/empates**, conforme [aceite final de T014B](reports/T014B.final-validation.md) em 18/10/2026. Reports anteriores preservados. Nenhum ajuste de implementação pendente; publicação manual permanece separada. Contrato executado abaixo preservado.

## Papel, objetivo e contexto

Você é o executor do complemento **R2 de T014B** do Tretta. Corrija a perda de metadados válidos quando a informação de outra categoria/alvo chega antes. Entregue mudança delimitada no rastreador de tempo e regressões; preserve R1/R3 e a experiência aprovada.

Trabalhe em `/Users/ivanseibel/dev/personal/tretta`. Execute você mesmo, sem acionar outros agentes. Retorne o report ao usuário e pare para validação.

Leia `AGENTS.md`, `apps/web/AGENTS.md`, instruções aplicáveis e `.agents/skills/orchestrate-work/SKILL.md`; status/plano atuais; `docs/product/provocacoes-e-reacoes.md`; `docs/work/T014B-adjustments.md`; **`docs/work/reports/T014B.revalidation.md`** e o report `T014B-adjustments.md`. T014A, R1 e R3 permanecem aceitos.

Use `coding-guidelines`. Consulte documentação local/Context7 se precisar de biblioteca/API conforme AGENTS; este defeito é lógica de tempo e não exige atualização de framework. Para eventual navegador, siga `browser-harness`; ao editar instruções, use `writing-for-agents`.

Preserve working tree completo, não rastreados e alterações preexistentes. HEAD sozinho não representa a fonte aceita. Reports/evidências anteriores permanecem intactos.

## Reprodução e correção delimitada

Na cópia física isolada, copie `docs/work/reports/assets/T014B-revalidation/orchestrator-mood-scopes.test.ts` para `apps/web/test/` e execute pelo runner existente. Os dois testes falham antes da correção, retornando zero em vez de 3500/58500 ms; [log](reports/assets/T014B-revalidation/scope-deadlines.log).

- Provocação: servidor 11000, próximo envio 26000, recebida em local 21000. Depois chega reação: servidor 10000, próximo envio 15000, recebida em local 21500. Não há amostra posterior da reação. Restantes: **3500 ms de reação e 14500 ms de provocação**.
- Cai: servidor 11000, liberação 71000, recebido em local 21000. Depois chega Bia: servidor 10000, liberação 70000, recebido em local 21500. Não há amostra posterior de Bia. Restantes: **58500 ms de Bia e 59500 ms de Cai**.

As expectativas usam a referência comum conhecida (servidor 11500 no local 21500). Não trocar dado ignorado por janela inteira de 5/60 segundos contada da chegada.

`MoodLimitTracker.acceptClock` hoje bloqueia qualquer metadado mais antigo que a amostra global, antes da ordem própria de categoria/alvo. Corrija separando atualização do relógio comum e validade da informação de cada escopo:

- Referência de relógio coerente, sem retrocesso. Uma atualização de provocação não invalida reação; recusa de Cai não invalida recusa vigente de Bia.
- Compare cada informação com o conhecimento mais recente **do próprio escopo**, inclusive estado autoritativo que declarou janela encerrada. Preserve a ordem ao remover a amostra ativa, para não ressuscitar dado superado.
- Aceite informação atrasada mas válida sem reancorar o prazo na chegada. Replay é idempotente. Estado novo pode encerrar a janela apropriada; aceite antigo não limpa recusa mais nova do alvo.
- Preserve recuperação, categorias/alvos independentes, dados estruturados do servidor e relógio do aparelho deslocado. Não elimine contagem, reduza limites ou interprete textos de erro.

Modelagem interna cabe ao executor. Escopo esperado: `apps/web/lib/moodTime.ts` e testes de tempo. Ajuste consumidor somente se estritamente necessário, explicando por quê. Sem alterar contrato, servidor, UI, durações, preferências, cartas ou recuperação. Necessidade de decisão de produto volta ao orquestrador.

## Critérios de aceite

| ID | Evidência observável |
| --- | --- |
| S1 — Escopos independentes | Dois casos do orquestrador passam com 3500/14500 e 58500/59500 ms. Metadados relevantes chegam ao escopo correto apesar da ordem adversa entre categorias/alvos. |
| S2 — Prazo e ordem | Replay/chegada tardia não renovam prazo; âncora não retrocede. Dado superado no próprio escopo é rejeitado, inclusive após `null` autoritativo ou limpeza por aceite mais novo. Cobrir duas ordens de chegada, repetições, expiração e recuperação. |
| S3 — Regressões e preservação | Seis reproduções anteriores e regressões R1/R3 verdes; build/tipos e unitários web passam. Servidor/protocolo aceitos iguais; fonte verificada corresponde à entrega e históricos intactos. |

## Verificação e retorno

Use `rtk` e o runtime do repositório. Verifique em **cópia isolada do working tree completo**, sem symlinks de reports para a fonte ou reescrita de evidências anteriores. Registre a reprodução inicial vermelha, incorpore regressões duráveis equivalentes e execute os runners existentes.

Execute build/tipos e unitários web. Reexecute os seis casos do orquestrador em `assets/T014B-validation/`, conforme o contrato anterior: o trecho de avatar é acrescentado ao arquivo com seus helpers. Se a mudança ficar restrita à biblioteca de tempo/testes, faça também o E2E de humor/recuperação pertinente; não é necessário repetir regras/servidor completos ou auditoria visual. Amplie a verificação se alterar outros caminhos.

Evidências novas em `docs/work/reports/assets/T014B-adjustments-2/`; manifeste origem, comparação fonte testada/entrega e preservação. Registre falhas/reexecuções, limitações e `git diff --check`. Sem salas públicas/família, commit, push, deploy, restart ou faturamento; hooks de teste desligados por padrão em produção.

Entregue **`docs/work/reports/T014B-adjustments-2.md`**, sem sobrescrever reports anteriores, com evidência S1–S3, arquivos alterados, decisões, resultados iniciais/finais, comandos, proveniência e pendências. Atualize somente o estado atual para **“aguardando revalidação do orquestrador”**, preservando aceite de T014A/R1/R3. Pare após entregar; não declare aceite final nem avance para publicação.
