# Publicação HTTPS no Railway — runbook T007

> Proposta paga preservada como alternativa histórica. Em 15 de outubro de 2026 o usuário definiu custo zero para a fase de hobby familiar. A proposta atual é preparada em [deployment-free.md](deployment-free.md); não contratar Railway a partir deste documento.

**Estado: preparação revisável; nenhuma implantação foi feita.** A opção indicada é Railway Hobby, com dois serviços no mesmo monorepo e uma réplica do servidor autoritativo. O usuário ainda precisa aprovar a plataforma, o custo e o acesso a uma conta/workspace. Não presumo conta, meio de pagamento, projeto Railway, domínio ou autorização para criar recursos.

Este runbook usa os manifestos e comandos do working tree atual. A configuração garante uma réplica e desativa o sleep no manifesto, mas a validação final deve confirmar os mesmos valores no painel Railway. Reinícios, atualizações e reversões encerram o processo de jogo em memória e apagam salas, chats e placares ativos; avise o grupo e espere as partidas terminarem antes de qualquer uma dessas operações.

## Custo e escolha pendente

O mínimo do plano Hobby é **US$ 5 por mês**, incluindo US$ 5 de uso de recursos. Acima do crédito, as taxas publicadas são US$ 10 por GB-mês de memória, US$ 20 por vCPU-mês e US$ 0,05 por GB de saída de rede. Como hipótese, dois serviços com média de 512 MB cada durante o mês, 0,05 vCPU combinados e 10 GB de saída dão cerca de US$ 10 de memória + US$ 1 de CPU + US$ 0,50 de saída: **aproximadamente US$ 11,50 no total mensal**, já contando o crédito incluído. É uma estimativa, não medição nem reserva de capacidade para dez salas; impostos e domínio próprio não estão incluídos. Com uso baixo, o piso continua US$ 5; com uso maior, o custo varia.

O limite rígido de uso é definido por workspace e, quando alcançado, desliga as cargas desse workspace. Isso pode tirar ambos os serviços do ar e não deve ser tratado como um teto garantido para o valor total da fatura, pois a assinatura base e impostos podem continuar. O dono do workspace deve decidir se quer alertas e qual risco de interrupção aceita antes de configurar limites. Um domínio `*.railway.app` com TLS automático evita a compra de domínio; domínio próprio e DNS são opcionais e dependem de propriedade e acesso confirmados pelo usuário.

## O que será configurado

Os dois serviços usam a raiz `/` como Root Directory, porque os apps dependem dos pacotes workspace em `packages/*`. Selecione explicitamente o arquivo Railway de cada serviço no painel: o caminho de configuração é absoluto em relação à raiz do repositório.

| Serviço | Config file | Build | Start | Healthcheck | Escala |
| --- | --- | --- | --- | --- | --- |
| `tretta-server` | `/apps/server/railway.toml` | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @tretta/server start` | `/healthz` | `numReplicas = 1`; `sleepApplication = false` |
| `tretta-web` | `/apps/web/railway.toml` | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @tretta/web start` | `/` | `numReplicas = 1`; `sleepApplication = false` |

Os manifestos atuais usam Railpack e `restartPolicyType = "ON_FAILURE"`. A raiz fixa `pnpm@11.14.0`; `.nvmrc` contém `22.23.1`, mas `engines.node` aceita qualquer versão `>=22.12.0`, então configure também `RAILPACK_NODE_VERSION=22.23.1` nos dois serviços para fixar o Node do build. Confira no log de build que a plataforma leu essas versões.

Defina as variáveis nos serviços Railway, sem criar ou enviar `.env`:

| Serviço | Variável | Valor e momento |
| --- | --- | --- |
| Ambos | `RAILPACK_NODE_VERSION` | `22.23.1`; disponível durante o build. |
| `tretta-server` | `TRE_TTA_WEB_ORIGIN` | Origem HTTPS exata da interface, por exemplo `https://<dominio-web>`, sem caminho ou barra final. No primeiro deploy, antes de o domínio web existir, deixe ausente (o padrão local não serve usuários externos). Defina o valor final e redeploy antes de divulgar o jogo. |
| `tretta-server` | `TRE_TTA_TEST_HOOKS` | `0`. Não defina `TRE_TTA_SEED`; hooks e semente de teste devem permanecer desligados. |
| `tretta-server` | `TRE_TTA_PORT` | Deixe ausente. O processo usa a variável `PORT` injetada pelo Railway; a configuração atual usa `PORT` quando `TRE_TTA_PORT` está ausente ou vazio. |
| `tretta-web` | `NEXT_PUBLIC_SERVER_URL` | URL HTTPS pública do serviço `tretta-server`, definida **antes do build**. O Next.js embute `NEXT_PUBLIC_*` no bundle durante o build, então trocar o valor requer novo build e deploy. |
| `tretta-web` | `NEXT_PUBLIC_TEST_HOOKS` | `0`; não habilite hooks especiais em produção. |

