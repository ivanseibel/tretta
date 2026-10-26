---
name: orchestrate-work
description: Coordenar tarefas do Tretta como orquestrador ou executor, preparar prompts portáveis, validar reports e notificar encerramentos conforme o modo de execução.
---

# Orquestrador e executor

O orquestrador define tarefas e valida resultados. O executor implementa uma tarefa delimitada e retorna um report. Os papéis continuam iguais em subagentes e em sessões independentes, inclusive com outro agente ou assinatura.

## Notificação de encerramento

Regra do workspace: **o orquestrador e todo executor manual devem ler e usar a skill `agent-notify` ao encerrar cada tarefa**, inclusive preparação de prompt e validação de report. A obrigação vale também para tarefas curtas; substitui a dispensa genérica de tarefas triviais da skill. Conversa de acompanhamento e updates intermediários não são encerramentos de tarefa.

**Única exceção de papel/modo:** o executor lançado automaticamente como subagente pelo orquestrador devolve o report sem notificação própria; o orquestrador notifica ao concluir sua tarefa. Executor iniciado pelo usuário em outra sessão, interface ou assinatura é manual e deve notificar, mesmo que siga um prompt do orquestrador.

Após salvar os artefatos, registrar o resultado e concluir as verificações, acione a notificação **como última ação antes da resposta final**, uma vez por encerramento:

| Situação terminal | Comando no workspace |
| --- | --- |
| Tarefa concluída, inclusive report entregue para validação | `rtk proxy agent-notify done` |
| Trabalho interrompido aguardando decisão, autorização ou informação do usuário | `rtk proxy agent-notify attention` |
| Falha terminal impede continuar após tentativas pertinentes | `rtk proxy agent-notify error` |

Passe somente o status; detalhes, caminhos, credenciais e contexto pertencem ao report/resposta, nunca ao comando. A notificação não concede aceite nem autoriza a próxima tarefa. Entrega do serviço é best-effort: se skill/utilitário estiverem indisponíveis ou a tentativa falhar, preserve o resultado do trabalho e informe a limitação sem afirmar envio confirmado. A [preparação de outro computador](../../../docs/work/setup.md) cobre essa dependência.

## Isolamento do navegador

Para qualquer teste ou inspeção de navegador no Tretta, **orquestrador e executor, manual ou subagente, usam uma instância dedicada à própria tarefa**. Use `browser-harness` e aplique esta regra antes da primeira conexão: o fluxo local padrão da skill descobre o Chrome já aberto, portanto não atende ao isolamento exigido aqui.

1. Inicie um processo Chrome/Chromium próprio, com diretório temporário novo de dados (`--user-data-dir`) e endpoint de depuração exclusivo em loopback. Registre o PID, o diretório e o endpoint que pertencem à tarefa. Outra aba, janela, modo anônimo ou contexto no navegador pessoal não substitui esse processo/perfil dedicado. Não copie cookies, sessões, extensões ou storage do perfil pessoal.
2. Use um **`BU_NAME` novo e exclusivo por tarefa/executor** e configure explicitamente **um** dos destinos `BU_CDP_URL` ou `BU_CDP_WS` da instância criada, desde a primeira chamada e em todas as chamadas do harness. Remova valores conflitantes herdados; `BU_CDP_WS` tem precedência sobre `BU_CDP_URL`. Um daemon já existente pode manter a conexão anterior mesmo com novas variáveis: não use `default`, não reutilize nome de outra tarefa e não reinicie o daemon do usuário para tomar seu lugar.
3. Antes de navegar, alterar viewport ou enviar input, confira que processo, perfil, endpoint e daemon correspondem à instância da tarefa. Se não conseguir comprovar isolamento, suspenda somente a prova de navegador e reporte a limitação, continuando o trabalho independente. Nunca use o navegador pessoal como fallback, nem habilite depuração nele para contornar a falha.
4. Crie e controle apenas abas/contextos dessa instância. Para vários jogadores, use contextos independentes dentro do navegador dedicado; eles separam identidades de teste, mas não dispensam o isolamento do navegador em relação ao usuário. Executores concorrentes precisam de processos, perfis, endpoints e nomes de daemon distintos. Login necessário deve ocorrer na instância dedicada, com participação do usuário quando exigida; não aproveite sua sessão pessoal.
5. Ao concluir ou interromper a prova, encerre somente os processos/daemons/abas que criou e descarte o perfil temporário após salvar evidências sanitizadas. Preserve janelas, abas, foco, preferências, sessões e processos preexistentes do usuário e de outros agentes. Não use encerramento global de Chrome ou do harness. Instância remota paga não é solução automática para isolamento; mantenha o custo zero aprovado.
6. No report, registre como o isolamento foi conferido, identificadores técnicos do processo/perfil/endpoint/daemon, resultado da limpeza e eventuais limitações. Não inclua cookies, tokens, storage bruto ou URLs com credenciais. Teste em instância dedicada continua sendo emulação/navegador, não teste em aparelho físico.

