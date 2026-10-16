# T004 — Continuidade do bot após nova entrada

## Papel e objetivo

Você é o executor do Tretta, em execução manual. Corrija a pendência encontrada na revalidação: uma pessoa nova entrar para aguardar a próxima rodada invalida o timer do substituto sem agendar outro, deixando a rodada parada. Preserve as cinco correções anteriores. T001/T002/T003 estão aceitas; T004 aguarda este ajuste e nova validação.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/product/first-version.md`, `docs/work/status.md`, `docs/work/T004.md`, `docs/work/reports/T004-adjustments.md` e **`docs/work/reports/T004.revalidation.md`**. A revalidação contém o cenário com controle, causa e evidências. Há uma reprodução independente em `docs/work/reports/assets/T004-validation/revalidate.mjs`.

O working tree contém implementação, testes e documentos de tarefas anteriores sem commit; preserve-os. Use RTK e as skills aplicáveis. Nenhum commit foi solicitado. T005 não foi preparada e continua fora desta execução.

## Correção e critérios de aceite

O caminho de entrada nova, sem credencial, em `RoomStore.joinRoom` incrementa a versão e publica snapshot, mas não sincroniza o bot. Sua guarda de versão descarta o timer anterior e a vez fica parada. Corrigir a sincronização do agendamento após essa transição e revisar os demais caminhos que mudam versão durante uma rodada ativa, com mudanças limitadas ao necessário.

Manter geração/versão e demais verificações contra callback obsoleto. A nova entrada deve gerar um agendamento válido quando o bot continuar autorizado a agir; replays de entrada devolvem o ack original sem repetir associação, mutação ou agendamento. A pessoa nova continua aguardando a próxima rodada, sem mão/controlador nesta. Nenhuma mudança de regra de produto.

Regressões determinísticas devem demonstrar:

1. Ana/Bia jogando; Ana sai; bot de Ana fica na vez e agendado; Cai entra sem credencial antes do timer. A entrada não altera o motor. Após o prazo válido, ocorre exatamente uma ação do bot, com cartas conservadas, vez correta e nenhuma paralisação.
2. Callback anterior à entrada pode ser entregue pelo harness mesmo após cancelamento; não altera versão/motor/eventos nem destrói o timer atual. O agendamento válido age no prazo.
3. Repetir a intenção de entrada de Cai preserva o ack original, não duplica associação, participante, snapshot/evento ou ação automática e não reinicia repetidamente o agendamento.
4. Entrada nova entre a compra do bot e sua ação na fase `after-draw` mantém continuidade: jogar apenas a recém-comprada quando válida ou passar quando não for, sem uma segunda compra no turno. A pessoa que aguarda continua sem controlar a mão.
5. Pausas/retenção e ausência de pessoas continuam bloqueando bots; retorno humano, saída, fim de rodada e expiração mantêm a invalidação correta. Regressões anteriores de callbacks e replays continuam passando.

## Verificação

Adicionar testes que falhem no estado atual e passem após a correção, registrando antes/depois. Preservar scripts, reports e evidências do orquestrador; usá-los como referência histórica, sem alterar para esconder o achado. A reprodução suplementar imprime observações e contém controle/placar; os novos testes devem exigir continuidade do bot no caso de entrada.

Executar instalação congelada, build, suíte completa, tipos, E2E e `git diff --check` sequencialmente. Tipos após build: `rtk proxy pnpm -r --if-present typecheck`. Registrar falhas/limitações honestamente. Reexecutar as reproduções originais e suplementares para conferir os comportamentos anteriores preservados. Publicação/carga/aparelho físico permanecem em T007.

## Retorno

Salvar `docs/work/reports/T004-adjustments-2.md` conforme o protocolo, com causa/correção, arquivos, regressões antes/depois, verificações e limitações. Atualizar `docs/work/status.md` para “T004 aguardando revalidação final do orquestrador”, preservando aceites e modo manual. Preservar os documentos do orquestrador e reports anteriores.

Parar e entregar o report para revalidação. Nenhum commit solicitado; T005 não deve ser iniciada.
