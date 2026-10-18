# Backlog após o primeiro teste em família

Atualizado em 18/10/2026. Fonte: feedback do usuário após jogar no celular com a irmã, escopo aprovado e ideias adiadas na concepção. Prioridades abaixo são propostas do orquestrador; T008 foi implementada/publicada e a investigação T009 foi solicitada e aceita; T010 foi implementada, publicada e aceita; teste humano da recuperação no celular ainda pendente. Ideias futuras não alteram as regras vigentes do Clássico.

## Prioridade atual — provocações pelo avatar e reações

Escolhida pelo usuário em 18/10/2026, acima dos candidatos históricos abaixo. **[Escopo confirmado](provocacoes-e-reacoes.md)** após entrevista `grill-with-docs` Q1–Q19. [T014A](../work/T014A.md) aceita. [T014B](../work/T014B.md) e ajustes executados e [aceitos localmente](../work/reports/T014B.final-validation.md) em 18/10/2026; nenhum ajuste de implementação pendente. Próxima etapa: publicação manual mediante autorização específica; T013 segue publicada. Nenhum executor acionado automaticamente.

## Publicada e aceita — ordem das jogadas (T012)

Após o aceite público de T011, o usuário priorizou compreender o percurso da rodada e sua inversão, especialmente com mais de duas pessoas. **Mesa em circuito aprovada em 17/10/2026**, conforme [escopo](ordem-das-jogadas.md). [T012](../work/T012.md) executada manualmente e **aceita localmente após ajustes**, conforme [validação final](../work/reports/T012.final-validation.md). [Publicação manual](../work/T012-publication.md) executada e [aceita pelo orquestrador](../work/reports/T012-publication.validation.md) em 17/10/2026; nenhuma execução de T012 pendente. A próxima melhoria ainda precisa ser escolhida com o usuário. Essa escolha prevalece sobre a ordem dos candidatos abaixo; preserva as regras atuais e inclui treino e mesa pública.

## Publicada e aceita — T008

| Item pedido | Resultado esperado |
| --- | --- |
| Mesa aconchegante | Mais personalidade com feltro, textura leve, profundidade das cartas e destaque claro da vez; direção escolhida pelo usuário |
| Provocações em tablet | Cada label acima de seu seletor; campos alinhados e utilizáveis do celular ao desktop |
| Chat recente primeiro | Mensagens novas no topo; histórico antigo acessível sem perder posição de leitura |
| Som de própria vez | Ligado por padrão, opção própria persistida, respeitando o silêncio geral; sem tocar repetidamente durante a mesma vez |

Contrato: [T008](../work/T008.md). [Validação local](../work/reports/T008.validation.md): 348 testes passando e 31 E2E. [Publicação aceita](../work/reports/T008-publication.validation.md) em 16/10/2026: refinamentos T008 aceitos naquela revisão; produção agora inclui a recuperação T010, com Render preservado. Som ainda sem audição humana da nova revisão.

## Prioridade de confiabilidade — antes de ampliar funcionalidades

| Achado | Evidência e próximo objetivo |
| --- | --- |
| Reentrada após atualizar a página | Smoke público do executor observou `ALREADY_CONNECTED` temporário e retorno após esperar/tentar novamente; usuário confirmou o sintoma especialmente no celular em 16/10/2026. [Diagnóstico T009 aceito](../work/reports/T009-investigation.validation.md): conexão antiga meio aberta continua autorizada por dezenas de segundos, mas o cliente desiste em ~1,2 s e mostra formulário que pode substituir a credencial. Mecanismo local comprovado; duração/frequência em aparelho físico não medidas. **Resolvido e publicado em T010**, com [aceite público](../work/reports/T010-publication.validation.md): espera limitada, confirmação segura e retomada da mesma identidade, mantendo a proteção de duas abas. Smoke público passou; falta retorno do teste humano no celular |
| Criar/entrar antes da conexão inicial | Primeiro clique pode exibir “Sem conexão com o servidor”; nova tentativa funcionou no smoke. Investigar prontidão e feedback de espera sem prometer conexão imediata ou atribuir a causa ao Render Free |

## Próximos candidatos — prioridade proposta

