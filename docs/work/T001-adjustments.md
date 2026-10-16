# Ajustes de T001 — Mãos e término da abertura

## Papel e objetivo

Você é o executor do Tretta em execução manual. Corrija os dois achados da validação de T001. A base existe no working tree, sem commit, e requer ajustes antes de T002.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/work/status.md`, `docs/work/plan.md`, `docs/product/first-version.md`, `docs/work/T001.md`, `docs/work/reports/T001.md` e `docs/work/reports/T001.validation.md`.

Confira o Git e preserve as alterações existentes, inclusive os documentos do orquestrador. Ao editar instruções para agentes, siga `writing-for-agents`; preparação em `docs/work/setup.md`.

Versões e estrutura atuais estão aceitas para T001. Escolhas locais de implementação cabem ao executor; mudanças de produto ou critérios voltam ao orquestrador.

## Escopo

1. Corrigir `hands` para que todo id textual válido seja propriedade própria com sete cartas, inclusive `__proto__`, `constructor` e `toString`. Preserve a API de consulta por id e a representação JSON; uma representação sem protótipo é uma opção local.
2. Garantir término da abertura para qualquer fonte que retorne valores em `[0, 1)`. Reserve temporariamente cada não numérica retirada até encontrar a primeira numérica. Devolva as reservadas à pilha restante e reembaralhe uma única vez quando houver devoluções. Preserve todas as cartas; mantenha erro explícito quando não houver numérica disponível. Documente a semântica de `returnedDuringOpening` e ajuste os comentários e testes afetados.
3. Acrescentar testes de regressão para os dois achados. Confira a reprodução com 108 cartas e a fonte periódica descrita na validação, além do caso mínimo com fonte constante. Verifique as invariantes da distribuição nos novos casos.

Regras completas de turno, frontend, transporte, bots e deploy ficam para as tarefas seguintes. Nenhum commit é solicitado.

## Critérios de aceite

- Cada jogador tem uma mão como propriedade própria; enumeração e JSON preservam todas as mãos, inclusive ids especiais. O conjunto de mãos e pilhas continua contendo todas as cartas, sem perdas ou duplicações.
- Os dois cenários de loop descritos na validação terminam com descarte numérico e preservação das cartas. A busca faz progresso finito, sem teto arbitrário de tentativas nem erro para baralho que contém numérica disponível.
- Não numéricas reservadas voltam à pilha de compra, aparecem uma vez cada em `returnedDuringOpening` e não entram no descarte.
- Permanecem satisfeitos todos os critérios originais de T001. Instalação congelada, testes e tipos passam.

## Verificação e retorno

Execute testes de regressão e a suíte completa, tipos e instalação com lockfile congelado, usando os comandos do projeto e as instruções de `AGENTS.md`. Registre resultados exatos e limitações. Para fontes que antes causavam loop, use proteção externa de timeout se necessária ao reproduzir o problema; um timeout do framework não interrompe necessariamente um laço síncrono.

Salve o report no formato do protocolo em `docs/work/reports/T001-adjustments.md`, com evidência por critério, arquivos alterados, decisões e comandos. Preserve o report original e a validação do orquestrador. Atualize `docs/work/status.md` para “aguardando revalidação do orquestrador”, mantendo o modo manual e os links relevantes.

Pare após os ajustes de T001. Traga o report ao usuário; T002 depende da aceitação do orquestrador.