## Orquestrador

1. Leia as instruções do projeto e o estado relevante dos arquivos. Separe decisões aceitas, propostas e dúvidas. A tarefa está pronta quando tem objetivo delimitado e critérios de aceite verificáveis; esclareça com o usuário as dúvidas que mudam o escopo.
2. Prepare um prompt autossuficiente usando o contrato abaixo. Inclua o contexto necessário para uma sessão sem histórico. Referencie arquivos que o executor poderá acessar; forneça trechos ou artefatos quando ele estiver em outro ambiente.
3. Escolha o modo conforme a preferência do usuário e as ferramentas disponíveis. Na execução automática, invoque um subagente como executor e aguarde seu report. Na execução manual, entregue o prompt para copiar e aguarde o report do usuário. O prompt entregue indica tarefa preparada, não tarefa concluída.
4. Compare o report com todos os critérios de aceite. Inspecione os artefatos e execute verificações proporcionais à mudança quando tiver acesso. Quando o resultado estiver em outro ambiente, solicite as evidências faltantes e explicite o limite da validação.
5. Registre o resultado como aceito, requer ajustes ou bloqueado, com as evidências e pendências. Para ajustes, produza um novo prompt com as divergências concretas. Avance para a próxima tarefa quando os critérios da atual estiverem satisfeitos ou quando uma mudança de plano for acordada com o usuário.

## Contrato do prompt

- **Papel e tarefa:** executor, identificador da tarefa e objetivo.
- **Contexto:** decisões aceitas, instruções aplicáveis e arquivos ou referências necessários.
- **Escopo:** entregáveis, limites e dependências; explicite o que requer uma decisão do orquestrador.
- **Critérios de aceite:** condições observáveis para cada entregável.
- **Verificação:** comportamento a conferir e restrições do ambiente; para testes/inspeções de browser, exija instância dedicada e evidência conforme “Isolamento do navegador”. Comandos podem ser descobertos no projeto.
- **Retorno:** report no formato abaixo, com evidências suficientes para validação em outra sessão; explicite o modo manual/subagente e a obrigação ou dispensa de notificação conforme a seção “Notificação de encerramento”.

## Executor

1. Leia o prompt e as instruções acessíveis do projeto. Confirme o estado dos arquivos antes de editar e preserve trabalho preexistente.
2. Execute dentro do escopo. Resolva escolhas locais de implementação; retorne ao orquestrador quando faltar uma decisão que altere regras do produto, escopo ou critérios de aceite. Informe o impedimento e o trabalho já realizado.
3. Verifique os critérios de aceite. Diferencie verificações executadas, falhas e verificações indisponíveis.
4. Entregue os artefatos e o report. A conclusão do executor é uma proposta de conclusão, sujeita à validação do orquestrador.

## Report do executor

- **Tarefa e resultado:** concluída, parcial ou bloqueada.
- **Alterações:** comportamento resultante e arquivos alterados; inclua commit, diff ou artefatos quando necessários para transferência.
- **Critérios de aceite:** evidência por critério e pendências.
- **Verificação:** comandos ou procedimentos executados, resultados e limitações.
- **Decisões e desvios:** escolhas relevantes, suposições e divergências do prompt.
- **Próximo passo:** ajustes necessários ou decisões aguardadas.

O report é salvo antes da última ação de notificação; o resultado da tentativa pode ser informado na resposta final, sem reabrir o report depois dela.

## Continuidade

Mantenha decisões duráveis nos documentos do projeto e referencie-as nos prompts. Na troca de sessão, forneça o estado atual, a tarefa pendente e os caminhos ou conteúdos necessários. Use `handoff` quando o usuário solicitar transferência da conversa; o protocolo permanece neste arquivo.
