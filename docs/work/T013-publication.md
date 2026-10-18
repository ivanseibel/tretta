# Prompt manual — T013-publication: publicar texto do descarte

**Estado: executada e aceita pelo orquestrador em 17/10/2026.** [Validação P1–P4](reports/T013-publication.validation.md). Report em [reports/T013-publication.md](reports/T013-publication.md) e evidências em `reports/assets/T013-public/`; produção serve o build T013 (`dpl_DARamMVYaXEgnZ2KvioZsMGRnf6k`) com Render preservado. Contrato abaixo preservado como registro da execução; não repetir a publicação sem nova tarefa. Em 17/10/2026, após o aceite local, o usuário pediu: “Vamos seguir, me dá o prompt pra próxima etapa.” Executor manual, preferência `gpt-6-luna`/`max`, sem subagentes.

## Papel, autorização e fonte

Você é o executor de **T013-publication** em `/Users/ivanseibel/dev/personal/tretta`. Publique o frontend aceito na Vercel existente e confira que “Bloqueio” e “Inversão” cabem inteiros no descarte do jogador no domínio público. A autorização cobre snapshot/upload, staged production, promoção do mesmo build, smoke em salas próprias e restauração do frontend T012 se houver regressão material. **Sem commit, push ou alteração/restart do Render.** Manter custo zero e recursos existentes.

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, status/plano, `docs/product/first-version.md`, [aceite local T013](reports/T013.validation.md), [report T013](reports/T013.md), [aceite público T012](reports/T012-publication.validation.md) e [runbook](deployment-free.md). Use `vercel:deployments-cicd`, `vercel:vercel-cli` e `browser-harness` quando disponíveis; consulte ajuda instalada/Context7 para opções de CLI/API. Registre indisponibilidades e a alternativa usada.

T013 altera somente o span central do descarte em `GameTable.tsx`: aplica `data-long` pelo comprimento do texto, igual à mão e ao descarte público. CSS, regras, servidor e protocolo intactos. Validação local conferiu fonte, diff, capturas e medições em 320/390/768/1280 px; testes do executor verdes. Não é necessário repetir as suítes locais da mesma fonte.

**Fonte autoritativa:** working tree completo, incluindo arquivos novos, comparado aos **159 arquivos** de `docs/work/reports/assets/T013-validation/source-sha256.json`. Esses 159 arquivos foram reconferidos sem diferenças ao preparar este prompt. HEAD base `3ae459e5a88e612dc389e7bcb4570809ddcc3445` contém T011; T012/T013 estão no working tree, não nesse commit. Preserve alterações, ignorados e todos os reports/evidências.

## Alvos — reconfirmar antes de mutações

| Alvo | Referência do último aceite |
| --- | --- |
| Vercel | Projeto `tretta`, `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`; time `seibel`, `team_4mQparNtNCNqsb95uxf2FzoD`, **Hobby** |
| Configuração | Next.js; root `apps/web`; Node `22.x`; fontes externas ao root habilitadas; sem integração Git |
| Domínio | `https://tretta.vercel.app` |
| Frontend anterior / rollback | **T012** `dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk`, READY/production; `https://tretta-66c9kswar-seibel.vercel.app` |
| Render somente leitura | Serviço `srv-db95f2u7bikc73dpndt0`, Free, uma instância; `https://tretta-server.onrender.com`; Live `dep-db9lnpm1egvs73ct80ig`, revisão `3ae459e` |

Não houve novo readback remoto na preparação deste prompt. Reconfirme destino, plano, alias, rollback disponível e estado/health do backend. Se produção estiver em outra revisão, apure antes de sobrepô-la; não reverta alterações externas por conta própria.

## Execução

1. **Conferir e congelar a fonte.** Compare os 159 hashes aceitos, registre Git e baseline dos históricos. Diferença funcional exige retornar ao orquestrador. Prepare snapshot temporário do working tree aceito com manifests/lockfile/pacotes necessários; exclua `.git`, dependências, builds/caches, `.env*`, storage/credenciais, ZIPs e `docs/`. Vínculo local descartável no snapshot está autorizado apenas para os IDs existentes; confira projeto/time efetivos e evite resolução automática que crie recursos.
2. **Identificar o upload real.** Use dry-run da CLI se disponível; registre lista, bytes, SHA-256 por arquivo e digest do conjunto. Separe os 159 arquivos aceitos dos extras necessários/gerados, incluindo `next-env.d.ts` se presente. Registre a contagem real, sem copiar a contagem da T012. Vincule metadados de tarefa `T013-publication`, digest e **base** `3ae459e`; a proveniência de T013 é working tree + manifesto.
3. **Fazer staged production.** Selecione Node 22 explicitamente também no temporário — shells fora do repo podem usar Node 16. Preserve pnpm 11.14.0/Corepack, instalação congelada e `apps/web/vercel.json`. Confira `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com` e hooks desligados (`NEXT_PUBLIC_TEST_HOOKS=0`). Use `rtk vercel deploy --prod --skip-domain` com projeto/time explícitos, conforme ajuda instalada. Aguarde READY/production; preserve logs de build, versões, ID e metadados. Confirme o domínio principal ainda no T012. Proteção do staged pode exigir `vercel curl` autenticado; mantenha proteção/CORS existentes.
4. **Conferir e promover.** Compare árvore remota de fontes com a lista de upload, separando `src/` de saídas de build. Inspecione bundle/HTTP staged e ausência de hooks; marcador genérico `seat-circuit` sozinho só identifica T012, não prova esta correção. Promova **o mesmo staged production READY**, sem rebuild, usando `rtk vercel promote <ID> --scope seibel`. Leia o alias direto `tretta.vercel.app` e confirme ID/projeto, READY/production, HTTP 200 e bundle servido correspondente ao build conferido.
5. **Smoke público focado.** Execute o procedimento abaixo com clientes reais e regras normais. Registre falhas/limites; encerre as próprias salas ao terminar. Não reinicie o backend para limpeza.
6. **Readback final.** Reconfirme alias/ID, plano e backend no mesmo estado/deploy, HTTP/health e históricos preservados. Se houver regressão material causada pela publicação, restaure **somente o frontend T012** previamente conferido e valide alias/HTTP. Comando de referência: `rtk vercel alias set dpl_5zzeCcbWYdEgZoz7d7pZUs7qTLtk tretta.vercel.app --scope seibel`. Registre o estado real, inclusive rollback ou pendência.