O cliente usa Socket.IO somente com transporte WebSocket. Com origem `https://`, o navegador negocia WSS (`wss://<dominio-server>/socket.io/`) através do proxy TLS. A configuração CORS aponta para a interface; ela não é uma barreira de autorização do transporte WebSocket. A autorização continua dependendo do vínculo da conexão e da credencial individual de retorno. Os dois valores públicos devem corresponder aos domínios finais. Railway documenta WebSockets sobre HTTP/1.1 e TLS nos domínios públicos.

## Preparação local e envio sem commit

Antes de qualquer envio externo, conclua as provas locais de T007 no fluxo próprio. O smoke de processo compilado disponível é `rtk proxy pnpm --filter @tretta/web e2e:production`; o script faz build com `NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:3100` e `NEXT_PUBLIC_TEST_HOOKS=0`, depois executa Playwright contra os processos compilados. Este runbook não executou build, instalação ou testes.

Após aprovação explícita de custo e acesso, Railway CLI permite enviar um diretório local sem criar commit. Use o projeto, ambiente e serviços que o usuário aprovou. Não use `--new`, `-y` nem `--no-gitignore`; `railway up` sem projeto/serviço selecionados pode iniciar um fluxo para criar recursos. Se o CLI não estiver instalado ou autenticado, siga a instalação e o login oficiais somente depois da aprovação.

Para não enviar relatórios, ambientes locais ou credenciais, crie um diretório temporário sanitizado a partir da raiz do repositório e revise o conteúdo antes de `railway up`:

```sh
rtk mktemp -d /tmp/tretta-railway.XXXXXX
rtk rsync -a \
  --exclude='.git/' \
  --exclude='.agents/' \
  --exclude='.aws/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='out/' \
  --exclude='dist/' \
  --exclude='coverage/' \
  --exclude='docs/work/reports/' \
  --exclude='test-results/' \
  --exclude='playwright-report/' \
  --exclude='playwright/.cache/' \
  --exclude='.env*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='credentials*' \
  ./ CAMINHO_TEMPORARIO/
```

Substitua `CAMINHO_TEMPORARIO` pelo caminho impresso por `mktemp`; mantenha o mesmo diretório para os dois serviços. O comando exclui o diretório `.git`, `.env*`, relatórios e saídas de build/teste. Revise também arquivos locais fora desses padrões antes de enviar. No painel, crie os dois serviços e selecione Root Directory `/` e o config file indicado na tabela. Então, já autenticado e somente depois da aprovação:

```sh
rtk railway up CAMINHO_TEMPORARIO --path-as-root --project ID_DO_PROJETO_APROVADO --environment AMBIENTE_APROVADO --service tretta-server
rtk railway up CAMINHO_TEMPORARIO --path-as-root --project ID_DO_PROJETO_APROVADO --environment AMBIENTE_APROVADO --service tretta-web
```

Substitua os marcadores pelos identificadores do projeto e ambiente escolhidos pelo usuário. `--path-as-root` faz o diretório sanitizado ser a raiz do arquivo enviado, mesmo ao executar o CLI fora dele. Não salve token de CLI, credencial ou arquivo `.env` no repositório ou no diretório temporário. A documentação oficial descreve `railway up [PATH]` como envio da fonte local; a seleção explícita impede depender de um vínculo implícito.

## Ordem de configuração e validação pública

