# T013 — Validação da publicação pelo orquestrador

**Aceita em 17/10/2026. P1–P4 atendidos.** [Tretta](https://tretta.vercel.app) serve T013 no deployment `dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k`. “Bloqueio” e “Inversão” cabem inteiros no descarte. Sem ajuste ou execução de T013 pendente. [Report do executor](T013-publication.md) preservado.

## Validação independente

Consultas autenticadas somente de leitura à Vercel e ao Render, HTTP público, comparação de manifestos/hashes, inspeção de logs e nove capturas selecionadas, além de recálculo das medidas entregues. Nenhuma sala criada ou ação de jogo repetida pelo orquestrador. Sem commit/push/deploy/restart nesta revisão.

| Critério | Evidência e decisão |
| --- | --- |
| **P1 — Fonte: aceito** | 159/159 fontes/configurações iguais ao manifesto local aceito e ao upload. Upload de 166 arquivos/1.404.477 bytes, seis extras de repositório mais `next-env.d.ts`. Manifesto recalculado: `3e3c84dea1cfe719181c7f0fbc2b63b734f3ab949ab1d93cad5866afc6af6085`. Nova consulta à árvore remota: mesmos 166 caminhos em `src/`, sem faltantes/extras, UIDs iguais ao SHA-1 local. Sem `.env*`, dependências, builds ou docs na fonte enviada. Metadados tarefa/digest/base conferidos. |
| **P2 — Publicação: aceito** | Alias direto confirma o ID T013, READY/production, projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, time `seibel`, Hobby, configuração preservada. Logs inspecionados: instalação congelada, pnpm 11.14.0, Next 16.4.1, build concluído e promoção do mesmo ID. Home/rota HTTP 200; 11 chunks públicos consultados, sem as três strings de hooks verificadas. Chunk `0pzjo0m_qc-nz.js` byte-idêntico à evidência staged, SHA-256 `aca6bb5fabd8545d6f3ddcef7c5e82bf0542c3a51ce4b85d75c164a076902839`; condição `data-long` presente especificamente no descarte privado. |
| **P3 — Experiência: aceito** | Capturas das duas palavras em 320/390/1280 px mostram texto inteiro; feed inspecionado registra jogada legal de Inversão, além de evidência de treino/pausa e saída. Quinze medições de retângulos recalculadas: valor dentro da carta, sem sobreposição com símbolo/nome auxiliar e sem corte horizontal. Fontes 11,2/13,12 px, consistentes com a mão. Snapshots de reload preservam lista da mão, apelido, descarte e nome acessível. Logs de teclado, WSS, erros vazios e encerramento inspecionados. |
| **P4 — Operação: aceito** | Render novamente conferido Free, uma instância, mesmo Live `dep-db9lnpm1egvs73ct80ig`, revisão `3ae459e5a88e612dc389e7bcb4570809ddcc3445`; nenhum novo deployment e health HTTP 200. Vercel Hobby mantida. HEAD inalterado e 0/0 contra `origin/main` local. Baseline do executor: 838 documentos presentes, somente os quatro documentos autorizados modificados. Nesta revisão, 874/874 arquivos anteriores de reports/evidências intactos. T012 READY e disponível como rollback. |

## Precisões e limites

A comparação de fonte remota usa UIDs SHA-1 da API, enquanto o manifesto SHA-256 foi recalculado localmente. `out/` foi separado da fonte `src/`. A base Git continua contendo T011; T012/T013 são identificadas pelo working tree aceito e manifesto, sem novo commit.

O smoke é evidência do executor, sem segunda execução interativa nesta revisão. Foi realizado em treino próprio, com jogadas legais e bots, usando a pausa normal após reload para capturar o descarte; não há necessidade de congelar estado por injeção. O público de quem aguarda não foi reamostrado, conforme o contrato e a cobertura local aceita. Sem aparelho físico; zooms e retângulos sustentam a leitura nas larguras emuladas. Capturas de viewport móvel em pausa não enquadram o descarte, que aparece nos zooms correspondentes.

No artefato de reload, a igualdade da mão e do apelido pode ser reconferida; o código está mascarado e não há ID de jogador para uma comparação independente de identidade. Isso limita a precisão da prova, sem indicar regressão. A continuidade do vínculo é reportada pelo executor e é coerente com os estados entregues.

O report atribui o timeout inicial de health a cold start. Os artefatos mostram timeout seguido de HTTP 200, sem diagnóstico causal suficiente para confirmar essa atribuição. A consulta independente respondeu 200. O readback de deployments confirma ausência de novo deploy, sem constituir auditoria de todo reinício interno do provedor.

## Continuidade e rollback

T013 publicada e aceita; status, plano, runbook e cabeçalho do contrato atualizados. Executor sem pendências. Execução dos próximos agentes permanece manual; nenhuma nova melhoria iniciada.

Rollback de frontend, novamente conferido READY: T012 `dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk`. Comando registrado, **não executado**: `rtk vercel alias set dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk tretta.vercel.app --scope seibel`. Backend preservado; nenhum commit/push necessário para esta publicação.

## Evidências

[Fonte/manifesto](assets/T013-public-validation/local-source-verification.json), [Vercel](assets/T013-public-validation/remote-readback.json), [árvore remota](assets/T013-public-validation/remote-source-tree.json), [comparação de fontes remotas](assets/T013-public-validation/remote-source-comparison.json), [HTTP/bundle](assets/T013-public-validation/http-bundle-readback.json), [Render](assets/T013-public-validation/render-readback.json), [medidas/smoke/preservação](assets/T013-public-validation/smoke-and-preservation-review.json) e [conferência final](assets/T013-public-validation/final-checks.json).
