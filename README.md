# Tretta

Jogo de cartas para amigos e família no navegador, com salas privadas para 2–8 pessoas, chat e provocações animadas. Celular e computador.

Estado atual: sala privada jogável localmente — criar sala, entrar por link com apelido e avatar, preparar, jogar uma rodada completa do Clássico pela interface e ver vencedor/placar, com recuperação de identidade após atualizar a página, queda/reconexão, pausas de 90 segundos, substituto automático, saída voluntária, transferência de anfitrião, remoção no lobby e retenção de 15 minutos (T001–T004), chat da sala com histórico e silêncio local e mesa pública para quem aguarda a próxima rodada (T005A), provocações manuais com alvo e efeito compartilhado (T005B), efeitos automáticos com duas variações por categoria, fila única de apresentações, sons sintetizados e preferências individuais de animação, som e ocultação (T005C, concluída) e interface responsiva, cartas e avatares com identidade própria e operação por teclado (T006, aceita). T007 acrescenta provas locais de oito navegadores, dez salas Socket.IO e processos compilados; as provas locais e a preparação estão aceitas em [T007.final-validation.md](docs/work/reports/T007.final-validation.md). Publicado por HTTPS em [tretta.vercel.app](https://tretta.vercel.app), com Vercel Hobby e Render Free. Validação pública em [T007-public-validation.md](docs/work/reports/T007-public-validation.md); uso real em celular foi confirmado pelo usuário jogando com a irmã; não houve medição de capacidade em nuvem.

Refinamentos T008 **publicados e aceitos**: mesa aconchegante, campos de provocação alinhados, mensagens recentes no topo e aviso sonoro da própria vez ligado por padrão, com opção persistida para desligar e respeito ao silêncio geral. [Validação](docs/work/reports/T008.validation.md): 348 testes passando (mais um pulado), 31 E2E, build e tipos. [Aceite público](docs/work/reports/T008-publication.validation.md) e [backlog pós-MVP](docs/product/backlog.md). A reentrada após reload agora tem retomada automática com espera limitada ([detalhes](#recuperação-pausas-e-substitutos)); diagnóstico local aceito em T009 e correção T010 **publicada e aceita** — [validação pública](docs/work/reports/T010-publication.validation.md). Som da nova revisão ainda sem audição humana em celular.

Mesa de treino (T011) em preparação, ainda **não publicada**: [T011A](docs/work/T011A.md) (protocolo e servidor) está aceita e [T011B](docs/work/T011B.md) (experiência no navegador) foi aceita após ajustes — [aceite](docs/work/reports/T011B.final-validation.md). No working tree local, a home oferece **“Treinar sozinho”**: uma pessoa cria uma mesa individual contra três bots fixos (Tico, Lila e Nino), com as regras do Clássico, preparação, mesa, resultado, nova rodada e recuperação iguais às da sala comum; sem convite e sem remoção de bots, e os bots não conversam nem provocam.

- [Escopo aprovado](docs/product/first-version.md)
- [Plano de implementação](docs/work/plan.md)
- [Estado e retomada](docs/work/status.md)
- [Preparação revisável de hospedagem](docs/work/deployment.md)
- [Preparar outro computador](docs/work/setup.md)
- [Hospedagem gratuita para a fase de hobby familiar](docs/work/deployment-free.md)

Diretriz atual: hospedar o jogo inteiro em planos gratuitos durante o uso familiar. A configuração publicada usa Vercel Hobby para a interface e Render Free para o servidor, com cotas e possível espera ao despertar o serviço. Publicado em [tretta.vercel.app](https://tretta.vercel.app); o primeiro acesso após inatividade pode aguardar o despertar do Render.

O trabalho segue um protocolo de orquestrador e executor descrito em [AGENTS.md](AGENTS.md).

## Requisitos

- Node.js 22, a partir de 22.12 (versão de referência em `.nvmrc`: 22.23.1).
- pnpm 11.14.0, fixado em `packageManager` do `package.json`. Com Corepack ativo, o pnpm correto é usado automaticamente.

## Instalação

```sh
pnpm install --frozen-lockfile
```

Use `--frozen-lockfile` para reproduzir exatamente o `pnpm-lock.yaml`.

## Rodar localmente

```sh
pnpm dev
```

O comando compila os pacotes (`@tretta/rules`, `@tretta/protocol`, `@tretta/server`) e sobe dois processos:

- Servidor autoritativo Socket.IO em `http://localhost:3100`.
- Aplicação web Next.js em `http://localhost:3000`.

Para jogar com duas pessoas na mesma máquina:

1. Abra `http://localhost:3000` e crie uma sala com apelido e avatar.
2. Copie o link de convite exibido no lobby.
3. Abra o link em uma janela anônima (ou outro navegador/dispositivo na mesma rede).
4. Escolha apelido/avatar, clique em **Estou pronto** nas duas telas e o anfitrião inicia a rodada.

Os dois processos também podem ser iniciados separadamente:

```sh
pnpm --filter @tretta/server dev    # tsx watch
pnpm --filter @tretta/web dev       # next dev
```

Comandos de produção/local sem watch:

```sh
pnpm build
node apps/server/dist/index.js      # servidor compilado (porta 3100)
pnpm --filter @tretta/web start     # next start (porta 3000)
```

## Variáveis de ambiente

`.env.example` documenta nomes e padrões, mas não é carregado automaticamente pelo processo Node do servidor. Exporte as variáveis no shell ou configure-as no gerenciador de processos do servidor. Para a web, defina variáveis no ambiente do Next.js ou em um arquivo `.env*` suportado dentro de `apps/web`. `NEXT_PUBLIC_*` é incorporada ao bundle durante o build; alterar `NEXT_PUBLIC_SERVER_URL` exige novo build.

| Variável | Processo | Padrão | Uso |
| --- | --- | --- | --- |
| `TRE_TTA_PORT` | servidor | — | Porta HTTP/Socket.IO explícita, com prioridade sobre `PORT` |
| `PORT` | servidor/web | `3100`/`3000` | Porta da plataforma; servidor usa quando `TRE_TTA_PORT` está ausente ou vazio, Next usa para `next start` |
| `TRE_TTA_WEB_ORIGIN` | servidor | `http://localhost:3000` | Origem permitida no CORS |
| `TRE_TTA_SEED` | servidor | — | Semente opcional para reproduzir embaralhamentos (não usar em produção) |
| `TRE_TTA_TEST_HOOKS` | servidor | — | `1` ativa ganchos de teste (definir o próximo baralho); nunca em produção |
| `TRE_TTA_GRACE_MS` | servidor | `90000` | Prazo da pausa por ausência, em ms; só tem efeito com `TRE_TTA_TEST_HOOKS=1` |
| `TRE_TTA_RETENTION_MS` | servidor | `900000` | Retenção da sala vazia, em ms; só tem efeito com `TRE_TTA_TEST_HOOKS=1` |
| `NEXT_PUBLIC_SERVER_URL` | web | `http://localhost:3100` | URL do Socket.IO usada pelo navegador |
| `NEXT_PUBLIC_TEST_HOOKS` | web | — | `1` expõe `window.__trettaTest` para os testes de navegador (baralho e desconexão simulada) |

Nenhum segredo é necessário nesta fase. Arquivos `.env` ficam fora do Git.

## Estrutura

- `packages/rules` (`@tretta/rules`): motor independente de interface, de transporte e de relógio. Contém o baralho Clássico de 108 cartas com ids únicos, a abertura da rodada e as transições de turno, efeitos, última carta, compras e vencedor, além das projeções privadas por jogador.
- `packages/protocol` (`@tretta/protocol`): contrato entre servidor e navegador — esquemas Zod de validação em runtime, tipos dos payloads, acks, snapshots públicos/privados e nomes de eventos. `@tretta/protocol/shared` contém apenas constantes e tipos (sem dependências) para o cliente.
- `apps/server` (`@tretta/server`): servidor autoritativo Node.js com Socket.IO, salas em memória, deduplicação de intenções e projeções por jogador.
- `apps/web` (`@tretta/web`): aplicação React/Next.js com telas de criação/entrada, lobby, mesa e resultado.
- `tsconfig.base.json`: configuração TypeScript compartilhada.

O motor é consumido como build: `@tretta/rules` e `@tretta/protocol` publicam `dist/` via `tsc` (`exports` aponta `types` para `./dist/index.d.ts` e runtime para `./dist/index.js`). Por isso `pnpm build` precede `pnpm dev`, `pnpm typecheck` e o start compilado. Os testes usam alias para o fonte, então `pnpm test` funciona sem build.

Aleatoriedade é injetada: `createSeededRandom(seed)` reproduz uma abertura nos testes. Entradas inválidas (quantidade fora de 2–8, ids vazios ou duplicados, semente ou fonte aleatória inválida) geram `RulesError` com `code` explícito.

## Motor de rodada

Estado autoritativo e comandos. `applyCommand` nunca altera o estado recebido: rejeições retornam `{ ok: false, error: { code, message } }` e preservam o estado; sucessos retornam novo estado e eventos públicos.

```ts
import { applyCommand, createRoundState, createSeededRandom, projectForPlayer, startRound } from '@tretta/rules';

const random = createSeededRandom(42); // aleatoriedade injetável; use Math.random fora dos testes
const state = createRoundState(startRound({ playerIds: ['ana', 'bia', 'cai'], random }));

// Comandos: play, draw, pass, announceLastCard, challengeLastCard
const first = applyCommand(state, { type: 'draw', playerId: state.seats[state.currentIndex]?.id ?? '' }, random);
if (!first.ok) throw new Error(first.error.message);

// Projeção privada: somente a própria mão e informações públicas
const view = projectForPlayer(first.state, 'ana');
view.hand;              // cartas da própria mão
view.playableCardIds;   // ids jogáveis agora (vazio fora da vez)
view.players;           // [{ id, handCount }] de todos
```

- `play`: `{ type, playerId, cardId, chosenColor?, announceLastCard? }`. `chosenColor` é obrigatória para coringas e proibida para as demais cartas. `announceLastCard` só vale quando o descarte deixa exatamente uma carta.
- `draw`: compra uma carta no turno. Depois dela, só a carta comprada pode ser descartada, ou o jogador passa com `pass`.
- `announceLastCard` e `challengeLastCard` (`{ playerId, targetId }`) valem enquanto a janela de última carta está aberta. A janela fecha na próxima compra voluntária ou descarte aceito de quem age, inclusive quando a vez volta à mesma pessoa, ou quando a rodada termina. Compras obrigatórias de Compra 2/Compra 4 não fecham a janela.
- Códigos de rejeição: `INVALID_COMMAND`, `ROUND_FINISHED`, `UNKNOWN_PLAYER`, `NOT_YOUR_TURN`, `CARD_NOT_IN_HAND`, `CARD_NOT_PLAYABLE`, `ONLY_DRAWN_CARD_PLAYABLE`, `COLOR_REQUIRED`, `INVALID_COLOR`, `COLOR_NOT_ALLOWED`, `ANNOUNCE_NOT_APPLICABLE`, `ALREADY_DREW`, `PASS_REQUIRES_DRAW`, `NO_LAST_CARD_WINDOW`, `ALREADY_ANNOUNCED`, `INVALID_CHALLENGE`. Denúncias inválidas não penalizam ninguém.

Qualquer tipo de carta pode encerrar a rodada. Os efeitos da carta vencedora — escolha de cor, compras obrigatórias, Bloqueio, Inversão e perda de turno — são resolvidos uma única vez antes do evento `roundFinished`; depois do fim, todos os comandos são recusados.

O estado completo (`RoundState`) pertence ao chamador do motor e não deve ser enviado aos jogadores. Use `projectForPlayer` para cada participante. Eventos (`RoundEvent`) são públicos e não incluem mãos nem o conteúdo da pilha de compra.

## Servidor autoritativo

### Conexão e identidade

- `client:createRoom` `{ intentId, nickname, avatar }` cria a sala e define o anfitrião. A resposta traz `roomCode`, `playerId` e `credential`.
- `client:joinRoom` `{ intentId, roomCode, nickname, avatar, credential? }` entra por convite. Com `credential` válida de um participante desconectado, a conexão retoma a mesma identidade, vaga e mão, inclusive depois de atualizar a página: vez, sentido, cor ativa, pilhas, fase após compra, carta recém-comprada e janela de última carta são preservadas. Sem credencial, entra como nova pessoa. Credencial inválida, sala ausente/experida e reentrada de identidade já conectada são recusadas com mensagens compreensíveis.
- O navegador guarda `{ playerId, credential, nickname, avatar }` por sala em `localStorage` (`tretta.identity.<código>`). A credencial nunca aparece em snapshots públicos, broadcasts ou links de convite. Transferência entre dispositivos continua sem fluxo próprio: o retorno usa a credencial do mesmo navegador.
- O ator de todo comando é derivado da conexão. `playerId` enviado no payload é campo desconhecido e a mensagem inteira é recusada.

### Contratos

Todo payload é validado em runtime com Zod (`@tretta/protocol`), com campos desconhecidos proibidos. Malformado gera `{ ok: false, error: { code: 'INVALID_PAYLOAD', message } }` sem alterar estado nem derrubar o servidor. Todas as respostas são acknowledgements com `{ ok: true, ... }` ou `{ ok: false, error: { code, message } }` (mensagens em português).

Eventos cliente→servidor: `client:createRoom`, `client:joinRoom`, `client:setReady`, `client:startRound`, `client:command`, `client:returnToLobby`, `client:leaveRoom`, `client:substituteAbsent`, `client:continueRound`, `client:endRoundWithoutWinner`, `client:removeParticipant`, `client:chatSend`, `client:chatHistory`, `client:tauntSend` e, só com `TRE_TTA_TEST_HOOKS=1`, `test:setNextDeck`.

Servidor→cliente:

- `server:state` (privado, um por conexão): `{ room, self, table }`. `room` é o snapshot público (participantes, prontidão, placar, status, pausa, retenção, relógio do servidor, `version`); cada participante traz `connected`, `inRound`, `isHost`, `autoControlled` (vaga sob substituto) e `absentSince` (início da ausência atual). `self.view` é a projeção de `projectForPlayer` apenas para quem está na rodada. Quem espera recebe `view: null`. `table` é a mesa pública da rodada (ver abaixo), `null` fora de rodada.
- `server:events` (broadcast da sala): eventos públicos do motor com `{ roomCode, roundId, version, events }`. Nunca contém mãos, pilha de compra ou credenciais.
- `server:chat` (broadcast da sala): `{ roomCode, message }` com a mensagem aceita (`seq`, autoria congelada, texto, `sentAt`).
- `server:taunt` (broadcast da sala): `{ roomCode, taunt }` com a provocação aceita (`id`, tipo, emissor e alvo congelados, `sentAt`); efeito transitório, sem histórico.
- `server:removed` (privado): avisa a conexão removida pelo anfitrião; a credencial correspondente deixa de autorizar a vaga.

### Deduplicação e sincronização

- Toda intenção mutável carrega `intentId` gerado pelo cliente. O servidor guarda a resposta por `(escopo, intentId)` — escopo é o participante (prontidão, início, comandos, retorno, substituição, continuação, encerramento e remoção) ou a conexão (criação, entrada e saída) — e mantém os registros enquanto o escopo viver. As respostas memorizadas no escopo da conexão são tombstones públicos e imutáveis (`roomCode`, `playerId`, `credential`, `version`): nunca guardam o objeto `Room`, participantes ou estado interno, e vivem até a conexão terminar. A associação de transporte (`socket.join`) é efeito exclusivo da execução autorizada de criação/entrada — um replay devolve o ack original sem reinscrever a conexão em sala antiga, revogada ou expirada: nada é expulso por limite de quantidade, então uma intenção antiga nunca é reinterpretada como nova. A assinatura inclui o **tipo de operação/evento** e o payload validado: repetir a mesma operação com o mesmo payload devolve exatamente a mesma resposta, com os campos capturados na primeira execução (inclusive `version`), sem reexecutar a mutação nem reemitir snapshots/eventos (o ack pode trazer uma `version` antiga; a ordenação do cliente a ignora); reusar o id em outra operação ou com outro payload é recusado com `INTENT_REUSED`. Os escopos são separados por pessoa e por sala; o cache da conexão (criação/entrada) é descartado quando a conexão termina, enquanto os registros do participante permanecem para a identidade recuperável.
- Comandos carregam `roundId`. Comando com rodada antiga é recusado (`STALE_ROUND`) e não afeta a rodada seguinte. Os handlers são síncronos, então as mutações de cada sala são processadas na ordem de recebimento do servidor (aviso/denúncia seguem essa ordem, sem relógio).
- Cada mutação incrementa `version` da sala. O cliente só aplica `server:state` quando `version` é maior que a última aplicada daquela sala, então duplicatas e acks antigos não regridem a interface. O ack de um comando traz a `version` resultante.
- Vitória é somada uma única vez por rodada (`scored`), na transição para `finished`.

### Sala, rodada e limites

- Capacidade da sala: 8 participantes (o limite da mesa). A nona entrada é recusada com `ROOM_FULL`, evitando seleção manual quando há mais interessados que vagas.
- Início da rodada: somente o anfitrião, na preparação, com 2–8 participantes conectados e todos prontos; validado no servidor mesmo se o cliente contornar a interface. Só quem está conectado entra na distribuição.
- Quem entra durante a rodada fica no lobby (`waiting`), não recebe mão e não pode comandar a rodada atual; participa da próxima preparação. Em `server:state` essa pessoa recebe `table` (mesa pública: topo do descarte, cor ativa, sentido, vez, quantidade da compra, contagens das mãos, janela de última carta e resultado) imediatamente e a cada atualização, sem mãos ocultas nem ordem da compra, e mantém os controles administrativos do anfitrião durante uma pausa de retenção.
- Ao terminar, a sala mostra vencedor e placar (somado uma única vez). O anfitrião usa **Voltar à preparação** para reabrir o lobby; prontidão é zerada e todos confirmam de novo. Rodada encerrada sem vencedor (`endRoundWithoutWinner`) não soma pontos e também permite nova preparação.

### Chat da sala

- **Contrato:** `client:chatSend` `{ intentId, roomCode, text }` valida no servidor (Zod estrito, campos desconhecidos recusam a mensagem inteira) e devolve `{ ok, message }`; a mensagem aceita tem `seq` (ordem e id autoritativos), autoria congelada no aceite (`playerId`, apelido, avatar — distingue identidades com apelido igual e sobrevive à saída/remoção), `text` e `sentAt` do relógio da sala. O cliente nunca escolhe autor, id ou horário. `roomCode` no payload amarra a intenção à sala de origem, então uma tentativa atrasada de vínculo anterior não publica em outra sala. Texto renderiza literalmente (React escapa HTML).
- **Limites:** até 500 caracteres contados em pontos de código Unicode (`Array.from`, emoji fora do BMP vale 1); vazio/inválido é recusado com `CHAT_EMPTY`/`CHAT_TOO_LONG`; cinco mensagens aceitas a cada dez segundos por identidade em janela móvel (`CHAT_RATE_LIMITED`), com relógio controlável do serviço — reentrada não reinicia a cota, leitura/silêncio/recusa não consomem cota, e replay de aceite ou recusa devolve a resposta original sem nova cópia nem novo consumo.
- **Histórico:** vive enquanto a sala existir, atravessa rodadas e sobrevive a saída/remoção/reload. Entrega paginada: `client:chatHistory` `{ roomCode, before?, limit? }` devolve a página em ordem crescente com `hasMore`; `before` é exclusivo (cursor estável). O cliente mescla por `seq` e mantém uma **fronteira** derivada do próprio conjunto — o menor `seq` da maior faixa contígua a partir do topo conhecido — como cursor de “anteriores”; assim um cache antigo destacado não fecha a paginação e o intervalo entre cache e página recente permanece recuperável. `server:chat` é um canal separado de `server:state`: chat não incrementa `version`, não reagenda o bot nem invalida snapshots. Cada operação assíncrona de chat é validada contra a geração do vínculo sala/identidade no cliente: resposta ou ack antigo (saída, remoção, sala inexistente, reentrada — inclusive no mesmo código como nova identidade) é descartado sem tocar mensagens, paginação, carregamento ou rascunho do contexto atual (`STALE_CONTEXT`).
- **Silêncio local:** silenciar/mostrar vale por identidade (`playerId`), só no próprio navegador, persistido por sala em `localStorage` (`tretta.chatMute.<código>`); oculta mensagens antigas e novas daquele autor na tela de quem silenciou, sem apagar nada do servidor nem afetar os demais, com caminho de desfazer visível na mensagem oculta.
- **Ciclo de vida:** expiração/reinício da sala elimina histórico e contadores; retenção de sala vazia mantém o histórico com os demais dados.

### Provocações

- **Contrato:** `client:tauntSend` `{ intentId, roomCode, type, targetId }` valida no servidor (Zod estrito; `type` é enum fechado — `tomate`, `torta`, `risadas`, `choro`) e devolve `{ ok, taunt }`; a provocação aceita tem `id` autoritativo (`t_<uuid>`), tipo, emissor e alvo congelados no aceite (distintos por `playerId`, apelido e avatar) e `sentAt` do relógio da sala. O cliente nunca escolhe id, autoria nem horário. Broadcast imediato `server:taunt` para a sala inteira; sem histórico, sem replay de efeito e sem incremento de `version` nem reagendamento do bot.
- **Limites autoritativos:** uma provocação a cada 15 segundos por emissor (`TAUNT_SENDER_COOLDOWN`) e no máximo três por minuto por alvo, em janela móvel por identidade (`TAUNT_TARGET_LIMIT`); recusa vem com mensagem explicando quando tentar de novo, não consome cota e preserva a escolha na interface. Janela do alvo expira por envelhecimento dos registros; saída/remoção retiram o alvo do conjunto elegível sem apagar o histórico de janela. Reentrada preserva as cotas (contadores por `playerId`, não por conexão); replays devolvem o ack original sem novo broadcast nem novo consumo.
- **Apresentação:** efeito transitório (~3 s) por id, deduplicado entre ack e broadcast e idempotente a broadcast repetido. A proteção contra reapresentação é memória local por sala nesta aba: a perda e a reentrada autorizada da mesma sala/identidade limpam os efeitos em tela mas preservam os ids apresentados (replay e duplicata não reapresentam; eventos novos seguem apresentando uma vez), enquanto troca de sala, saída, remoção ou sala inexistente limpam efeitos e descartam os ids — nenhum evento atravessa sala nem ressuscita sala removida. Um reload zera essa memória local sem risco: o servidor nunca retransmite efeitos antigos. Cada envio fica associado à operação e ao vínculo corrente: conclusão antiga (timeout de conexão perdida, ack após troca de sala) não libera o loading nem substitui o erro da operação nova, e o bloqueio de envio segue dependendo da autorização do vínculo. Quem aguarda a próxima rodada provoca normalmente, sem assumir mão nem receber comandos de jogo. Sem histórico, sem reprovação e sem toque no conteúdo da página (`pointer-events: none`); com `prefers-reduced-motion`, o mesmo aviso aparece estático.

### Efeitos automáticos, fila e preferências

- **Contrato:** `server:events` (versão de protocolo 4) traz sempre o campo `effects`, com os efeitos derivados no servidor deste mesmo lote, na mesma ordem dos `events` que os originaram (`eventIndex`) — rejeição, replay ou re-render do lote não criam nem reescolhem efeito. Categorias: `penaltyDraw` (`drew` com motivo `penalty`/`challenge`, com alvo, apelido e a quantidade realmente entregue — 0 quando a pilha esgota), `blocked` (`turnSkipped`, inclusive após Compra 2/4 e Inversão com duas pessoas), `directionReversed` (`directionChanged`, com o sentido resultante) e `victory` (`roundFinished`, com `substitute` congelado antes da retirada da vaga). Compra voluntária e encerramento sem vencedor não geram efeito; a sequência de um comando com vários efeitos (ex.: Compra 2) e os efeitos finais antes da vitória são preservados. Cada efeito tem `id` único (`fx_<uuid>`) para dedupe, `roundId`, `seq` de emissão na sala e `variant` — duas variações visualmente distintas por categoria (`cards-rain`/`cards-avalanche`, `brick-wall`/`stumble`, `boomerang`/`windmill`, `confetti`/`trophy`). A escolha acontece uma única vez no servidor com um RNG cosmético próprio (com `TRE_TTA_SEED`, `seed ^ 0x5eed`; nunca a fonte aleatória do baralho nem a política do bot) e a mesma decisão chega a jogadores e a quem aguarda; só o anfitrião pode fixar variação com `test:setEffectVariant` (ganchos de teste). Nenhuma mão, pilha ou credencial entra no transporte de efeitos.
- **Fila local de apresentação:** efeitos automáticos e provocações manuais compartilham uma fila serial no cliente — um item por vez, ordem de chegada e a sequência de um mesmo lote preservadas, deduplicadas por `id`. O encerramento de cada item é feito por timer (nunca só por `animationend`, que pode faltar com animação desligada ou desmontagem), com geração contra callbacks antigos; o limite é de 8 itens pendentes, descartando o mais antigo. Durações completas: 2,6 s para efeito e 3,2 s para provocação; reduzidas 2,0/2,4 s; desligadas 1,4 s estático com a legenda visível. Troca de sala, saída, remoção, nova rodada ou desmontagem cancelam fila, timers e áudio; a transição normal da mesa para o resultado da mesma rodada preserva os efeitos finais enfileirados. O overlay não intercepta ponteiro nem captura foco: cartas, chat, controles e ações de resultado continuam usáveis durante qualquer apresentação, e fila não altera motor, rede, versão da sala nem agendamento do bot.
- **Preferências individuais:** o painel "Apresentação" (visível em desktop e celular, inclusive para quem aguarda e no resultado) oferece animação completa/reduzida/desligada, silenciar sons e ocultar provocações recebidas. Persistem por navegador em `localStorage` (`tretta.mood`), sem conta e sem efeito na sala, no motor ou nos demais participantes — cada um segue recebendo a apresentação que configurou. `prefers-reduced-motion` limita a animação completa à reduzida, inclusive quando o sistema muda durante a sessão, e a desligada permanece permitida; armazenamento indisponível ou corrompido cai para os padrões sem quebrar a sala. Mudanças valem para os itens ativos e pendentes sem reproduzir novamente nada; ocultar remove provocações da fila sem tocar nos efeitos automáticos, e reativar não despeja o que foi ocultado.
- **Sons:** sintetizados com WebAudio (sem asset de terceiros), curtos e funcionais por categoria/variação, uma reprodução por ativação de item; silenciar corta o som em andamento e impede os seguintes, inclusive provocações. Autoplay bloqueado, contexto indisponível ou `resume()` rejeitado viram silêncio — nunca erro de jogo nem trava de fila.

### Recuperação, pausas e substitutos

- **Retomada da identidade no navegador (T010, publicada):** ao abrir ou reabrir a sala com credencial guardada, a página mostra **"Retomando sua sessão…"** e repete a reentrada com recuo exponencial (500 ms ×1,5 até 4 s) até o vínculo ser confirmado — sem formulário de novo participante, sem apagar a credencial e sem exigir reload ou clique. Cada ciclo tem **prazo efetivo de 60 segundos** (deadline com relógio real; timeout de ack, perda de transporte e disparos concorrentes não o tornam infinito) e é cancelado ao navegar, sair ou desmontar o contexto, sem que respostas atrasadas toquem o contexto novo. Efeito da página, `connect` do socket e nova tentativa manual coalescem num único laço, e cada tentativa lógica usa `intentId` próprio. Recusa temporária (identidade ainda conectada em outra aba/dispositivo) só gera espera; falta de identidade permite a entrada normal; sala inexistente, credencial inválida/revogada, remoção e saída voluntária seguem os fluxos definitivos. **Esgotado o prazo**, mensagem neutra oferece **"Tentar novamente"** (novo ciclo explícito) e **"Voltar ao início"**, preservando a credencial e sem tomar a sessão de outra conexão. Enquanto o vínculo não confirma, comandos da rodada, chat, provocações e controles mutáveis da sala ficam bloqueados na interface e nas APIs do cliente; reconectar o transporte não autoriza envio. Durante a espera ou após esgotar, `joinRoom` sem credencial não sobrescreve a identidade daquela sala. **Aceite local:** deadline, vínculo de transporte e confirmação de resultado incerto dentro/entre ciclos verificados; [T010.final-validation.md](docs/work/reports/T010.final-validation.md). Publicação aceita em [T010-publication.validation.md](docs/work/reports/T010-publication.validation.md).
- **Queda de quem está na rodada:** a rodada inteira pausa por até 90 segundos, mesmo fora da vez da pessoa; nenhum comando altera o motor enquanto pausada. O retorno com a mesma credencial recupera a mão e resolve essa ausência; quando todas as causas somem, a rodada retoma preservada. O timeout sozinho não inicia substituto: sem decisão do anfitrião, a pausa continua e a identidade pode voltar depois do prazo. Ausências múltiplas são independentes: resolver uma não elimina a pausa causada por outra.
- **Decisões do anfitrião na pausa:** `substituteAbsent` ativa o substituto de uma ausência elegível (`agora >= absentSince + prazo`); `continueRound` substitui todas as elegíveis e encerra a retenção, mantendo a pausa se restar causa não elegível; `endRoundWithoutWinner` encerra sem somar vitória e permite nova preparação. Só o anfitrião atual executa, validado no servidor.
- **Substituto automático:** age apenas na vez do assento sob controle automático, com a rodada em andamento e pelo menos uma pessoa conectada. Cada agendamento captura geração e versão da sala; callbacks cancelados (mesmo já entregues à fila) retornam sem tocar no timer atual, no motor ou nos eventos, e o agendamento é refeito depois do `bump` de cada transição — inclusive quando alguém novo entra para aguardar a próxima rodada — para que ações obsoletas não executem nem a vez fique parada. Política determinística: primeira carta válida na ordem da mão preferindo coloridas; coringa escolhe a cor mais presente na mão (desempate na ordem canônica vermelho > amarelo > verde > azul); avisa "Última carta!" junto do descarte que deixa uma carta; depois de comprar, joga só a recém-comprada quando válida, senão passa; nunca denuncia. Decisões usam apenas `projectForPlayer` (mão própria e dados públicos).
- **Saída voluntária:** durante a rodada, `leaveRoom` ativa o substituto na hora, sem pausa, preservando mão e credencial para retorno até o fim da rodada. Fora da rodada, a saída remove o participante e libera a vaga. O fim da rodada retira substitutos desconectados e libera as vagas; vitória de substituto aparece como "Substituto de [apelido]" e não soma ao placar pessoal; se a pessoa retoma a mão antes do fim, a vitória conta normalmente. O replay da saída devolve o ack original mesmo sem vínculo atual e não afeta uma sala nova.
- **Placar histórico:** vitórias humanas vivem em um histórico da sala (`snapshot.scoreboard`), separado da ocupação de vagas. Saída, remoção ou retirada de substituto no fim da rodada preservam as vitórias até a sala expirar ou o servidor reiniciar; entradas históricas não ocupam capacidade, não exigem prontidão nem autorizam retorno com credencial revogada, e identidades distintas nunca se fundem, mesmo com apelidos iguais. Resultados e preparação exibem esse placar.
- **Anfitrião:** quando o anfitrião sai ou cai, o papel passa ao participante conectado há mais tempo (`connectedSince` da conexão atual, não a ordem de entrada); empate pela ordem estável de entrada e, por fim, pelo id. O retorno do anfitrião anterior não reverte a transferência. Remoção de participante (`removeParticipant`) vale no lobby/entre rodadas, só pelo anfitrião; a credencial removida não restaura a autorização revogada.
- **Ausência total e expiração:** sem ninguém conectado, a rodada congela, os substitutos param e a sala (estado, placar e credenciais) é retida por 15 minutos; o primeiro retornante assume como anfitrião e encontra a rodada pausada (a retenção só sai com `continueRound` ou encerramento). Retorno cancela a expiração antiga; nova ausência total inicia um período novo. Sem retorno até o limite, a sala, os índices de participantes/conexões, os registros de intenção dos participantes e os agendamentos são liberados, mesmo com conexões ainda abertas — restam apenas tombstones públicos por conexão, sem referências internas da sala; callbacks antigos são invalidados por token e não apagam sala recuperada. Reiniciar o servidor encerra salas e placares em memória: os clientes exibem "Sala não encontrada" e o caminho de volta ao início.

### Ganchos de teste

Com `TRE_TTA_TEST_HOOKS=1` no servidor e `NEXT_PUBLIC_TEST_HOOKS=1` no web, o cliente autenticado como anfitrião pode definir o baralho da próxima rodada (`test:setNextDeck` / `window.__trettaTest.setNextDeck`) e fixar a variação do próximo efeito automático (`test:setEffectVariant` / `window.__trettaTest.setEffectVariant(variant | null)`, com `null` voltando ao RNG cosmético da sala); o servidor aceita `TRE_TTA_SEED` para reproduzir embaralhamentos e os prazos podem ser encurtados com `TRE_TTA_GRACE_MS`/`TRE_TTA_RETENTION_MS`. O web expõe ainda `window.__trettaTest.disconnect()`/`connect()` para simular perda e recuperação de conexão. Tudo desativado por padrão; nunca usar em produção. Os testes de integração usam um relógio controlável injetado na camada de sala (os heartbeats do Socket.IO continuam no relógio real).

## Testes e tipos

```sh
pnpm -r --workspace-concurrency=1 --if-present test  # Vitest de todos os pacotes em sequência
pnpm typecheck                                      # build dos pacotes + checagem de tipos
```

- `packages/rules/test`: regressões de T001/T002 com estados controlados e simulações completas.
- `packages/protocol/test`: esquemas de entrada (campos desconhecidos, códigos, comandos e intenções novas).
- `apps/server/test`: integração real com Socket.IO sobre HTTP — fluxo de sala, contratos/autorização, deduplicação e ordem, privacidade no transporte (inclusive durante substituição e retorno), oito participantes conectados, recuperação de identidade, pausas com relógio controlado (`FakeClock` injetado), saída/remoção, transferência de anfitrião, retenção/expiração, política do substituto, efeitos automáticos (mapeamento de eventos às quatro categorias, transporte para três clientes, variação fixada por gancho, RNG cosmético independente das regras, vitória de substituto), o processo compilado (`node dist/index.js`; rode `pnpm build` antes) e o harness de dez salas/80 clientes Socket.IO com conclusão simultânea de uma rodada por sala. O `restart.test.ts` mata e reergue o processo real para verificar que a sala em memória deixa de existir.

### Fluxo completo no navegador

```sh
pnpm e2e
```

Executa os testes Playwright em `apps/web/e2e`. O servidor de jogo (porta 3100, semente 7, ganchos de teste, prazos encurtados) é iniciado pelo fixture `serverProc`, que também permite reiniciá-lo no meio do teste; o Next sobe em modo dev na porta 3000. A suíte cobre rodada completa em desktop e celular (compra, passe, descarte da recém-comprada, aviso, escolha de cor, resultado e nova rodada), denúncia, convite inválido, atualização de página com recuperação de mão/fase, perda e recuperação de conexão, pausa com substituto após o prazo, encerramento sem vencedor, saída voluntária, transferência de anfitrião, remoção no lobby, reinício do processo do servidor, chat, provocações, efeitos automáticos e preferências. O cenário T007 abre oito contextos de navegador, incluindo celular, entra por convite, verifica 56 cartas privadas únicas, chat/provocação, reload e resultado/placar. As portas 3000/3100 precisam estar livres. As capturas T007 ficam em `docs/work/reports/assets/T007/`; as imagens não contêm credenciais.

O smoke de produção compila e inicia os processos reais (`node dist/index.js` e `next start`), com os hooks desligados e `NEXT_PUBLIC_SERVER_URL` definido durante o build:

```sh
pnpm --filter @tretta/web e2e:production
```

Ele confirma que `window.__trettaTest` não é exposto e que o navegador conecta ao Socket.IO compilado. Para as dez salas, rode `pnpm --filter @tretta/server exec vitest run test/ten-room-load.test.ts`; as métricas locais incluem processo servidor, 80 clientes e harness e não prometem capacidade em nuvem. Instalação congelada e resultados locais estão em [reports/T007.md](docs/work/reports/T007.md). A publicação gratuita e seus limites estão em [T007-public-validation.md](docs/work/reports/T007-public-validation.md) e [deployment-free.md](docs/work/deployment-free.md). A opção Railway em [deployment.md](docs/work/deployment.md) é apenas histórica.
