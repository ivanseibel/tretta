# T007 — configuração do projeto Vercel

**Tarefa e resultado:** concluída em 16 de outubro de 2026. O workspace escolhido foi confirmado como Hobby. Como não havia projetos nesse workspace, criei o projeto `tretta` sem conectar um repositório Git.

## Configuração aplicada

- Workspace: **Seibel**, slug `seibel`, team ID `team_4mQparNtNCNqsb95uxf2FzoD`; plano lido como `hobby`.
- Projeto: `tretta`, ID `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`.
- Framework: Next.js (`nextjs`).
- Root Directory: `apps/web`.
- Include source files outside of the Root Directory: ativado (`true`).
- Node.js: `22.x`.
- Variáveis de ambiente plain, aplicadas a **Production** e **Preview**: `ENABLE_EXPERIMENTAL_COREPACK=1` e `NEXT_PUBLIC_TEST_HOOKS=0`.
- Repositório Git: não conectado. Nenhuma origem `NEXT_PUBLIC_SERVER_URL` foi inventada; ela continua pendente da URL real do Render.

## Evidências e verificações

- O `vercel teams ls --format json` autenticado listou três workspaces e identificou `seibel` pelo ID informado pelo usuário. A leitura autenticada de `/v2/teams/{id}` retornou `billing.plan=hobby`; o report não inclui outros campos de billing.
- `vercel project ls --scope seibel --format json` retornou zero projetos antes da criação.
- A criação do projeto e o PATCH de configuração retornaram o ID acima. A leitura posterior de `/v9/projects/{id}` confirmou `framework=nextjs`, `rootDirectory=apps/web`, `nodeVersion=22.x` e `sourceFilesOutsideRootDirectory=true`.
- A leitura de `/v10/projects/{id}/env` confirmou os dois nomes, valores esperados, tipo `plain` e alvos `production` e `preview`.
- `vercel list tretta --scope seibel --format json --limit 100` retornou zero deployments.
- A leitura inicial de `/v9/projects/{id}/domains` e aliases veio vazia. Em uma leitura independente posterior, o orquestrador encontrou `tretta.vercel.app`, indicando a reserva/associação automática do domínio padrão após propagação assíncrona. Ele não foi comprado; o projeto continua com zero deployments e o site não está publicado. `https://tretta.vercel.app` é candidato a `TRE_TTA_WEB_ORIGIN` no Render depois da publicação.
- Não ocorreu conexão Git, build, upload, deploy, alteração de faturamento, nem mudança em outro workspace/projeto. Nenhum arquivo de código foi alterado.

O Vercel MCP conectado não tinha autorização para o workspace Seibel e retornou 403. As leituras e alterações foram feitas com o CLI Vercel autenticado, sempre com escopo explícito `seibel`. Nenhum token ou conteúdo de autenticação foi lido ou registrado.

## Verificação disponível e pendente

As configurações foram lidas de volta no painel de API; um build Vercel ainda não foi iniciado. A publicação requer a criação do serviço Render e uma origem HTTPS real para `NEXT_PUBLIC_SERVER_URL`. Depois, o orquestrador poderá configurar essa origem e conduzir o deploy em uma etapa separada.
