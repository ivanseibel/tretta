# Report do executor — ajustes de T003

Executado em 14 de outubro de 2026 no working tree deste clone, sem commit. Report sujeito à revalidação do orquestrador. Validação de origem: [T003.validation.md](T003.validation.md). Prompt: [T003-adjustments.md](../T003-adjustments.md).

## Tarefa e resultado

**Concluída (proposta de conclusão).** Os dois achados de deduplicação foram corrigidos: registros de intenção deixam de ser expulsos por limite de quantidade (vivem enquanto o escopo — participante ou conexão — viver) e a assinatura passa a incluir o tipo de operação/evento, de modo que o mesmo id em outra operação é recusado com `INTENT_REUSED`. Seis regressões novas por Socket.IO real cobrem os cenários da validação, incluindo replay antigo após mais de 256 intenções, replay de compra com a vez novamente jogável e reuso cruzado início/retorno. Todas as verificações do projeto (instalação congelada, build, suíte completa, tipos e E2E) passam.

## Alterações

- `apps/server/src/rooms.ts`: removido o teto `MAX_INTENTS_PER_PARTICIPANT` e a expulsão do registro mais antigo; `dedupe` (participante) e `dedupeSocket` (conexão, criação/entrada) agora preservam a resposta pelo tempo de vida do escopo. O campo passou a se chamar `signature` (assinatura = operação + payload) e o comentário documenta a semântica: repetição idêntica devolve exatamente a resposta original sem reexecutar; assinatura diferente ⇒ `INTENT_REUSED`. Nenhuma outra regra de T003 foi reduzida.
- `apps/server/src/handlers.ts`: helper `intentSignature(event, payload)` incluindo o nome do evento; aplicado em `client:createRoom`, `client:joinRoom`, `client:setReady`, `client:startRound`, `client:command` (evento + `roundId` + comando) e `client:returnToLobby`. O gancho `test:setNextDeck` passou a usar o mesmo mecanismo (dedupe por participante, assinatura com evento e payload).
- `packages/protocol/src/index.ts`: `setNextDeckPayloadSchema` agora exige `intentId` (gancho de teste alinhado ao restante do contrato).
- `apps/web/app/providers.tsx`: `window.__trettaTest.setNextDeck` envia `intentId` novo a cada chamada.
- `apps/server/test/helpers.ts`: helper `setNextDeck` inclui `intentId`.
- `apps/server/test/dedupe-retention.test.ts` (novo): 6 regressões por Socket.IO real descritas abaixo.
- `README.md`: contrato de deduplicação atualizado (escopo da chave, operação na assinatura, vida útil dos registros, resposta consistente sem reemitir snapshots).
- `docs/work/status.md`: “T003 aguardando revalidação do orquestrador”.

Versões, build e estrutura aceitos não mudaram; nenhum pacote ou dependência nova.

## Evidência por critério de aceite

### 1. Prontidão antiga após mais de 256 intenções

`dedupe-retention.test.ts > “repetir uma prontidão antiga após 256 intenções não reexecuta nem altera estado”`: envia `client:setReady` id `intent-old-ready-retention`/`ready: true` (ack original), depois 256 intenções distintas de prontidão alternada terminando em `false` (versão avança, prontidão volta a `false`), e reenvia a intenção original idêntica. Resultado: ack **igual ao original**, prontidão permanece `false`, `version` inalterada, nenhum `server:state` novo e nenhum evento novo (aguarda 120 ms após o ack para descartar atraso). Na implementação anterior o registro era expulso e a mutação reexecutava.

### 2. Compra antiga com a vez novamente jogável

`dedupe-retention.test.ts > “repetir uma compra antiga quando comprar voltaria a ser válido…”`: numa rodada ativa com baralho determinístico, Ana compra com id fixo (mão 8, fase `after-draw`); em seguida envia 256 compras distintas recusadas com `ALREADY_DREW` (registradas no mesmo escopo), passa, Bia compra e passa — a vez volta a Ana em fase `play`, estado em que uma compra seria válida. O replay devolve o ack original, a mão continua com 8 cartas, a fase segue `play`, `version` e eventos `drew` não mudam. Para provar que a proteção não é só efeito da ilegalidade momentânea, uma compra **nova** logo depois funciona (mão 9, `after-draw`, evento `drew` +1).

### 3. Reuso entre operações

- `“…início versus retorno com payloads iguais”`: `client:startRound` id `intent-cross-operation` inicia a rodada; `client:returnToLobby` com o **mesmo id e payload de mesmo formato** (`{ intentId }`) é recusado com `INTENT_REUSED`, sala continua `playing` e versão inalterada. Repetir o `startRound` original devolve o ack idêntico, sem nova rodada (mesmo `roundId`/`roundNumber`/`version`).
- `“…prontidão versus início com o mesmo id”`: `setReady` aceito; mesmo id com `ready: false` (mesmo evento, outro payload) ⇒ `INTENT_REUSED`; mesmo id em `startRound` ⇒ `INTENT_REUSED`; repetir o `setReady` original devolve o ack idêntico, sem alterar prontidão/versão.
- `“…criação e entrada memorizam por conexão…”`: `client:createRoom` repetido com o mesmo payload devolve o ack idêntico e mantém uma única sala; mesmo id com apelido diferente ⇒ `INTENT_REUSED`. `client:joinRoom` idem: replay consistente, sala permanece com 2 participantes; conflito de payload ⇒ `INTENT_REUSED`.
- `dedupe.test.ts` (T003 original) continua passando: mesma operação/payload repete o resultado; id reusado com outro conteúdo ⇒ `INTENT_REUSED`; identidades e salas isoladas; descarte de Bloqueio com duas pessoas inofensivo à duplicata.

