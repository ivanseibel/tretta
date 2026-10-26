# Plano de implementação

Plano inicial, organizado pelo orquestrador a partir do escopo aprovado. As tarefas posteriores a T001 serão detalhadas conforme os resultados anteriores. Cada execução retorna report; o orquestrador valida os critérios antes de avançar.

## Feature atual — mesa de jogo, reações e telas

**[Escopo aprovado](../product/mesa-e-reacoes.md) em 25/10/2026**, após entrevista `grill-with-docs` em quatro rodadas. O protótipo do usuário (`docs/work/t016-prototype/`) vira a base de um redesign de **todas as telas**, com trilho ([ADR 0002](../adr/0002-trilho-de-mesa-substitui-a-faixa.md)), 12 reações individuais ([ADR 0003](../adr/0003-reacoes-substituem-provocacoes.md)) e remoção completa das provocações com alvo. A análise técnica do protótipo está em [T017](T017.md).

| Etapa | Entrega | Estado |
| --- | --- | --- |
| [T018](T018.md) | Extensão do protótipo: home, preparação, espera, mesa, resultado, erros; 12 reações; Sala; 2–8 assentos | Aprovado em 26/10/2026; A2 aplicado |
| T019A | Protocolo/servidor: 12 reações, provocações preservadas | Aceito em 26/10/2026: protocolo 14 e servidor 149+1 testes verdes |
| T019B | Base web: tokens, fontes, casca, catálogo de 12 reações | Aceito em 26/10/2026: typecheck, 180 testes e build verdes; preview |
| T019C | Mesa: trilho, 2–8 assentos, centro, mão, ações | Entregue em 26/10/2026: typecheck/build/188 testes web; e2e transitórios para D/F |
| T019F-prep | Harness de verificação e baseline visual | Aceito em 26/10/2026: harness, baseline e smoke prontos |
| T019D | Gaveta/Sala/preferências/reações e remoção das provocações da UI | Aceito em 26/10/2026: 181 testes web e smoke em 412/360 |
| T019D2 | Limpeza da plumbing de taunts no web | Aceito em 26/10/2026: provider/sons/prefs limpos; 169 testes |
| T019E1 | Home no visual novo | Aceito em 26/10/2026: typecheck/build/169 testes e harness |
| T019E2 | Preparação, espera, resultado, erros | Aceito em 26/10/2026: 181 testes web, 23 capturas |
| T019A2 | Limpeza final de protocolo/servidor de provocações | Aceito em 26/10/2026: protocolo 13, servidor 137+1, grep limpo |
| T019F | Integração, e2e, matriz completa e aceite local | Concluída tecnicamente em 26/10/2026: e2e 42/42, matriz 108/108, build/tipos/testes verdes; aguardando teste no iPhone |
| Publicação | Publicar web + servidor juntos | Só com autorização específica |

Execução: Orca como orquestrador e **opencode** como executor. O plano de ondas, donos de arquivo e contratos está em [T019](T019.md): **2 agentes em paralelo por onda**, com validação entre ondas. T014 permanece a versão pública até a publicação desta feature; sem commit/push/deploy sem autorização.

## Feature anterior — acessibilidade visual da mesa (T016, substituída)

Escopo e protótipo de 25/10/2026 preservados como histórico. A faixa linear do ADR 0001 e o plano de port T017 foram substituídos por [mesa-e-reacoes](../product/mesa-e-reacoes.md), [ADR 0002](../adr/0002-trilho-de-mesa-substitui-a-faixa.md) e [T018](T018.md).

## Feature anterior — provocações pelo avatar e reações

Prioridade escolhida e **[escopo confirmado](../product/provocacoes-e-reacoes.md) em 18/10/2026**, após entrevista `grill-with-docs` Q1–Q19. O usuário confirmou o entendimento conjunto e pediu início pelos executores manuais. As menções históricas abaixo a uma próxima melhoria por escolher antecedem esta prioridade. T014 está publicada e aceita; T013 é o rollback do frontend.

