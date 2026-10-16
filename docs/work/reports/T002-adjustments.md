# Report T002-adjustments — Efeitos da carta vencedora e documentação da janela

## Tarefa e resultado

- **Tarefa:** ajustes de T002 preparados em [T002-adjustments.md](../T002-adjustments.md).
- **Resultado:** concluída pelo executor, **aguardando revalidação do orquestrador**.
- **Modo:** execução manual, conforme `docs/work/status.md`. Nenhum commit foi criado. T001, T002 e os documentos do orquestrador foram preservados no working tree; o report e a validação originais de T002 não foram alterados.

## Alterações

Comportamento resultante em `@tretta/rules`:

- O descarte vencedor (`remaining === 0`) agora chama `resolveEffects` uma única vez e só então marca `status: 'finished'`, define `winnerId` e emite `roundFinished`. A função `resolveMandatoryDraws` foi removida; não há mais caminho paralelo de efeitos. Compras obrigatórias continuam dentro do mesmo comando, sem duplicação.
- Efeitos terminais: Inversão final com 3+ pessoas muda o sentido e emite `directionChanged`; Inversão final com 2 pessoas vira Bloqueio, mantém o sentido e emite `turnSkipped` para a outra pessoa; Bloqueio final emite `turnSkipped` para a pessoa afetada; Compra 2/Compra 4 finais emitem `drew` (penalidade) e `turnSkipped` para a vítima, com a escolha de cor já aplicada. A ordem é sempre `played`, efeitos, `roundFinished`.
- A janela de última carta da pessoa anterior é fechada pela jogada vencedora (o descarte vencedor já zerava `lastCard`), e a rodada concluída recusa todos os comandos com `ROUND_FINISHED`, sem alterar o estado.
- Representação terminal do índice de vez: `currentIndex` passa a apontar o assento que jogaria em seguida com os efeitos aplicados (antes permanecia no vencedor). Documentado em `state.ts`; `projectForPlayer` continua publicando `currentPlayerId: null` e `phase: 'finished'` quando a rodada termina.
- Documentação da janela: o comentário de `LastCardWindow`, a mensagem de rejeição `NO_LAST_CARD_WINDOW` e o README passam a dizer que a janela fecha na próxima compra voluntária ou descarte aceito de quem efetivamente age — inclusive quando a vez volta à mesma pessoa — e que compras obrigatórias de Compra 2/4 não a fecham. O README também registra que os efeitos da carta vencedora são resolvidos antes de `roundFinished`.

Arquivos alterados nesta tarefa (working tree, sem commit):

| Arquivo | Alteração |
| --- | --- |
| `packages/rules/src/commands.ts` | Caminho terminal usa `resolveEffects`; `resolveMandatoryDraws` removida; comentário de `resolveEffects`; mensagem de `NO_LAST_CARD_WINDOW` menciona compra voluntária/descarte aceito. |
| `packages/rules/src/state.ts` | Comentário de `LastCardWindow` com a regra completa da janela; comentário de `currentIndex` documenta o índice terminal. |
| `packages/rules/test/classic-finals.test.ts` | Expectativas antigas corrigidas; sequências exatas de eventos; Inversão 3+ nos dois sentidos, Inversão com 2 pessoas, Bloqueio, Compra 2, Compra 4 e fechamento da janela pela jogada vencedora. |
| `packages/rules/test/classic-last-card.test.ts` | Cenário aprovado de Compra 2 preservado (renomeado); novo teste de Compra 4 obrigatória mantendo a janela aberta. |
| `README.md` | Regra da janela explícita; efeitos finais antes de `roundFinished`. |
| `docs/work/status.md` | Estado “T002 aguardando revalidação do orquestrador”; aceite de T001 e modo manual preservados. |
| `docs/work/reports/T002-adjustments.md` | Este report. |

## Evidência por critério

### Escopo dos ajustes

1. **Efeitos completos e únicos antes de concluir.** `packages/rules/src/commands.ts:284` agora resolve `resolveEffects` antes de `roundFinished`; não há chamada duplicada de compras ou efeitos. Os testes de finais conferem `events.filter(drew)` com comprimento 1, mãos e pilha exatas após cada efeito, e a sequência literal de eventos por tipo.
2. **Inversão final nos dois sentidos e Bloqueio/perda de turno.** Em `classic-finals.test.ts`:
   - “vitória com Inversão com três pessoas muda o sentido e emite directionChanged”: eventos `played → directionChanged → roundFinished`, sentido final `counterclockwise`, próximo assento `cai`;
   - “vitória com Inversão no sentido anti-horário volta ao sentido horário”: parte de `counterclockwise`, termina em `clockwise` com `directionChanged` e próximo assento `bia`;
   - “vitória com Inversão com duas pessoas funciona como Bloqueio e mantém o sentido”: `turnSkipped` para `bia`, sentido `clockwise`, próximo assento `ana`;
   - “vitória com Bloqueio registra a perda de turno do próximo antes do resultado”: `played → turnSkipped(bia) → roundFinished`;
   - “vitória com Compra 2 resolve a compra e a perda de turno do próximo antes do resultado”: `played → drew(2, penalty) → turnSkipped(bia) → roundFinished`, mão de `bia` com duas cartas compradas e pilha restante `d3–d5`;
   - “vitória com Compra 4 resolve as quatro cartas, a cor ativa e a perda de turno”: mesma ordem com `drew(4)`, cor ativa `blue` e `turnSkipped(bia)`.