Use APIs autenticadas quando a CLI não expuser o dado necessário. O histórico T012 mostra API de alias direto e árvore de arquivos úteis; confira o formato atual. A CLI instalada na T012 era 57.0.0: `project inspect` retornava texto, `alias inspect` não existia e `vercel curl` não aceitava `--scope`. Ajuda atual prevalece. Não exponha tokens/valores privados em comandos, logs ou artefatos.

## Smoke público e prova visual

- Use apenas salas/identidades próprias, em sala comum ou treino. Observe **Bloqueio e Inversão reais no descarte privado**, por ações legais da UI, sem injetar baralho/semente/estado ou habilitar hooks públicos. Treino e sala comum compartilham `GameTable`; não é necessário concluir rodadas nem repetir toda a T012.
- Capture as duas palavras em 320/390 px e desktop. Meça fonte e conteúdo em relação à carta; texto inteiro, sem reticências/corte ou sobreposição com símbolo/nome auxiliar, tamanho consistente com a mão. Confirme `data-long`, nome acessível completo, compra, cor ativa e uma interação legal da mão. A evidência principal é o texto renderizado, não apenas o atributo.
- Confira brevemente o circuito T012 ainda presente e a entrada/mesa de treino. Caso o smoke seja em treino, isso já cobre essa tela. Descarte público pode ser amostrado se houver observador próprio; sua apresentação não mudou em T013 e a cobertura local está aceita.
- Faça um reload do próprio participante: retorno à mesma identidade/mão e descarte legível quando o estado correspondente permanecer. Em treino, bots podem avançar enquanto recupera; não exija que o descarte congele nem atribua avanço legal a regressão. Confira ausência de erros materiais de página/console, HTTPS/WSS e hooks públicos ausentes.
- Se não conseguir observar uma das cartas por jogo normal, registre a prova faltante e pare como parcial; não force o estado nem declare atendimento. Emulação não é aparelho físico. Logs usam aliases/asserts/digests; capturas sem credenciais, storage bruto, mãos de bots ou convites de terceiros. Redija códigos das salas próprias nas evidências compartilhadas. Não entre em salas da família.

## Critérios e retorno

| ID | Prova necessária |
| --- | --- |
| P1 — Fonte | 159 hashes aceitos; manifesto exato do upload e extras explicados; digest/metadados/árvore remota coerentes; nenhuma fonte funcional não revisada |
| P2 — Publicação | Mesmo projeto Seibel Hobby; staged production READY e promoção do mesmo ID; alias direto, HTTP e bundle no domínio conferidos |
| P3 — Experiência | Ambas as palavras inteiras no descarte privado em celular/desktop, por jogo real; interação/treino e reload sem falha material; limitações e erros registrados |
| P4 — Operação | Render preservado, custo zero, históricos intactos; sem commit/push/restart; salas próprias encerradas, estado final e rollback identificados |

Entregue **`docs/work/reports/T013-publication.md`** com P1–P4, IDs/URLs/projeto/time/plano, fonte/manifestos/digests, comandos e logs sanitizados, capturas/medidas e resultados/falhas/limites. Evidências novas em **`docs/work/reports/assets/T013-public/`**. Preserve todos os reports e diretórios anteriores, inclusive `T013/`, `T013-reference/` e `T013-validation/`.

Atualize status/plano/runbook para **“T013 publicada, aguardando validação do orquestrador”**, ou o estado parcial/rollback real. Não declare aceite. Pare após entregar o report; a próxima ação cabe ao orquestrador.

Referências oficiais reconferidas via Context7 em 17/10/2026: [deploy/skip-domain](https://vercel.com/docs/cli/deploy) e [staged production/promoção](https://vercel.com/docs/deployments/promoting-a-deployment). Promover staged production preserva o build; promover Preview pode reconstruí-lo.