1. Após a aprovação, crie um projeto e ambiente Railway no workspace escolhido. Crie `tretta-server` e `tretta-web`, ambos com Root Directory `/`, e associe os config files absolutos da tabela. Confirme no painel uma réplica e sleep/serverless desligado para cada serviço. Defina `RAILPACK_NODE_VERSION=22.23.1` nos dois e mantenha `TRE_TTA_TEST_HOOKS=0` no servidor. Não crie volume ou serviço de persistência.
2. Faça o primeiro deploy do servidor sem usuários conectados. O Railway injeta `PORT`; o app deve responder `GET /healthz` com HTTP 200. Gere o domínio público do servidor no painel e anote a origem `https://...`.
3. Antes do build web, defina `NEXT_PUBLIC_SERVER_URL` com a origem do servidor. Faça o deploy web e gere seu domínio público Railway. Não divulgue o link enquanto CORS ainda estiver no padrão local.
4. Defina `TRE_TTA_WEB_ORIGIN` como a origem HTTPS exata do domínio web, sem caminho ou barra final, e redeploy o servidor. Faça essa mudança antes de abrir salas reais: o redeploy encerra o processo anterior e seu estado em memória.
5. Confirme `https://<dominio-server>/healthz` com HTTP 200 e `https://<dominio-web>/` com HTTP 200. Em uma sessão de teste, crie uma sala e entre com uma segunda identidade; no painel de rede do navegador confira o handshake WebSocket seguro em `wss://<dominio-server>/socket.io/`, ausência de erro CORS e funcionamento de mensagens/estado. Confira logs sem incluir credenciais. Esse smoke público não substitui as provas locais de oito clientes e dez salas.
6. Antes de convidar o grupo, confira variáveis, hooks/seed ausentes ou desligados, uma réplica do servidor, sleep desativado e healthchecks dos dois serviços. Observe CPU, memória, tráfego e cobrança real; a hipótese de US$ 11,50 não é promessa de capacidade para dez salas.

Railway healthchecks são usados para ativar uma nova implantação após uma resposta saudável; não são uma sonda contínua de disponibilidade. `ON_FAILURE` pode reiniciar um processo com falha, mas isso perde o estado autoritativo em memória. A quantidade de salas não é persistida entre processos.

## Atualização, reinício e rollback

Combine a janela com o grupo e espere não haver partidas ativas antes de deploy, restart ou rollback. Um `SIGTERM` fecha o servidor e o Socket.IO; a memória do processo desaparece. Reinício automático após falha, atualização e reversão têm o mesmo efeito sobre salas, chats e placares. A reversão restaura código/configuração da implantação, não o estado de jogo.

Para uma reversão manual, abra o serviço afetado no Railway, entre em **Deployments**, abra o menu da implantação anterior aprovada e escolha **Rollback**. O plano Hobby mantém imagens de deploy para rollback por 72 horas; confirme a retenção disponível no momento. Após reverter, repita o healthcheck e smoke HTTPS/WSS, confirme CORS e variáveis e só então avise o grupo. Se o servidor foi reiniciado, informe que as salas anteriores foram encerradas.

Em **Workspace → Usage**, o administrador pode configurar alertas e o limite rígido de compute. Um limite rígido alcançado desliga as cargas do workspace, portanto pode derrubar web e servidor juntos; confirme a conta, o limite escolhido e esse impacto antes de habilitá-lo.

## Pendências de aprovação

- Aprovar Railway Hobby com cobrança variável e a publicação desta versão pelos domínios `railway.app` fornecidos. A aprovação abrange o envio do snapshot revisado; nenhum commit é necessário.
- Identificar a conta/workspace e disponibilizar acesso autorizado quando a publicação for aprovada. Nenhum login ou conta foi presumido.

Domínio próprio e limite rígido de gastos são opcionais e não fazem parte da configuração inicial proposta. Antes de futuras atualizações com usuários ativos, combinar a janela operacional; avisos ao grupo cabem ao responsável, sem envio automático de mensagens pelo agente.

## Fontes oficiais

- [Planos e preços Railway](https://docs.railway.com/pricing/plans) e [controle de custo por workspace](https://docs.railway.com/pricing/cost-control).
- [Monorepos e config file Railway](https://docs.railway.com/deployments/monorepo), [variáveis Railway](https://docs.railway.com/guides/variables) e [schema Railway](https://railway.com/railway.schema.json) para `numReplicas` e `sleepApplication` sob `[deploy]`.
- [Railpack para Node.js](https://railpack.com/languages/node/) para seleção de Node e pnpm.
- [Domínios e TLS Railway](https://docs.railway.com/networking/public-networking), [limites de WebSocket](https://docs.railway.com/networking/public-networking/specs-and-limits) e [healthchecks](https://docs.railway.com/deployments/healthchecks).
- [CLI `railway up`](https://docs.railway.com/cli/up) e [deploy Railway](https://docs.railway.com/cli/deploying).
- [Reversão e retenção Railway](https://docs.railway.com/deployments/deployment-actions) e [encerramento de processos em deploy](https://docs.railway.com/deployments/deployment-teardown).
- [Variáveis de ambiente Next.js](https://nextjs.org/docs/app/guides/environment-variables), incluindo a substituição de `NEXT_PUBLIC_*` durante o build.

*Verificação documental em 15/10/2026. O runbook só registra a preparação local; a publicação continua pendente das aprovações acima e das provas de T007.*
