# Plano de implementação

Plano inicial, organizado pelo orquestrador a partir do escopo aprovado. As tarefas posteriores a T001 serão detalhadas conforme os resultados anteriores. Cada execução retorna report; o orquestrador valida os critérios antes de avançar.

Modo atual, aprovado em 15 de outubro de 2026: execução automática por subagentes `gpt-6-luna`, reasoning `max`, com despacho e validação do orquestrador entre tarefas. Substitui o modo manual usado nas entregas anteriores. Em 16 de outubro o usuário autorizou commit e push desta versão no repositório existente. A hospedagem deve permanecer inteiramente gratuita; preservar os trabalhos existentes e conferir o estado remoto antes de publicar.

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

Diretriz atual do usuário: **hospedagem inteiramente gratuita para uso familiar como hobby**, registrada no [escopo](../product/first-version.md). A opção paga Railway deixa de ser a proposta atual. A preparação documental de Vercel Hobby para a interface e Render Free para o servidor foi revisada em [deployment-free.md](deployment-free.md), sem refatoração do motor ou banco adicional. Commit e push desta versão foram pedidos expressamente em 16 de outubro; a publicação depende da revisão disponível no remoto e dos acessos aos provedores. O usuário está criando a conta Render e deve escolher um workspace Hobby Vercel entre os disponíveis. Usar Render sem método de pagamento cadastrado para evitar cobrança de excedentes; não alterar faturamento de conta existente automaticamente. Cotas, suspensão e possíveis perdas de salas foram documentadas.

[T006 — Interface e acessibilidade](T006.md) aceita; [validação independente](reports/T006.final-validation.md): 330 testes passando (mais um pulado), 27 E2E e diff-check. [T007 — Validação e preparação de publicação](T007.md) com **provas locais aceitas**; [aceite local](reports/T007.final-validation.md): 335 testes passando (mais um pulado), 28 E2E, smoke compilado e reexecução independente dos cenários novos. T007 permanece parcial: publicação gratuita HTTPS/WSS e confirmação em aparelhos reais aguardam acesso autorizado e código disponível ao provedor. O [runbook Railway](deployment.md) preserva apenas a alternativa paga histórica; nenhum recurso foi contratado ou publicado.

## Verificação

Cada tarefa inclui verificação do comportamento que entrega. O motor recebe testes determinísticos, com aleatoriedade e relógio controláveis quando necessários. A integração verifica comandos inválidos/duplicados e isolamento de informação. O fluxo jogável recebe testes com clientes independentes e validação mobile/desktop. Evidências indisponíveis devem aparecer como pendentes no report.

## Questões para as tarefas seguintes

As decisões necessárias para T002 foram aprovadas pelo usuário em 14 de outubro de 2026 e incorporadas ao escopo: substitutos não denunciam automaticamente; o fim da rodada encerra janelas de denúncia, respeitando a ordem de recebimento dos comandos.

A decisão necessária para T004 foi aprovada pelo usuário em 14 de outubro de 2026 e registrada no escopo: o retorno do anfitrião anterior não reverte a transferência; o anfitrião atual mantém o papel. O contrato manual está preparado em [T004.md](T004.md).

O caso de todos saírem voluntariamente segue a regra universal já aprovada em [first-version.md](../product/first-version.md): sem pessoas conectadas, rodada congelada e substitutos parados, sala retida por 15 minutos; primeiro retornante assume como anfitrião e encontra a rodada pausada. Sem retorno, a sala expira. Não há uma decisão nova de encerramento automático a tomar nesse caso.

Decisão para T005 aprovada pelo usuário em 15 de outubro de 2026 e incorporada ao escopo: quem aguarda a próxima rodada vê a mesa pública e pode enviar provocações, mantendo mãos adversárias privadas e sem controlar uma mão nesta rodada. Chat para toda a sala permanece aprovado. T005A entrega a mesa pública e o chat; a permissão de provocar será implementada em T005B.
