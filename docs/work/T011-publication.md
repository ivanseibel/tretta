# Prompt manual — publicar a mesa de treino T011

**Estado: executada e aceita pelo orquestrador em 17/10/2026.** [Report](reports/T011-publication.md) e [aceite](reports/T011-publication.validation.md). Contrato histórico abaixo preservado; não repetir a publicação sem nova tarefa. Preferência `gpt-6-luna`, reasoning `max`. Não acione outros agentes.

## Papel, autorização e contexto

Você é o executor da publicação T011 em `/Users/ivanseibel/dev/personal/tretta`. Após o aceite local e a indicação de que a publicação dependia de autorização específica, o usuário respondeu **“Vamos”** em 17/10/2026. Esse pedido autoriza avançar com a publicação da mesa de treino nos serviços existentes, incluindo o commit/push da fonte revisada necessário ao servidor Git do Render e seu reinício. Não autoriza outros recursos, planos pagos ou mudanças de produto.

A execução continua manual. O usuário deve iniciar esta execução **numa janela sem partidas**: o processo Render guarda salas em memória e a atualização as apaga. Não há endpoint de contagem de salas em produção; `/healthz` saudável não prova ausência de partidas. Se a janela não estiver estabelecida na sessão executora, conclua a preparação reversível e informe a condição antes do push/reinício. Não entre em salas da família, não envie mensagens ao grupo e não acrescente telemetria para contornar essa limitação.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, status/plano, `docs/product/mesa-de-treino.md`, `docs/work/reports/T011A.validation.md`, **`docs/work/reports/T011B.final-validation.md`**, `deployment-free.md` e o aceite público de T010. Use as skills de deploy/CLI Vercel pertinentes, `browser-harness` para interação com navegador e `writing-for-agents` para instruções. Siga Context7 para dúvidas atuais de API/CLI.

T011A e T011B estão aceitas localmente, inclusive R1/B6. Fonte é o **working tree completo**, com T008–T011 ainda sem commit e arquivos novos. HEAD sozinho não é a entrega. Confira Git e preserve alterações, ignorados, logs e históricos; testes formais já foram aceitos e não devem reescrever evidências na fonte.

## Alvos e estado conferidos na preparação

Conferir novamente antes de mutações; estes IDs são referências, não licença para substituir outro serviço:

| Alvo | Referência |
| --- | --- |
| Git | `git@github.com:ivanseibel/tretta.git`, branch `main`; HEAD e remoto conferidos em `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837` |
| Render | Serviço `srv-db95f2u7bikc73dpndt0`, workspace `tea-cuhq60rv2p9s738m7us0`, plano **Free**, uma instância, `https://tretta-server.onrender.com` |
| Backend anterior | Deploy `dep-db95f367bikc73dpnfs0`, Live, revisão `8967e94…`; `autoDeploy=yes`, gatilho `commit` de `main` |
| Vercel | Projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `team_4mQparNtNCNqsb95uxf2FzoD`, workspace **Seibel — Hobby** (`seibel`), root `apps/web`, Node 22.x |
| Frontend anterior | T010 READY/production `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj`, `https://tretta-26gh6ystv-seibel.vercel.app`; listagem de aliases confirma `tretta.vercel.app` nesse build |

Vercel não tem Git conectado; manter upload explícito para o projeto existente. Sem nova conta, projeto, Blueprint, domínio, banco, plano ou cartão. Plano de runtime Render é `serviceDetails.plan=free`; não confundir com metadados do executor de build.

Conferências desta preparação em [readback.json](reports/assets/T011-public-preparation/readback.json): 148 fontes aceitas sem diferenças, refs Git, backend e destino do alias. Projeto/plano Vercel e configurações devem ser reconfirmados pelo executor; a referência de Hobby vem do aceite anterior.

## Sequência de publicação

### 1. Conferir e congelar a fonte

- Compare os arquivos funcionais/configurações com `docs/work/reports/assets/T011B-final-validation/validated-source.sha256.json` (148 caminhos; `next-env.d.ts` é gerado e foi excluído). Diferença funcional exige voltar ao orquestrador antes de publicar; documentos de estado posteriores não invalidam o código aceito.
- Confira também manifests/lockfile/configurações de build da raiz e as fontes servidor/protocolo aceitas. Registre baseline, branch/remoto e hash das fontes. Se `main` remoto avançou, inspecione a divergência e preserve trabalho alheio; nada de force-push, reset ou descarte.
- Prepare **um commit local da versão revisada acumulada T008–T011**, com seleção explícita de fontes/configurações/testes e documentação/evidência sanitizada pertinente. Revise a lista staged e o diff antes de confirmar; inclua todos os arquivos novos necessários, como `TurnNotifier`, helpers e testes. Preserve ignorados localmente; não inclua `.env`, credenciais, storage de navegador, ZIPs brutos, dependências, builds, caches ou `.vercel`. Não use add indiscriminado de ignorados. Registre o SHA e a lista exata do commit; **ainda não faça push**.
- Monte snapshot temporário de upload a partir dessa mesma fonte, incluindo root/workspace/lockfile e fontes externas ao root web; retire `.git`, dependências, `dist`, `.next`, env, `.vercel` preexistente, reports e artefatos não necessários ao build. Gere lista e manifesto SHA-256 dos arquivos efetivamente enviados, relacionando digest, commit e aceites. Preserve a fonte original e os históricos.

