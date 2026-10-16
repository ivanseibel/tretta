# T007 — Preparação declarativa gratuita para Vercel e Render

Data: 16 de outubro de 2026.

## Tarefa e resultado

Preparação local concluída. Foram adicionados artefatos revisáveis para Vercel Hobby (interface Next.js) e Render Free (servidor Node/Socket.IO), sem criar projeto ou serviço externo, fazer deploy, commit ou push.

## Alterações

- `apps/web/vercel.json` fixa comandos de instalação e build do workspace, usando o Corepack habilitado pelo ambiente da Vercel, lockfile congelado e o filtro `@tretta/web...` para incluir dependências locais.
- `render.yaml` declara explicitamente `plan: free`, runtime Node, build filtrado, comando de início, health check `/healthz`, Node `22.23.1` e `TRE_TTA_TEST_HOOKS=0`. `TRE_TTA_WEB_ORIGIN` fica como entrada manual do Blueprint (`sync: false`); não há URL fictícia, `TRE_TTA_PORT` nem `TRE_TTA_SEED`.
- `package.json` da raiz e `apps/web/package.json` limitam `engines.node` à linha 22, incluindo o patch local validado 22.23.1.
- `docs/work/deployment-free.md` agora descreve os arquivos e os ajustes de projeto necessários na Vercel. As origens públicas permanecem pendentes até que os provedores atribuam URLs.

## Critérios de aceite

- **Vercel Hobby:** os comandos usam o workspace na raiz, incluem as dependências necessárias da interface e preservam `pnpm@11.14.0` por Corepack. O rootdir `apps/web` e a opção **Include source files outside of the Root Directory in the Build Step** continuam como ajustes de projeto, pois a documentação oficial não oferece uma chave correspondente em `vercel.json`.
- **Render Free:** Blueprint configura o tier `free`, versão Node compatível, comandos de monorepo, `/healthz` e hooks desativados. Não adiciona banco, Redis ou outro serviço.
- **URLs e ambiente:** o build Vercel exige `NEXT_PUBLIC_SERVER_URL` com protocolo HTTPS e bloqueia localhost/loopback; o mesmo comando fixa `NEXT_PUBLIC_TEST_HOOKS=0`. `TRE_TTA_WEB_ORIGIN` será preenchido com a origem Vercel no Blueprint Render. Os domínios ainda não existem; nenhum endpoint localhost ou placeholder público foi configurado.
- **Cobrança:** o manifesto usa somente plano Free. O runbook mantém a recomendação de não cadastrar método de pagamento no workspace Render para evitar excedentes cobrados.

## Verificação

- Consultada documentação oficial atual por Context7: [Vercel monorepos](https://vercel.com/docs/monorepos), [Corepack e configuração de build](https://vercel.com/docs/builds/configure-a-build), [versões Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Render monorepos](https://render.com/docs/monorepo-support), [Blueprints](https://render.com/docs/infrastructure-as-code), [variáveis de ambiente](https://render.com/docs/configure-environment-variables), [health checks](https://render.com/docs/health-checks) e [versões Node.js](https://render.com/docs/node-version).
- Os manifestos JSON foram parseados e o Blueprint passou por parse YAML com checagem dos valores centrais. A documentação local da versão instalada do Next.js confirma que `NEXT_PUBLIC_*` é incorporado ao bundle no build.
- Inspeção local confirmou `.nvmrc=22.23.1`, `packageManager=pnpm@11.14.0`, fallback do servidor para `PORT` quando `TRE_TTA_PORT` está ausente/vazio e hooks ativados somente com valor `1`.
- Não foram executados testes, E2E, builds ou instalação. Havia desenvolvimento local nas portas 3000/3100 e `.next` em uso; o build filtrado do servidor já havia sido aceito no report de hospedagem anterior, então não foi repetido.

## Decisões e limites

- A Vercel só recebe a origem Render depois da criação do Web Service. A publicação requer definir as variáveis antes do build, com uma URL HTTPS real.
- O projeto Vercel precisa ser conectado com rootdir `apps/web` e a opção de incluir arquivos fora da raiz ativada nas configurações do projeto. Esta execução foi somente local; a seleção de workspace e provisionamento ficam com o orquestrador.
- O Render ainda depende de conta/workspace sem método de pagamento cadastrado e de uma branch publicada para o serviço buscar o código.
- O arquivo histórico `apps/server/railway.toml` foi preservado sem alteração.

## Próximo passo

O orquestrador valida estes artefatos, publica a revisão já autorizada e confirma o SHA no remoto. Após o usuário criar o workspace Render, pode configurar os projetos; só então as origens reais podem ser definidas e o smoke público HTTPS/WSS executado.