| Incremento | Entrega | Estado |
| --- | --- | --- |
| [T014A](T014A.md) | Protocolo e servidor: reações sem alvo, limites/metadados de tempo, autoridade/deduplicação e disponibilidade dos alvos | [Aceita A1–A8](reports/T014A.validation.md) em 18/10/2026; build/tipos e 201 testes independentes passando; históricos preservados |
| [T014B](T014B.md) | Experiência no navegador: avatares, reações, resposta, preferências, painel alternativo e regressões de uso | [Aceita localmente B1–B10/U1–U3](reports/T014B.final-validation.md) em 18/10/2026; build/tipos, 180 unitários e 46 casos reunidos verdes; nenhum ajuste pendente |
| [Ajustes T014B](T014B-adjustments.md) | Corrigir R1–R3 e incorporar regressões com tempo/acks controlados | Executados; R1/R3 aceitos antes e R2 encerrado no [aceite final](reports/T014B.final-validation.md). Report preservado |
| [Complemento R2](T014B-adjustments-2.md) | Preservar metadados válidos por categoria/alvo sem retroceder o relógio nem renovar prazos | Executado; S1 aceito antes e S2 encerrado no [aceite final](reports/T014B.final-validation.md). Report preservado |
| [Relógio e empates](T014B-adjustments-3.md) | Corrigir estimativa monotônica e replay de fatos superados no mesmo timestamp | Executado e [aceito U1–U3](reports/T014B.final-validation.md) em 18/10/2026; report e evidências preservados |
| [T014-publication](T014-publication.md) | Publicar protocolo/servidor e experiência T014 compatíveis, com commit/push, staged promovido e smoke próprio | [Aceita P1–P5](reports/T014-publication.validation.md) em 18/10/2026: commit `90aff00`, Render Live `dep-dbahinbm8hqs73be533g`, frontend `dpl_613qfXj17XFdFctcg5HjsEimhfpz`; desvio de isolamento registrado e núcleo repetido em browser dedicado |

T014A e T014B concluem o recorte, **publicado e aceito em 18/10/2026** pelo [aceite público](reports/T014-publication.validation.md). Fonte/manifestos, Git/provedores/alias/bundle e históricos conferidos independentemente. Smoke do executor inspecionado; sem novo gameplay ou alteração de produção pelo orquestrador. Nenhum ajuste/execução/publicação pendente; próximo passo é uso humano no celular/som e feedback. T013 é o rollback do frontend; backend anterior `3ae459e` exige cuidado com auto-deploy em eventual restauração.

Execução manual, preferência `gpt-6-luna`, reasoning `max`; sem despacho automático. Notificação e isolamento do navegador seguem o protocolo atual. Documentos/harness posteriores ao commit permanecem locais; nenhum segundo push documental autorizado.

## T013 — texto do descarte publicado e aceito

[Contrato T013](T013.md) executado manualmente e **aceito pelo orquestrador em 17/10/2026**, conforme [validação C1–C3](reports/T013.validation.md). Correção mínima em `GameTable.tsx`, sem CSS; fontes e históricos conferidos, capturas e medições antes/depois inspecionadas. [Report original](reports/T013.md) preservado. Nenhum ajuste de implementação pendente. A [T013-publication](T013-publication.md) foi **executada manualmente em 17/10/2026** e foi **aceita pelo orquestrador** em [reports/T013-publication.validation.md](reports/T013-publication.validation.md): staged production `dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k` promovido o mesmo build, `tretta.vercel.app` servindo T013, smoke próprio de “Bloqueio”/“Inversão” no descarte, sem commit/push e com Render preservado. Report e evidências em [reports/T013-publication.md](reports/T013-publication.md) e `reports/assets/T013-public/`. P1–P4 atendidos, sem execução de T013 pendente; próxima melhoria depende de escolha do usuário.

## Publicação T012 — concluída e aceita

O usuário autorizou com **“Vamos”** em 17/10/2026 e a [T012-publication](T012-publication.md) foi **executada manualmente em 17/10/2026** (somente frontend; sem commit/push/restart Render): staged production `dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk` promovido o mesmo build e `tretta.vercel.app` serve T012; smoke público de circuito/Inversão/recuperação/treino em salas próprias. 159/159 fontes conferidas; upload 166 arquivos/1.404.378 bytes, digest `c0b0fc72…`; backend preservado Live na revisão `3ae459e`. Report em [reports/T012-publication.md](reports/T012-publication.md). **Aceita pelo orquestrador** em [reports/T012-publication.validation.md](reports/T012-publication.validation.md): fontes/manifesto/UIDs remotos, alias/build, HTTP e backend conferidos; smoke inspecionado; históricos preservados. Sem execução pendente; rollback de frontend pelo T011 `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP`. Preferência `gpt-6-luna`, reasoning `max`, sem despacho automático.

## T012 — ordem das jogadas aceita localmente

[Escopo aprovado](../product/ordem-das-jogadas.md) de mesa em circuito implementado por executor manual e **aceito após ajustes** em 17/10/2026, conforme [validação final](reports/T012.final-validation.md). [Contrato T012](T012.md), [report original](reports/T012.md), [revisão inicial](reports/T012.validation.md), [prompt A1–A3](T012-adjustments.md) e [report dos ajustes](reports/T012-adjustments.md) preservados como histórico.