### 2. Deixar o frontend pronto sem mudar o domínio

- Confira projeto/time/Hobby, configurações e variáveis públicas: `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com`, `NEXT_PUBLIC_TEST_HOOKS=0`, Corepack e pnpm 11.14.0, Node 22 e inclusão de fontes externas ao root. Preserve `apps/web/vercel.json`. Não exponha variáveis privadas.
- Vincule somente ao projeto existente, confira o upload com o recurso de dry run disponível no CLI e faça **staged production**: `vercel deploy --prod --skip-domain` com workspace/projeto explícitos. Use `rtk` nos comandos reais. Nunca promova Preview supondo que é o mesmo build: Preview pode ser reconstruído na promoção.
- Aguarde READY, confira logs, versões, URL HTTPS, digest/base nos metadados e os marcadores do treino no bundle. O domínio principal permanece T010. O backend antigo ainda não suporta treino: não conclua um teste de treino contra ele, nem afrouxe o CORS para o domínio temporário. Verificações autenticadas de HTTP/build nesse estágio bastam; o smoke completo virá no domínio público depois da atualização do servidor.
- Se o build falhar, pare e reporte antes do push: não reinicie o backend para uma interface que ainda não está pronta.

### 3. Atualizar o backend uma vez, na janela sem partidas

- Com o frontend staged READY e janela estabelecida, faça push normal do **commit exato** para `origin/main`. Isso já deve disparar o auto-deploy Render. Não execute um deploy manual adicional enquanto houver deploy automático desse SHA em andamento.
- Acompanhe o deploy e registre ID, revisão, estado e logs. Confirme Live na revisão enviada, plano Free, uma instância, instalação congelada/build filtrado, `TRE_TTA_TEST_HOOKS=0`, seed ausente e origem `https://tretta.vercel.app`. `NODE_VERSION=22.23.1` e demais configurações vigentes permanecem.
- Se o gatilho automático comprovadamente não ocorrer, verifique primeiro a lista/fila. Só então use deploy manual do SHA exato no serviço existente, sem limpar cache ou reiniciar repetidamente por tentativa. A CLI instalada oferece `render deploys create <serviço> --commit <SHA> --wait`; confirme a ajuda atual e use polling com updates, evitando silêncio prolongado.
- Healthcheck HTTPS 200 é necessário, mas não suficiente. Verifique por clientes próprios a nova criação `mode=training`, três bots e recusa de entrada externa, e a compatibilidade da sala humana com o frontend T010 ainda público. Use apenas informações da própria projeção, sem logar mãos/credenciais. Se houver falha, não promova a interface nova.

### 4. Promover o mesmo build e conferir o domínio

- Promova o **mesmo staged production READY**, sem rebuild. Confira diretamente o alias `tretta.vercel.app` e seu deployment ID/projeto; a lista embutida em `inspect` pode omitir o domínio principal. Use subcomandos documentados: `vercel alias list`/API de leitura; `alias inspect` não existe nesse CLI e pode ser interpretado como atribuição de alias.
- Ajuste apenas o domínio deste projeto se a promoção não o associar. Confirme por readback e HTTP público. Não altere a origem CORS para suportar o domínio temporário nem conecte Git na Vercel.

### 5. Smoke público sem hooks

No navegador, com sala/identidades próprias e sem testes destrutivos sobre outras salas:

