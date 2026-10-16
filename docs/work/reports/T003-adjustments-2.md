# Report do executor — ajustes finais de T003

Executado em 14 de outubro de 2026 no working tree deste clone, sem commit. Report sujeito à revalidação final do orquestrador. Revalidação de origem: [T003.revalidation.md](T003.revalidation.md). Prompt: [T003-adjustments-2.md](../T003-adjustments-2.md).

## Tarefa e resultado

**Concluída (proposta de conclusão).** Os dois pontos restantes do contrato de deduplicação foram fechados:

1. O ack memorizado de `client:createRoom` e `client:joinRoom` agora é construído com campos imutáveis capturados na primeira execução (inclusive `version`); o replay idêntico devolve exatamente o ack original mesmo depois de a sala avançar de versão, sem reexecutar nem reemitir snapshots/eventos.
2. `handleDisconnect` limpa o cache por conexão **sempre** — inclusive quando a conexão nunca criou/entrou em sala (ex.: `ROOM_NOT_FOUND`) — mantendo intactos os registros por participante, que continuam protegendo replays depois da reentrada.

As correções anteriores (retenção sem teto e assinatura por evento) foram preservadas. Instalação congelada, build, 162 testes das suítes (rules 123 + protocolo 6 + integração 33), tipos e os três E2E passam.

## Alterações

- `apps/server/src/handlers.ts`: os handlers de criação e entrada passam a montar o ack (`CreateRoomAck`/`JoinRoomAck`) **dentro** do cálculo da intenção, capturando `roomCode`, `playerId`, `credential`, `rejoined` e `version` no primeiro processamento; o replay do cache devolve esse ack congelado, sem ler referências mutáveis da sala. Formato público inalterado. `socket.join` no replay é idempotente e não altera o estado.
- `apps/server/src/rooms.ts`: `handleDisconnect` descarta primeiro o cache de intenções da conexão e só depois verifica o participante; entradas recusadas não deixam mais registros órfãos. Comentário documenta que os registros do participante têm vida útil própria.
- `apps/server/test/dedupe-retention.test.ts`: 4 regressões novas por Socket.IO real (criação com ack congelado, entrada com ack congelado, limpeza do cache da conexão após recusa/desconexão, sobrevivência dos registros do participante à reconexão).
- `README.md`: contrato de deduplicação precisado — resposta com campos capturados na primeira execução (inclusive `version`) e cache da conexão descartado ao terminar a conexão, com registros do participante preservados.

Nenhum pacote, versão, dependência ou schema mudou nesta rodada.

## Evidência por critério de aceite

### 1. Replay de criação/entrada com ack original e versão diferença real

- `dedupe-retention.test.ts > “replay de criação devolve o ack original congelado após a sala avançar de versão”`: cria a sala com id fixo (ack com `version` 1), envia 3 intenções distintas de prontidão (versão vai a 4) e repete a criação idêntica. Resultado: `toEqual(original)` — inclusive `version: 1` —; versão atual permanece 4; nenhum novo `server:state` nem evento (aguarda 120 ms após o ack); uma única sala e um único participante; `roundNumber` segue 0. Na implementação anterior o replay lia `response.room.version` da sala viva e devolvia versão posterior.
- `“…replay de entrada devolve o ack original congelado…”`: entrada com id fixo (ack original com `rejoined: false`), 2 mutações posteriores na sala (versão +2) e replay idêntico: `toEqual(original)`, versão atual inalterada, nenhum snapshot novo para quem entrou e a sala continua com 2 participantes.

### 2. Limpeza do cache de conexão

- `“…fim de conexão limpa o cache da conexão mesmo sem sala; cache alheio permanece”`: `client:joinRoom` para `ZZZZZZ` recusado com `ROOM_NOT_FOUND` deixa exatamente 1 registro no cache da conexão (inspeção interna da estrutura, sem endpoint público); uma segunda conexão também acumula 1 registro recusado. Ao desconectar a primeira, seu cache zera (aguardando o processamento do servidor) e o da segunda permanece 1.
- `“…registros do participante sobrevivem ao fim da conexão e seguem protegendo replays”`: participante com 2 registros de prontidão; ao desconectar, o cache **da conexão** zera, mas os 2 registros do participante permanecem. Após reentrada com credencial (`rejoined: true`), o replay da intenção antiga de prontidão devolve exatamente o ack original; `ready` continua `false` (a última intenção válida antes da queda) e a versão não muda — provando que a proteção não foi perdida nem reexecutada.

