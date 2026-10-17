# Prompt manual — T009: investigar reentrada, especialmente no celular

**Estado:** executado manualmente e diagnóstico aceito em 16/10/2026. [Report](reports/T009-investigation.md), [validação](reports/T009-investigation.validation.md) e [próximo prompt manual T010](T010-recovery-fix.md). Contrato original abaixo preservado; não repetir a investigação inteira sem motivo. Correção ainda não implementada.

## Papel e objetivo

Você é o executor de investigação T009 do Tretta, em uma sessão independente. Modelo preferido pelo usuário: **GPT-6 Luna (`gpt-6-luna`), reasoning `max`**. Não acione outros agentes.

Investigue por que atualizar a página ou voltar ao jogo pode mostrar “Esta identidade já está conectada em outra aba ou dispositivo”, exigindo espera e nova tentativa para recuperar a partida. Entregue reprodução verificável, diagnóstico com nível de confiança e proposta delimitada de correção. Nesta etapa, preserve o comportamento do produto.

## Contexto e leitura inicial

Repositório: `/Users/ivanseibel/dev/personal/tretta`. Se usar outro clone, obtenha a fonte completa do working tree T008: HEAD sozinho não contém a versão publicada.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/work/status.md`, `docs/work/plan.md`, `docs/product/first-version.md`, `docs/product/backlog.md` e `docs/work/reports/T008-publication.validation.md`. Consulte as instruções locais do app e as skills pertinentes à investigação/testes. Prefixe comandos de shell com `rtk`.

Fatos conhecidos:

- Em 16/10/2026, o usuário confirmou ter percebido esse comportamento **especialmente no celular**. Navegador, sistema, duração e sequência exata não foram informados. Esse relato não comprova qual evento de ciclo de vida o provoca.
- O smoke público de T008 observou recusa temporária `ALREADY_CONNECTED`; esperar e tentar novamente permitiu retornar. Evidência em `docs/work/reports/assets/T008-public/smoke-public.json`; report do executor em `docs/work/reports/T008-publication.md`.
- T008 foi publicada e aceita em `https://tretta.vercel.app`, deployment Vercel `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey`. Servidor: `https://tretta-server.onrender.com`, deploy Render `dep-db95f367bikc73dpnfs0`, revisão `8967e94`. Esses IDs são referência histórica, não autorização para alterar serviços.
- O fluxo de reentrada não foi alterado por T008. O código inspecionado fazia quatro tentativas com intervalo de 400 ms para `ALREADY_CONNECTED`. Expiração tardia do socket em cerca de 45 s foi levantada como hipótese; causa, duração e origem histórica **não estão comprovadas**.
- O E2E local de reload passou. É necessário explicar a lacuna entre esse teste e o comportamento observado, em vez de apenas repetir o teste e concluir que não existe problema.
- Regra aprovada: recuperar identidade e mão no mesmo navegador após atualizar a página. A proteção contra uma identidade em duas conexões ativas continua obrigatória. Transferência entre dispositivos está fora do escopo.

## Escopo de investigação

1. Registre o estado inicial do Git, versões e fonte utilizada, preservando alterações/arquivos novos existentes. Referência local: Node 22.23.1 e pnpm 11.14.0. Não use reset, limpeza destrutiva ou troca de dependências para preparar o ambiente.
2. Trace o caminho de criação/conexão do socket, carga da identidade, rejoin, tentativas e tratamento de erros no cliente; autorização, associação participante–conexão e reconhecimento da desconexão no servidor. Pontos iniciais: `apps/web/app/providers.tsx`, `apps/web/app/sala/[code]/page.tsx`, `apps/web/lib/client.ts`, `apps/server/src/server.ts`, `handlers.ts` e `rooms.ts`. Siga também chamadas concorrentes e respostas atrasadas, se houver evidência.
3. Monte uma reprodução local controlada e reutilizável. Priorize dois clientes isolados e uma rodada ativa. Observe o tempo até a primeira recusa e até a recuperação, quantidade de tentativas, códigos de ack, reconhecimento da desconexão antiga e mensagens exibidas. Identifique participantes/conexões por aliases nos registros.
4. Compare os cenários abaixo e registre cada um como reproduzido, não reproduzido, simulado ou indisponível. Concentre o esforço nas diferenças que expliquem o sintoma; não transforme isso em auditoria geral do jogo.
5. Compare hipóteses com as evidências e recomende uma correção mínima e seus testes. Se a solução exigir mudança de regras de identidade, protocolo, dependências ou infraestrutura, explicite a decisão necessária; não a execute.

## Cenários e controles