A1 resolveu leitura/conteúdo dos assentos e consulta por toque/teclado; A2 descreve o percurso no sentido vigente; A3 demonstrou uma corrida anterior do teste na tela de resultados e corrigiu sua sincronização. Revisão independente: build/tipos, 145 unitários e 14 E2E passando; 159 fontes/configurações conferidas e históricos intactos. Sem implementação pendente. **Publicação T012 executada em 17/10/2026** (ver acima), mantendo execução manual e custo zero, **aceita pelo orquestrador** em [reports/T012-publication.validation.md](reports/T012-publication.validation.md). A próxima melhoria ainda precisa ser escolhida com o usuário. Nenhum commit/push foi feito. T011 permanece disponível como rollback do frontend.

## Modo de execução e trabalho anterior

Modo atual, alterado pelo usuário em 16 de outubro de 2026: **acionamento manual de executores**. O orquestrador prepara prompts, valida reports e avança após aceite, sem novos despachos automáticos. Preferência de modelo `gpt-6-luna`, reasoning `max`, preservada. T008A–C foram entregues e aceitas após validação independente. Commit e push anteriores foram autorizados para a publicação já entregue. A hospedagem continua inteiramente gratuita; os refinamentos T008 estão publicados e aceitos em reports/T008-publication.validation.md.

Prioridade escolhida e escopo aprovado em 17/10/2026: **mesa de treino**, conforme [fonte de produto](../product/mesa-de-treino.md). [T011A — protocolo e servidor](T011A.md) [aceita](reports/T011A.validation.md); [T011B — experiência no navegador](T011B.md) [aceita após ajustes](reports/T011B.final-validation.md). T011 concluída localmente; [publicação manual](T011-publication.md) executada em 17/10/2026 pelo executor manual e registrada em [reports/T011-publication.md](reports/T011-publication.md), **aceita pelo orquestrador** em [reports/T011-publication.validation.md](reports/T011-publication.validation.md). Naquele aceite, `tretta.vercel.app` servia T011 e o Render ficou Live na revisão `3ae459e`; T010 era o rollback do frontend. Produção atual T012 está registrada acima; as etapas abaixo são históricas.

## Incrementos de T011 — mesa de treino

| Incremento | Entrega | Estado |
| --- | --- | --- |
| [T011A](T011A.md) | Protocolo e servidor: uma pessoa + três bots, rodadas, placar, privacidade e recuperação, verificados por clientes locais | [Aceita em 17/10/2026](reports/T011A.validation.md): build/tipos, servidor 140 + 1 pulado, protocolo 12, web 109; fonte e históricos conferidos |
| [T011B](T011B.md) | Entrada “Treinar sozinho”, telas e fluxo completo responsivo, recuperação pelo navegador e regressões da sala humana | [Aceita em 17/10/2026](reports/T011B.final-validation.md): R1/B6 corrigido, web 131/131 e runner 7/7 independentes, build/tipos verdes; E2E do executor 7/7 inspecionados |
| [T011-publication](T011-publication.md) | Publicar servidor e frontend compatíveis, confirmar fonte/planos/IDs e smoke público de treino e sala humana | [Aceita em 17/10/2026](reports/T011-publication.validation.md): fonte/manifesto remoto, Render Live, Vercel alias e planos conferidos; protocolo/smoke inspecionados, históricos intactos |

T011A e T011B concluem a implementação local da mesa de treino. A publicação foi autorizada separadamente em 17/10/2026, após o aceite; o contrato delimita commit/push, sequência entre provedores, cuidado com salas em memória e recuperação se falhar. A tarefa foi executada e aceita em 17/10/2026. T011 concluída publicamente; sem execução pendente. Teste humano no celular continua desejável; próximos trabalhos serão delimitados manualmente. Documentos atuais permanecem locais, sem segundo push.

## Sequência inicial — histórico

| Tarefa | Entrega | Critério de conclusão |
| --- | --- | --- |
| T001 | Base TypeScript e baralho Clássico | Instalação reproduzível, verificações locais e testes do baralho e distribuição |
| T002 | Motor Clássico completo | Rodada simulada até o vencedor; testes de turnos, efeitos, última carta, reembaralhamento e projeções privadas |
| T003 | Sala e partida jogável | Dois navegadores criam/entram por convite, preparam e concluem rodada; contratos validam intenções e deduplicam comandos |
| T004 | Recuperação e substitutos | Reconexão, atualização da página, transferência de anfitrião, pausas, retenção e substituição conforme escopo |
| T005 | Chat e humor | Chat, limites, provocações e variações automáticas sincronizadas; controles individuais respeitados |
| T006 | Interface e acessibilidade | Mesa responsiva, cartas distinguíveis sem depender da cor, teclado, foco, movimento reduzido e resultados |
| T007 | Validação e publicação | Mesa de oito pessoas, alvo de dez salas, segurança das mãos, fluxo completo e HTTPS; hospedagem contratada somente após aprovação do custo |

