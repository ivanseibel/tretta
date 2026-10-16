# T007 — Preparação de hospedagem HTTPS

Data da pesquisa: 15 de outubro de 2026. Valores em dólares americanos, antes de impostos e de eventual compra de domínio.

## Tarefa e resultado

Concluída como pesquisa e proposta de implantação. Recomendo **Railway Hobby** para a primeira implantação: aceita os dois processos Node do monorepo, oferece domínio público com TLS e suporta WebSocket/WSS; no cenário de referência abaixo, custa cerca de **US$ 11,50/mês**. A conta não foi criada, nenhuma assinatura foi contratada e nenhum recurso externo foi provisionado.

O plano alternativo é **Render Hobby**, com custo fixo estimado em **US$ 14/mês** para dois serviços pequenos, ou **US$ 14,75/mês** no cenário de 10 GB de tráfego de saída. Render documenta explicitamente WebSockets e fornece healthchecks contínuos, com um custo mais previsível para a capacidade inicial proposta.

## Base local conferida

- O workspace exige Node.js `>=22.12.0`, fixa `pnpm@11.14.0` e usa `.nvmrc` com `22.23.1`.
- A partir da raiz, `pnpm build` executa os builds dos pacotes e dos dois apps. O servidor inicia por `pnpm --filter @tretta/server start`; a interface Next inicia por `pnpm --filter @tretta/web start`.
- O servidor Socket.IO é um processo Node próprio, com estado de salas em memória. Expõe `GET /healthz` com `200`, aceita uma origem CORS configurada e escuta em `TRE_TTA_PORT`, padrão `3100`.
- A interface lê `NEXT_PUBLIC_SERVER_URL`, padrão local `http://localhost:3100`, e cria o cliente com `transports: ['websocket']`.
- A configuração atual não lê a variável de plataforma `PORT` para o servidor Socket.IO. A interface `next start` usa `PORT` para escolher sua porta. A configuração de CORS atual exige uma origem explícita correspondente ao endereço público da interface.
- O servidor chama `httpServer.listen(port)` sem fixar o host. O Node.js 22, quando o host é omitido, usa o endereço IP não especificado; assim, a porta configurada aceita conexões pelas interfaces da instância.
- Os hooks especiais ficam desativados por padrão; `TRE_TTA_TEST_HOOKS` só os liga quando seu valor é exatamente `1`.

Não li arquivos `.env` locais nem inspecionei ou reproduzi segredos.

## Opções e custo

| Opção | Base fixa e consumo | Hipótese mensal de referência | Adequação |
| --- | --- | --- | --- |
| **Railway Hobby — recomendada** | Mínimo de **US$ 5/mês**, que inclui US$ 5 de uso. Acima disso, CPU custa US$ 20/vCPU-mês, RAM US$ 10/GB-mês e saída de rede US$ 0,05/GB. Builds e armazenamento de imagem não são cobrados; não é necessário adicionar volume. | Se os dois serviços usarem em média 512 MB de RAM cada durante todo o mês, consumirem em média 0,05 vCPU combinados e enviarem 10 GB: RAM US$ 10 + CPU US$ 1 + saída US$ 0,50 = **aprox. US$ 11,50 no mês**, já considerando que os US$ 5 da assinatura contam como crédito de uso. Com menos uso, o piso é US$ 5; com mais uso, o valor varia. | Serviços separados e domínio Railway com certificado SSL automático. WebSockets sobre HTTP/1.1 são aceitos; as conexões WebSocket não têm limite de inatividade ou duração nos limites documentados. Configurar uma réplica para o servidor autoritativo. |
| **Render Hobby** | Workspace custa **US$ 0/mês**. Um serviço web pago `0.5c-512mb` custa **US$ 7/mês** por 0,5 CPU e 512 MB; dois serviços custam **US$ 14 fixos/mês** se ficarem ativos o mês todo. O workspace inclui 5 GB de saída e 500 minutos de build; excedente de saída custa US$ 0,15/GB. | Com 10 GB de saída, os 5 GB excedentes custam US$ 0,75: **aprox. US$ 14,75/mês**, se os builds ficarem dentro dos minutos incluídos. Os serviços são cobrados por segundo de execução; sem tráfego medido, 10 GB é apenas hipótese. | Suporta WebSockets públicos, WSS, TLS gerenciado, subdomínios `onrender.com`, healthchecks HTTP contínuos e rollback. Um domínio próprio pode usar os dois domínios incluídos no plano Hobby; compra e renovação do domínio ficam à parte. |