**Escolha posterior do usuário em 17/10/2026:** implementar a mesa de treino. Essa escolha prevalece sobre a ordem sugerida abaixo. [Escopo aprovado](mesa-de-treino.md); [T011A aceita](../work/reports/T011A.validation.md) e [T011B aceita após ajustes](../work/reports/T011B.final-validation.md). Implementação e [publicação aceitas](../work/reports/T011-publication.validation.md) em 17/10/2026; sem execução pendente. Os demais candidatos permanecem no backlog.

| Ordem | Ideia | Valor para a família | Limite / decisão antes de executar |
| --- | --- | --- | --- |
| 1 | Ajuda rápida na mesa | Consultar o significado das cartas, última carta e compra/passe sem interromper a partida | Conteúdo derivado das regras atuais; começar por guia curto contextual, sem tutorial obrigatório |
| 2 | Chat acessível durante a jogada | Ler e responder com um toque, especialmente no celular, sem procurar o painel no fim da página | Validar painel recolhível/aba e indicador de novas mensagens; manter a mão e o descarte utilizáveis |
| 3 | Convite pelo compartilhamento nativo | Enviar o link pelo menu do celular, mantendo Copiar link como alternativa | Nenhuma permissão de contatos e nenhum envio automático |
| 4 | Resumo divertido da rodada | Criar histórias da partida: quem mais comprou, quem distribuiu penalidades, viradas e títulos humorísticos | Usar somente dados públicos; definir métricas e como tratar substitutos, sem revelar mãos |
| 5 | Pequena noite de partidas | Dar continuidade ao encontro: melhor de três/cinco ou meta de vitórias | Escolher formato e definir encerramento/empate; a regra atual continua sendo rodada independente |
| 6 | Mesa de treino | Uma pessoa conhecer as regras jogando contra três bots fixos desde o início | Concluída em T011A/T011B, conforme [escopo](mesa-de-treino.md); [publicada e aceita](../work/reports/T011-publication.validation.md) |

Eu começaria por ajuda rápida, chat acessível e resumo divertido: reduzem dúvidas e aumentam a conversa que já faz o jogo funcionar. Não exigem contas de usuário ou serviços pagos por definição; qualquer mudança de infraestrutura ainda precisa ser avaliada.

## Pequeno achado durante a validação

O feed vazio usa a frase “A rodada ainda não começou” mesmo logo após iniciar uma rodada sem jogadas. É um texto preexistente; um próximo ajuste pode trocar por “Ainda não há jogadas registradas” sem mudar regras. Não foi incluído automaticamente em T008.

## Ideias que já estavam adiadas

| Ideia | Situação / condição |
| --- | --- |
| Modo Caos | Cartas especiais, troca de mãos, ataques e defesas ainda são propostas históricas; precisam de regras e balanceamento aprovados antes de entrar no motor |
| Rivalidades e títulos humorísticos | Previstos para depois no escopo; começar com resumo da sessão antes de histórico permanente |
| Pontuação por cartas e campeonatos | Fora da primeira versão; definir formato antes de implementar |
| Bots competitivos | Estratégia mais elaborada que o substituto simples atual; não significa inteligência que enxergue mãos adversárias |
| Retomar a identidade em outro aparelho | Precisa de fluxo seguro de transferência; o link da sala sozinho não pode entregar a mão de alguém |
| Salas resistentes a reinício | Requer persistência e retomada de timers/identidades; avaliar compatibilidade com custo zero, sem prometer disponibilidade contínua |
| Voz integrada | Já era ideia futura; por enquanto chamadas externas funcionam. Avaliar custo, rede e microfone antes de escolher solução |
| Avatares personalizados e temas | Avatares atuais são prontos; fotos, contas e desbloqueáveis ficaram para depois |

Fontes de escopo: [primeira versão](first-version.md). A [concepção](../reference/conception.md) dá contexto histórico, sem autorizar implementação de suas propostas.

## Critério de prioridade

Priorizar melhorias observadas numa partida real, facilidade de entrar/jogar e humor entre pessoas. Validar uma mudança por vez com o grupo. Cadastro, ranking global, monetização, loja e infraestrutura paga não são necessários para a fase familiar atual.