### 3. Regressões anteriores preservadas

- `dedupe-retention.test.ts` agora com 10 testes: os 6 das correções anteriores (prontidão antiga após 256 intenções, compra antiga com vez novamente válida, `INTENT_REUSED` início×retorno e prontidão×início, criação/entrada memorizadas por conexão, duplicata sem snapshot novo) continuam passando.
- `dedupe.test.ts` (7) mantém Bloqueio 2p, vitória única, nova rodada/prontidão, isolamento entre pessoas/salas e ordem de aviso/denúncia.
- Privacidade no transporte (3 clientes e isolamento entre salas), contratos/autorização, fluxo de sala, oito participantes e processo compilado (`node dist/index.js`) seguem verdes na suíte de integração (7 arquivos, 33 testes + 1 placeholder ignorado).
- `packages/rules` 123 testes e `packages/protocol` 6 testes passando; E2E Playwright (rodada completa desktop + Pixel 7, denúncia/espera e convite inválido) 3 de 3.

### 4. Verificações do projeto

| Comando | Resultado |
| --- | --- |
| `rtk pnpm install --frozen-lockfile` | exit 0, lockfile inalterado |
| `rtk pnpm build` | exit 0 (rules, protocol, server, web) — executado antes do teste de processo compilado |
| `rtk pnpm test` | exit 0 — rules 123, protocolo 6, servidor 33 (+1 placeholder ignorado) |
| `rtk proxy pnpm -r --if-present typecheck` | exit 0 em todos os projetos (sem repetir build) |
| `rtk pnpm --filter @tretta/web e2e` | exit 0 — 3 testes Playwright desktop/celular |
| `git diff --check` | sem erros de espaçamento |

Iteração interna (sem efeito no resultado): nas primeiras execuções, duas regressões novas acusaram corrida de sincronização do teste (esperavam uma versão intermediária antes de a última mutação chegar ao cliente observador); os testes passaram a aguardar a versão final exata. Não houve falha funcional do servidor.

## Decisões e desvios

- **Ack congelado no cálculo da intenção**: em vez de copiar campos após o retorno do `RoomStore`, o handler monta o payload do ack na primeira execução e o cacheia; o formato público (`CreateRoomAck`/`JoinRoomAck`) não mudou. O `socket.join` continua sendo executado no caminho de sucesso (inclusive replay), por ser idempotente e não alterar estado.
- **Limpeza incondicional do cache de conexão**: a remoção acontece antes da verificação de participante, cobrindo conexões que só acumularam recusas. Os registros por participante continuam fora desse caminho, pois servem à identidade recuperável (T004).
- **Inspeção interna apenas no teste**: a contagem de registros usa cast para a estrutura privada do `RoomStore` dentro da suíte; nenhum endpoint ou payload público expõe caches ou credenciais.
- Sem desvio de escopo: expiração de salas, pausas, substitutos e anfitrião continuam em T004; nenhum arquivo do orquestrador foi alterado além do `status.md` de estado.

## Limitações

- Verificação somente em macOS, Node 22.23.1, store pnpm local; sem clone limpo de outra máquina.
- Celular verificado por emulação (Pixel 7); aparelho físico, mesa de oito navegadores, carga, HTTPS e publicação permanecem em T007.
- O teste do processo compilado depende de `dist/` existente (build executado antes; sem build ele aparece como ignorado, conforme o README).
- O cache por participante segue com retenção indefinida no processo (correção aceita na revalidação); expiração de salas/participantes é T004.

## Próximo passo

Entregar ao orquestrador para revalidação final de T003. T004 continua dependente do aceite e das decisões de produto já previstas no plano (troca de anfitrião no retorno e encerramento da rodada quando todos saem).