3. **Encerramento e bloqueio.** Todos os testes de finais chamam `expectFinishedAndLocked`: `status` finalizado, vencedor correto, e `draw`/`pass`/`play`/`announceLastCard`/`challengeLastCard` posteriores recusados com `ROUND_FINISHED` e JSON do estado idêntico antes/depois. O teste “a jogada vencedora fecha a janela anterior antes de encerrar” cobre janela aberta de `ana` fechada pelo descarte vencedor de `bia` (`lastCard` nulo) e rodada finalizada.
4. **Testes corrigidos e ampliados.** As antigas expectativas “Bloqueio sem efeito / Inversão não altera o sentido” foram substituídas pelas corretas. Contagens: `classic-finals.test.ts` com 11 testes (era 8; +3) e `classic-last-card.test.ts` com 14 (era 13; +1); total 123 contra 119 anteriores.
5. **Janela explícita na documentação.** `README.md` (bullet de `announceLastCard`/`challengeLastCard` e parágrafo de efeitos finais), comentário de `LastCardWindow` em `state.ts` e mensagem de `NO_LAST_CARD_WINDOW` em `commands.ts`. O cenário aprovado de Compra 2 continua coberto (“Compra 2 obrigatória não fecha a janela do denunciado; a penalidade chega ao próximo”) e a variante de Compra 4 foi adicionada (“Compra 4 obrigatória também não fecha a janela do denunciado”), demonstrando a mesma regra para as duas cartas.

### Critérios de T002 mantidos

1. **Base preservada:** `rtk pnpm install --frozen-lockfile` exit 0; suíte completa exit 0; tipos exit 0; regressões de T001 (`deck`, `opening`, `random`) passam.
2. **Turnos e validade:** inalterados; `classic-turns.test.ts` e `classic-effects.test.ts` seguem passando sem alteração.
3. **Efeitos:** durante a rodada inalterados; agora também no caminho terminal, com os testes acima.
4. **Última carta e ordem:** regras inalteradas; documentação alinhada à decisão aprovada; testes da janela (aviso, denúncia, fechamento, ordens opostas, Bloqueio com retorno da vez) passam.
5. **Compras e conservação:** `classic-piles.test.ts` passa; simulações conferem 108 cartas em cada passo.
6. **Finais:** efeitos de Bloqueio/Inversão/perda de turno presentes; comandos posteriores recusados; sem placar no estado.
7. **Privacidade:** a verificação por passo em `simulation.ts` (projeções e eventos) continua passando; os novos eventos (`turnSkipped`, `directionChanged`) mantêm o formato público sem cartas ocultas.
8. **Rodada integrada:** as 56 simulações de 2–8 jogadores com sementes 1–8 continuam terminando com vencedor e sem perder cartas.

## Verificação executada

| Comando | Resultado |
| --- | --- |
| `rtk pnpm install --frozen-lockfile` | Exit 0 (`ok`). |
| `rtk pnpm test` | Exit 0. 10 arquivos, 123 testes passando (119 anteriores + 4 novos). |
| `rtk proxy pnpm typecheck` | Exit 0, sem erros de tipos. |
| `rtk pnpm --filter @tretta/rules exec vitest run classic-simulation` | Exit 0, 9 testes de simulação. |
| `rtk pnpm --filter @tretta/rules exec vitest run classic-finals classic-last-card` | Exit 0, 25 testes (11 de finais, 14 de última carta). |
| `git diff --check` | Exit 0. |

Durante a execução, uma expectativa nova de teste estava errada (com sentido anti-horário, o próximo assento após a Inversão final é `bia`, não `cai`); o teste foi corrigido — o motor já calculava `seatAt` corretamente. Nenhuma outra falha.

## Decisões e desvios

- O caminho terminal reaproveita `resolveEffects`, garantindo efeitos únicos e o mesmo formato de eventos; a função específica de compras terminais foi removida.
- O índice de vez terminal mudou de “vencedor” para “próximo assento após os efeitos”, escolha local documentada em `state.ts`; a projeção permanece com `currentPlayerId: null`, conforme o permitido pelo prompt.
- A mensagem de rejeição de denúncia sem janela foi ajustada para citar “compra voluntária ou descarte aceito”; o código (`NO_LAST_CARD_WINDOW`) e as demais mensagens não mudaram.
- Nenhuma decisão de produto nova; interpretações aprovadas na validação foram aplicadas como estão. Nenhum commit foi criado.

## Limitações e pendências

- Verificação apenas em macOS (darwin), Node 22.23.1 e pnpm 11.14.0, com dependências e store locais; sem clone limpo em outra máquina.
- Nenhum commit ou patch de transferência foi criado; as alterações estão no working tree deste clone.
- Seguem fora desta tarefa: interface, animações, salas, sockets, bots, chat, placar e deploy. Pendências de produto de T004/T005 permanecem as do plano.

## Próximo passo

Revalidar T002 pelo orquestrador com base neste report, em [T002.validation.md](T002.validation.md) e no working tree. Com o aceite, preparar T003. Nenhum commit foi solicitado.
