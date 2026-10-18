# Prompt manual — T014-publication: publicar provocações pelo avatar e reações

**Estado: preparado em 18/10/2026; não executado.** Após o [aceite local final](reports/T014B.final-validation.md), o usuário respondeu **“Ok, seguimos”**. A publicação manual está autorizada no recorte abaixo, incluindo commit/push necessário ao Render. A janela sem partidas ainda precisa ser estabelecida antes do push/reinício. Preferência `gpt-6-luna`, reasoning `max`; execute você mesmo, sem acionar outros agentes.

**Encerramento obrigatório do executor manual:** use a skill `agent-notify` conforme [o protocolo](../../.agents/skills/orchestrate-work/SKILL.md#notificação-de-encerramento). Depois de salvar o report e terminar as verificações, notifique como última ação antes da resposta final. Report concluído aguardando validação usa `rtk proxy agent-notify done`; se precisar parar por decisão/autorização/informação pendente, use `attention`; falha terminal usa `error`. A dispensa vale somente para executor lançado automaticamente como subagente, não para esta execução manual.

## Papel, fonte e contexto

Você é o executor de **T014-publication**, em `/Users/ivanseibel/dev/personal/tretta`. Publique a fonte aceita de T014A/T014B nos serviços existentes e devolva report para validação do orquestrador. O working tree contém também T012/T013 aceitas que ainda não estão no Git remoto; preserve e publique essa fonte acumulada. HEAD sozinho não reproduz a entrega.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, estado/plano, `docs/product/first-version.md`, `docs/product/provocacoes-e-reacoes.md`, `reports/T014A.validation.md`, **`reports/T014B.final-validation.md`**, `reports/T014B-adjustments-3.md`, `reports/T013-publication.validation.md` e `deployment-free.md`. Os caminhos de reports/runbook nesta lista são relativos a `docs/work/`. Use `writing-for-agents`, `vercel:deployments-cicd`, `vercel:vercel-cli` e, para navegador, `browser-harness`. Consulte documentação atual via Context7 e ajuda instalada antes de usar sintaxe incerta.

Fonte congelada na preparação: [accepted-source.json](reports/assets/T014-public-preparation/accepted-source.json). São os 166 arquivos do manifesto final do executor, mais configurações de raiz conferidas contra a cópia da validação final. `next-env.d.ts` é gerado e não integra o manifesto. Compare novamente antes de publicar; diferença funcional exige retornar ao orquestrador. Documentos posteriores de continuidade não invalidam o aceite do código.

Preserve working tree, não rastreados, ignorados, reports e evidências anteriores. Verificações locais aceitas: build/tipos, 180 unitários e 46 casos de reprodução independentes; E2E pertinente 5/5 do executor e conjunto anterior 49/49. Não é necessário repetir essas suítes sem divergência nova. Qualquer verificação que reescreva gerados/históricos deve ocorrer numa cópia física isolada.

## Autorização e janela operacional

A autorização cobre snapshot, commit da fonte acumulada revisada, push normal único, deploy no Render existente, frontend staged production e promoção do mesmo build, smoke próprio e rollback delimitado. Mantenha custo zero, uma instância Render Free e Vercel Seibel Hobby. Novos recursos, planos pagos, mudanças de produto, force-push e descarte de trabalho alheio ficam fora do contrato.

**Conclua conferência de alvos, commit local, snapshot e frontend staged READY antes de solicitar a confirmação da janela.** Se o usuário já confirmou uma janela válida nesta sessão, prossiga sem repetir a pergunta. Caso contrário, peça a confirmação imediatamente antes do push: o reinício apaga salas, chats e placares em memória. O [runbook](deployment-free.md), seção “Acesso e operação”, exige: “Antes de deploy ou reinício planejado, esperar uma janela sem partidas e avisar o grupo”. A confirmação humana cobre essa condição; não envie mensagens ao grupo. `/healthz` não mede salas ativas, e não existe contador público para inferir a janela. Não altere produção nem faça push enquanto essa condição estiver pendente.

## Alvos de referência — reconfirmar antes de mutações

IDs e versões abaixo vêm dos aceites anteriores; não foram reconfirmados na nuvem nesta preparação documental.

| Alvo | Referência aceita |
| --- | --- |
| Git | `git@github.com:ivanseibel/tretta.git`, branch `main`; base local `3ae459e5a88e612dc389e7bcb4570809ddcc3445` |
| Render | Serviço `srv-db95f2u7bikc73dpndt0`, workspace `tea-cuhq60rv2p9s738m7us0`, plano Free, uma instância; `https://tretta-server.onrender.com` |
| Backend anterior | T011, deploy `dep-db9lnpm1egvs73ct80ig`, revisão `3ae459e…`; auto-deploy por commit de `main` |
| Vercel | Projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `team_4mQparNtNCNqsb95uxf2FzoD`, workspace Seibel — Hobby (`seibel`), root `apps/web`, Node 22.x |
| Frontend anterior | T013, deployment `dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k`, domínio `https://tretta.vercel.app` |

Confira o projeto resolvido no diretório real do comando, proprietário, plano, alias atual e backend Live. Não conecte Git à Vercel nem crie projeto/serviço. Se houver divergência, inspecione antes de agir e preserve o estado existente.

## Sequência delimitada

### 1. Congelar fonte, commit e snapshot

- Confira branch, remoto e revisão remota. Se `main` avançou, inspecione e resolva preservando trabalho alheio; retorne se a integração alterar a fonte aceita. Registre estado anterior, manifestos, SHA e readbacks sanitizados.
- Prepare **um commit local** da fonte aceita acumulada T012–T014, selecionando explicitamente código, testes/configurações e documentação pertinente. Confira staged/diff e inclua todos os novos componentes, biblioteca de tempo, reação/protocolo e testes necessários. Não use `git add .` indiscriminadamente. Preserve fora do commit segredos, `.env`, credenciais, storage, ZIPs, builds, caches, dependências e `.vercel`; não force inclusão de logs ignorados. Registre lista exata e SHA. Ainda não faça push.
- Gere snapshot físico de upload da mesma fonte: raiz/workspace/lockfile e fontes dos pacotes externos ao root web; exclua `.git`, env, caches, dependências, builds, `.vercel` herdado e reports/artefatos desnecessários ao build. Compare fontes funcionais com o commit e o manifesto aceito. Registre lista SHA-256, digest do conjunto e vínculo com SHA/aceites.

### 2. Preparar frontend sem trocar o domínio

- Confirme projeto/time/Hobby, Node 22, Corepack/pnpm 11.14.0, root `apps/web` e fontes fora do root. Preserve configuração aceita de build e `apps/web/vercel.json`. Confira `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com` e `NEXT_PUBLIC_TEST_HOOKS=0`; não exponha variáveis privadas.
- Vincule o snapshot somente ao projeto existente com alvo explícito e verifique os arquivos de upload pelo mecanismo disponível na CLI. Use **staged production**, `vercel deploy --prod --skip-domain`, com scope/projeto conferidos e metadados de tarefa/digest/commit. Prefixe comandos com `rtk`.
- Aguarde READY e confira logs, HTTPS, ID, metadados e marcadores de reação no bundle, sem hooks. O alias principal continua T013. Não amplie CORS para a URL temporária; o backend antigo ainda não entrega reações. Build/HTTP autenticado bastam antes da atualização do servidor. Falha neste estágio impede o push.

### 3. Atualizar backend na janela confirmada

- Com staged READY e janela confirmada, envie **o commit exato** por push normal a `origin/main`. Acompanhe o auto-deploy; não dispare deploy manual duplicado enquanto o mesmo SHA estiver em fila/execução. Se o gatilho comprovadamente não ocorrer, confira fila e use mecanismo documentado para o SHA exato no mesmo serviço.
- Confirme Live na revisão enviada, Free/uma instância, Node 22, build congelado do servidor, healthcheck 200, `TRE_TTA_TEST_HOOKS=0`, seed ausente e `TRE_TTA_WEB_ORIGIN=https://tretta.vercel.app`. Não modifique faturamento, planos, CORS ou segredos para fazer o smoke passar.
- Verifique em sala humana própria a compatibilidade com T013 ainda pública: criar/entrar, preparação, jogada/chat e metadados aditivos de humor aceitos pelo cliente antigo. Por clientes próprios autorizados, confirme `client:reactionSend`/`server:reaction`, categorias independentes e destinatário ausente recusado quando aplicável. Não logue credenciais/mãos brutas. A versão documental do protocolo passou de 5 para 6; inspecione comportamento efetivo, não presuma incompatibilidade ou compatibilidade só pelo número.
- Se o backend não estiver saudável/compatível, não promova o frontend. Informe falha e aplique a recuperação abaixo quando necessária.

### 4. Promover e conferir o mesmo build

- Promova o **mesmo staged production READY**, sem rebuild. Preview promovido pode gerar build novo; não substitua a estratégia por Preview.
- Confira por readback direto que `tretta.vercel.app` aponta ao ID esperado, no projeto correto; não dependa só da lista embutida de `inspect`. Prefira comandos documentados de promoção/rollback; consulte ajuda para listagem de aliases. Não invente `alias inspect`.
- Confira HTTP/bundle público, URL do servidor e ausência de hooks. Registre o estado final dos dois provedores e do Git.

### 5. Smoke público próprio

Use navegador via `browser-harness`, contextos independentes para identidades diferentes e salas criadas para esta prova. Duas abas do mesmo perfil têm proteção de identidade e não substituem dois clientes independentes. Sem hooks/seed, injeção de estado, alteração de relógio/infra pública ou salas da família.

1. Sala humana com duas pessoas: avatar alheio → provocação com alvo correto; só destinatário vê o aviso e responde ao emissor. Chat e uma jogada legal continuam funcionando. Conferir menu/feedback por toque e teclado/Escape.
2. Próprio avatar → 😂 Rindo / 😭 Chorando / 😡 Bravo. Confirmar recepção por outro cliente, identificação do emissor, duração breve, ausência de duplicação e de som de reação. Verificar simultaneidade entre pessoas e acesso “Reagir” de quem aguarda; use terceiro contexto próprio para observador, sem inventar assento.
3. Confirmar espera de cinco segundos separada da provocação de quinze segundos, sem gerar rajada de abuso. Ocultar reações limpa imediatamente; reativar não repete. Confirmação textual de envio oculto e preferência persistida após reload. Não reexecute matrizes artificiais de replays em produção: estão cobertas pelos testes determinísticos aceitos.
4. Reload durante rodada própria: mesma identidade/mão/estado por asserts/digests, recuperação/pausa explícita, limites ainda coerentes e sem reapresentar humor antigo. Duas abas continuam protegidas. Não publicar storage ou mãos para provar igualdade.
5. Treino com três bots: preparação, provocar bot, reagir, iniciar e realizar jogada legal; bot não envia humor sozinho. Conferir circuito, vez, nomes consultáveis e texto do descarte em 320/390 px e desktop. Prova de rodada completa/oito clientes já aceita localmente; não exigir nova rodada completa só para publicar esta feature.
6. HTTPS/WSS, console/página sem erros materiais e hooks públicos ausentes. Encerre/saia das salas próprias ao final, sem reiniciar o servidor para limpá-las. Documente limitações de som/dispositivo físico; não apresente emulação como aparelho real.

Colete evidências suficientes por critério, usando aliases, IDs técnicos, contagens e digests. Capture apenas UI das identidades próprias; preserve segredos fora de logs/artefatos.

## Recuperação delimitada

- Registre frontend/backend anteriores efetivos antes da primeira mutação. Falha de staged build deixa produção preservada. Falha no Render exige conferir qual deploy ficou Live; não presuma rollback automático.
- Para regressão material no frontend, restaure o deployment T013 anterior confirmado (`dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k`, se ainda for o anterior efetivo), no mesmo domínio/projeto. Confira alias e HTTP. Restaurar frontend não restaura servidor.
- Para falha material no backend, use rollback suportado gratuito ou redeploy da revisão anterior confirmada, referência `3ae459e5a88e612dc389e7bcb4570809ddcc3445`, no mesmo serviço Free. Não reescreva Git. Novo deploy/reinício não recupera salas perdidas. Se precisar redeployar código anterior enquanto `main` contém T014, controle auto-deploy para impedir reintrodução da falha: CLI/API por SHA não o desabilitam automaticamente. Registre alteração e estado final; não reative se isso tornar a disparar a revisão problemática.
- Mantenha o usuário informado sobre estado parcial e serviço efetivo. Não crie pushes documentais/restarts repetidos para tentar estabilizar. Mudança funcional exige voltar ao orquestrador com diagnóstico; publicação não é tarefa de desenvolvimento.

## Critérios de aceite e retorno

| ID | Evidência necessária |
| --- | --- |
| P1 — Fonte | Manifesto aceito conferido, commit acumulado exato, remoto no SHA, snapshot/upload correspondente e sanitizado |
| P2 — Backend | Mesmo serviço Free/uma instância, revisão exata Live, healthcheck e protocolo de reação corretos, compatibilidade com frontend anterior, hooks desligados, janela confirmada e ausência de deploy duplicado injustificado |
| P3 — Frontend | Mesmo Seibel Hobby/projeto, staged production READY promovido sem rebuild, alias direto/HTTP/bundle/metadados conferidos |
| P4 — Experiência | Smoke real de provocar/responder/reagir/observador, preferências/limites/recuperação, treino, teclado e layouts; resultados/erros/limitações precisos |
| P5 — Operação | Históricos preservados, custo zero, nenhuma sala alheia usada; reinícios, estado final dos provedores/Git, rollback disponível e desvios registrados |

Entregue **`docs/work/reports/T014-publication.md`**, com P1–P5, URLs, SHAs, deploy IDs/time/projeto/plano, manifestos/digest, comandos/readbacks sanitizados, smoke/capturas e limitações. Evidências novas em **`docs/work/reports/assets/T014-public/`**. Preserve todos os reports anteriores.

Atualize estado/plano/runbook para **“publicação T014 aguardando validação do orquestrador”**, sem declarar aceite público. Após o push da versão, novos reports/estado ficam locais: **não faça segundo push documental**, que reiniciaria o Render. Pare e devolva o report ao usuário.

## Documentação conferida na preparação

Consultadas via Context7 em 18/10/2026: [Vercel deploy](https://vercel.com/docs/cli/deploy), [promote](https://vercel.com/docs/cli/promote), [Render deploys](https://render.com/docs/deploys) e [rollbacks](https://render.com/docs/rollbacks). Reconfirme ajuda/versões e alvos no momento da execução.
