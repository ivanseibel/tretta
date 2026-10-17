# T010 — Aceite público do orquestrador

Data: 17/10/2026. **Publicação aceita. T010 concluída.**

Contrato: [T010-publication.md](../T010-publication.md). [Report do executor](T010-publication.md) preservado. O [aceite local](T010.final-validation.md) já havia confirmado 137/137 testes direcionados e a restauração dos 88 artefatos históricos; essas verificações não foram repetidas para validar o deployment.

## Verificação independente

| Critério | Resultado |
| --- | --- |
| Projeto/time/plano | APIs autenticadas confirmam projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, conta `team_4mQparNtNCNqsb95uxf2FzoD`, workspace `seibel`, plano Hobby, Next.js, root `apps/web`, Node 22.x |
| Deployment e domínio | Deployment `dpl_J9jjh4nHDUfMZj9cZU2JN8hKS6Tj` READY/production. API direta de `tretta.vercel.app` aponta a esse ID/projeto; target production do projeto também coincide |
| Proveniência da fonte | Manifesto recalculado: `e917313dd0d798352ed1bd7c3249c3bf6000b126acdac438b0e0b1d2ed7ef82d`, igual ao metadado remoto `trettaSourceManifest`. Base `8967e94`. Os **144/144** arquivos validados coincidem com o manifesto enviado e com o working tree no momento desta conferência |
| Conjunto enviado | 150 caminhos únicos, 1.182.018 bytes, lista de upload e manifesto com os mesmos caminhos. Sem env, ZIP, dependências, `.git`, `.next`, `dist` ou diretório `.vercel` |
| Build existente | Logs consultados independentemente: pnpm 11.14.0, frozen lockfile, Next 16.4.1, TypeScript e hooks desligados no comando de build. Sem rebuild nesta validação |
| HTTP e bundle | Home e shell de sala retornam 200. Dez scripts públicos consultados; marcadores `recovery-exhausted`, `retry-recovery-button`, mensagem de vínculo pendente e URL HTTPS Render presentes |
| Backend | CLI Render confirma deploy `dep-db95f367bikc73dpnfs0`, revisão `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837`, live. Healthcheck 200 com `{"ok":true}`. Sem escrita ou reinício |

Artefatos sanitizados desta revisão em [assets/T010-public](assets/T010-public/): `orchestrator-readback.json`, `orchestrator-manifest-check.json`, `orchestrator-http.json` e `orchestrator-build-checks.json`.

Precisão documental: os seis arquivos adicionais ao manifesto de 144 são documentos/instruções (`AGENTS.md`, `CLAUDE.md`, `README.md`, skill local), `.vercelignore` e `apps/web/next-env.d.ts`. A expressão do report de que os extras seriam apenas gerados é imprecisa; a conferência dos caminhos não encontrou fonte funcional divergente nem `tsconfig.tsbuildinfo` no upload. Não afeta o aceite.

## Smoke público

O orquestrador inspecionou `smoke-public.json`, os digests/contagens e capturas de lobby/espera. A execução interativa foi feita pelo executor, não repetida nesta revisão:

- Dois participantes criam/entram, preparam, jogam e conversam; hooks ausentes e zero erros de console/página.
- Reload mostra Retomando e recupera automaticamente em 10.995 ms, sem esgotamento. Identidade/credencial/mão de oito cartas com digests iguais; roster preservado.
- Segunda aba da mesma identidade permanece em espera, sem formulário, erro ou ações habilitadas; a primeira continua operável. Ao fechar a primeira, a segunda recupera em 6.378 ms, sem reload extra ou duplicação, e chat funciona após confirmação do vínculo.
- Preferência de aviso de vez desligada permanece após reload; clientes próprios saem ao final. Nenhuma sala da família foi usada.

Os tempos são medições do smoke, não garantia de latência. As provas de perda de ack, deadline e confirmação entre ciclos continuam cobertas pelo aceite local; não foram injetadas falhas na infraestrutura pública.

## Encerramento e limites

Site atual: [Tretta](https://tretta.vercel.app), build [tretta-26gh6ystv-seibel.vercel.app](https://tretta-26gh6ystv-seibel.vercel.app). T008 permanece como versão anterior conhecida para eventual rollback; nenhuma restauração foi necessária.

**T010 publicada e aceita, sem commit/push.** Nenhuma mudança de servidor, protocolo, motor, hospedagem ou cobrança nesta validação. Fonte funcional conferida antes de atualizar os documentos de aceite desta sessão. O modo continua manual, preferência `gpt-6-luna`/`max`; nenhum novo executor foi acionado.

Próximo passo: o usuário testar reload e retorno de segundo plano no celular físico, verificando se volta à mesma mão. Esse teste humano ainda não foi feito na revisão T010; frequência no aparelho, suspensão real do navegador e capacidade em nuvem não foram medidas. A eventual espera pelo Render Free e a perda de salas em reinício seguem os limites já documentados.

O aviso inicial de criar/entrar antes de o socket conectar continua como item separado no backlog. Nenhuma nova funcionalidade foi iniciada. Commit/push futuros dependem de pedido humano específico e planejamento por causa do auto-deploy Render ligado a main.
