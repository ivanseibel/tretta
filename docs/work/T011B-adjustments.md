# Prompt manual — ajustes de T011B: isolar respostas de entrada obsoletas

**Estado: executado e aceito**, conforme [validação final](reports/T011B.final-validation.md) de 17/10/2026. [Report da execução](reports/T011B-adjustments.md) e contrato abaixo preservados. Preferência: `gpt-6-luna`, reasoning `max`. Publicação continua separada.

## Papel e contexto

Você é o executor dos ajustes de **T011B**, em `/Users/ivanseibel/dev/personal/tretta`. Trabalhe manualmente, sem acionar outros agentes. Leia `AGENTS.md`, `apps/web/AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, status/plano, `docs/product/mesa-de-treino.md`, `docs/work/T011B.md` e **`docs/work/reports/T011B.validation.md`**. O report original `docs/work/reports/T011B.md` permanece como registro da entrega anterior.

Confira Git e preserve o working tree completo, inclusive arquivos novos, T008–T011A aceitas e evidências históricas. Use `coding-guidelines`, práticas React pertinentes e `writing-for-agents` para instruções. Siga os requisitos locais de documentação Next/Context7 quando precisar de API específica. Para nova interação com navegador, siga `browser-harness` e os E2E locais existentes.

## Falha reproduzida — R1/B6

`joinRoom` em `apps/web/app/providers.tsx` aplica o resultado da entrada manual depois de `await` sem validar o contexto da tentativa. `TRAINING_ROOM_ENTRY_REFUSED` liga um estado global apresentado pela página atual.

Caso sem reordenação de acks: sala A sem credencial → enviar entrada e segurar ack → navegar para B, que ainda mostra formulário e não emitiu join → entregar recusa de A → B passa a exibir indevidamente “Mesa de treino individual”. Outra variante oculta B já autorizada. O controle com recuperação antiga (`startRecovery`) passa.

Reprodução preservada em `docs/work/reports/assets/T011B-validation/orchestrator-training-refusal.test.tsx` e `supplemental.log`: **7 testes, 5 verdes e 2 vermelhos**. Em cópia isolada, copie o runner para `apps/web/test/` para executar seus imports relativos. A suíte web entregue, sem esse runner, passou **126/126**.

## Correção delimitada

1. Vincule a entrada manual e seu resultado à tentativa/contexto que a originou. Navegação, cancelamento/limpeza, saída ou substituição desse contexto devem invalidar respostas pendentes. Antes dos efeitos após `await`, confira que sala, tentativa e transporte ainda autorizam aplicá-los. Use as proteções existentes quando coerentes; evite criar uma segunda máquina de recuperação.
2. Uma resposta obsoleta não pode alterar recusa, busy/erro do contexto novo, credencial, vínculo ou navegação. A proteção deve valer também ao sair e retornar ao mesmo código com uma tentativa nova; checar apenas igualdade do código não distingue esses contextos.
3. A recusa **atual** de treino continua definitiva e compreensível, preservando credenciais e sem retries automáticos. `ALREADY_CONNECTED` continua transitória; deadline, resultado incerto entre ciclos e isolamento de recuperação T010 permanecem corretos. Preserve a assinatura/semântica pública de `joinRoom` usada pelos consumidores existentes.
4. Corrija o estado em sua origem. Apenas esconder o painel por comparação de código na página não satisfaz a invalidação dos efeitos antigos. Escolha a implementação local mais simples; mudanças pontuais em provider/página/helper e testes pertinentes bastam.

Servidor, protocolo, motor, política dos bots e apresentação aprovada da mesa permanecem preservados. Regras novas, refatoração geral de operações e correção do E2E T007 ficam fora deste ajuste.

## Critérios de aceite do ajuste

| ID | Evidência |
| --- | --- |
| J1 — Troca de sala | As duas variantes vermelhas do runner passam sem afrouxar suas asserções; B mantém formulário ou lobby autorizado, sem recusa/efeito de A |
| J2 — Cancelamento/mesmo código | Testes determinísticos cancelam uma entrada pendente, saem e voltam ao mesmo código; a resposta antiga não interfere na tentativa nova. Confiram também busy/erro e identidade, além da ausência do painel |
| J3 — Comportamento vigente | Recusa atual continua definitiva, sem nova identidade/retry; recuperação antiga continua inerte; duas abas, cancelamento, deadline e confirmação de resultado incerto T010 continuam corretos |
| J4 — Evidência e preservação | Fonte verificada coincide com a entrega; históricos anteriores byte-idênticos; report diferencia resultados observados de hipóteses e limitações |

Integre os casos novos ao conjunto permanente com o provider/componentes reais e transporte controlado. O runner preservado continua sendo evidência independente; pode ser executado além dos testes permanentes. Não copie o algoritmo corrigido para simular sucesso no teste.

## Verificação proporcional

Na cópia isolada do working tree completo, execute unitários web completos, runner complementar, build/tipos e E2E de treino/recuperação pertinentes. Preserve o fluxo humano com um smoke local de duas pessoas que entre, jogue e recupere a mesma identidade. Os scripts, portas e hooks locais podem ser descobertos no projeto; mantenha hooks desligados por padrão na produção.

Não há necessidade de repetir regras/servidor, prova de carga ou toda a matriz T007 nesta correção restrita ao cliente, salvo alteração ou falha nova que justifique. Se houver timeout, registre assinatura e log; repetir até verde não estabelece causa.

Use `rtk`, Node 22/pnpm fixado, logs suficientes para conferir saída e exit code, build/tipos/E2E em sequência quando compartilham gerados e `git diff --check`. Documentos/artefatos da cópia devem ser físicos, sem symlink para a fonte. Novas evidências em `docs/work/reports/assets/T011B-adjustments/`; preserve os assets T011B e da validação. Registre hashes antes/depois e fonte da cópia; o baseline histórico disponível tem 417 entradas, não as 352 contadas no report original.

Sem commit, push, deploy, restart Render, alteração de custo ou uso de salas públicas/familiares. Capture apenas a UI autorizada; credenciais, storage bruto e mãos adversárias ficam fora de logs.

## Precisão do report

Mantenha o achado T007 fora do escopo de correção. Registre que a falha apareceu na base e na entrega nas medições anteriores; a atribuição ao `.next` é hipótese não demonstrada por isolamento causal. Diferencie as contagens agregadas de medições dos logs individuais efetivamente preservados, e não invente evidências ausentes. Corrija a contagem de históricos conferidos na nova entrega sem reescrever os reports anteriores.

## Retorno e parada

Entregue **`docs/work/reports/T011B-adjustments.md`**: resultado, alterações desta execução, evidência J1–J4, resultados dos casos antes/depois, comandos/logs e falhas/intermitências, proveniência/preservação, decisões e limitações. Atualize somente o estado atual de status/plano para “ajustes de T011B aguardando validação do orquestrador”, referenciando o novo report.

Pare após entregar. O aceite continua sendo do orquestrador; publicação só será preparada depois de satisfazer T011B.
