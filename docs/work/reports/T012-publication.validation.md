# T012 — Validação da publicação pelo orquestrador

**Resultado: aceita em 17/10/2026. P1–P5 atendidos.** A mesa em circuito está publicada em [Tretta](https://tretta.vercel.app), no deployment `dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk`. Sem ajuste ou execução pendente de T012. Execução manual e [report original](T012-publication.md) preservados.

## Verificação independente

Leituras autenticadas de Vercel/Render, comparação local de manifestos e hashes, HTTP público e inspeção dos estados/capturas entregues. Nenhuma sala criada, ação de jogo repetida, suíte local repetida, commit/push ou mutação remota nesta validação. Evidências novas em [assets/T012-public-validation/](assets/T012-public-validation/).

| Critério | Evidência e decisão |
| --- | --- |
| **P1 — Proveniência: aceito** | 159/159 fontes/configurações coincidem com o manifesto do aceite local e o upload. Os 166 arquivos do upload coincidem com a árvore local; contagem de 1.404.378 bytes e manifesto recalculados. Digest `c0b0fc72042b37072d0e4f329e421c7414b4c5f9c3db2dfbf8fb9e639ce67615`. Nova consulta à árvore remota: 166 caminhos em `src/`, sem faltantes/extras e todos os UIDs iguais ao SHA-1 dos arquivos locais. Sem `.env*`, dependências, builds ou docs na fonte enviada. |
| **P2 — Build/domínio: aceito** | Alias consultado diretamente aponta ao ID novo, READY/production, no projeto/time Seibel Hobby existentes. Metadados tarefa/digest/base conferidos. Logs de staged/build/promoção inspecionados: instalação congelada, pnpm 11.14.0, build Next.js concluído, promoção do mesmo ID. HTTP 200 na home e rota; 11 chunks consultados sem as três strings de hooks verificadas. Chunk da mesa com `seat-circuit`, percurso, direção e consulta; SHA-256 `1a7b2e020039d5b4af244bd1d71d6b7cc0b5a31804d3cc6906ef49a7f1905b2a`, igual ao registro staged. |
| **P3 — Experiência: aceito** | 12 capturas inspecionadas: mesa, nome consultado, Inversão em duas perspectivas, observadora e treino, em 320/390 px e desktop. Snapshots das quatro perspectivas recalculados: própria pessoa na base, índices estáveis, um assento atual, setas giradas 180° e percurso acessível invertido. Capturas e feed sustentam a sequência legal Coringa→Azul / Inversão azul. Toque/teclado, avanço dos bots e coletores sem erros apoiam-se no smoke entregue, sem repetição interativa pelo orquestrador. |
| **P4 — Recuperação: aceito** | Comparação dos snapshots de B confirma igualdade de identidade, digest/contagem da mão, percurso, sentido, vez e chat antes/depois do reload. Preferência desligada permanece; coletor entregue registra ausência de replay da Inversão. |
| **P5 — Operação: aceito** | Readback Render confirma mesmo serviço Free, uma instância e deployment Live `dep-db9lnpm1egvs73ct80ig`, commit `3ae459e5a88e612dc389e7bcb4570809ddcc3445`; nenhum novo deployment. `/healthz` 200 `{"ok":true}`. Vercel Hobby preservada. HEAD permanece nesse commit, 0/0 contra `origin/main` local; sem commit/push. 645/645 arquivos anteriores de reports/evidências preservados por SHA-256. Encerramento das salas próprias, ausência de restart pela execução e WSS constam do report/smoke. |

## Precisões e limites

O report contém um erro de contagem textual dos extras: são **seis arquivos de repositório + `apps/web/next-env.d.ts` gerado = sete extras**, não sete mais um. A lista nominal e os manifestos estão corretos: 159 + 7 = 166. Isso não altera o conteúdo publicado; o original foi preservado.

O commit base contém T011. A fonte de T012 continua sendo o working tree aceito, vinculado ao manifesto e ao deployment; não foi criada revisão Git de T012. A comparação remota de fontes usa os UIDs da API, enquanto a igualdade SHA-256 foi recalculada localmente. O build remoto também contém saída em `out/`, que não foi confundida com a fonte `src/`.

Sem aparelho físico. A tela “Recuperando…” não foi observada no reload rápido; o banner da observadora não foi reconfirmado após seu reload, embora ela tenha permanecido sem mão. Os índices de assentos documentam estabilidade lógica, sem nova medição independente de geometria. Zero erros, interações, transporte WSS e limpeza são evidências do executor, não uma segunda execução do smoke. O readback de deployments confirma ausência de novo deploy, mas não é auditoria exaustiva de reinícios internos do provedor. Esses limites não bloqueiam os critérios acordados.

O aviso na primeira entrada enquanto conecta é anterior a T012 e permanece no backlog. Não foi atribuída causa ao Render nem aberta nova implementação. O teste humano de recuperação/leitura no celular permanece como acompanhamento, sem impedir o aceite.

## Estado final

- Público: `tretta.vercel.app` → `dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk`, READY/production, projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `seibel`.
- Backend: serviço `srv-db95f2u7bikc73dpndt0`, Live no deployment e revisão acima.
- Rollback de frontend: T011 `dpl_fiXC5suPTF2VCW22fEVf64HZYhNP`, novamente conferido READY. Comando registrado, **não executado**: `vercel alias set dpl_fiXC5suPTF2VCW22fEVf64HZYhNP tretta.vercel.app --scope seibel`.

Status, plano, runbook e continuidade de produto atualizados para publicada e aceita. Próxima melhoria depende de escolha do usuário; executores continuam manuais. Commit/push futuro precisa considerar o auto-deploy do Render e suas salas em memória.

## Evidências desta validação

[Fonte local](assets/T012-public-validation/local-source-verification.json), [readback Vercel](assets/T012-public-validation/remote-readback.json), [árvore remota](assets/T012-public-validation/remote-source-tree.json), [comparação remota](assets/T012-public-validation/remote-source-comparison.json), [HTTP/bundles](assets/T012-public-validation/http-readback.json), [Render](assets/T012-public-validation/render-readback.json), [revisão do smoke](assets/T012-public-validation/smoke-review.json) e [preservação](assets/T012-public-validation/preservation-verification.json).
