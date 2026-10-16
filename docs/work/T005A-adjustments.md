# T005A — Recuperação completa e isolamento de respostas do chat

## Papel e objetivo

Você é o executor do Tretta em execução manual. Corrija os dois achados de T005A: lacunas inacessíveis após recuperar mais de uma página de chat e respostas assíncronas antigas aplicadas no vínculo atual. T001–T004 estão aceitas; T005A requer ajustes. O usuário leva o report ao orquestrador para revalidação.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo, status/plano, `docs/work/T005A.md`, `docs/work/reports/T005A.md` e **`docs/work/reports/T005A.validation.md`**. A validação contém causas, cursores e reproduções independentes. Script histórico em `docs/work/reports/assets/T005A-validation/reproduce-client.mjs`; ele executa o fonte do provider com hooks/transporte controlados e paginação do servidor real, sem montar React/DOM. Preserve esse artefato e acrescente regressões no nível do provider/interface real.

Preserve o working tree existente, documentos do orquestrador, reports e aceites. Nenhum commit solicitado. Use RTK, `writing-for-agents` para instruções e as skills aplicáveis; leia `apps/web/AGENTS.md` antes de editar Next. Decisão aprovada permanece: quem aguarda vê a mesa pública, mantém mãos privadas e poderá provocar em T005B. T005B/T005C continuam pendentes.

## 1. Recuperar intervalos ausentes e manter paginação acessível

Hoje o cliente conhece seq 1; perde seq 2–61; a página recente devolve 12–61. O merge mantém seq 1 e 12–61, mas o botão calcula `before: 1`, recebe vazio e esconde o botão. As dez mensagens 2–11 ficam inacessíveis apesar de preservadas no servidor.

Manter fronteiras/cursor e continuidade coerentes para recuperação, paginação antiga e chegada ao vivo. Recuperar todos os intervalos perdidos ou mantê-los explicitamente carregáveis por um caminho funcional da UI. Preservar mensagens já carregadas, histórico completo no servidor e ordem sem duplicatas. Uma resposta de página recente não pode invalidar indevidamente a fronteira de outra página em carregamento. Tamanho de página permanece limitado; não resolver aumentando arbitrariamente o limite ou removendo o histórico/cache antigo.

Regressões devem demonstrar:

- Cliente com mensagens já carregadas recebe mais de 50 mensagens durante desconexão; ao retornar, todas continuam recuperáveis, inclusive um intervalo entre cache antigo e página recente. Usar o cenário 1 + 60 do orquestrador e pelo menos uma recuperação de múltiplas páginas.
- Mensagens ao vivo durante consultas, respostas em ordem invertida e acionamento de “anteriores” durante recuperação não criam buracos/duplicatas nem fazem `hasMore` encerrar o intervalo errado.
- Entrada tardia/reload sem cache, retorno com cache e histórico menor que uma página continuam corretos; carregamento não depende de nova mensagem para destravar.

## 2. Vincular cada resposta ao contexto autorizado atual

`loadChatHistory` e `sendChat` capturam o código ao emitir, mas aplicam os acks incondicionalmente depois. O filtro de `server:chat` não protege os merges dessas respostas. A mensagem antiga pode aparecer em outra sala e ocupar um `seq` que pertence à sala nova.

Invalidar operações antigas quando o vínculo deixa de ser válido; conferir o contexto de sala/identidade/geração pertinente antes de qualquer efeito de uma resposta. Proteger mensagens e também flags de carregamento, paginação, erros e efeitos no rascunho. Um código de sala igual após saída/remoção e nova entrada não basta para considerar um pedido antigo atual. Recuperação e envios devem respeitar a autorização recuperada, além do transporte conectado. Implementação concreta fica a seu critério.

Regressões com callbacks controláveis devem demonstrar:

- Consulta em A pendente → sair → entrar em B → entregar resposta A. B mantém somente seus dados/flags. Repetir com ack de envio e com seq colidente entre salas; a mensagem legítima de B deve ser recebida normalmente.
- Limpeza por saída, remoção ou sala inexistente invalida o trabalho antigo. Resposta depois de sair/reentrar no mesmo código, especialmente como nova identidade, não modifica o contexto novo.
- Pedido atual de B ainda pendente não tem seu indicador de carregamento/erro/paginação alterado pelo término de A. Conclusão antiga não limpa o rascunho digitado no contexto novo.
- Retorno com ack de reentrada atrasado sincroniza o histórico após o vínculo autorizado; uma consulta prematura recusada não deixa o painel definitivamente vazio. Envios ficam bloqueados durante a falta de vínculo.
- Histórico e ack de envio atuais continuam mesclando com broadcasts sem duplicatas; replays do servidor mantêm acks originais, cota e emissão única.

## Verificação e limites

Acrescentar testes que falhem antes e passem depois. Preferir testes do provider/componente montados ou E2E com rede/relógio controlados para as corridas; um teste apenas da função de merge ou uma mesclagem feita manualmente pelo próprio teste não verifica a sincronização real. Evitar esperas longas ou ampliar limites de produção para montar o cenário.

Preservar projeção pública/privada, silêncio local, histórico autoritativo, Unicode/limites, ordenação e agendamentos de T004. Chat/leitura continuam sem mudar versão/motor nem adiar bot. A validação independente já confirmou o controle após compra; manter essa invariância. Nenhuma regra de produto nova e nenhum avanço a T005B/C.

Executar instalação congelada, build, suíte completa, tipos, E2E e diff-check sequencialmente; tipos após build: `rtk proxy pnpm -r --if-present typecheck`. Reexecutar a evidência histórica e explicar mudanças de interface que impeçam seu harness, sem alterá-lo para esconder os achados. Registrar falhas/limitações honestamente.

## Retorno

Salvar `docs/work/reports/T005A-adjustments.md` no formato do protocolo, com evidências dos dois achados, regressões antes/depois, arquivos, verificações, decisões e limites. Explicar fronteiras/cursor, recuperação e invalidação por contexto. Precisar contagens e escopos conforme o código atual; a validação aponta imprecisões documentais do report original, que deve ser preservado.

Atualizar `docs/work/status.md` para “T005A aguardando revalidação do orquestrador”, preservando aceites T001–T004, modo manual e decisão aprovada. Parar e entregar o report ao usuário. Nenhum commit solicitado; T005B depende da revalidação.