## Organização técnica

Base aprovada: TypeScript, React/Next.js, Node.js, Socket.IO e motor independente. O servidor guarda o estado autoritativo em memória; o cliente recebe uma projeção por jogador. Uma instância atende a escala inicial.

Base entregue e aceita em T001: pnpm workspaces e Vitest, com versões fixadas no projeto. O motor completo de [T002](T002.md), a sala/partida jogável de [T003](T003.md) e a recuperação/substitutos de [T004](T004.md) estão aceitos. Aceite final de T004 em [reports/T004.final-validation.md](reports/T004.final-validation.md), de 15 de outubro de 2026. T003 acrescentou protocolo validado, servidor Socket.IO e frontend Next.js; os pacotes são consumidos por builds `dist`.

## Incrementos de T005

T005 foi executada em três incrementos, cada um com report e validação antes do seguinte. Os três estão aceitos. O escopo de chat e humor permanece integralmente obrigatório; aceitar um incremento não conclui T005 inteira.

| Incremento | Entrega | Estado |
| --- | --- | --- |
| [T005A](T005A.md) | Chat da sala, limites, histórico/recuperação, silêncio local de mensagens e mesa pública para quem aguarda | Aceita após ajustes; [aceite final](reports/T005A.final-validation.md), 244 testes passando (mais um pulado) e 13 E2E |
| [T005B](T005B.md) | Quatro provocações, alvo, visibilidade compartilhada e limites por emissor/alvo, incluindo quem aguarda | Aceita após ajustes; [aceite final](reports/T005B.final-validation.md), 267 testes passando (mais um pulado), 14 E2E e runner 4/4 |
| [T005C](T005C.md) | Duas variações sincronizadas por efeito automático, fila, sons e preferências de animação/ocultação | Aceita após ajustes; [aceite final](reports/T005C.final-validation.md), 329 testes passando (mais um pulado), 22 E2E e suplementos independentes |

## Etapa atual

Diretriz atual do usuário: **hospedagem inteiramente gratuita para uso familiar como hobby**, registrada no [escopo](../product/first-version.md). A opção paga Railway deixa de ser a proposta atual. A preparação documental de Vercel Hobby para a interface e Render Free para o servidor foi revisada em [deployment-free.md](deployment-free.md), sem refatoração do motor ou banco adicional. Commit e push desta versão foram pedidos e realizados em 16 de outubro. A publicação foi validada no workspace **Seibel — Hobby** da Vercel e no workspace Hobby sem cartão do Render; ver [aceite público](reports/T007-public-validation.md). Usar Render sem método de pagamento cadastrado para evitar cobrança de excedentes; não alterar faturamento de conta existente automaticamente. Cotas, suspensão e possíveis perdas de salas foram documentadas.

[T006 — Interface e acessibilidade](T006.md) aceita; [validação independente](reports/T006.final-validation.md): 330 testes passando (mais um pulado), 27 E2E e diff-check. [T007 — Validação e preparação de publicação](T007.md) com **provas locais aceitas**; [aceite local](reports/T007.final-validation.md): 335 testes passando (mais um pulado), 28 E2E, smoke compilado e reexecução independente dos cenários novos. T007 tem publicação gratuita HTTPS/WSS aceita em [reports/T007-public-validation.md](reports/T007-public-validation.md): site Vercel e servidor Render no ar, rodada completa por dois clientes WSS e fluxo pelo navegador confirmados. O usuário confirmou uso real em celular com a irmã na versão pública anterior; T008 foi validada em navegador local e no site público, ainda sem teste em aparelho físico. Não foi feita nova prova de capacidade em nuvem. O [runbook Railway](deployment.md) preserva apenas a alternativa paga histórica. Configuração e operação atuais em [deployment-free.md](deployment-free.md).

## Verificação

Cada tarefa inclui verificação do comportamento que entrega. O motor recebe testes determinísticos, com aleatoriedade e relógio controláveis quando necessários. A integração verifica comandos inválidos/duplicados e isolamento de informação. O fluxo jogável recebe testes com clientes independentes e validação mobile/desktop. Evidências indisponíveis devem aparecer como pendentes no report.

