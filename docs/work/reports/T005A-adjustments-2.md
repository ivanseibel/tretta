# T005A — Bloquear envio até confirmar o vínculo recuperado — report do executor

Executado em 15 de outubro de 2026 no working tree deste clone, sem commit. Instruções lidas: `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo, status/plano, `docs/work/T005A.md`, `docs/work/T005A-adjustments.md`, `docs/work/reports/T005A-adjustments.md` e `docs/work/reports/T005A.revalidation.md`. T001–T004 e as correções já confirmadas da revalidação (paginação por fronteira, isolamento de acks) foram preservadas. T005B/T005C não foram tocadas; nenhum commit foi solicitado ou criado.

## Tarefa e resultado

**Concluída**, aguardando revalidação final do orquestrador. O cliente passou a representar explicitamente a disponibilidade do vínculo autorizado do chat (`chatLinkReady`): invalida na perda de conexão/vínculo e só volta após criação, entrada ou reentrada confirmada. Botão e `sendChat` respeitam essa disponibilidade; o rascunho é preservado e a UI indica a recuperação. Instalação congelada, build, suíte completa (**244 testes**: 127 regras + 10 protocolo + 11 web + 96 servidor, 1 pulado), typecheck de todos os pacotes, **13 E2E** e `git diff --check` passam, executados sequencialmente.

## Causa e correção

**Causa.** O evento `connect` (`apps/web/app/providers.tsx`) mudava a conexão para `live` antes da resposta de `rejoin`. `ChatPanel` habilitava o envio só por esse estado, e `sendChat` verificava apenas código da sala e socket conectado. Com o ack de join pendente — transporte de volta, vínculo individual ainda não confirmado (reentrada pode falhar ou exigir novas tentativas) — o botão ficava habilitado e a chamada direta à API emitia `client:chatSend`. O servidor recusava (`NOT_IN_ROOM`), mas o cliente permitia a tentativa antes da confirmação.

**Correção.** Disponibilidade explícita do vínculo autorizado pertinente ao chat, no cliente:

- `chatLinkReady` no contexto (`RoomProvider`): inicia em falso; **invalida** em `disconnect` e em `clearRoomState` (saída, remoção, sala inexistente, credencial inválida); **restabelece** em `resetRoomState`, chamado somente após ack de criação, entrada ou reentrada confirmada. Espelho em ref (`chatLinkReadyRef`) para o envio decidir sem capturar estado desatualizado.
- `sendChat` recusa com `LINK_PENDING` (código só de cliente, como `OFFLINE`/`TIMEOUT`/`STALE_CONTEXT`) **sem emitir** ao socket enquanto `chatLinkReady` for falso — proteção não é só visual.
- `ChatPanel`: `canSend` passou a exigir `chatLinkReady`; o placeholder indica a recuperação (“Recuperando a conexão com a sala…”). Rascunho permanece intacto nas recusas.
- Transporte reconectado (`connection === 'live'`) deixa de ser tratado como vínculo: a disponibilidade só volta com a confirmação correspondente, e cada vínculo autorizado novo habilita somente o seu próprio contexto (a geração `chatLinkEpoch` já cobre a invalidação de respostas antigas).

Nenhuma regra de jogo, limite, autenticação de conta ou protocolo de acesso foi alterado. Chat/leitura continuam sem tocar versão/motor/bot.

## Regressões (antes → depois)

`apps/web/test/chat-sync.test.tsx` — quatro testes novos somados aos sete anteriores, com `RoomProvider` + `ChatPanel` reais (React 19 + jsdom, `@testing-library/react`) e transporte controlado. **Antes: 3 falhando** dos novos (evidência em `assets/T005A-adjustments-2/vitest-red-before.txt`); **depois: 11 passando** (`vitest-green-after.txt`).

| Regressão | Antes (falha observada) | Depois |
| --- | --- | --- |
| Reconexão com join pendente: rascunho, botão e API direta | botão habilitado (`buttonEnabledBeforeJoinAck: true`), placeholder comum, `sendChat` emite `client:chatSend` antes do ack | botão bloqueado, placeholder “Recuperando…”, `sendChat` recusa sem emissão, rascunho preservado, nenhuma consulta prematura de histórico (pendente só `client:joinRoom`) |
| Reentrada confirmada: envio | — | histórico sincroniza após o ack; exatamente um `client:chatSend` com o código da sala; ack + broadcast idempotentes por `seq`; rascunho limpo só no ok |
| Reentrada recusada (`ROOM_NOT_FOUND`) | `chatLinkReady` inexistente; envio não tinha bloqueio por vínculo | `roomGone` e bloqueio mantidos; `sendChat` sem emissão; vínculo posterior em outra sala habilita somente o seu contexto |
| Remoção com reentrada pendente | idem | `clearRoomState` invalida; `sendChat` sem emissão |

As sete regressões anteriores permanecem verdes na mesma suíte (11/11 no arquivo). O cenário de reconexão sem consulta prematura foi mantido e agora também cobre botão/API.

Teste suplementar do orquestrador (`docs/work/reports/assets/T005A-revalidation/run-authorization-check.mjs`), executado como referência após a correção: **exit 0** (antes exit 1); observações agora `buttonEnabledBeforeJoinAck: false`, `chatSendEmittedBeforeJoinAck: false`, `transportLive: true`. Artefato histórico preservado sem alteração; nenhum teste temporário permaneceu (`apps/web/test/` contém apenas `chat-sync.test.tsx`).

## Arquivos alterados

- `apps/web/app/providers.tsx`: estado/ref `chatLinkReady`, invalidação em `disconnect`/`clearRoomState`, restabelecimento em `resetRoomState`, recusa `LINK_PENDING` em `sendChat`, contexto tipado.
- `apps/web/components/ChatPanel.tsx`: `canSend` com `chatLinkReady`; placeholder de recuperação.
- `apps/web/test/chat-sync.test.tsx`: quatro regressões novas no describe “autorização do vínculo para envio do chat”.
- `docs/work/status.md`; evidências em `docs/work/reports/assets/T005A-adjustments-2/` (`vitest-red-before.txt`, `vitest-green-after.txt`).
- Nada mudou em `packages/*`, `apps/server`, nem nos reports e prompts anteriores.

## Verificação executada

- `rtk proxy pnpm install --frozen-lockfile`: exit 0.
- `rtk proxy pnpm build`: exit 0 (a primeira execução falhou no typecheck do `next build` por um `.value` sem cast no teste novo; corrigido e reexecutado).
- `rtk proxy pnpm test`: exit 0 — 127 (regras), 10 (protocolo), **11 (web)**, 96 (servidor; 1 pulado) = 244 passando.
- `rtk proxy pnpm -r --if-present typecheck`: exit 0 após o build.
- `pnpm --filter @tretta/web e2e`: exit 0 — 13 testes em 39,3 s.
- `rtk git diff --check`: exit 0.
- Runner do teste suplementar do orquestrador: exit 0 após a correção.

Ambiente macOS/Node 22.23.1; E2E via suíte Playwright existente. Limites já registrados permanecem: `browser-harness` indisponível, histórico em memória, E2E com prazos encurtados.

## Decisões e desvios

- **Nome e semântica**: `chatLinkReady` no contexto; `LINK_PENDING` é código só de cliente, fora do `ErrorCode` do protocolo.
- **Estabelecer em `resetRoomState`**: único ponto já comum a criação, entrada e reentrada confirmadas; recusas (`not-found`, `invalid`, `already`, `error`) não o alcançam e mantêm o bloqueio.
- Indicação de recuperação via placeholder (sem elemento extra); rascunho nunca é limpo por recusa de vínculo.
- Sem mudança de servidor, protocolo, limites de jogo ou autenticação.

## Próximo passo

Revalidação final do orquestrador. Sem pendências de implementação dentro do escopo; T005B depende do aceite.
