# Plano de implementação

Plano inicial, organizado pelo orquestrador a partir do escopo aprovado. As tarefas posteriores a T001 serão detalhadas conforme os resultados anteriores. Cada execução retorna report; o orquestrador valida os critérios antes de avançar.

Modo atual, alterado pelo usuário em 16 de outubro de 2026: **acionamento manual de executores**. O orquestrador prepara prompts, valida reports e avança após aceite, sem novos despachos automáticos. Preferência de modelo `gpt-6-luna`, reasoning `max`, preservada. T008A–C foram entregues e aceitas após validação independente. Commit e push anteriores foram autorizados para a publicação já entregue. A hospedagem continua inteiramente gratuita; os refinamentos T008 estão publicados e aceitos em reports/T008-publication.validation.md.

Prioridade escolhida e escopo aprovado em 17/10/2026: **mesa de treino**, conforme [fonte de produto](../product/mesa-de-treino.md). [T011A — protocolo e servidor](T011A.md) [aceita](reports/T011A.validation.md); [T011B — experiência no navegador](T011B.md) [aceita após ajustes](reports/T011B.final-validation.md). T011 concluída localmente; [publicação manual](T011-publication.md) autorizada pelo usuário (“Vamos”) e preparada, ainda não executada. T010 permanece em produção; suas etapas abaixo são históricas.

## Incrementos de T011 — mesa de treino

| Incremento | Entrega | Estado |
| --- | --- | --- |
| [T011A](T011A.md) | Protocolo e servidor: uma pessoa + três bots, rodadas, placar, privacidade e recuperação, verificados por clientes locais | [Aceita em 17/10/2026](reports/T011A.validation.md): build/tipos, servidor 140 + 1 pulado, protocolo 12, web 109; fonte e históricos conferidos |
| [T011B](T011B.md) | Entrada “Treinar sozinho”, telas e fluxo completo responsivo, recuperação pelo navegador e regressões da sala humana | [Aceita em 17/10/2026](reports/T011B.final-validation.md): R1/B6 corrigido, web 131/131 e runner 7/7 independentes, build/tipos verdes; E2E do executor 7/7 inspecionados |
| [T011-publication](T011-publication.md) | Publicar servidor e frontend compatíveis, confirmar fonte/planos/IDs e smoke público de treino e sala humana | Autorizada e preparada; aguardando execução manual em janela sem partidas e report para validação |

T011A e T011B concluem a implementação local da mesa de treino. A publicação foi autorizada separadamente em 17/10/2026, após o aceite; o contrato delimita commit/push, sequência entre provedores, cuidado com salas em memória e recuperação se falhar. A tarefa preparada ainda não foi executada.

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
