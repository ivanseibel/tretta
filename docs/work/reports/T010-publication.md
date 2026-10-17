# T010 — Report de publicação

**Tarefa e resultado:** concluída como proposta; aguarda validação do orquestrador. A recuperação corrigida de T010 foi publicada como novo deployment de produção no projeto `tretta`, workspace Seibel Hobby, e o domínio `https://tretta.vercel.app` aponta para o build testado. O servidor Render não foi tocado e não houve commit/push.

## Entrega

- **Deployment:** `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj`, `READY`, target `production`, região `iad1`, Node `22.x`, plano `hobby`, criado em `2026-10-17T00:34:35Z`.
- **URL do build:** [tretta-26gh6ystv-seibel.vercel.app](https://tretta-26gh6ystv-seibel.vercel.app).
- **Domínio público:** [https://tretta.vercel.app](https://tretta.vercel.app) — a inspeção autenticada do domínio retornou exatamente o ID novo (`readback.json`, 00:44 UTC); HTTP público 200; o bundle público contém os marcadores da recuperação T010 (chunk `0o71oknalomjx.js`: `Tentar novamente`, `sessão em retomada`, `Recuperando o vínculo com a sala`) e os chunks do build anterior T008 não os contêm. O deploy anterior `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey` permanece disponível; fallback mais antigo `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc`.
- **Fonte (sem commit):** working tree validado copiado para área temporária — **150 arquivos, 1.182.018 bytes**, digest do manifesto `e917313dd0d798352ed1bd7c3249c3bf6000b126acdac438b0e0b1d2ed7ef82d`, base `8967e94`. Conferência prévia: **144/144 arquivos** do manifesto aceito (`reports/assets/T010-final-validation/validated-source.sha256.json`) idênticos na fonte e no upload; fora do manifesto apenas gerados (`apps/web/next-env.d.ts`, `tsconfig.tsbuildinfo`). Metadados do deployment: `trettaBaseCommit=8967e94` e `trettaSourceManifest=<digest>`.
- **Evidências:** `assets/T010-public/` — [source-manifest.sha256.txt](assets/T010-public/source-manifest.sha256.txt), [source-files.json](assets/T010-public/source-files.json), [deployment.json](assets/T010-public/deployment.json), [build-log-checks.json](assets/T010-public/build-log-checks.json), [http-authenticated.json](assets/T010-public/http-authenticated.json), [bundle-markers.json](assets/T010-public/bundle-markers.json), [readback.json](assets/T010-public/readback.json), [smoke-public.json](assets/T010-public/smoke-public.json) e capturas `lobby-public-redacted.png` (código de convite censurado), `retomando-reload.png` e `retomando-segunda-aba.png`.
- **Servidor:** `srv-db95f2u7bikc73dpndt0` segue **Live** no deploy `dep-db95f367bikc73dpnfs0` (revisão `8967e94`), `https://tretta-server.onrender.com/healthz` HTTP 200. Nenhuma chamada de escrita, deploy ou reinício no Render; a branch `main` não recebeu push.

## Critérios de aceite

| Critério | Evidência | Situação |
| --- | --- | --- |
| Fonte fiel ao validado; snapshot sem `.git`, dependências, builds, env, `.vercel` preexistente e ZIPs; manifesto SHA-256 dos enviados | 144/144 hashes conferidos antes do deploy; rsync com as exclusões e `.vercelignore` idêntico ao T008 (`18acec09…`); `.env.local` efêmero do CLI removido sem leitura; `vercel deploy --dry`: Next.js, 150 arquivos, 1.182.018 bytes; nenhum `.env*`/ZIP/deps no upload | Aceito |
| Staged production com versões/configurações aprovadas, READY, HTTP autenticado e bundle T010 | `vercel deploy --prod --skip-domain`: `READY`; logs: Corepack → `pnpm 11.14.0`, `pnpm install --frozen-lockfile`, guarda da URL passou com `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com`, `NEXT_PUBLIC_TEST_HOOKS=0`, Next.js 16.4.1; `vercel curl` autenticado: home 200 (12.687 bytes, título Tretta) e shell de sala 200; marcadores T010 no chunk `0o71oknalomjx.js`, ausentes no T008 | Aceito |
| Promoção do mesmo build sem rebuild; alias conferido diretamente | `vercel promote dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj` ("Success!… promoted", ~3 s) sem novo build; `vercel inspect tretta.vercel.app` retornou o mesmo ID, `READY`, `production`; `aliasAssigned=true` | Aceito |
| Smoke público com sala e identidades próprias cobrindo recuperação, duas abas e preferência; Render intacto | Dois contextos isolados no domínio público: criar/entrar (2 tentativas cada; 1º clique pegou o aviso OFFLINE pré-existente), preparar, rodada iniciada, compra+passa dos dois lados, chat 1/1 nos dois sentidos; aviso de vez ligado por padrão → desligado e **persistido** após reload; reload: "Retomando" observada e retomada automática em ~11,0 s sem esgotar o ciclo — mesma credencial e mesma mão (digests iguais, 8 cartas), sem duplicados; segunda aba: "Retomando" sem formulário de nova pessoa, sem banner de erro e sem "já está conectada" (ainda recuperando após 8 s, nenhuma ação disponível), primeira aba segue operável (chat chega ao host); fechada a primeira aba, a segunda retomou sozinha em ~6,4 s sem reload extra, mesma identidade/mão, sem duplicados, chat habilitado só após o vínculo e funcionando; hooks ausentes nos dois clientes; zero erros de console/página; saída dos dois clientes; healthz 200 | Aceito |
| Report por critério, IDs/hashes, saídas sanitizadas, limitações e pendências; status/runbook atualizados | Este report; artefatos acima; `status.md` e `deployment-free.md` atualizados com "T010 publicada, aguardando validação do orquestrador" | Aceito |

## Verificação (comandos e resultados sanitizados)

- **Alvos (somente leitura):** `vercel whoami` (ivanseibel), `vercel teams ls` (workspace `seibel`), `vercel inspect` no domínio e nos deployments; `render services list` e `render deploys list` confirmaram serviço Free e deploy Live inalterado; healthz 200 na abertura e no readback.
- **Fonte:** `rsync` do working tree para cópia temporária excluindo `.git`, `node_modules`, `.next`, `dist`, `.env*`, `.vercel`, `*.zip`, `*.tsbuildinfo`, `test-results`, `playwright-report` e `docs`; `.vercelignore` com `.env*`, `*.zip`, `.vercel`; `vercel link --project tretta --scope seibel` explícito; manifesto com SHA-256 por arquivo e digest do conjunto.
- **Dry run:** framework Next.js detectado, 150 arquivos, 1.182.018 bytes; ignorados `.gitignore` (padrão Vercel) e `.vercel/`.
- **Deploy e promoção:** `vercel deploy --prod --skip-domain --yes -m trettaBaseCommit=8967e94 -m trettaSourceManifest=<digest>`; depois `vercel promote <id> --yes`, promovendo o mesmo build; readback do alias no fim do smoke.
- **HTTP autenticado:** `vercel curl` no staged (proteção contornada pelo próprio comando; nenhum token registrado) e no público; fetch autenticado dos chunks para conferir os marcadores T010 no staged e no domínio público.
- **Smoke público:** script próprio fora do repositório, Playwright da workspace, dois contextos isolados; resumo com digests (sem valores brutos de mão/credencial) e código da sala mascarado em `assets/T010-public/smoke-public.json`; capturas inspecionadas, com o código de convite censurado na do lobby.
- **Readback final:** domínio → `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj` (`READY`, `production`); HTTP público 200; Render `Live` inalterado e healthz 200.

## Decisões e desvios

- A fonte publicada é o working tree validado (sem commit), identificada pelo manifesto; nenhum push foi feito para não acionar o auto-deploy do Render (branch `main` conectada).
- **`docs/` fora do upload**, autorizado pelo prompt (reports/artefatos regenerados preservados no clone): o snapshot caiu de ~91 MB para 1,2 MB e o manifesto cobre exatamente os 150 arquivos enviados, incluindo os 144 da fonte funcional aceita.
- **`*.tsbuildinfo` excluído** (estado de build gerado); é a única diferença de conjunto em relação ao fluxo T008, sem efeito no build — a Vercel regenera esse arquivo.
- O smoke repetiu o primeiro clique após o aviso "Sem conexão com o servidor" enquanto o socket inicial conectava (guarda `OFFLINE_ERROR` pré-existente no `HEAD`, fora do escopo); o produto não foi alterado.
- A reentrada protegida em duas abas consome o ciclo T010 enquanto a primeira conexão vive — comportamento esperado; após o fechamento da primeira aba, a segunda retomou sozinha sem reload extra.
- A captura do lobby teve o código da sala censurado antes de entrar em `assets/`; nenhuma credencial, mão ou sala da família foi registrada.

## Limitações e pendências

- Sem teste em aparelho físico; capturas e digests inspecionados pelo executor; a validação independente (deployment/alias, manifesto e smoke) cabe ao orquestrador.
- A sala do smoke foi encerrada pelos dois clientes e expira sozinha em ~15 min; nenhuma sala da família foi acessada.
- `docs/work/plan.md` ainda descreve a publicação T010 como "preparada, não executada" (linha da etapa T010), e o bloco "Retomar em outra sessão" de `status.md` ainda diz que a produção continua T008; ambos são refrescados pelo orquestrador no aceite, como no fluxo T008.
- Capacidade em nuvem não foi remedida; Render pode suspender por inatividade e reinícios apagam salas (comportamento inalterado).
- Enquanto o orquestrador não aceitar, o domínio pode ser restaurado ao build T008 conferido com `vercel alias set dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey tretta.vercel.app --scope seibel`, sem tocar no backend.

## Próximo passo

Validação do orquestrador: conferir `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj` e o alias, o manifesto `e917313d…` e o smoke em `assets/T010-public/`; depois do aceite, atualizar `plan.md`. Nenhuma decisão de commit/push foi tomada; um pedido humano específico continua necessário para integrar esta versão de documentação/deploy ao Git.
