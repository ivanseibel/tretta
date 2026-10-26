# Prompt manual — T019-publication: publicar a mesa nova, trilho e 12 reações

**Estado: em execução manual em 26/10/2026, autorizada pelo usuário (“Acho que por hora está bom, vamos publicar”).** A fonte é o working tree acumulado sobre `90aff00`, com a UI nova da mesa, trilho de 2–8 assentos, 12 reações sem alvo e remoção das provocações. O gate final (e2e completo e matriz 108/108) roda antes do commit. Contrato baseado em [T014-publication](T014-publication.md); a publicação anterior permanece histórica.

**Encerramento obrigatório do executor manual:** use a skill `agent-notify` conforme [o protocolo](../../.agents/skills/orchestrate-work/SKILL.md#notificação-de-encerramento). Depois de salvar o report e terminar as verificações, notifique como última ação antes da resposta final. Report concluído aguardando validação usa `rtk proxy agent-notify done`; se precisar parar por decisão/autorização/informação pendente, use `attention`; falha terminal usa `error`. A dispensa vale somente para executor lançado automaticamente como subagente.

## Papel, fonte e contexto

**Browser dedicado obrigatório:** antes de qualquer inspeção/smoke, siga o [isolamento do navegador](../../.agents/skills/orchestrate-work/SKILL.md#isolamento-do-navegador): processo/perfil temporário próprios, endpoint CDP explícito e `BU_NAME` exclusivo da tarefa. Não conecte ao Chrome pessoal já aberto. Contextos independentes para os jogadores devem pertencer à instância dedicada; registre a comprovação e a limpeza no report.

Você é o executor de **T019-publication**, em `/Users/ivanseibel/dev/personal/tretta`. Publique a fonte aceita de T019 nos serviços existentes e devolva report para validação do orquestrador.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, estado/plano, [o escopo aprovado](../product/mesa-e-reacoes.md), [T019](T019.md), [o report T019F](reports/T019F.md), [o runbook](deployment-free.md) e [T014-publication](T014-publication.md). Use `writing-for-agents`, `vercel:deployments-cicd`, `vercel:vercel-cli` e, para navegador, `browser-harness`. Consulte documentação atual via Context7 e ajuda instalada antes de usar sintaxe incerta.

Fonte congelada: working tree no momento do commit, sobre `90aff00645fe42f60ab68fb4ce96e527c081c95c`. O commit e o snapshot devem reproduzir exatamente o build verificado. Preserve working tree, não rastreados, ignorados, reports e evidências anteriores.

## Autorização e janela operacional

A autorização cobre snapshot, um commit local da fonte acumulada revisada, push normal único, deploy no Render existente, frontend staged production e promoção do mesmo build, smoke próprio e rollback delimitado. Mantenha custo zero, uma instância Render Free e Vercel Seibel Hobby. Novos recursos, planos pagos, mudanças de produto, force-push e descarte de trabalho alheio ficam fora do contrato.

**Conclua conferência de alvos, commit local, snapshot e frontend staged READY antes de solicitar a confirmação da janela.** Se o usuário já confirmou uma janela válida nesta sessão, prossiga sem repetir a pergunta. Caso contrário, peça a confirmação imediatamente antes do push: o reinício apaga salas, chats e placares em memória. O [runbook](deployment-free.md), seção “Acesso e operação”, exige: “Antes de deploy ou reinício planejado, esperar uma janela sem partidas e avisar o grupo”. A confirmação humana cobre essa condição; não envie mensagens ao grupo. `/healthz` não mede salas ativas, e não existe contador público para inferir a janela. Não altere produção nem faça push enquanto essa condição estiver pendente.

## Alvos de referência — reconfirmar antes de mutações

| Alvo | Referência |
| --- | --- |
| Git | `git@github.com:ivanseibel/tretta.git`, branch `main`; base `90aff00645fe42f60ab68fb4ce96e527c081c95c` |
| Render | Serviço `srv-db95f2u7bikc73dpndt0`, workspace `tea-cuhq60rv2p9s738m7us0`, plano Free, uma instância; `https://tretta-server.onrender.com` |
| Backend anterior | T014, deploy `dep-dbahinbm8hqs73be533g`, revisão `90aff00`, Live; auto-deploy por commit de `main` |
| Vercel | Projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `team_4mQparNtNCNqsb95uxf2FzoD`, workspace Seibel — Hobby, root `apps/web`, Node 22.x |
| Frontend anterior | T014, deployment `dpl_613qfXj17XFdFctcg5HjsEimhfpz`, domínio `https://tretta.vercel.app` |
| Rollback frontend | T013, `dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k` |

Confira o projeto resolvido no diretório real do comando, proprietário, plano, alias atual e backend Live. Não conecte Git à Vercel nem crie projeto/serviço. Se houver divergência, inspecione antes de agir e preserve o estado existente.

## Sequência delimitada

### 1. Congelar fonte, commit e snapshot

- Confira branch, remoto e revisão remota. Se `main` avançou, inspecione e resolva preservando trabalho alheio; retorne se a integração alterar a fonte aceita. Registre estado anterior, manifestos, SHA e readbacks sanitizados.
- Prepare **um commit local** da fonte acumulada T019, selecionando explicitamente código, testes/configurações e documentação pertinente. Inclua a UI nova, protocolo de 12 reações, remoção de provocações, e2e e documentos de T019. Não use `git add .` indiscriminadamente. Preserve fora do commit segredos, `.env`, credenciais, storage, ZIPs, builds, caches, dependências e `.vercel`; não force inclusão de logs ignorados. Registre lista exata e SHA. Ainda não faça push.
- Gere snapshot físico de upload da mesma fonte: raiz/workspace/lockfile e fontes dos pacotes externos ao root web; exclua `.git`, env, caches, dependências, builds, `.vercel` herdado e reports/artefatos desnecessários ao build. Compare fontes funcionais com o commit. Registre lista SHA-256, digest do conjunto e vínculo com SHA.

### 2. Preparar frontend sem trocar o domínio

- Confirme projeto/time/Hobby, Node 22, Corepack/pnpm 11.14.0, root `apps/web` e fontes fora do root. Preserve `apps/web/vercel.json`. Confira `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com` e `NEXT_PUBLIC_TEST_HOOKS=0`; não exponha variáveis privadas.
- Vincule o snapshot somente ao projeto existente com alvo explícito e verifique os arquivos de upload pelo mecanismo disponível na CLI. Use **staged production**, `vercel deploy --prod --skip-domain`, com scope/projeto conferidos e metadados de tarefa/digest/commit. Prefixe comandos com `rtk`.
- Aguarde READY e confira logs, HTTPS, ID, metadados e marcadores da UI nova no bundle, sem hooks. O alias principal continua T014. Não amplie CORS para a URL temporária; o backend antigo não entrega as 12 reações. Build/HTTP autenticado bastam antes da atualização do servidor. Falha neste estágio impede o push.

### 3. Atualizar backend na janela confirmada

- Com staged READY e janela confirmada, envie **o commit exato** por push normal a `origin/main`. Acompanhe o auto-deploy; não dispare deploy manual duplicado enquanto o mesmo SHA estiver em fila/execução. Se o gatilho comprovadamente não ocorrer, confira fila e use mecanismo documentado para o SHA exato no mesmo serviço.
- Confirme Live na revisão enviada, Free/uma instância, Node 22, build congelado do servidor, healthcheck 200, `TRE_TTA_TEST_HOOKS=0`, seed ausente e `TRE_TTA_WEB_ORIGIN=https://tretta.vercel.app`. Não modifique faturamento, planos, CORS ou segredos para fazer o smoke passar.
- Verifique em sala humana própria a compatibilidade com o backend/frontend anteriores: criar/entrar, preparação, jogada, chat, 12 reações sem alvo, limite de 5 s, preferências e ausência de provocações. Confirme `client:reactionSend`/`server:reaction` e recusa de destinatário. Não logue credenciais/mãos brutas.
- Se o backend não estiver saudável/compatível, não promova o frontend. Informe falha e aplique a recuperação abaixo quando necessária.

### 4. Promover e conferir o mesmo build

- Promova **o mesmo staged production READY**, sem rebuild. Preview promovido pode gerar build novo; não substitua a estratégia por Preview.
- Confira por readback direto que `tretta.vercel.app` aponta ao ID esperado, no projeto correto; não dependa só da lista embutida de `inspect`. Prefira comandos documentados de promoção/rollback; consulte ajuda para listagem de aliases. Não invente `alias inspect`.
- Confira HTTP/bundle público, URL do servidor e ausência de hooks. Registre o estado final dos dois provedores e do Git.

### 5. Smoke público próprio

Use navegador via `browser-harness` na instância dedicada da tarefa, contextos independentes para identidades diferentes e salas criadas para esta prova. Duas abas do mesmo perfil têm proteção de identidade e não substituem dois clientes independentes. Sem hooks/seed, injeção de estado, alteração de relógio/infra pública ou salas da família.

1. Home: rolagem livre, “Criar sala” no fluxo, sem cabeçalho/rodapé fixos; criar sala e entrar com segunda identidade.
2. Preparação: cabeçalho rola, só o rodapé de ações fica fixo; barra inferior com Conversa, Reagir, Histórico e Sala; prontidão e início pelo anfitrião.
3. Mesa: trilho de assentos, vez, sentido com seta direita no horário e esquerda no anti-horário, “próximo na ordem” com nome e “(bot)”; mão em uma fileira com rolagem vertical, segunda fileira espiada e “▾” no contador; cartas jogáveis/selecionadas com anel interno sem corte.
4. Rodada: jogada legal, compra, passe, cor do coringa, chat e histórico. Pausa compacta sem rolagem; Apresentação sem borda/legend sobrepostos; peão sem rastro.
5. Reações: as 12 reações sem alvo, apresentação central de 4 s, intervalo de 5 s, ocultar local com confirmação textual e preferência persistida após reload; nenhuma provocação com alvo.
6. Resultado: cabeçalho rola, rodapé de ações fixo, placar e nova rodada; espera e erros preservados.
7. Treino com três bots: preparação, início, jogada legal, reações e saída. Conferir 320/390 px e desktop.
8. HTTPS/WSS, console/página sem erros materiais e hooks públicos ausentes. Encerre/saia das salas próprias ao final, sem reiniciar o servidor para limpá-las. Documente limitações de som/dispositivo físico; não apresente emulação como aparelho real.

Colete evidências suficientes por critério, usando aliases, IDs técnicos, contagens e digests. Capture apenas UI das identidades próprias; preserve segredos fora de logs/artefatos.

## Recuperação delimitada

- Registre frontend/backend anteriores efetivos antes da primeira mutação. Falha de staged build deixa produção preservada. Falha no Render exige conferir qual deploy ficou Live; não presuma rollback automático.
- Para regressão material no frontend, restaure o deployment T014 anterior confirmado (`dpl_613qfXj17XFdFctcg5HjsEimhfpz`, se ainda for o anterior efetivo), no mesmo domínio/projeto. Confira alias e HTTP. Restaurar frontend não restaura servidor.
- Para falha material no backend, use rollback suportado gratuito ou redeploy da revisão anterior confirmada, referência `90aff00645fe42f60ab68fb4ce96e527c081c95c`, no mesmo serviço Free. Não reescreva Git. Novo deploy/reinício não recupera salas perdidas. Se precisar redeployar código anterior enquanto `main` contém T019, controle auto-deploy para impedir reintrodução da falha: CLI/API por SHA não o desabilitam automaticamente. Registre alteração e estado final; não reative se isso tornar a disparar a revisão problemática.
- Mantenha o usuário informado sobre estado parcial e serviço efetivo. Não crie pushes documentais/restarts repetidos para tentar estabilizar. Mudança funcional exige voltar ao orquestrador com diagnóstico; publicação não é tarefa de desenvolvimento.

## Critérios de aceite e retorno

| ID | Evidência necessária |
| --- | --- |
| P1 — Fonte | e2e 42/42 e matriz 108/108 no build atual, commit acumulado exato, remoto no SHA, snapshot/upload correspondente e sanitizado |
| P2 — Backend | Mesmo serviço Free/uma instância, revisão exata Live, healthcheck e protocolo de 12 reações sem alvo, hooks desligados, janela confirmada e ausência de deploy duplicado injustificado |
| P3 — Frontend | Mesmo Seibel Hobby/projeto, staged production READY promovido sem rebuild, alias direto/HTTP/bundle/metadados conferidos |
| P4 — Experiência | Smoke real da home, preparação, mesa, mão, reações, pausa, resultado e treino; layouts 320/390/desktop; resultados/erros/limitações precisos |
| P5 — Operação | Históricos preservados, custo zero, nenhuma sala alheia usada; reinícios, estado final dos provedores/Git, rollback disponível e desvios registrados |

Entregue **`docs/work/reports/T019-publication.md`**, com P1–P5, URLs, SHAs, deploy IDs/time/projeto/plano, manifestos/digest, comandos/readbacks sanitizados, smoke/capturas e limitações. Evidências novas em **`docs/work/reports/assets/T019-public/`**. Preserve todos os reports anteriores.

Atualize estado/plano/runbook para **“publicação T019 aguardando validação do orquestrador”**, sem declarar aceite público. Após o push da versão, novos reports/estado ficam locais: **não faça segundo push documental**, que reiniciaria o Render. Pare e devolva o report ao usuário.

## Documentação conferida na preparação

Consultadas via Context7 em 18/10/2026 e a reconfirmar na execução: [Vercel deploy](https://vercel.com/docs/cli/deploy), [promote](https://vercel.com/docs/cli/promote), [Render deploys](https://render.com/docs/deploys) e [rollbacks](https://render.com/docs/rollbacks). Reconfirme ajuda/versões e alvos no momento da execução.
