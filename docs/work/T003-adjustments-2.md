# Ajustes finais de T003 — Resposta original e limpeza de conexão

## Papel e objetivo

Você é o executor do Tretta em execução manual. Feche os dois pontos restantes do contrato de deduplicação. Retenção após 256 entradas e assinatura por evento já foram aceitas na revalidação; mantenha essas correções.

## Contexto obrigatório

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/work/status.md`, `docs/work/T003.md`, `docs/work/T003-adjustments.md`, `docs/work/reports/T003-adjustments.md` e `docs/work/reports/T003.revalidation.md`. Consulte o escopo em `docs/product/first-version.md` e o plano em `docs/work/plan.md` quando precisar das regras e limites.

Confira o Git e preserve o working tree, os reports e os documentos do orquestrador. Use RTK, com `rtk proxy` para filtros problemáticos; consulte Context7 para APIs/configurações de bibliotecas conforme `AGENTS.md`. Use `writing-for-agents` ao editar instruções. Nenhum commit foi solicitado; T001/T002 estão aceitas e T004 aguarda o aceite final de T003.

## Escopo

1. Tornar estável o ack de criação/entrada memorizado por conexão. Hoje o handler lê `response.room.version` de uma referência mutável, portanto o replay idêntico devolve uma versão posterior. Capture os dados necessários à resposta na primeira execução, inclusive versão. A escolha local de armazenar o ack ou campos imutáveis no resultado cabe ao executor; não é necessário mudar o formato público.
2. Limpar `socketIntents` quando a conexão termina, mesmo se nunca tiver criado/entrado em sala. Hoje `handleDisconnect` retorna antes da limpeza se não houver participante; entradas recusadas para sala inexistente deixam registros sem escopo vivo. Preserve os registros por participante, que têm vida útil independente da conexão e servem à identidade recuperável.
3. Adicionar regressões para criação e entrada: primeira resposta, outras mutações na sala, replay da intenção idêntica, resposta exatamente igual à original e ausência de novos participantes/salas/snapshots/eventos. O caso deve incluir diferença real entre versão original e versão atual da sala.
4. Adicionar regressão de limpeza após entrada recusada e desconexão; confirmar também limpeza da conexão de participante conectado, mantendo os registros do participante. Inspeção de estrutura interna pode ficar no teste; não criar endpoint público para consultar caches ou credenciais.

São correções do contrato já documentado, sem nova decisão de produto. Não ampliar para expiração de salas, pausas, substitutos, transferência de anfitrião ou outros comportamentos de T004.

## Critérios de aceite

- Replay idêntico de `client:createRoom` e `client:joinRoom`, após mutações posteriores, devolve exatamente o ack original, inclusive `version`. Sala/participante permanecem únicos; a repetição não altera a versão atual da sala nem emite nova atualização.
- Ao terminar uma conexão, seu cache deixa de existir, inclusive após `ROOM_NOT_FOUND`. Cache de outras conexões e registros por participante permanecem corretos; não há perda da proteção contra replay de intenções do participante.
- Permanecem satisfeitas as regressões anteriores: retenção após mais de 256 entradas, replay de compra com vez válida, `INTENT_REUSED` entre eventos/payloads, isolamento, Bloqueio 2p e placar único.
- Instalação congelada, build, suíte completa, tipos e três E2E desktop/celular passam; processo compilado e privacidade continuam cobertos.

## Verificação e retorno

Execute as novas regressões e as verificações proporcionais. Faça build antes de testar o processo compilado; após build confirmado, execute os comandos de testes/tipos/E2E dos pacotes para evitar builds repetidos. Diferencie limitação de portas do sandbox de falha funcional.

Salve o report do protocolo em `docs/work/reports/T003-adjustments-2.md`, com evidência por critério, arquivos, comandos/resultados, decisões e limitações. Preserve reports e validações anteriores. Atualize `docs/work/status.md` para “T003 aguardando revalidação final do orquestrador”, mantendo o modo manual e os aceites anteriores.

Pare após esta correção e entregue o report ao usuário. Nenhum commit foi solicitado. T004 depende da revalidação final.
