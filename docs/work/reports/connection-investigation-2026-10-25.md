# Investigação — aviso de conexão na página inicial

Data: 25/10/2026. Papel: orquestrador, diagnóstico direto autorizado pelo usuário após captura do aviso. Resultado: investigação concluída; defeito de aviso persistente reproduzido na versão pública. Nenhuma implementação, publicação, reinício remoto ou alteração de conta.

## Conclusão

O servidor estava disponível durante a investigação. A página inicial respondeu HTTP 200 em 0,070 s; `/healthz` respondeu HTTP 200 com `{"ok":true}` em 1,250 s. Um cliente Socket.IO real conectou por WebSocket em 823 ms, com a origem pública configurada no handshake, sem enviar comandos de sala.

Há um defeito de apresentação confirmado: uma tentativa de criar sala enquanto o socket está desconectado retorna imediatamente o erro `OFFLINE`; quando a conexão é estabelecida, o aviso continua visível. A criação recusada localmente também não é retomada automaticamente. A captura do usuário é compatível com esse caminho, mas não prova a causa da desconexão original no celular.

## Evidências

- O [bundle público](assets/connection-investigation-2026-10-25/public-bundle.json) aponta para `https://tretta-server.onrender.com`, usa somente WebSocket e contém o mesmo tratamento de erro. Não apareceu URL incorreta de servidor nos chunks examinados.
- Em Chrome dedicado, abri a página pública, instrumentei apenas as referências dos WebSockets para observar `readyState`, simulei falta de rede pelo CDP e fechei os sockets de teste. Preenchi o apelido e cliquei em Criar sala com o transporte indisponível. O aviso foi exibido e a página permaneceu em `/`.
- Ao restaurar a rede, uma conexão nova chegou a `readyState=1` (OPEN), enquanto o aviso continuava presente: [estado sanitizado](assets/connection-investigation-2026-10-25/reconnected-state.json) e [captura](assets/connection-investigation-2026-10-25/stale-banner.png). Hooks de teste do produto estavam ausentes. Nenhuma sala foi criada e nenhum estado de jogo foi injetado.
- A fonte local explica o resultado: `apps/web/app/providers.tsx:294` retorna `OFFLINE` antes de emitir; o listener `connect` em `:830` atualiza a conexão, mas não limpa o erro; `createRoom` em `:1220` grava a mensagem e encerra a tentativa recusada. O botão na página inicial não depende do estado real da conexão. O socket é iniciado no efeito de montagem do provider, portanto um clique durante a conexão inicial também pode seguir esse caminho.

## Hospedagem e limite da conclusão

A documentação atual do [Render Free](https://render.com/docs/free#spinning-down-on-idle), conferida por Context7 e na fonte oficial, informa suspensão após 15 minutos sem tráfego de entrada e retomada em aproximadamente um minuto, disparada por HTTP ou nova conexão WebSocket. Isso pode prolongar a conexão inicial; não foi observado cold start nem suspensão por cota nesta investigação. Não há evidência suficiente para atribuir a ocorrência do celular ao Render, à rede ou ao navegador. Não foram acessados logs ou painel da conta.

## Encaminhamento

Como contorno imediato, depois de a conexão voltar, fechar o aviso e tentar Criar sala ou Treinar sozinho novamente. Isso inicia uma nova tentativa; esperar sozinho não repete a criação recusada.

Uma próxima tarefa delimitada pode tornar a conexão inicial visível e remover o aviso específico de offline quando o transporte voltar, preservando erros de outras causas. Caso se decida aguardar a conexão para completar o primeiro clique, definir prazo, cancelamento e prevenção de criações duplicadas e verificar esses comportamentos. Implementação e publicação não fazem parte deste diagnóstico; execução de desenvolvimento continua no modo manual registrado no projeto.

## Isolamento, limpeza e verificações

Chrome headless próprio, PID `9320`, perfil temporário `/var/folders/r_/xrvhskhx45l6n66k99kzs61r0000gn/T/tretta-connection-20261025-bjlnj8yn`, CDP `http://127.0.0.1:56769`, daemon exclusivo `tretta-connection-20261025-v1`. Linha de comando do processo e versão CDP foram conferidas antes da navegação. `BU_CDP_WS` foi removida e o endpoint explícito foi usado desde a primeira chamada. Nenhuma conexão ao navegador pessoal.

Daemon exclusivo encerrado com `--reload` no mesmo namespace; processo dedicado encerrado por PID após reconferir perfil/porta; perfil removido. [Registro da limpeza](assets/connection-investigation-2026-10-25/browser-isolation.json), finalizado às 13:45 UTC. Navegador de desktop com queda simulada, sem teste em iPhone físico. Sem teste de criação bem-sucedida, rodada ou reentrada nesta tarefa.

Verificações proporcionais: HTTP público, handshake Socket.IO real, inspeção do bundle publicado e reprodução de interface com rede controlada. Sem suíte de build/unitários, pois nenhuma fonte de produto foi alterada. Alterações preexistentes do workspace preservadas. Encerramento usa a skill `agent-notify`, conforme protocolo do projeto.