| Cenário | O que distinguir |
| --- | --- |
| Reload normal em desktop e contexto mobile | Controle com desconexão reconhecida rapidamente; mesma identidade, mão e fase após recuperação |
| Reload/perda de transporte com reconhecimento tardio da desconexão antiga | Aproximar a condição real por controle de rede/proxy/harness, descrevendo o mecanismo e seus limites. Distinguir perda abrupta de `socket.disconnect()` voluntário |
| Volta de aba em segundo plano, bloqueio de tela e breve queda/troca de rede | Testar o que o ambiente permitir. Viewport mobile não reproduz suspensão real de Safari/Chrome no celular; declarar essa diferença |
| Duas abas realmente ativas com a mesma credencial | Controle de proteção: uma segunda aba viva recusada não comprova falha de reload e não justifica expulsar automaticamente a primeira |
| Reentrada concorrente, reconexão repetida ou ack atrasado | Verificar se há duplicação/race, se a credencial é preservada durante a recusa temporária e se respostas antigas contaminam o vínculo atual |
| Sala expirada, credencial inválida/revogada e saída voluntária | Distinguir falhas definitivas de condição transitória; não propor retries infinitos nem ressuscitar identidade removida |

O aviso “Sem conexão com o servidor” no primeiro clique de criar/entrar foi outro achado do smoke. Só investigue sua relação se houver evidência de causa compartilhada; caso contrário, mantenha-o como item separado.

## Ambiente e limites

- Faça a investigação local em processos/cópia isolados, conferindo portas antes de iniciar. Preserve a aplicação eventualmente aberta, os arquivos `.next` do clone usado por outra sessão e capturas históricas que os E2E existentes sobrescrevem.
- Pode criar scripts/testes de reprodução e instrumentação em cópia temporária ou `docs/work/reports/assets/T009-investigation/`. Toda instrumentação é diagnóstica e deve ficar identificada e fora da versão publicada. Não faça correções em `apps/*`/`packages/*` no working tree principal nesta tarefa.
- Use os testes existentes como referência: `apps/web/e2e/recovery.spec.ts`, `fixtures.ts`, `room.ts`; `apps/server/test/recovery.test.ts`, `dedupe-retention.test.ts`, `privacy.test.ts`, `pause.test.ts` e os testes de sincronização do cliente. Rode apenas verificações pertinentes; build antes dos testes que consomem `dist`. Não é necessário repetir as suítes completas aceitas para entregar diagnóstico.
- Para comportamento específico de Socket.IO/Engine.IO ou ciclo de vida de navegador, consulte documentação primária atual via Context7 conforme AGENTS. Separe a documentação da prova do comportamento desta aplicação.
- O site público e o Render ficam preservados: sem deploy, reinício, alteração de timeout/configuração, commit, push ou cobrança. Se uma hipótese só puder ser confirmada em produção, descreva um experimento mínimo para uma próxima tarefa; não acesse salas da família.
- Nos artefatos, registre códigos, tempos relativos e aliases; mantenha credenciais, storage bruto e payloads de mãos fora de logs/reports. Para comparar a mão do próprio cliente antes/depois, use asserção ou digest sem publicar suas cartas.

## Critérios de aceite do diagnóstico

1. Caminho relevante do código explicado com referências a arquivo/linha e distinção entre transporte conectado e vínculo autorizado na sala.
2. Reprodução executável com comando e pré-condições; evidência de recusa/recuperação, ou registro honesto das tentativas sem reprodução e da lacuna que resta.
3. Linha do tempo correlaciona cliente antigo, cliente novo, reconhecimento de desconexão e decisões do servidor. Tempos medidos ficam separados de estimativas e hipóteses.
4. Matriz dos cenários e controles acima, incluindo a proteção de duas abas; limites de emulação versus aparelho físico explicitados.
5. Diagnóstico diferencia causas comprovadas, contribuintes e hipóteses descartadas/pendentes. Explica por que o E2E local pode passar. Aumentar retries ou atribuir tudo ao Render não basta como diagnóstico.
6. Proposta mínima de correção com arquivos prováveis, alternativas/tradeoffs e testes de regressão. Considere cancelamento ao sair/trocar de sala, preservação de credencial/mão e bloqueio de ações até confirmação do vínculo. Não implementar a proposta nesta etapa.
7. Estado final preservado: nenhum deploy/commit/push ou alteração funcional no clone principal; liste os artefatos diagnósticos criados e qualquer limitação.

## Retorno e parada

Escreva `docs/work/reports/T009-investigation.md` no formato do protocolo: resultado (concluída/parcial/bloqueada), alterações/artefatos, evidência por critério, comandos e resultados, diagnóstico e confiança, decisões/desvios, limitações e próximo passo recomendado. Inclua instruções para o orquestrador reproduzir sem depender da memória desta sessão.

Se não puder reproduzir com confiança, entregue como parcial com as hipóteses restantes e o menor experimento necessário; não declare causa raiz por inferência. Se precisar de teste humano no celular, prepare uma sequência curta e indique quais observações faltam, sem bloquear a análise local disponível.

Atualize somente o trecho atual de `docs/work/status.md` para “T009 investigação aguardando validação do orquestrador”, distinguindo o que foi concluído do que permanece parcial. Preserve reports e aceites anteriores. Pare após entregar o report; não avance para correção ou publicação.
