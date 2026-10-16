# Hospedagem grátis para a fase familiar

**Proposta revisável; nenhum deploy, conta ou recurso foi criado.** Para a fase de hobby familiar, usar Vercel Hobby para o Next.js e um Web Service Free no Render para o Node.js/Socket.IO. Não adicionar banco, Redis, persistência ou refatoração do motor. A aplicação continua com uma única instância autoritativa e estado em memória.

O custo de plataforma é zero dentro dos planos e limites atuais, sem domínio próprio e sem método de pagamento cadastrado no Render. Vercel Hobby é restrito a uso pessoal e não comercial. Render descreve seus serviços Free como adequados a projetos de hobby, mas recomenda não os usar para produção. Esses planos não garantem disponibilidade, capacidade ou permanência futura do tier.

## Pré-requisito para publicar

O usuário autorizou commit e push em 16 de outubro de 2026. A revisão funcional e os manifestos gratuitos estão publicados em `origin/main`, commit `10367a6`. O fluxo padrão do Render pode buscar essa branch de um repositório conectado. Antes de criar o serviço, conferir a revisão escolhida e o acesso de leitura ao repositório. Não há novo pedido de autorização de commit pendente para esta versão.

A criação dos projetos e o deploy ainda não ocorreram. Acesso à conta Render e escolha do workspace Hobby Vercel seguem pendentes; manter o limite de custo zero. Este runbook não cria imagem nem publica código por upload local.

## Configuração proposta

**Render — servidor.** O arquivo versionado [render.yaml](../../render.yaml) declara um Web Service Node no plano Free, com a raiz do repositório como contexto, `NODE_VERSION=22.23.1`, health check `/healthz` e `TRE_TTA_TEST_HOOKS=0`. O comando de build ativa Corepack, registra as versões Node/pnpm nos logs, instala o workspace congelado e compila o servidor e suas dependências. O comando de início executa o pacote compilado. `TRE_TTA_WEB_ORIGIN` é solicitado ao criar/sincronizar o Blueprint (`sync: false`); preencher com a origem HTTPS real do site Vercel, sem caminho nem barra final. Não definir `TRE_TTA_PORT`, para o servidor usar `PORT` da plataforma; manter `TRE_TTA_SEED` ausente.

```sh
corepack enable && node --version && pnpm --version && pnpm install --frozen-lockfile && pnpm --filter @tretta/server... build
pnpm --filter @tretta/server start
```

O filtro de build foi executado e aceito na preparação local anterior; esta tarefa não o repetiu. O Blueprint precisa ser conectado a uma branch publicada para o Render buscar o código. Sem pagamento cadastrado no workspace Render, o serviço permanece no plano Free declarado.

**Vercel — interface.** O arquivo [apps/web/vercel.json](../../apps/web/vercel.json) define instalação e build a partir do rootdir `apps/web`, mudando para a raiz do repositório e compilando a interface com seus pacotes de workspace:

```sh
# Install Command (apps/web como diretório atual)
cd ../.. && pnpm --version && pnpm install --frozen-lockfile
# Build Command (apps/web como diretório atual)
cd ../.. && node -e 'let u;try{u=new URL(process.env.NEXT_PUBLIC_SERVER_URL)}catch{};process.exit(!u||u.protocol!=="https:"||/^(localhost|127\.|\[::1\])/i.test(u.hostname)?1:0)' && NEXT_PUBLIC_TEST_HOOKS=0 pnpm --filter @tretta/web... build
```

Na Vercel, definir Root Directory `apps/web` e ativar **Include source files outside of the Root Directory in the Build Step** para incluir `packages/protocol` e `packages/rules`. A opção é um ajuste do projeto na Vercel; não há chave declarativa equivalente em `vercel.json`. Habilitar `ENABLE_EXPERIMENTAL_COREPACK=1` no ambiente de build. O `packageManager` da raiz fixa `pnpm@11.14.0`; o Install Command registra a versão efetivamente selecionada e usa o lockfile congelado. Se Corepack não selecionar 11.14.0 ou o lockfile for recusado, interromper a publicação para reavaliar a compatibilidade, sem trocar a versão do projeto silenciosamente.

