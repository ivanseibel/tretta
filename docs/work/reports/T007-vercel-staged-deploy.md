# T007 — Vercel production staged

**Tarefa e resultado:** concluída como staged production. O deployment está `READY` no workspace Hobby escolhido; aguarda a validação do orquestrador. Não executei `vercel promote`.

## Alvo e fonte

- O CLI autenticado listou um único projeto no workspace `seibel`: `tretta`, ID `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`. A leitura do time confirmou plano `hobby`, ID `team_4mQparNtNCNqsb95uxf2FzoD`.
- A configuração lida de volta foi Next.js, Root Directory `apps/web`, Node `22.x` e inclusão de fontes fora da raiz habilitada. O projeto continua sem integração Git.
- Exportei `git archive 8967e94` para `/private/tmp/tretta-vercel-source.onJsoc`; esse commit contém a implementação funcional `10367a6`. O `vercel deploy --dry` detectou Next.js e listou 336 arquivos (45.375.438 bytes), incluindo `apps/web/vercel.json`, o workspace e fontes de `packages/rules` e `packages/protocol`.
- O primeiro dry-run identificou `.env.example` como arquivo de upload. Adicionei ao snapshot temporário um `.vercelignore` com `.env*` e `*.zip`; no dry-run final não havia `.env*`, ZIP, `.next`, `node_modules` ou `.git`. O upload efetivo foi de 43,3 MB. Nenhum arquivo ou build local do repositório foi enviado.

## Variáveis

- `NEXT_PUBLIC_SERVER_URL` foi adicionada pela CLI para Production e Preview como variável não sensível, com a origem `https://tretta-server.onrender.com` fornecida para esta tarefa.
- As variáveis existentes `ENABLE_EXPERIMENTAL_COREPACK=1` e `NEXT_PUBLIC_TEST_HOOKS=0` permaneceram em Production e Preview. O readback de metadados listou as três chaves e os dois alvos; a API não expôs o valor da nova variável na leitura padrão. O comando de build validou que a origem era HTTPS e não localhost.

## Build remoto

- Vercel CLI local `57.0.0` (Node `22.23.1`); o builder informou Vercel CLI `64.0.2`. Node do projeto: `22.x`.
- `ENABLE_EXPERIMENTAL_COREPACK=1` fez Corepack selecionar `pnpm@11.14.0`. `pnpm install --frozen-lockfile` concluiu; o lockfile estava atualizado e foram instalados 154 pacotes nos cinco projetos do workspace.
- Next.js `16.4.1`: builds de `packages/rules` e `packages/protocol`, compilação Next.js, TypeScript e geração das páginas estáticas passaram. O build remoto concluiu em 25 segundos.

## Deployment e smoke

- **Deployment:** `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc`
- **URL:** [tretta-c0lhivjhc-seibel.vercel.app](https://tretta-c0lhivjhc-seibel.vercel.app)
- **Inspeção:** [deployment no Vercel](https://vercel.com/seibel/tretta/4oPaKQDrLFLVjoQmSJgQgcHm4DUc)
- **Estado:** `READY`, target `production`, projeto correto. Metadados do deployment registram `trettaSourceCommit=8967e94` e `trettaFunctionalCommit=10367a6`.
- `vercel curl / --deployment https://tretta-c0lhivjhc-seibel.vercel.app` retornou HTTP 200 (`text/html; charset=utf-8`). O CLI usou o fluxo autenticado de bypass de proteção; não desativei a proteção nem li ou registrei o token.
- O comando `vercel link` criou `.env.local` temporário no snapshot, com token OIDC. Não abri nem imprimi o arquivo; removi-o sem leitura antes do smoke e confirmei que não existia. Ele foi criado depois do upload.

## Domínios e próximo passo

O deploy foi solicitado com `--prod --skip-domain`. Não houve chamada explícita de `vercel promote` nem alteração manual de domínios. Ainda assim, o CLI reportou `Aliased https://tretta-seibel.vercel.app` e a API do deployment confirmou somente esse alias automático (`aliasAssigned=true`). A lista de domínios do projeto contém `tretta.vercel.app` como verificado; o alias automático não aparece nessa lista. O orquestrador deve validar o mapeamento antes de promover o domínio público.

As provas locais e as suítes não foram repetidas. O orquestrador confirmou separadamente o servidor Render HTTPS e WSS; este report cobre o build e smoke HTTP do web staged. Não fiz commit, push, conexão Git, mudança de plano, configuração global ou alteração no Render.
