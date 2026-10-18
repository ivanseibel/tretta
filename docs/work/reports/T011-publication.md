# T011 — Report de publicação

**Tarefa e resultado:** executada como proposta; aguarda validação do orquestrador. A mesa de treino (fonte acumulada T008–T011) foi publicada nos serviços existentes: backend Render no deploy `dep-db9lnpm1egvs73ct80ig` da revisão `3ae459e` e frontend promovido como `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP` em `https://tretta.vercel.app`. Commit único `3ae459e` enviado a `origin/main`; nenhum segundo push (documental) foi feito. Custo permanece zero.

## Entrega

- **Fonte e commit:** working tree conferido contra o manifesto aceito — **148/148 arquivos** funcionais idênticos, 0 diferenças/0 faltantes (`01-source-verification.json`), incluindo as fontes novas de T011. Commit local único `3ae459e5a88e612dc389e7bcb4570809ddcc3445` ("feat: deliver family refinements, recovery fix and training table") com seleção explícita de fontes/testes/documentação sanitizada. Push normal `8967e94..3ae459e main -> main` (`23-push.txt`); `origin/main` confere com o SHA exato; sem force-push/reset.
- **Upload:** snapshot de **163 arquivos / 1.317.728 bytes** (dry run: framework Next.js; ignorados `.env.local`, `.gitignore`, `.vercel`); manifesto SHA-256 por arquivo em [source-manifest.sha256.txt](assets/T011-public/source-manifest.sha256.txt), digest do conjunto `80be6645…`; sem `.git`, dependências, builds, env, ZIPs ou `.vercel`; `docs/` fora do upload.
- **Frontend:** projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `seibel` (`team_4mQparNtNCNqsb95uxf2FzoD`), plano **hobby**, root `apps/web`, Node 22.x, `NEXT_PUBLIC_SERVER_URL`/`NEXT_PUBLIC_TEST_HOOKS=0` preservados, Corepack/pnpm 11.14.0, Next.js 16.4.1. **Staged production** `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP`, READY, em `https://tretta-qj6nwkkie-seibel.vercel.app`; promoção do **mesmo build** (`vercel promote`, "Success! … [3s]", sem rebuild); `vercel alias ls` confirma `tretta.vercel.app → tretta-qj6nwkkie-seibel.vercel.app`; HTTP público 200 (12.968 bytes, título Tretta, "Treinar sozinho" no HTML) e marcadores de treino também nos chunks públicos; build T010 anterior permanece disponível para rollback.
- **Backend:** `srv-db95f2u7bikc73dpndt0`, workspace `tea-cuhq60rv2p9s738m7us0`, plano **Free**, 1 instância; auto-deploy `dep-db9lnpm1egvs73ct80ig` (trigger `new_commit`, `2026-10-17T11:28:38Z` → `11:29:58Z`, Live) da revisão exata `3ae459e`; instalação congelada + build filtrado do servidor; log de runtime "Tretta server listening on http://localhost:10000 (web origin: https://tretta.vercel.app)"; healthcheck HTTPS 200 `{"ok":true}`; CORS restrito à origem; hooks desligados; sem deploy manual duplicado.
- **Evidências:** [assets/T011-public](assets/T011-public/) — `deployment.json`, `source-manifest.sha256.txt`, `source-files.json`, `build-log-checks.json`, `bundle-markers.json`, `protocol-check.json`, `cors-origin-check.txt`, `promote.txt`, `alias-after-promote.txt`, `smoke-public.json` e `smoke/` com 12 capturas e logs dos passos (step1–step8).

## Critérios de aceite