1. Home → “Treinar sozinho” → preparação com três bots identificados/prontos; confirmar prontidão e iniciar. Nenhum convite/remoção ou falso alerta de desconexão de bot.
2. Jogar **uma rodada real completa** contra bots pelas regras normais e conferir vencedor/placar, retorno à preparação e outra rodada com os mesmos bots. Sem seed, baralho injetado, alteração direta de estado ou ativação de hooks públicos. Não prometer duração fixa da rodada; se a prova não terminar, reporte parcial em vez de forçar vitória.
3. Reload numa rodada ativa: mesma identidade e mão por asserts/digests, espera T010 e continuação explícita da pausa; depois, ações funcionam. Duas abas no mesmo contexto mantêm proteção e recuperação depois de fechar a primeira, sem identidade duplicada.
4. Contexto sem credencial tenta entrar na própria mesa de treino e recebe a recusa individual; nada de nova identidade ou retry automático. A corrida R1/B6 já foi provada localmente: não injete atrasos/falhas na infraestrutura pública para repeti-la.
5. Sala comum com dois clientes de navegador: convite, prontidão, início, jogada, chat e recuperação da mesma identidade após reload. Preferência de aviso de vez permanece persistida. Não é necessário completar outra rodada humana só para repetir provas já aceitas.
6. Confirmar HTTPS/WSS, hooks ausentes no bundle/cliente e recusados no servidor compilado, console/página sem erros materiais. Sair das salas próprias ao final, sem novo restart para limpá-las.

Logs usam aliases, contagens, asserts/digests; capturas mostram só informação da UI autorizada. Nada de tokens, credenciais, convites reais de terceiros, storage bruto ou mãos dos bots nos artefatos.

## Recuperação se a publicação falhar

- Registre os alvos anteriores antes da primeira mutação. Falha no build staged não exige mudar produção. Falha do deploy Render normalmente preserva o anterior, mas confira o estado efetivamente Live e a saúde; não presuma sucesso ou rollback automático.
- Se o frontend novo tiver problema, restaure `tretta.vercel.app` ao build T010 conhecido e disponível, confirmando o ID/HTTP. Reverter o frontend não restaura o backend.
- Se precisar restaurar o servidor, use rollback suportado sem custo ou redeploy da revisão anterior **`8967e94eae18a351c6c7b4c81a1f00ea5d6d1837`**, no mesmo serviço/plano. Não reescreva a branch Git para simular rollback. Redeploy por SHA pode exigir rebuild e novo reinício; não recupera salas perdidas.
- CLI/API de deploy por SHA não desativam auto-deploy Render. Se for necessário manter um backend antigo enquanto `main` contém o novo, desative temporariamente o auto-deploy apenas para estabilizar a restauração, registre a alteração e deixe explícito no report o estado final. Não reative automaticamente se isso disparar novamente a versão problemática. Evite novos pushes documentais durante esse estado.
- Se a interface voltar a T010 e o backend novo estiver saudável e compatível com salas humanas, registre o estado misto e a limitação; não anuncie treino publicado. Mudança de plano/cobrança nunca é solução autorizada.

## Critérios de aceite e retorno

| ID | Prova necessária |
| --- | --- |
| P1 — Fonte | Fonte aceita, commit/push e manifestos identificados; remoto aponta ao SHA enviado; upload sem dados privados/gerados |
| P2 — Backend | Mesmo serviço Free, novo deploy Live da revisão exata, healthcheck e protocolo de treino/humano corretos, hooks desligados; sem deploy duplicado não justificado |
| P3 — Frontend/domínio | Mesmo projeto Seibel Hobby, staged production READY e promoção desse build, alias direto para o ID correto, HTTP/bundle conferidos |
| P4 — Experiência pública | Rodada completa de treino, placar/outra rodada, recuperação/duas abas/recusa; sala comum, chat e preferência funcionando; erros e limitações registrados |
| P5 — Preservação/operação | Históricos intactos, custo zero, nenhuma sala alheia usada; estado final/rollback e quaisquer perdas/reinícios descritos com precisão |

Entregue **`docs/work/reports/T011-publication.md`**, com evidência P1–P5, URLs públicas, commit SHA, IDs de deploy/time/projeto/plano, digest/lista de upload, comandos/saídas sanitizados, smoke/capturas, falhas e estado final. Artefatos novos em `docs/work/reports/assets/T011-public/`.

Atualize runbook/status/plano para **“publicação T011 aguardando validação do orquestrador”**, sem declarar aceite. Depois do push da versão, reports/status novos ficam no working tree: não faça um segundo push apenas documental, pois dispararia outro restart. Pare após entregar para a validação independente.

## Referências operacionais conferidas na preparação

Docs oficiais via Context7: [Vercel deploy/staging](https://vercel.com/docs/cli/deploy), [promoção](https://vercel.com/docs/deployments/promoting-a-deployment), [Render deploy por commit e auto-deploy](https://render.com/docs/deploys), [rollback Render](https://render.com/docs/rollbacks). CLI Render 2.29.0 confirmou `--commit`/`--wait`; Vercel CLI 57.0.0 confirmou `alias list/set` na preparação. Confira a ajuda se a versão mudar.
