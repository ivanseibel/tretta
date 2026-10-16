# T005A — Ajustes: recuperação completa e isolamento de respostas do chat — report do executor

Executado em 15 de outubro de 2026 no working tree deste clone, sem commit. Instruções lidas: `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo, status/plano, `docs/work/T005A.md`, report original (preservado), `docs/work/reports/T005A.validation.md` e o script histórico `assets/T005A-validation/reproduce-client.mjs`. T001–T004 preservadas; nenhum commit foi solicitado e nenhum foi criado. T005B/T005C não foram tocadas.

## Tarefa e resultado

**Concluída**, aguardando revalidação do orquestrador. Os dois achados da validação foram corrigidos no cliente, com regressões novas no nível do provider/ChatPanel montados (React real, transporte controlado) que falhavam antes e passam depois. Instalação congelada, build, suíte completa (**240 testes**: 127 regras + 10 protocolo + 7 web + 96 servidor, 1 pulado), typecheck de todos os pacotes, **13 E2E** e `git diff --check` passam, executados sequencialmente. Nenhuma regra de produto nova; projeção, silêncio, limites, Unicode, ordenação e invariantes de T004 permanecem intactos (chat/leitura continuam sem tocar versão/motor/bot).

## Achados e correções

### 1 (P1) — Lacuna maior que uma página ficava inacessível

**Causa.** O botão “anteriores” usava `chatMessages[0].seq` (menor seq global do cache). Com cache antigo destacado (ex.: só a seq 1) e página recente 12–61, o pedido `before: 1` retornava vazio e o `hasMore` do cliente caía: as mensagens 2–11 permaneciam no servidor sem caminho na UI. A resposta da página recente também sobrescrevia `chatHasMore` sem distinguir fronteiras.

**Correção.** A fronteira de paginação passou a ser derivada do próprio conjunto, sem estado extra: `chatHistoryFrontierOf` (`apps/web/app/providers.tsx`) calcula o menor `seq` da **maior faixa contígua ancorada no topo conhecido** (os seqs são densos e começam em 1, garantia do servidor). `null` quando tudo a partir da seq 1 está presente; caso contrário é o cursor correto de `before`. O contexto expõe `chatHistoryFrontier`; `chatHasMore` passou a ser `chatFrontier !== null` (derivado, não a última resposta). O `ChatPanel` usa a fronteira no clique. A derivação é imune à ordem de chegada das respostas: qualquer merge novo é reavaliado, então uma resposta recente não invalida a fronteira de um “anteriores” em andamento, nem o contrário. Recuperação do cenário 1 + 60: recarga traz 12–61, o botão envia `before: 12`, o servidor devolve 2–11 e o conjunto fecha em 1–61 com o botão sumindo sozinho.

### 2 (P2) — Respostas antigas aplicadas no vínculo atual

**Causa.** `loadChatHistory` e `sendChat` capturavam o código da sala ao emitir, mas aplicavam mensagens, `hasMore`, carregamento e o resultado do envio sem revalidar o vínculo. O filtro de `server:chat` protegia broadcasts, não essas respostas. Um ack antigo contaminava outra sala, ocupava um `seq` que pertencia à sala nova (fazendo a mensagem legítima ser descartada como duplicata) e limpava o rascunho.

**Correção.** Geração do vínculo (`chatLinkRef` + estado `chatLinkEpoch`): cada limpeza (`clearRoomState` — saída, remoção, sala inexistente) e cada vínculo autorizado novo (`resetRoomState` — criação, entrada, reentrada) avança o contador. `loadChatHistory` e `sendChat` capturam a geração ao emitir e, se ela mudou, descartam o efeito: histórico retorna `STALE_CONTEXT` sem tocar mensagens, paginação nem `chatHistoryLoading` do contexto novo; envio retorna `STALE_CONTEXT` (`AckEnvelope` local), o que impede a limpeza do rascunho no `ChatPanel`. A mesma geração mudando no mesmo código (reentrada, inclusive como nova identidade) invalida o trabalho antigo — igualar só o código não basta. Carga/recarregamento do histórico deixou de depender do pulso de conexão: um efeito do `ChatPanel` recarrega a cada `chatLinkEpoch`, então a sincronização ocorre **após** a reentrada autorizada (o join ack), nunca antes — consulta prematura deixa de existir e o painel não fica definitivamente vazio após reconexão.

## Regressões (antes → depois)

`apps/web/test/chat-sync.test.tsx` — 7 testes com `RoomProvider` + `ChatPanel` reais (React 19 + jsdom, `@testing-library/react`), socket/identidade controlados e paginação que replica o contrato do servidor (`before` exclusivo, ascendente, `hasMore`). **Antes: 7 falhando** (evidência em `assets/T005A-adjustments/vitest-red-before.txt`); **depois: 7 passando** (`vitest-green-after.txt`).

| Regressão | Antes (falha observada) | Depois |
| --- | --- | --- |
| Cenário 1 + 60 (cache 1, servidor 61, página recente 12–61) | `before: 1`; 2–11 inacessíveis | `before: 12`; 1–61 completos; botão some |
| Várias páginas perdidas (cache 1–10, servidor 130) | `before: 1` | `before: 81` → 31 → fecha em 130 |
| Ao vivo durante consulta + dois “anteriores” concorrentes fora de ordem | cursor errado | merge idempotente, 1–20 completos, sem duplicata |
| Histórico de A entregue após entrar em B | “histórico da sala A” no chat de B; `hasMore`/carregamento de B atingidos | descartado; loading de B segue o pedido de B |
| Ack de envio de A com seq colidente na sala nova | “envio da sala A” ocupa seq 1; mensagem legítima de B perdida; rascunho limpo | descartado; B.renderiza; rascunho preservado; erro `STALE_CONTEXT` |
| Reentrada no mesmo código como nova identidade + remoção durante consulta | resposta antiga aplicada; “fantasma” ressuscitava | geração invalida; contexto novo intacto |
| Reconexão | `client:chatHistory` prematura junto do join | só `client:joinRoom`; histórico sincroniza após o ack autorizado |

O cenário de corrida do rascunho (`fill`/ack) coberto no E2E de T005A permanece verde; as novas corridas são determinísticas via callbacks controlados.

## Arquivos alterados

- `apps/web/app/providers.tsx`: `chatHistoryFrontierOf` (derivada), geração do vínculo (`chatLinkRef`, `chatLinkEpoch`, `bumpChatLink` em `clearRoomState`/`resetRoomState`), invalidação em `loadChatHistory`/`sendChat`, `chatHasMore` derivado, contexto com `chatHistoryFrontier`/`chatLinkEpoch`; `RoomContextValue` exportado (tipagem dos testes).
- `apps/web/components/ChatPanel.tsx`: efeito único de carregamento por `chatLinkEpoch` (substitui montagem + pulso `lost → live`), botão usando `chatHistoryFrontier`.
- `apps/web/test/chat-sync.test.tsx` (novo), `apps/web/vitest.config.ts` (novo), `apps/web/package.json` (script `test`; devDeps `jsdom`, `@testing-library/react`, `@testing-library/dom`), `apps/web/tsconfig.json` (inclui `test/` e `vitest.config.ts`), `pnpm-lock.yaml` (deps novas).
- `README.md`: contrato do histórico (fronteira derivada, invalidação por geração) e como rodar as regressões.
- `docs/work/status.md`; evidências em `docs/work/reports/assets/T005A-adjustments/` (`vitest-red-before.txt`, `vitest-green-after.txt`, `harness-after-fix.json`).
- Nada mudou em `packages/*` nem em `apps/server`; os reports originais de T005A e a validação ficam como estão.

## Verificação executada

- `pnpm install --frozen-lockfile`: exit 0 (lockfile atualizado com as devDeps de teste, depois congelado).
- `pnpm build`: exit 0 (rules, protocol, server, web — `next build` typea também `test/`).
- `pnpm -r --if-present test`: exit 0 — 127 (regras), 10 (protocolo), **7 (web, novas)**, 96 (servidor; 1 pulado).
- `rtk proxy pnpm -r --if-present typecheck`: exit 0 após o build.
- `pnpm --filter @tretta/web e2e`: exit 0 — 13 testes em 38,8 s, incluindo os três specs de chat e o reinício real do servidor.
- `rtk git diff --check`: exit 0. Sem commit; árvore preservada além dos arquivos citados.

## Reexecução da evidência histórica

`reproduce-client.mjs` executado **sem alteração** após o build (`assets/T005A-adjustments/harness-after-fix.json`):

- Controle (acks na mesma sala + broadcast duplicado) e controle de chat após compra: continuam conformes.
- Histórico atrasado após trocar de sala: “histórico da sala A” **desapareceu** do estado de B (`messages: ["mensagem da sala B"]`). O campo `staleHasMoreApplied: true` do harness não é mais vazamento: `chatHasMore` é agora a fronteira derivada do conjunto de B (só seq 2, faltando a seq 1 ainda não entregue pelo carregamento próprio de B) — a regressão montada prova que, ao concluir o load de B, o botão some.
- Ack de envio atrasado: B mantém só a mensagem de B.
- Recuperação 1 + 60: o harness continua enviando o cursor antigo `chatMessages[0].seq` (= 1) e por isso ainda reporta `missing: [2..11]` — **mudança de interface que impede o harness**: o botão real passou a usar `chatHistoryFrontier` (= 12). O mesmo campo já aparece no render do provider e a regressão montada recupera as 61 com `before: 12`. `canLoadOlderAfterwards` virou `true` (antes `false`): a UI não esconde mais o caminho. O script não foi alterado para não esconder o achado; a recuperação integral é demonstrada pelos testes novos.

## Precisões documentais

Conforme apontado na validação (reports originais preservados): `classic-public-table.test.ts` tem **quatro** testes (127 − 123), não doze; `projectPublicTable(state: RoundState)` recebe **apenas o estado**; o handler de envio de chat deduplica em `participant.intents` (escopo do participante), não por conexão.

## Decisões e limites

- **Fronteira derivada, não estado de cursor**: recalculada a cada merge; imune a ordem de respostas concorrentes e sem bookkeeping paralelo a corromper. Pressupõe seqs densos a partir de 1 — invariantes do servidor (`chatNextSeq`), cobertos pela suíte.
- **`STALE_CONTEXT` é código só de cliente** (como `OFFLINE`/`TIMEOUT`), fora do `ErrorCode` do protocolo; o envio stale vira recusa para o painel, que preserva o rascunho.
- **Sem consulta prematura**: a recarga espera o join ack (reentrada autorizada) em vez de tratar “socket conectado” como vínculo.
- Infra de teste nova só em dev (`jsdom`, Testing Library); nenhum limite de produção ampliado, nenhuma espera longa nos testes.
- Limites conhecidos mantidos: histórico em memória (some com o servidor), E2E com prazos encurtados, `browser-harness` indisponível no ambiente (suíte Playwright como verificação de navegador, como na validação).

## Próximo passo

Revalidação do orquestrador. Sem pendências de implementação dentro do escopo dos ajustes; T005B depende do aceite.