| Critério | Evidência | Situação |
| --- | --- | --- |
| **P1 — Fonte**: aceita, commit/push e manutenção identificados; remoto no SHA; upload limpo | 148/148 conferidos antes do commit; commit `3ae459e` revisado (fontes T008–T011, testes e docs/evidências sanitizados; nenhum `.env`/ZIP/dependência/build/cache); push `8967e94..3ae459e`; `origin/main` = SHA; upload 163/1.317.728 bytes, digest `80be6645…`, dry run sem privados/gerados | Atendido (proposta) |
| **P2 — Backend**: mesmo serviço Free, novo deploy Live da revisão exata, healthcheck, protocolo treino/humano, hooks desligados, sem deploy duplicado | Auto-deploy `dep-db9lnpm1egvs73ct80ig` da revisão `3ae459e` (Free, 1 instância, `new_commit`, Live 11:29:58Z); build congelado + filtro; `TRE_TTA_TEST_HOOKS=0`; seed ausente; origem `https://tretta.vercel.app`; healthz 200 `{"ok":true}`; protocolo próprio **16/16 verde** (mode `training`, 4 participantes, bots Lila/Nino/Tico prontos; recusas `TRAINING_ROOM_ENTRY_REFUSED` sem credencial e com credencial falsa; `TEST_HOOKS_DISABLED` nos dois hooks; sala clássica create/join/ready/start/playing/chat/history/leave; transporte `websocket`) | Atendido (proposta) |
| **P3 — Frontend/domínio**: mesmo projeto Seibel Hobby, staged READY, promoção do mesmo build, alias correto, HTTP/bundle | Staged `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP` READY antes do push (`--skip-domain`); promovido o mesmo build após backend Live, sem rebuild; alias direto conferido; HTTP 200 e marcadores (`Treinar sozinho`, `training`, `tretta-server.onrender.com`, `sessão em retomada`, `Recuperando o vínculo`) nos chunks públicos; `__trettaTest`/hooks ausentes nos chunks | Atendido (proposta) |
| **P4 — Experiência pública**: rodada completa, placar/outra rodada, recuperação/duas abas/recusa, sala comum/chat/preferência | Rodada 1 real completa pelas regras normais (4 jogadas + 1 compra/passa; vitória legítima da bot Lila; placar Lila 1, demais 0) e rodada 2; reload na rodada ativa: "recuperando" → mesma mão 8=8 → pausa "Os bots esperam por você…" → continuação com fase pós-compra preservada; duas abas: segunda protegida (sem formulário/mão), após fechar a primeira retomou com a mesma mão 8=8; recusas sem credencial (mensagem individual com bots, sem identidade criada, reload volta ao formulário) e com credencial falsa (recusa imediata, credencial intacta); sala comum com 2 clientes: convite/entrada/prontidão/início, mãos 7/7, uma jogada de cada, chat A→B e B→A, aviso de vez ligado por padrão → desligado e persistido após reload, recuperação da B com mão 6=6 e chat funcionando; saída dos dois clientes; zero erros de console/página; HTTPS; hooks ausentes no cliente | Atendido (proposta) |
| **P5 — Preservação/operação**: históricos intactos, custo zero, nenhuma sala alheia, estado/rollback e perdas/reinícios precisos | Nenhum teste/evidência reescrito na fonte; planos Free/Hobby sem novos recursos/domínio/cartão; só salas próprias usadas e encerradas; único reinício foi o do próprio deploy Render (11:28–11:29Z) na janela sem partidas confirmada pelo usuário, sem perdas reportadas; rollback documentado no runbook (frontend ao T010; backend `8967e94`/rollback suportado); reports/estado ficam no working tree sem novo push | Atendido (proposta) |

## Verificação (comandos e resultados sanitizados)