## Questões para as tarefas seguintes

As decisões necessárias para T002 foram aprovadas pelo usuário em 14 de outubro de 2026 e incorporadas ao escopo: substitutos não denunciam automaticamente; o fim da rodada encerra janelas de denúncia, respeitando a ordem de recebimento dos comandos.

A decisão necessária para T004 foi aprovada pelo usuário em 14 de outubro de 2026 e registrada no escopo: o retorno do anfitrião anterior não reverte a transferência; o anfitrião atual mantém o papel. O contrato manual está preparado em [T004.md](T004.md).

O caso de todos saírem voluntariamente segue a regra universal já aprovada em [first-version.md](../product/first-version.md): sem pessoas conectadas, rodada congelada e substitutos parados, sala retida por 15 minutos; primeiro retornante assume como anfitrião e encontra a rodada pausada. Sem retorno, a sala expira. Não há uma decisão nova de encerramento automático a tomar nesse caso.

Decisão para T005 aprovada pelo usuário em 15 de outubro de 2026 e incorporada ao escopo: quem aguarda a próxima rodada vê a mesa pública e pode enviar provocações, mantendo mãos adversárias privadas e sem controlar uma mão nesta rodada. Chat para toda a sala permanece aprovado. T005A entrega a mesa pública e o chat; a permissão de provocar será implementada em T005B.

## Após o MVP — T008

Feedback familiar e direção visual aprovados em 16/10/2026. [T008](T008.md) entrega refinamento da mesa, alinhamento de provocações, ordem do chat e aviso sonoro de vez. **Aceita localmente** em [T008.validation.md](reports/T008.validation.md): build, tipos, 348 testes passando (mais um pulado), 31/31 E2E e capturas inspecionadas. [Publicação manual concluída e aceita](reports/T008-publication.validation.md): domínio público no deployment `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey`, Render preservado, sem commit/push. Teste humano de som/celular continua desejável. Reentrada após reload é a próxima prioridade técnica proposta, com tarefa manual própria antes de executar. [Backlog](../product/backlog.md) registra candidatos futuros sem autorizar sua implementação.

## T009 — Investigação de reentrada

Investigação manual executada e [aceita pelo orquestrador](reports/T009-investigation.validation.md) em 16/10/2026. Reconhecimento tardio da conexão antiga, burst curto de recuperação e risco de substituir a credencial demonstrados localmente; A–F repetidos, sete asserções aprovadas. Aparelho físico e frequência continuam sem medição. Report original: [T009-investigation.md](reports/T009-investigation.md).

## T010 — Correção da recuperação

[Implementação T010](reports/T010.md) entregue; **requer ajustes** após [validação independente](reports/T010.validation.md) em 17/10/2026. [Próximo prompt manual](T010-adjustments.md) preparado, não executado. Restaurar retorno automático da mesma identidade/mão com espera visível, deadline de 60 s por ciclo, cancelamento e proteção contra callbacks antigos, mantendo a proteção de duas abas. Corrigir o acesso acidental ao formulário de nova identidade; testes determinísticos e queda abrupta de um jogador em servidor/navegador reais. Sem publicação nesta tarefa; report `reports/T010.md` para validação.

### Revalidação de T010 em 17/10/2026

Os três ajustes anteriores foram confirmados. [Revalidação](reports/T010.revalidation.md): 31 testes direcionados passam e um caso entre ciclos falha. [T010-adjustments-2](T010-adjustments-2.md) preparado, não executado: confirmar resultado incerto após esgotar o prazo e Tentar novamente, preservando deadline, contexto e identidade; finalizar restauração específica da métrica histórica. Publicação continua posterior ao aceite.

### Aceite local final de T010 em 17/10/2026

[T010 aceita após ajustes](reports/T010.final-validation.md): 137/137 na revalidação independente, 88 artefatos históricos iguais à base e prova integrada entre ciclos inspecionada. [Publicação manual](T010-publication.md) preparada, não executada, somente frontend. Servidor permanece no deploy existente e a produção ainda usa T008; aceite público depende do próximo report. As validações anteriores ficam como histórico dos achados corrigidos.

### Publicação de T010 aceita em 17/10/2026

[Aceite público](reports/T010-publication.validation.md): domínio no deployment `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj`, fonte/manifesto conferidos, recuperação e duas abas demonstradas no smoke público; Render preservado. T010 concluída, sem commit/push. Os registros de prompts preparados e validações com ajustes acima são históricos. Nenhuma execução pendente; próximo passo é feedback humano no celular. Próximas tarefas continuam manuais e delimitadas pelo backlog.
