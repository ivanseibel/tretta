# Plano de implementação

Plano inicial, organizado pelo orquestrador a partir do escopo aprovado. As tarefas posteriores a T001 serão detalhadas conforme os resultados anteriores. Cada execução retorna report; o orquestrador valida os critérios antes de avançar.

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

Proposta operacional para T001: pnpm workspaces e Vitest. O executor pode definir versões e configuração compatíveis, documentando a escolha. Frontend e transporte serão acrescentados quando suas tarefas começarem, evitando estrutura vazia.

## Verificação

Cada tarefa inclui verificação do comportamento que entrega. O motor recebe testes determinísticos, com aleatoriedade e relógio controláveis quando necessários. A integração verifica comandos inválidos/duplicados e isolamento de informação. O fluxo jogável recebe testes com clientes independentes e validação mobile/desktop. Evidências indisponíveis devem aparecer como pendentes no report.

## Questões para as tarefas seguintes

Antes de T002, explicitar quando substitutos podem denunciar última carta e como resolver uma denúncia pendente quando outro jogador encerra a rodada. Antes de T004, fechar se a troca de anfitrião é revertida no retorno e como encerrar a rodada quando todos saírem voluntariamente. Antes de T005, definir se quem aguarda no lobby vê a mesa e pode provocar. São limites da especificação atual; não bloqueiam T001.