Esses números não demonstram que os tamanhos pequenos atendem dez salas: não há medição de CPU, memória ou tráfego para a meta de até dez salas, com até oito jogadores por mesa. O custo real depende do uso e precisa ser acompanhado durante a validação. O cenário Railway compara o preço medido de dois processos com 512 MB de memória média cada, não uma reserva contratada de capacidade. Render cobra capacidade do plano independentemente do uso enquanto o serviço estiver ativo.

Fontes atuais de preço: [Railway Hobby e taxas de recursos](https://docs.railway.com/pricing/plans), [página de preços Railway](https://railway.com/pricing), [planos de workspace Render](https://render.com/docs/new-workspace-plans), [preços e compute Render](https://render.com/pricing), [especificações de compute Render](https://render.com/docs/compute-plans) e [saída de rede Render](https://render.com/docs/outbound-bandwidth).

## Configuração proposta

Para **Railway**, criar dois serviços a partir da raiz do repositório, cada qual com build e start próprios. A documentação de monorepo permite comandos por serviço; a documentação de rede confirma domínios `.railway.app`, SSL automático e WebSockets. Para **Render**, manter a raiz do repositório como diretório de build dos dois serviços, pois os pacotes `packages/*` são dependências locais do workspace; usar comandos filtrados para iniciar cada app. Usar a instância paga `0.5c-512mb` para cada serviço e manter uma instância do servidor.

| Serviço | Build a partir da raiz | Start | Variáveis e rede |
| --- | --- | --- | --- |
| Web Next.js | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @tretta/web start` | Definir `NEXT_PUBLIC_SERVER_URL=https://<dominio-publico-do-servidor>` antes do build. O Next.js embute variáveis `NEXT_PUBLIC_*` no JavaScript durante o build. `next start` lê `PORT`. |
| Socket.IO | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @tretta/server start` | Definir `TRE_TTA_WEB_ORIGIN=https://<dominio-publico-da-web>`. Configurar uma réplica. Alinhar `TRE_TTA_PORT` à porta pública do processo: em Render, `10000` é a porta padrão; em Railway, adaptar o servidor para aceitar o `PORT` fornecido ou fazer ambos os valores coincidirem na configuração do serviço. |

O cliente pode receber a URL pública `https://...`; para Socket.IO, `https` e `wss` são formas equivalentes. Como o código força somente o transporte WebSocket, o navegador não tem fallback para long-polling. Isso evita a necessidade de sessões fixas, mas pode impedir conexão em algumas redes restritivas. A página e o servidor têm domínios distintos, então a origem CORS precisa ser o endereço final da interface; se ele mudar, a variável do servidor também precisa mudar.

Deixar `TRE_TTA_TEST_HOOKS` ausente ou definir `0`. Nunca definir `1` em produção.

## Operação, reinício e reversão

O servidor já responde a `SIGTERM` fechando salas e conexões Socket.IO. Tanto reinício quanto implantação de uma nova versão encerram o processo em memória e, conforme o escopo aprovado, apagam salas, placares e chats. Um rollback também inicia novamente uma versão do servidor; não recupera o estado em memória. Fazer implantações e reinícios fora de partidas ativas. A réplica do servidor deve permanecer em `1`; não habilitar autoscaling horizontal.

O caminho `/healthz` pode ser configurado como healthcheck do servidor. No Railway ele valida a nova implantação antes de ativá-la, mas não monitora continuamente o processo. No Render os healthchecks de serviço são repetidos e falhas persistentes podem reiniciar a instância, portanto também podem encerrar salas. O healthcheck da interface pode usar `/`. O servidor atualmente não configura uma verificação própria de saúde das salas, apenas responde se o processo HTTP está atendendo.

O rollback Railway restaura uma implantação e suas variáveis; no Hobby, as imagens de deploy removidas ficam retidas por 72 horas. Render também permite rollback pela tela de deploys. Nenhum dos mecanismos reconstitui as salas perdidas no reinício.

Fontes operacionais: [Railway monorepos](https://docs.railway.com/deployments/monorepo), [Railway TLS e domínios](https://docs.railway.com/networking/public-networking), [WebSockets e limites Railway](https://docs.railway.com/networking/public-networking/specs-and-limits), [réplicas Railway](https://docs.railway.com/deployments/scaling), [healthchecks Railway](https://docs.railway.com/deployments/healthchecks), [deploy e rollback Railway](https://docs.railway.com/deployments/deployment-actions), [Render monorepos](https://render.com/docs/monorepo-support), [serviços web Render](https://render.com/docs/web-services), [WebSockets Render](https://render.com/docs/websocket), [healthchecks Render](https://render.com/docs/health-checks), [reinício e rollback Render](https://render.com/docs/rollbacks) e [limitações do plano gratuito Render](https://render.com/docs/free).

Fontes técnicas adicionais: [variáveis públicas no build do Next.js](https://nextjs.org/docs/app/guides/environment-variables), [porta de `next start`](https://nextjs.org/docs/app/api-reference/cli/next), [host padrão de `server.listen()` no Node 22](https://nodejs.org/docs/latest-v22.x/api/net.html#serverlistenport-host-backlog-callback) e [inicialização e transporte WebSocket do Socket.IO](https://socket.io/docs/v4/client-options/).

## Critérios de aceite

- **Duas aplicações Node e workspace:** identificados os scripts atuais de build e start, a dependência de pacotes compilados `dist` e a necessidade de build a partir da raiz.
- **Instância autoritativa única:** as duas propostas permitem manter uma instância do processo de jogo; a configuração não deve ativar escala horizontal.
- **HTTPS e WebSocket/WSS:** ambas fornecem URL TLS e documentam suporte WebSocket; Render declara WSS explicitamente, Railway declara WebSockets sobre HTTP/1.1 e SSL automático.
- **URL, CORS e portas:** registradas as variáveis que devem ser ajustadas, o URL público do socket que precisa existir antes do build Next e o desalinhamento atual entre `TRE_TTA_PORT` e `PORT`.
- **Healthcheck, hooks e operação:** identificado `/healthz`, o estado de hooks de teste desligado por padrão e o efeito de restart/deploy/rollback sobre salas em memória.
- **Custo antes de contratar:** as duas alternativas e suas hipóteses foram comparadas; domínio próprio e variações de consumo foram separados do preço fixo.

## Verificação

Li `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, `docs/product/first-version.md`, `docs/work/status.md`, `docs/work/plan.md` e os arquivos de configuração e inicialização relevantes: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.env.example`, manifestos dos apps e pacotes, `apps/server/src/config.ts`, `apps/server/src/index.ts`, `apps/server/src/server.ts`, `apps/server/src/handlers.ts`, `apps/web/lib/client.ts` e `apps/web/next.config.ts`.

Consultei páginas oficiais de preço e operação em 15/10/2026 e usei Context7 para validar a documentação atual de Next.js, Socket.IO, Railway e Render. Não executei build, testes, instalação ou deploy, conforme o limite da tarefa.

## Decisões e desvios

Recomendo Railway Hobby pela conta de referência menor, com preço variável e recursos medidos. Render Hobby é a opção de custo base mais previsível e tem confirmação explícita de WSS em sua documentação. Não presumi conta, vínculo a Git, acesso a DNS, domínio, meio de pagamento ou assinatura de nenhum provedor.

O tamanho de máquina e o tráfego ainda não foram validados para dez salas. A T007 deve testar a escala aprovada e revisar os custos observados. Nenhuma configuração local foi alterada além deste relatório.

## Próximo passo

Depois de T006 ser aceita, o orquestrador pode preparar configuração local para Railway em T007 e validar build, endpoint, conexão WSS, origem CORS, oito participantes e dez salas. A aprovação do usuário sobre plataforma e custo vem antes de criar conta com cobrança, conectar Git/DNS ou contratar recursos de hospedagem, conforme o escopo aprovado.
