# T008 — Aceite da publicação pelo orquestrador

Data: 16/10/2026. **Publicação aceita. T008 concluída.**

Contrato: [prompt de publicação](../T008-publication.md). [Report do executor](T008-publication.md) preservado. A implementação já tinha sido aceita em [T008.validation.md](T008.validation.md), com 348 testes passando, um pulado, 31 E2E, build e tipos; essas suítes não foram repetidas nesta conferência de publicação.

## Conferência independente

| Critério | Resultado |
| --- | --- |
| Projeto e plano | APIs autenticadas confirmam projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, conta `team_4mQparNtNCNqsb95uxf2FzoD`, workspace `seibel`, plano `hobby`, Next.js, root `apps/web` e Node `22.x` |
| Deployment e domínio | `vercel inspect https://tretta.vercel.app` retorna `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey`, READY, production. API do projeto confirma o mesmo production target; API do alias `tretta.vercel.app` confirma esse deployment e projeto |
| Fonte | Digest SHA-256 do manifesto recalculado: `78db6b5696ffcfbbbec05175b6437d3acb5cc70b07ac65717a21398d4a4fb0b0`, igual ao metadado remoto `trettaSourceManifest`. Base remota `8967e94`. Lista e manifesto têm os mesmos 360 caminhos, 47.125.700 bytes. SHA-256 da fonte atual sem divergências; SHA-1/tamanho de 357 arquivos atuais também coincidem com a lista de upload |
| Arquivos novos e exclusões | `TurnNotifier.tsx`, `turnNotifications.ts` e testes novos constam do upload. Sem `.env*`, ZIP, `.git`, `node_modules`, `.next`, `dist` ou diretório `.vercel` nos caminhos. `.vercelignore` é arquivo apenas da cópia de upload; os outros dois caminhos divergentes são status/runbook atualizados depois da publicação, sem mudança de código |
| Build | Leitura independente dos logs existentes: pnpm 11.14.0, instalação congelada, Next 16.4.1 e TypeScript. Build READY. `apps/web/vercel.json` coincide com a fonte validada, incluindo a guarda HTTPS e hooks desligados no build |
| HTTP e versão servida | Home e rota de sala respondem 200. Dez scripts da rota pública consultados; bundle contém `pref-turn-notification`, o rótulo do aviso e `https://tretta-server.onrender.com` |
| Backend preservado | `render deploys list` confirma o único deploy listado `dep-db95f367bikc73dpnfs0`, revisão completa `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837`, status live. `/healthz` retorna 200 e `{"ok":true}`. Nenhuma operação de escrita ou reinício executada nesta validação |
| Smoke e apresentação | Resumo estruturado do executor e capturas de tablet, celular e preferência inspecionados: dois participantes, jogadas, chat recente primeiro, opt-out persistido, layout alinhado, hooks ausentes e zero erros registrados. A execução interativa do smoke é evidência do executor; o orquestrador repetiu leitura remota/HTTP e inspeção de artefatos, sem recriar salas |

A lista de aliases embutida no deployment/CLI mostra apenas `tretta-seibel.vercel.app`; isso não foi usado isoladamente para concluir a associação do domínio principal. A consulta direta à API do alias `tretta.vercel.app` confirma o vínculo exato esperado.

A conferência de hashes ocorreu antes das atualizações documentais de aceite desta sessão; novos registros de status, plano e backlog não representam alterações na fonte executável.

Artefatos sanitizados da conferência em [assets/T008-public](assets/T008-public/): `orchestrator-readback.json`, `orchestrator-http.json`, `orchestrator-manifest-check.json`, `orchestrator-render-check.json` e `orchestrator-build-log-checks.json`. As primeiras consultas de rede no sandbox falharam em DNS/fetch; a repetição somente leitura com acesso de rede passou. Sem mudança de credenciais ou configuração.

## Achados e limites

**Reentrada após reload:** o executor observou recusa temporária `ALREADY_CONNECTED`, com retorno possível após esperar e tentar novamente. O orquestrador confirmou que o fluxo relevante de reentrada não foi modificado por T008 e que o código atual faz quatro tentativas com intervalos de 400 ms. Esse intervalo pode não cobrir uma desconexão reconhecida tardiamente pelo servidor. A hipótese de expiração do socket em cerca de 45 s é plausível, mas não foi comprovada por medição independente nem comparação pública controlada com T007.

Decisão: aceitar o release T008, sem rollback por esse achado, e priorizar investigação/correção de reentrada no backlog antes de ampliar funcionalidades. A ausência de alteração nesse fluxo sustenta separar o achado; não constitui prova absoluta de origem histórica. Preservar a proteção contra duas conexões ativas da mesma identidade em eventual correção. O aviso inicial de falta de conexão também fica registrado para investigação própria, sem atribuir causa ao plano gratuito.

Som verificado por instrumentação, não por audição humana. Teste em celular físico da nova revisão e confirmação audível continuam desejáveis. Não houve nova prova de capacidade em nuvem, acesso à sala da família ou comprovação de estado de cada sala existente. Deploy Render inalterado e nenhuma escrita são as evidências de preservação do backend.

## Continuidade

Site atual: [Tretta](https://tretta.vercel.app). Código publicado a partir do working tree, ainda sem commit/push. Commit/push futuros continuam sujeitos a pedido humano específico e planejamento: push em main pode disparar deploy Render e apagar salas em memória.

Modo manual mantido, preferência `gpt-6-luna`/`max`. Nenhum novo executor foi acionado. Próximo passo imediato: uso no celular e audição do aviso; próxima tarefa técnica recomendada: reentrada confiável, com prompt próprio antes da execução. [Backlog](../../product/backlog.md) atualizado; sugestões de produto seguem sem implementação autorizada.