- **Git:** `git status`/`log`/diff da lista staged conferidos; um único commit com seleção explícita; `git push` normal; `git rev-parse origin/main` = `3ae459e5…`.
- **Upload:** `rsync` do working tree para cópia temporária com exclusões de `.git`/deps/builds/env/`.vercel`/ZIPs; `sha256sum` gerando o manifesto; `vercel link --project tretta --scope seibel`; `vercel deploy --dry`: Next.js, 163 arquivos, 1.317.728 bytes, ignorados `.env.local`/`.gitignore`/`.vercel`.
- **Vercel:** `vercel env ls` (variáveis preservadas, sem exposição de valores privados); `vercel deploy --prod --skip-domain` (staged READY; build com Corepack/pnpm 11.14.0 e Next.js 16.4.1); `vercel promote dpl_fiXC5suPTF2VCW22fEVf64HZYhNP --scope seibel`; `vercel alias ls --scope seibel`; fetch público de home e chunks para conferir marcadores; `vercel inspect --json` (READY/production; `meta: null`, sem metadados customizados visíveis — a fonte fica pelo commit/manifesto).
- **Render:** `render services list`/`deploys list`/`logs` (sanitizados), healthz via curl; deploy `new_commit` da revisão exata; log de build e de runtime conferidos; CORS via requisições ao endpoint Socket.IO com as duas origens (`30/31-cors-*.headers`; permitida recebe `Access-Control-Allow-Origin: https://tretta.vercel.app`, outra não recebe cabeçalho).
- **Protocolo próprio:** script fora do repositório contra a URL pública do servidor — 16 verificações verdes com recusas/hooks desligados esperados (`protocol-check.json`, summary `totalChecks: 16`, `allOk: true`).
- **Smoke público:** `browser-harness` com Chrome dedicado em instância separada (perfil temporário, CDP 127.0.0.1:9333; navegador do usuário não foi alterado); contexto padrão + contextos incognito para terceiros; asserts por testids; coletor de erros de página/console; capturas e logs em `assets/T011-public/smoke/`.

## Decisões e desvios

- Janela sem partidas confirmada pelo usuário ("Sem jogos — pode publicar") antes do push; sem contador público de salas, como previsto no contrato.
- Staged production antes do push; promoção apenas do mesmo build READY, sem rebuild.
- O primeiro `vercel promote` **sem `--scope`** falhou por contexto (`ivan-l-seibels-projects`); repetido com `--scope seibel` — mesmo build promovido, sem efeito em produção.
- Auto-deploy Render disparou com `new_commit`; nenhum deploy manual adicional; um único reinício (o próprio deploy).
- Chrome do usuário não foi usado: a aprovação de depuração remota do macOS dependia de acessibilidade; foi usada instância dedicada com perfil temporário, sem tocar no navegador do usuário.
- Um clique em "Entrar" num contexto novo ocorreu antes da conexão do socket (aviso "Sem conexão com o servidor" pré-existente do HEAD); aguardada a reconexão, o fluxo seguiu e a recusa apareceu. Não é regressão nova nem alteração de produto.
- Sem forçar vitória: a rodada 1 terminou legitimamente com a bot Lila vencendo; nenhum seed, hook, baralho injetado ou alteração direta de estado usados no smoke.
- Capturas da sala comum tiveram o código redigido (precedente T010); capturas de treino seguem o precedente aceito T011B (sala individual que recusa terceiros).

## Limitações e pendências

- A validação independente (deployment/alias, manifesto, protocolo e smoke) cabe ao orquestrador.
- Sem teste em aparelho físico nesta execução; o teste humano de recuperação no celular continua pendente.
- Plano Free hiberna por inatividade; retomadas futuras zeram salas por desenho do serviço.
- Enquanto não houver aceite: rollback do frontend com `vercel alias set dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj tretta.vercel.app --scope seibel`; do backend, rollback suportado no mesmo serviço Free ou redeploy da revisão `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837` (exige rebuild/reinício; não recupera salas).
- Relatórios/estado atualizados ficam no working tree; nenhum push documental foi feito para não disparar novo restart.

## Próximo passo

Validação do orquestrador: conferir `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP` e o alias `tretta.vercel.app`, o manifesto `80be6645…` e protocolo/smoke em `assets/T011-public/`; depois do aceite, atualizar `plan.md` e o bloco "Retomar em outra sessão". Nenhum novo commit/push sem pedido humano específico.
