# T007 — deploy Render Free

**Resultado: concluída.** O serviço Node foi criado no plano Free, compilado e ficou Live no workspace pessoal Hobby sem cartão. O root validou independentemente o health check público.

## Estado local conferido

- Repositório limpo em `main`, no commit `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837`.
- `render.yaml` declara Web Service `tretta-server`, runtime Node, plano `free`, Node `22.23.1`, health check `/healthz`, hooks de teste desligados e `TRE_TTA_WEB_ORIGIN` como entrada a preencher.
- O plano de deploy permaneceu limitado a serviço Free, sem banco, Redis, disco, serviço pago, cartão ou alteração de billing.
- O setup Vercel já aceito está registrado em [T007-vercel-project-setup.md](T007-vercel-project-setup.md). A preparação do manifesto e o build local previamente aceito estão documentados em [T007-release-preparation.md](T007-release-preparation.md) e [T007-free-hosting.md](T007-free-hosting.md); não foram repetidos nesta etapa.

## Serviço criado

- Workspace: **My Workspace**, plano **Hobby**; a tela Billing mostrou `No card on file`, 0/750 horas grátis, 0/5 GB de banda, 0/500 minutos de pipeline e nenhum encargo pendente. Antes da criação, o painel mostrava zero serviços e zero Blueprints.
- Render explica que, sem método de pagamento, uso Free acima dos limites suspende serviços Free durante o restante do período; minutos de build excedentes desativam novos builds. A conta não recebe cobrança de excedente sem método de pagamento. Isso mantém o critério de custo zero, com risco de indisponibilidade quando uma cota se esgotar. Referências: [Render FAQ de billing](https://render.com/docs/faq) e [limites Free](https://render.com/docs/free), consultados via Context7.
- Blueprint `tretta`, ID `exs-db95ers9v7es739jpqig`, conectado a `ivanseibel/tretta`, branch `main`, `render.yaml` na raiz.
- Web Service `tretta-server`, ID `srv-db95f2u7bikc73dpndt0`, tipo Node, plano **Free** (readback do painel), URL HTTPS `https://tretta-server.onrender.com`.
- Deploy `dep-db95f367bikc73dpnfs0` terminou como **Deploy succeeded | Live**. O Render conferiu a revisão `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837` em `main`.
- Variáveis do serviço: `NODE_VERSION`, `TRE_TTA_TEST_HOOKS` e `TRE_TTA_WEB_ORIGIN`; valor lido de volta para os hooks foi `0` e a origem foi `https://tretta.vercel.app`. Os valores foram ocultados após a conferência. Não há `TRE_TTA_SEED`, `TRE_TTA_PORT`, outros campos de ambiente, arquivos secretos ou grupos conectados; a porta permanece gerenciada pelo Render.

## Build e health check

- Os logs confirmam Node `22.23.1`, pnpm `11.14.0`, `pnpm install --frozen-lockfile` concluído com lockfile atualizado e 236 entradas aprovadas pelas supply-chain policies.
- O build filtrado executou `packages/rules`, `packages/protocol` e `apps/server`; todos terminaram sem erro. O comando de início foi `pnpm --filter @tretta/server start`; logou que o servidor está ouvindo e usando `https://tretta.vercel.app` como origem web.
- O painel de deploy marcou o serviço Live após o health check interno em `/healthz`. O root verificou independentemente `https://tretta-server.onrender.com/healthz`: HTTP 200 com `{"ok":true}`.
- O processo inicial usou um único deploy. Nenhum redeploy manual foi disparado.

## Acesso e limite desta execução

- `browser-harness --doctor` inicialmente não encontrou Chrome/Edge conectado. A chamada normal mostrou o pedido do Chrome para permitir remote debugging (`permission-blocked`); `browser-harness mac-approve` falhou com erro AppleScript `-10827`, e a leitura do guia público não conseguiu resolver o host por DNS. O root localizou a aba Render já autenticada, e a continuação usou CUA nessa mesma sessão, sem browser paralelo.
- Nenhuma credencial, cookie, token, cache de navegador ou URL de sessão foi lida ou registrada. Não foram alterados plano, cartão, billing, permissões do GitHub ou configurações fora do serviço descrito.

## Continuidade

**Próximo passo:** o root continua a configuração/publicação Vercel e a validação integrada pública. Esta tarefa Render terminou; o repositório não recebeu alterações de código, commit ou push nesta execução.