### 4. Duplicatas não alteram estado nem reenviam snapshots

Coberto nos itens 1–3 (versão, prontidão, mãos, fases e contagens de eventos) e em `“…duplicata de comando não altera rodada antiga nem reenvia snapshot…”`: replay de descarte devolve o mesmo ack, nenhum `server:state` novo chega após 120 ms e o evento `played` segue único. `dedupe.test.ts` mantém os cenários de vitória única, nova rodada/prontidão e ordem de aviso/denúncia.

### 5. Documentação do contrato

Seção “Deduplicação e sincronização” do README atualizada: chave `(escopo, intentId)` com escopo = participante ou conexão; assinatura inclui operação/evento + payload validado; vida útil = enquanto o escopo viver (sem expulsão); repetição devolve exatamente a resposta original sem reexecutar nem reemitir snapshots/eventos; ack pode carregar versão antiga e a ordenação do cliente a ignora; reuso cruzado ⇒ `INTENT_REUSED`.

### 6. Critérios originais de T003 permanecem atendidos

- `packages/rules`: 123 testes (regressões T001/T002) passando.
- `packages/protocol`: 6 testes passando.
- `apps/server`: 7 arquivos, 29 testes passando e 1 placeholder ignorado, incluindo processo compilado (`node dist/index.js`), fluxo de sala, contratos/autorização, privacidade no transporte (3 clientes + isolamento entre salas), oito participantes e os novos de retenção.
- E2E Playwright: 3 testes passando (rodada completa desktop + Pixel 7 com compra/passe/descarte da recém-comprada/aviso/cor, denúncia e entrada em espera, convite inválido), atualizando os screenshots em `docs/work/reports/assets/T003/`.

## Comandos executados e resultados

| Comando | Resultado |
| --- | --- |
| `rtk pnpm install --frozen-lockfile` | exit 0, lockfile inalterado |
| `rtk pnpm build` | exit 0 (rules, protocol, server, web) |
| `rtk pnpm test` | exit 0 — rules 123, protocol 6, server 29 (+1 placeholder ignorado) |
| `rtk proxy pnpm -r --if-present typecheck` | exit 0 em todos os projetos |
| `rtk pnpm --filter @tretta/server test` | exit 0 — 7 arquivos, 29 testes, incluindo `dedupe-retention.test.ts` (6) |
| `rtk pnpm --filter @tretta/web e2e` | exit 0 — 3 testes Playwright |
| `git diff --check` | sem erros de espaçamento |

Iteração interna (sem impacto no resultado): a primeira execução após a mudança falhou porque `test:setNextDeck` ainda não enviava `intentId` nos testes; o schema/helper foram alinhados ao novo contrato e as suítes voltaram a passar.

## Decisões e desvios

- **Sem limite de retenção** (opção indicada no prompt): nesta instância em memória, os registros vivem enquanto o participante/conexão viver; nada é expulso. Limitar respostas sem perder o reconhecimento de intenções antigas exigiria um mecanismo extra (marcas por escopo) sem ganho neste escopo; a semântica escolhida é a mais simples e não reduz garantias. O consumo de memória acompanha o tamanho da partida e é liberado quando a sala/participante deixa de existir (retenção de salas é T004).
- **Assinatura com evento** nos seis handlers mutáveis e no gancho de teste; cache do id continua **compartilhado** por pessoa (recusa cruzada entre operações), como o critério exige; caches separados por evento seriam insuficientes.
- `test:setNextDeck` passou a exigir `intentId` — gancho de teste alinhado ao mesmo mecanismo; o provider web gera um novo id por chamada. Nenhum fluxo de jogador mudou.
- Nenhum desvio de escopo: recuperação/pausas/substitutos (T004), chat/visibilidade (T005), polimento (T006) e carga/HTTPS (T007) não foram tocados.
- Mensagens da interface que citam “próxima tarefa” permanecem (substituição prevista ao implementar o fluxo completo de T004, conforme a validação).

## Limitações

- Verificação somente em macOS, Node 22.23.1, store pnpm local; sem clone limpo de outra máquina.
- A retenção de registros é indefinida no processo; a expiração de salas/participantes pertence a T004 (retenção de 15 minutos) e, para uma instância única em memória, o custo atual é proporcional ao histórico de intenções por pessoa.
- Celular verificado por emulação (Pixel 7); aparelho físico, mesa de oito navegadores, carga e HTTPS permanecem em T007.
- `pnpm test` inclui o teste do processo compilado apenas quando `dist/` existe (o README orienta `pnpm build` antes).

## Próximo passo

Entregar ao orquestrador para revalidação de T003. T004 continua dependente do aceite e das decisões de produto já previstas no plano (troca de anfitrião no retorno e encerramento da rodada quando todos saem).
