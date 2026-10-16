# Ajustes de T002 — Efeitos da carta vencedora

## Papel e objetivo

Você é o executor do Tretta em execução manual. Corrija os efeitos no caminho de vitória de T002 e alinhe a documentação da janela de denúncia à decisão aprovada. T001 está aceita; T002 requer estes ajustes antes de T003.

## Contexto obrigatório

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/product/first-version.md`, `docs/work/status.md`, `docs/work/plan.md`, `docs/work/T002.md`, `docs/work/reports/T002.md` e `docs/work/reports/T002.validation.md`.

Confira o Git e preserve o working tree de T001, T002 e do orquestrador. Siga as instruções de comandos, usando `rtk proxy pnpm typecheck` para evitar a falha conhecida do filtro. Use `writing-for-agents` ao editar instruções. Nenhum commit foi solicitado.

A decisão de janela já está aprovada e registrada no escopo: Compra 2/4 obrigatórias não fecham a janela; a próxima compra voluntária ou descarte aceito a fecha, inclusive quando a vez retorna à mesma pessoa. Substitutos não denunciam automaticamente. As demais interpretações aceitas estão na validação; não é necessária nova aprovação para estes ajustes.

## Escopo

1. Aplicar todos os efeitos da última carta antes de concluir a rodada. Hoje `play` chama apenas `resolveMandatoryDraws` quando a mão fica vazia, ignorando Bloqueio, Inversão e o registro de perda de turno. Preserve o formato dos eventos existentes e evite executar compras ou efeitos duas vezes.
2. Inversão final com três ou mais pessoas deve mudar o sentido e emitir `directionChanged`; com duas, deve funcionar como Bloqueio sem mudar o sentido. Bloqueio final e cartas Compra 2/4 finais devem registrar `turnSkipped` para a pessoa afetada. Compras obrigatórias e escolha de cor continuam resolvidas antes do resultado. Os eventos dos efeitos precedem `roundFinished`.
3. Encerrar com o mesmo vencedor e janela fechada; todos os comandos posteriores continuam recusados. A rodada concluída não permite nova jogada. A representação interna do índice de vez terminal é uma escolha local, documentada se mudar; a projeção continua com jogador atual nulo.
4. Corrigir as expectativas de `classic-finals.test.ts` que afirmam ausência dos efeitos finais. Acrescentar cobertura de Inversão final nos dois sentidos com três ou mais pessoas e com duas pessoas, Bloqueio final e perda de turno das duas cartas de compra finais. Confira quantidade e ordem dos eventos e das compras.
5. Explicitar no README e nos comentários pertinentes que a janela fecha na compra voluntária ou descarte seguinte; compras obrigatórias de Compra 2/4 não a fecham. Preservar o teste do cenário aprovado; cobrir ambas as variantes de compra obrigatória se necessário para demonstrar a mesma regra.

Interface, animações, salas, sockets, bots, chat, placar e deploy continuam fora desta tarefa. A correção entrega estados/eventos consistentes para os consumidores futuros.

## Critérios de aceite

- Cada tipo de carta pode vencer com efeitos completos e únicos, antes de `roundFinished`. Inversão registra o sentido correto; Bloqueio/perda de turno registram a pessoa correta, respeitando o sentido; compras não se duplicam. Coringas ainda exigem cor válida.
- Estado anterior permanece preservado, cartas físicas não se perdem nem duplicam, vencedor permanece correto e a rodada finalizada recusa novos comandos.
- Janela de denúncia e documentação seguem a decisão aprovada, sem mudar a regra dos comandos inválidos ou da ordem de recebimento.
- Todos os critérios de T002 permanecem atendidos: regressões de T001, privacidade, 2–8 jogadores, simulações até vencedor, instalação congelada, suíte completa e tipos.

## Verificação e retorno

Execute regressões, suíte completa e simulações existentes, checagem de tipos e instalação com lockfile congelado. Registre comandos exatos, resultados e limitações. Contagem de testes não substitui evidência dos cenários.

Salve o report do protocolo em `docs/work/reports/T002-adjustments.md`, com evidência por critério, comportamento, arquivos alterados, decisões/desvios e pendências. Preserve o report e a validação originais. Atualize `docs/work/status.md` para “T002 aguardando revalidação do orquestrador”, mantendo o aceite de T001 e o modo manual.

Pare após os ajustes e entregue o report ao usuário. T003 depende da revalidação; nenhum commit foi solicitado.
