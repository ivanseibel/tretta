# T014-publication — validação do orquestrador

**Resultado em 18/10/2026: P1–P5 aceitos. T014 publicada e aceita**, em [tretta.vercel.app](https://tretta.vercel.app), com o desvio operacional de isolamento registrado abaixo. Nenhum ajuste de implementação ou publicação pendente. [Report original](T014-publication.md) e suas evidências preservados.

## Estado público confirmado independentemente

| Alvo | Estado conferido |
| --- | --- |
| Git | HEAD e `origin/main` em `90aff00645fe42f60ab68fb4ce96e527c081c95c` |
| Render | Serviço `srv-db95f2u7bikc73dpndt0`, workspace `tea-cuhq60rv2p9s738m7us0`; **`dep-dbahinbm8hqs73be533g` Live** no mesmo SHA, gatilho `new_commit`; Free, uma instância, healthcheck 200 |
| Vercel | Projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `team_4mQparNtNCNqsb95uxf2FzoD` / Seibel Hobby; alias direto `tretta.vercel.app` → **`dpl_613qfXj17XFdFctcg5HjsEimhfpz`**, READY/PROMOTED, target production |
| Rollback | Frontend T013 `dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k`, reconfirmado READY. Backend: revisão anterior `3ae459e5a88e612dc389e7bcb4570809ddcc3445`; redeploy/rollback no mesmo serviço, considerando auto-deploy ativo e `main` já em T014 |

O ID correto do novo deploy Render é **`dep-dbahinbm8hqs73be533g`**. A grafia `dep-dahinbm8hqs73be533g` em parte do resumo/report do executor é um erro de transcrição; as listagens do provedor e os JSON de evidência apontam ao primeiro. O report original permanece preservado.

## Aceite por critério

| Critério | Conclusão e evidência |
| --- | --- |
| P1 — Fonte | **Aceito.** 172/172 arquivos aceitos coincidem com o working tree e com o commit enviado; SHA remoto conferido. Snapshot de 179 arquivos / 1.570.127 bytes reproduzido por hashes: somente `next-env.d.ts` gerado não vem do commit. Digest do manifesto `a22d4f59c57f067dc1e482cb11f39c33d3a2c53ee3580766456b251a091a91b7` recalculado. Upload contém 178 arquivos ao excluir `.gitignore`; árvore remota atual com 178/178 UIDs iguais, sem extras/divergências. [Fonte](assets/T014-public-validation/source-verification.json), [árvore remota](assets/T014-public-validation/remote-files-comparison.json). |
| P2 — Backend | **Aceito.** Listagem atual mostra uma única implantação desse SHA, Live, por `new_commit`, no serviço esperado Free/uma instância. Healthcheck HTTPS 200. Logs e readback sanitizado do executor confirmam Node 22.23.1, instalação congelada, hooks 0, seed ausente e origem correta. Protocolo público relatado: 1 broadcast por cliente, categorias independentes, cooldowns e recusas estritas; compatibilidade T013 em sala própria conferida antes da promoção. [Deploys atuais](assets/T014-public-validation/render-deploys.json), [serviço](assets/T014-public-validation/render-service.json), [protocolo](assets/T014-public/06-protocol-verification.json), [compatibilidade](assets/T014-public/07-compat-t013.json). |
| P3 — Frontend | **Aceito.** Projeto/time/Hobby, root `apps/web`, Node 22 e fontes externas ao root reconfirmados. Deployment público é o mesmo ID de staged production, com metadados de tarefa/commit/digest e READY/PROMOTED. Alias consultado diretamente; home e rota da sala com HTTP 200/HSTS. Onze chunks dessas rotas conferidos: três reações, resposta, preferências, painel e URL correta presentes; marcadores de hooks ausentes. [Alias](assets/T014-public-validation/alias.json), [deployment](assets/T014-public-validation/deployment.json), [projeto](assets/T014-public-validation/project.json), [plano](assets/T014-public-validation/vercel-team.json), [bundle](assets/T014-public-validation/route-bundle.json). |
| P4 — Experiência | **Aceito com os limites de observação abaixo.** Report e resumo do smoke cobrem provocar/responder, destinatário correto, três reações, observador, simultaneidade, duração, limites independentes, preferências, recuperação/duas abas, treino, toque/teclado/Escape e HTTPS/WSS. Capturas de treino em 320/390/1280 px e medidas do descarte inspecionadas; confirmam os estados capturados, não toda a matriz de interação. Não houve novo gameplay pelo orquestrador. [Smoke](assets/T014-public/10-smoke-summary.json), [medidas](assets/T014-public/smoke/training-measures.json), [report](T014-publication.md). |
| P5 — Operação | **Aceito, com desvio de isolamento registrado.** Janela confirmada no report, nenhum segundo push/deploy duplicado, mesmos recursos Free/Hobby. 1064 arquivos históricos de reports/evidências iguais à base da validação local. Recursos dedicados declarados pelo executor já não existem na conferência atual. Limpeza de salas próprias e preservação do navegador pessoal registradas pelo executor; não acessamos esse navegador para confirmar. [Preservação](assets/T014-public-validation/source-verification.json), [limpeza](assets/T014-public-validation/cleanup-readback.json). |

## Isolamento do navegador e limites da evidência

O executor registrou uso inicial do Chrome padrão pelos daemons `t014b`/`t014c`, antes de a regra de isolamento ser incorporada às instruções durante sua sessão. Essa primeira passada **não conta como execução em browser isolado**. O report informa repetição do núcleo com Nina/Dora em instâncias dedicadas, endpoints 9333/9335, perfis temporários próprios e nomes de daemon explícitos, além de encerramento das salas próprias abertas na primeira passada.

A repetição dedicada, o aceite local anterior e a correspondência integral das fontes sustentam o aceite da feature. O desvio permanece registrado e não concede exceção ao protocolo atual. Alguns detalhes do smoke amplo (por exemplo, observador/simultaneidade com três pessoas) vêm da primeira passada descrita no report; não afirmamos que toda a matriz foi repetida em três browsers dedicados. O protocolo vigente exige isolamento desde a primeira conexão em novas execuções.

Conferência de limpeza atual: PIDs 69285/69286/69287/70435/74496/70868/73571 ausentes; perfis `/tmp/t014-chrome-a`, `-b` e `-c` removidos. O orquestrador não se conectou ao Chrome pessoal nem abriu uma nova sessão de browser nesta validação. Abas pessoais ou residuais fora dos recursos dedicados não foram inspecionadas ou fechadas.

Sem aparelho físico, leitor de tela ou audição de áudio no iPhone. Headless com áudio mutado não comprova ausência de som por audição; essa garantia permanece sustentada por código/testes locais aceitos. As capturas do descarte mostram amostra numérica; não constituem nova prova de todas as cartas especiais. A regressão de texto longo permanece coberta por T013 e pelas fontes aceitas preservadas.

## Verificações, acesso e preservação

Leituras independentes de Git, CLI Render, API Vercel via CLI e HTTP público; inspeção de JSONs, hashes, logs sanitizados e capturas. O conector Vercel retornou 403 no scope Seibel; o fallback autenticado pela CLI funcionou **no mesmo time/projeto**, sem reautenticação ou mudança de alvo. Consultas de metadados foram sanitizadas antes de salvar.

[Resultados consolidados](assets/T014-public-validation/checks.json). Fonte **1343/1343 intacta após as verificações**, antes das atualizações de continuidade deste aceite, conforme [preservação](assets/T014-public-validation/preservation-before-continuity.json). O report do executor e todas as evidências anteriores continuam intactos. Atualizações documentais posteriores identificadas em [continuity-preservation.json](assets/T014-public-validation/continuity-preservation.json); `git diff --check` limpo.

Build/tipos, 180 unitários, 46 casos de reprodução e E2E aceitos localmente não foram repetidos nesta validação de publicação: fontes correspondem integralmente. Nenhum código de produto, commit, push, deploy, restart, faturamento ou sala foi alterado pelo orquestrador.

**T014 concluída publicamente.** Próximo passo é uso humano da versão publicada e feedback, especialmente em celular/som. Não há novo executor despachado nem autorização para outro push documental/reinício. Alterações do harness e documentos posteriores ao commit permanecem locais, preservados.