`engines.node` na raiz e em `apps/web/package.json` agora restringe a seleção à linha 22 (`>=22.12.0 <23.0.0`), compatível com a validação local em 22.23.1. A Vercel seleciona a versão mais recente que corresponda ao intervalo; não fixa o mesmo patch local. O Render usa o patch validado explicitamente por `NODE_VERSION`.

Antes do build de produção, definir no ambiente de build Vercel `NEXT_PUBLIC_SERVER_URL` com a origem HTTPS real do servidor Render. O comando de build recusa valor ausente, HTTP ou localhost/loopback, e força `NEXT_PUBLIC_TEST_HOOKS=0`. O valor da URL não é versionado porque depende da criação do serviço. `NEXT_PUBLIC_*` é embutida no bundle durante o build; qualquer correção dessa URL exige novo build. Depois de conhecer a origem Vercel, preencher `TRE_TTA_WEB_ORIGIN` no Render e redeployar o servidor antes de convidar pessoas. Não usar WebSockets da Vercel para o jogo: seu suporte atual é beta, cada conexão de Function tem limite de 300 segundos no Hobby e não atende ao estado autoritativo em memória deste servidor.

## Acesso e operação

Usar os domínios HTTPS fornecidos pelos provedores; domínio próprio não é necessário. Em uma sessão privada de smoke test, abrir o site HTTPS, criar uma sala e entrar com uma segunda identidade. Confirmar `/healthz` HTTP 200, ausência de erro de CORS e conexão `wss://<servidor>/socket.io/`, além de uma jogada e mensagem de chat. Não registrar convites ou credenciais nos logs.

O código mantém a pausa de 90 segundos e a retenção de sala de 15 minutos enquanto o processo permanece vivo. Suspensão ou reinício do Render apaga salas, chats e placares e interrompe esses prazos; as janelas não sobrevivem à parada. Render pode reiniciar o serviço a qualquer momento e não permite escalar o plano Free para várias instâncias. A suspensão por inatividade ocorre após 15 minutos sem tráfego HTTP ou mensagens WebSocket recebidas; a retomada leva cerca de um minuto. A documentação conta mensagens WebSocket como tráfego, mas não prova que o heartbeat normal do Socket.IO impeça a suspensão. Não gerar pings artificiais para mantê-lo acordado.

Render compartilha 750 horas de instância grátis por workspace e por mês; tráfego de saída e minutos de build também têm cotas. Sem pagamento cadastrado, exceder a cota de tráfego suspende serviços Free; exceder minutos de build impede novos builds no período. Com pagamento cadastrado, esses excedentes podem ser cobrados. Para manter esta fase sem cobrança, não cadastrar cartão no workspace Render; acompanhar as cotas no painel. Uma suspensão por limite pode deixar o jogo fora do ar até a cota voltar. Não há garantia de custo zero se os termos ou a configuração de pagamento mudarem.

Antes de deploy ou reinício planejado, esperar uma janela sem partidas e avisar o grupo; qualquer reinício perde o estado em memória. Após a atualização, repetir o smoke HTTPS/WSS. Reinícios de plataforma podem ocorrer sem janela de aviso, e não há recuperação de salas após eles.

## Fontes oficiais conferidas em 16/10/2026

- [Render Free](https://render.com/docs/free), [WebSockets](https://render.com/docs/websocket), [primeiro deploy](https://render.com/docs/your-first-deploy), [monorepos](https://render.com/docs/monorepo-support) e [versão do Node](https://render.com/docs/node-version).
- [Vercel Hobby](https://vercel.com/docs/plans/hobby), [monorepos](https://vercel.com/docs/monorepos), [build e Corepack](https://vercel.com/docs/builds/configure-a-build), [versões de Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [WebSockets em Functions](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) e [variáveis públicas Next.js](https://nextjs.org/docs/app/guides/environment-variables).
- [Filtro de dependências pnpm](https://pnpm.io/filtering).
