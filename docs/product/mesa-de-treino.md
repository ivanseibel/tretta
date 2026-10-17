# Mesa de treino

Atualizado em 17/10/2026. **Escopo aprovado pelo usuário**, que respondeu: “Está aprovado. Pode preparar o prompt para a primeira execução.” A implementação seguirá incrementos manuais, com validação do orquestrador entre entregas.

## Objetivo autorizado

Permitir que uma pessoa conheça as regras jogando sozinha contra bots. Esta é a prioridade escolhida após T010, acima da ordem sugerida no [backlog](backlog.md). O [Clássico aprovado](first-version.md) continua sendo a referência das regras.

## Escopo aprovado

- Uma pessoa e três bots fixos, com identificação própria de bot. A mesa de treino recusa a entrada de outras pessoas.
- Entrada “Treinar sozinho” na página inicial, usando apelido e avatar. A pessoa inicia cada rodada; os bots estão sempre prontos.
- Mesmas regras e estratégia simples atuais: bots usam a própria mão e informações públicas, preferem carta colorida válida, escolhem a cor mais presente, avisam última carta e não denunciam.
- Resultado identifica o vencedor pelo próprio nome. Placar da sessão contabiliza vitórias da pessoa e dos bots; os bots permanecem disponíveis na próxima rodada. A pessoa pode jogar outra rodada ou sair.
- Reload/desconexão permite recuperar a mesma identidade e mão enquanto a sala existir. Sem a pessoa conectada, bots param e vale a retenção atual de 15 minutos; retorno segue a retomada explícita da rodada pausada já existente.
- Usa o servidor atual e mantém custo zero. Dificuldade configurável, dicas de jogada, tutorial novo e modo offline ficam fora deste recorte.

O aceite cobre este recorte. Detalhes locais de implementação cabem ao executor; mudanças de regras ou experiência que ampliem o recorte voltam ao orquestrador.

## Inspeção para o planejamento

O código foi lido no working tree completo em 17/10/2026; nenhuma implementação ou suíte foi executada nesta retomada.

| Ponto existente | Implicação para o treino |
| --- | --- |
| `apps/server/src/bot.ts`: `decideBotCommand` recebe `PlayerView` | A política simples já pode decidir sem acesso às mãos adversárias |
| `apps/server/src/rooms.ts`: `startRound` seleciona participantes conectados e prontos; limpa `autoControlled` | Adversário permanente precisa participar desde a abertura e nas rodadas seguintes, independentemente de conexão humana |
| `finishRound` remove substitutos ausentes; `settleIfFinished` não soma suas vitórias | Identidade de bot de treino precisa ser distinta da substituição temporária de uma pessoa |
| `connectedCount`, `ensureHost`, retenção e `botTarget` dependem de presença | Bot não pode simular pessoa conectada, assumir anfitrião ou manter a sala ativa sozinho |
| `joinRoom` recupera humanos por credencial e aceita novos participantes | Preservar recuperação do dono; recusar nova pessoa e impedir assumir bot, inclusive por comandos diretos |
| `snapshotOf`, resumo de rodada e efeitos de vitória expõem substituição | Modo e identidade precisam chegar de forma coerente à mesa, resultado e placar, mantendo mãos privadas |
| Home, `Lobby`, `GameTable`, `Results`, `PausePanel` e saída usam a semântica de sala humana | Entrada e ações do treino precisam corresponder ao modo; bot não deve aparecer como desconectado ou substituto de alguém |

As escolhas internas de tipos, eventos e armazenamento cabem ao executor dentro do contrato futuro. O motor Clássico e o fluxo de sala com amigos devem preservar o comportamento aceito. Chat e humor existentes não exigem conversação nem provocações automáticas dos bots.

## Continuidade

Execução manual, preferência `gpt-6-luna` com reasoning `max`. [T011A — protocolo e servidor](../work/T011A.md) [aceita](../work/reports/T011A.validation.md); [T011B — interface e fluxo completo](../work/T011B.md) [aceita após ajustes](../work/reports/T011B.final-validation.md). **Mesa de treino implementada e aceita localmente**, sem execução de implementação pendente. [Publicação manual](../work/T011-publication.md) autorizada separadamente pelo usuário (“Vamos”, 17/10/2026), preparada e ainda não executada. Nenhum executor foi acionado pelo orquestrador; treino ainda não publicado.

Preservar o working tree, reports e evidências aceitas. Verificações que geram métricas/capturas devem usar cópia isolada e artefatos próprios. Publicação, commit e push seguem separados da implementação, conforme [estado do trabalho](../work/status.md).
