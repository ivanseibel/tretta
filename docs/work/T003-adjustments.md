# Ajustes de T003 — Deduplicação das intenções

## Papel e objetivo

Você é o executor do Tretta em execução manual. Corrija as duas falhas de deduplicação documentadas pelo orquestrador, preservando o fluxo jogável e a privacidade. T001/T002 estão aceitas; T003 requer estes ajustes antes de T004.

## Contexto obrigatório

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/product/first-version.md`, `docs/work/status.md`, `docs/work/plan.md`, `docs/work/T003.md`, `docs/work/reports/T003.md` e `docs/work/reports/T003.validation.md`.

Confira o Git e preserve as alterações não commitadas e os documentos do orquestrador. Siga as instruções de comandos do repositório, usando RTK e `rtk proxy` quando necessário; use `writing-for-agents` ao editar instruções. APIs/configurações de bibliotecas requerem Context7 conforme `AGENTS.md`. Nenhum commit foi solicitado.

## Escopo

1. Garantir que uma intenção já processada não volte a executar depois de mais de 256 entradas no cache. A solução simples nesta instância em memória é preservar registros pelo tempo de vida do participante/sala. Aumentar o limite não corrige o problema. Se optar por limitar respostas, preserve o reconhecimento de intenções antigas sem executar sua mutação novamente e documente a semântica; não reduza as garantias de T003.
2. Incluir o tipo de operação/evento na assinatura da intenção. O registro do id continua compartilhado no escopo de pessoa/sala para detectar reuso entre operações: `client:startRound` e `client:returnToLobby` com o mesmo id devem resultar em `INTENT_REUSED`, não sucesso memorizado da primeira operação. Revisar todos os handlers mutáveis que usam o mesmo mecanismo, inclusive criação/entrada por conexão.
3. Manter resposta consistente para repetição idêntica, rejeição para reuso com conteúdo diferente, separação entre pessoas/salas e recusa de rodadas antigas. Duplicatas não alteram versão, prontidão, pilhas, placar ou eventos, nem reenviam snapshots antigos como atualização nova.
4. Acrescentar regressões por Socket.IO real para os dois cenários da validação. Demonstrar replay antigo após superar o limite anterior, reuso entre eventos diferentes com payloads iguais e preservação do estado/broadcasts. Incluir replay de compra de uma rodada ainda ativa após mais de 256 intenções posteriores, quando a vez e fase novamente permitiriam comprar, para provar que a proteção cobre efeitos de jogo e não só prontidão.
5. Atualizar a documentação do contrato para informar escopo da chave, inclusão da operação na assinatura e vida útil dos registros. Preservar o formato privado das saídas; versões/build/estrutura aceitos só precisam mudar se a correção justificar.

Recuperação completa, pausas, saídas/substitutos e decisões de anfitrião continuam em T004; chat/humor/visibilidade para quem aguarda em T005; polimento em T006; carga/HTTPS/publicação em T007. Não ampliar esta correção para essas tarefas.

## Critérios de aceite

- Repetir a intenção original de prontidão após mais de 256 intenções distintas não altera prontidão, versão nem eventos e tem resposta consistente. Intenção antiga não pode ser reinterpretada como nova.
- Repetir uma compra antiga na mesma rodada, após superar o limite anterior e voltar a uma vez em que comprar seria válido, não acrescenta cartas nem emite novo `drew`.
- Reutilizar um id em outra operação, inclusive início versus retorno ao lobby, é recusado com `INTENT_REUSED`; a operação não altera estado. Mesma operação/payload repete o resultado; outro payload é recusado. Identidades e salas permanecem isoladas.
- Critérios originais de T003 permanecem atendidos: integração real, processo compilado, Bloqueio 2p, placar único, nova rodada/prontidão, privacidade, oito participantes e fluxo de navegador desktop/celular.
- Instalação congelada, build, suíte completa, tipos e E2E passam, com resultados e limitações registrados.

## Verificação e retorno

Execute as novas regressões e as verificações do projeto. Build deve preceder a cobertura do processo compilado. Evite repetir builds desnecessários: após um build confirmado, use comandos de testes/tipos/E2E dos pacotes conforme o README. Testes que abrem servidores locais podem precisar de permissão do ambiente; diferencie falhas de sandbox de falhas funcionais.

Salve o report do protocolo em `docs/work/reports/T003-adjustments.md`, com evidências por critério, arquivos alterados, comandos/resultados, decisões/desvios e limitações. Preserve report e validação originais; atualize `docs/work/status.md` para “T003 aguardando revalidação do orquestrador”, mantendo o aceite de T001/T002 e o modo manual.

Pare após os ajustes e entregue o report ao usuário. T004 depende da revalidação. Nenhum commit foi solicitado.
