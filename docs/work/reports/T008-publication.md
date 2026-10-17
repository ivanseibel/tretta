# T008 — Report de publicação

**Tarefa e resultado:** concluída como proposta; aguarda validação do orquestrador. A interface T008 foi publicada como novo deployment de produção no projeto `tretta`, workspace Seibel Hobby, e o domínio `https://tretta.vercel.app` aponta para o build testado. O servidor Render não foi tocado.

## Entrega

- **Deployment:** `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey`, `READY`, target `production`, região `iad1`.
- **URL do build:** [tretta-kyrddrenp-seibel.vercel.app](https://tretta-kyrddrenp-seibel.vercel.app).
- **Domínio público:** [https://tretta.vercel.app](https://tretta.vercel.app) — a inspeção autenticada do domínio retornou exatamente o ID novo; o registro de aliases mostra `tretta.vercel.app` e `tretta-seibel.vercel.app` pareados com o novo deployment (`aliasAssigned=true`, sem erro de alias). HTTP público 200. O deployment anterior `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc` permanece disponível para eventual restauração de alias.
- **Fonte (sem commit):** working tree validado copiado para área temporária; 360 arquivos, 47.125.700 bytes. Manifesto com SHA-256 por arquivo e digest do conjunto: `78db6b5696ffcfbbbec05175b6437d3acb5cc70b07ac65717a21398d4a4fb0b0`. Evidências em [assets/T008-public/source-manifest.sha256.txt](assets/T008-public/source-manifest.sha256.txt) e [assets/T008-public/source-files.json](assets/T008-public/source-files.json); metadados do deployment registram `trettaBaseCommit=8967e94` e `trettaSourceManifest=<digest>`.
- **Evidências:** [deployment.json](assets/T008-public/deployment.json), [smoke-public.json](assets/T008-public/smoke-public.json) e capturas `home-public.png`, `table-768.png`, `table-390.png`, `chat-newest-first.png` e `turn-notification-pref.png` em `docs/work/reports/assets/T008-public/`.
- **Servidor:** `srv-db95f2u7bikc73dpndt0` segue com o deploy `dep-db95f367bikc73dpnfs0` (commit `8967e94`) **live** e `https://tretta-server.onrender.com/healthz` HTTP 200. Nenhuma chamada de escrita, deploy ou reinício no Render; a branch `main` não recebeu push.

## Critérios de aceite

| Critério | Evidência | Situação |
| --- | --- | --- |
| Novo deployment de produção READY no projeto/time corretos; domínio aponta ao build testado | `vercel inspect` do deployment novo: `READY`, `production`, projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `seibel`; `vercel inspect https://tretta.vercel.app` retornou o mesmo ID; alias `tretta.vercel.app` → `tretta-kyrddrenp-seibel.vercel.app`; HTTP público 200; chunk da rota de sala servido no domínio contém o marcador T008 `pref-turn-notification` | Aceito |
| Build com versões/configurações aprovadas, URL HTTPS real e sem hooks | Log do build: `ENABLE_EXPERIMENTAL_COREPACK=1` → `pnpm 11.14.0`, `pnpm install --frozen-lockfile`, guarda da URL passou com `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com`, `NEXT_PUBLIC_TEST_HOOKS=0`, Next.js 16.4.1, TypeScript sem erros. Readback do projeto: Next.js, root `apps/web`, Node `22.x`, fontes fora da raiz incluídas, sem Git. `apps/web/vercel.json` idêntico ao validado. Em execução, `window.__trettaTest` indefinido antes e depois do relaunch | Aceito |
| Smoke integrado confirma as mudanças; Render mantém deploy e salas | Dois clientes próprios isolados no domínio público: criar/entrar/preparar, rodada iniciada, movimentos reais dos dois lados (Bia comprou e passou; Ana jogou Amarelo 6), chat com mensagens 1–3 renderizado do mais novo ao mais antigo no topo, aviso de vez nasce ligado e permanece desligado após relaunch, campos Provocação/Alvo alinhados em 1440/1024/768/390 px sem overflow, zero erros de console/página, hooks ausentes, saída dos dois clientes. Render: deploy inalterado `live` e healthz 200 | Aceito |
| Report por critério, IDs/hashes, saídas sanitizadas, limitações e pendências; status/runbook atualizados | Este report; artefatos acima; `status.md` e `deployment-free.md` atualizados com os fatos | Aceito |

## Verificação (comandos e resultados sanitizados)

- Alvos: `vercel teams ls`/`project ls --scope seibel` confirmaram workspace `seibel` (plano Hobby já verificado em T007) e projeto único `tretta`; `vercel whoami` autenticado. `render services list`/`deploys list` (somente leitura) confirmaram o serviço Free e o deploy `live` inalterado.
- Fonte: `rsync` do working tree para cópia temporária excluindo `.git`, `node_modules`, `.next`, `dist`, `.env*`, `.vercel` e `*.zip`; `.vercelignore` com `.env*`, `*.zip`, `.vercel`. `vercel link --project tretta --scope seibel` vinculou explicitamente; o `.env.local` efêmero criado pelo CLI foi removido sem leitura; nenhum arquivo `.env*`, ZIP, `node_modules`, `.next`, `dist` ou `.vercel` apareceu na lista de upload.
- `vercel deploy --dry` antes do upload: framework Next.js detectado, 360 arquivos, 47.125.700 bytes, arquivos novos de T008 presentes (`TurnNotifier.tsx`, `turnNotifications.ts`, `refinements.spec.ts`, `turn-notification.test.tsx`).
- `vercel deploy --prod --skip-domain --yes --scope seibel` com metadados de revisão: `READY` em ~21 s de build; depois `vercel promote <id> --scope seibel --yes` promoveu o mesmo build; a promoção associou o domínio do projeto sem necessidade de `alias set` manual desta vez.
- Leitura autenticada do deployment: `trettaBaseCommit=8967e94`, `trettaSourceManifest=78db6b56…`, `aliasAssigned=true`; HTTP autenticado no staged retornou 200 com HTML do Tretta.
- Smoke público (script próprio fora do repositório, Playwright da própria workspace, dois contextos isolados; capturas e resumo salvos em `assets/T008-public/`): todas as verificações do critério acima passaram; medidores de oscilador WebAudio (proxy técnico, não audição) registraram 2 avisos antes do opt-out e 0 depois do relaunch.

## Decisões e desvios

- A fonte publicada é o working tree validado (sem commit), identificada pelo manifesto; nenhum push foi feito para não acionar o auto-deploy do Render (branch `main` conectada).
- O smoke usou dois contextos isolados de Playwright (identidades separadas) em vez do navegador integrado; o script não foi adicionado ao repositório.
- **Observação preexistente, não corrigida (fora do escopo):** após atualizar a página, a primeira tentativa de reentrada pode mostrar "Esta identidade já está conectada em outra aba ou dispositivo." enquanto a plataforma ainda mantém o socket anterior (expiração do ping do engine.io, ~45 s); uma nova tentativa depois disso reentra normalmente e a rodada retoma. A lógica de reentrada não foi alterada por T008 (diff de `providers.tsx` não toca `rejoinInternal`/`waitForConnection`), o E2E local de reload passa e a validação pública de T007 não cobria reload. Sem correção para não refatorar produto durante a publicação; evidência sanitizada no resumo do smoke (`refresh-rejoin-pending`). Restauração do domínio ao deployment anterior, se o orquestrador julgar necessário, seria apenas `vercel alias set dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc tretta.vercel.app --scope seibel`.
- Logo após carregar a página, o primeiro clique em criar/entrar pode mostrar o aviso "Sem conexão com o servidor" enquanto o socket inicial conecta (guarda `OFFLINE_ERROR` já presente em `HEAD`; não é regressão de T008). No smoke o clique foi repetido e a criação seguiu normalmente.

## Limitações e pendências

- Sem teste em aparelho físico e sem audição humana do som de vez; o áudio continua dependente de gesto do navegador (coberto pelo E2E local de WebAudio). Capturas inspecionadas pelo executor; validação independente cabe ao orquestrador.
- A sala do smoke foi encerrada pelos dois clientes e expira sozinha em ~15 min; nenhuma sala da família foi acessada, nenhuma credencial ou mão adversária foi registrada.
- Capacidade em nuvem não foi remedida; Render pode suspender por inatividade e reinícios apagam salas (comportamento inalterado).
- `docs/work/plan.md` ainda descreve a publicação T008 como "ainda não executada"; atualizar no aceite do orquestrador.
- O hot reload de página na versão pública tem a nuance acima; sugestão de item no backlog para melhorar o retry de reentrada.

## Próximo passo

Validação do orquestrador: conferir o deployment/alias, o manifesto e o smoke em `assets/T008-public/`, e decidir sobre a observação de reentrada (backlog ou tarefa própria). Nenhuma decisão de commit/push foi tomada; um pedido humano específico continua necessário para integrar esta versão de documentação/deploy ao Git.
