---
name: orchestrate-work
description: Coordenar tarefas do Tretta como orquestrador ou executor, preparar prompts portáveis e validar reports de execução automática ou manual.
---

# Orquestrador e executor

O orquestrador define tarefas e valida resultados. O executor implementa uma tarefa delimitada e retorna um report. Os papéis continuam iguais em subagentes e em sessões independentes, inclusive com outro agente ou assinatura.

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
- **Verificação:** comportamento a conferir e restrições do ambiente; comandos podem ser descobertos no projeto.
- **Retorno:** report no formato abaixo, com evidências suficientes para validação em outra sessão.

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

## Continuidade

Mantenha decisões duráveis nos documentos do projeto e referencie-as nos prompts. Na troca de sessão, forneça o estado atual, a tarefa pendente e os caminhos ou conteúdos necessários. Use `handoff` quando o usuário solicitar transferência da conversa; o protocolo permanece neste arquivo.
