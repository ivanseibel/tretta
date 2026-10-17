# Prompt manual — Publicar a recuperação T010

**Executado manualmente e aceito em 17/10/2026.** [Report](reports/T010-publication.md) e [aceite público](reports/T010-publication.validation.md). Contrato histórico abaixo preservado; não repetir a publicação sem nova tarefa. Modelo preferido **GPT-6 Luna (`gpt-6-luna`), reasoning `max`**. Não acione outros agentes.

## Papel, objetivo e contexto

Você é o executor de publicação T010. Publique o frontend validado na Vercel Hobby existente e entregue report para validação do orquestrador. Preserve o servidor Render e suas salas.

Repositório `/Users/ivanseibel/dev/personal/tretta`. Leia AGENTS, protocolo local, status/plano, `docs/work/reports/T010.final-validation.md`, reports T010 de ajustes, `deployment-free.md` e skills de publicação/CLI pertinentes. O contrato de T008 em `docs/work/T008-publication.md` é histórico, não uma tarefa a repetir.

T010 está aceita localmente: recuperação automática, deadline de 60 s, proteção por contexto/transporte e confirmação de intenção incerta inclusive entre ciclos explícitos. A fonte é o **working tree validado**, com arquivos ainda não rastreados; HEAD `8967e94` sozinho não contém essa versão. Não fazer commit/push para publicar: o Render tem auto-deploy em main e pode apagar salas se reiniciar.

Alvos de referência do último aceite (conferir remotamente antes da ação):

- Vercel **Seibel — Hobby**, slug `seibel`, team `team_4mQparNtNCNqsb95uxf2FzoD`.
- Projeto `tretta`, ID `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, domínio `https://tretta.vercel.app`, root `apps/web`, Node `22.x`.
- Versão pública T008: `dpl_HMJVr7wLLfHAx6t3DKoFbTQ2dtey`, URL `https://tretta-kyrddrenp-seibel.vercel.app` — fallback conhecido; confirmar que segue disponível.
- Render `srv-db95f2u7bikc73dpndt0`, Free, URL `https://tretta-server.onrender.com`, deploy de referência `dep-db95f367bikc73dpnfs0` (`8967e94`). Somente leitura.

## Execução

1. Confira Git, alvos, plano e estado da publicação atual. Compare a fonte funcional/configurações com `docs/work/reports/assets/T010-final-validation/validated-source.sha256.json`. Documentação/artefatos novos não invalidam o código; divergência funcional requer devolução ao orquestrador antes de publicar código não revisado.
2. Prepare snapshot temporário da fonte, incluindo novos arquivos e manifests necessários ao workspace. Exclua `.git`, dependências, builds gerados, `.env*`, `.vercel` preexistente e ZIPs brutos. Reports/arquivos regenerados não necessários ao build podem ficar fora do upload, preservados no clone. Vincule explicitamente ao projeto/time existentes e confira a lista com `vercel deploy --dry`. Gere manifesto SHA-256 dos arquivos efetivamente enviados e identifique o deployment com digest/base. Nunca registrar tokens nem env privada; qualquer env efêmera gerada pelo CLI fica fora do upload/artefatos.
3. Use Node 22 explicitamente também em diretórios temporários (o shell pode selecionar Node 16 fora do repo) e pnpm 11.14.0. Preserve `apps/web/vercel.json`, Corepack ativo, instalação congelada, fontes externas ao root incluídas, `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com` e `NEXT_PUBLIC_TEST_HOOKS=0`. Sem alteração de cobrança/plano/proteção.
4. Faça staged production (`--prod --skip-domain`, projeto/time explícitos). Confirme READY, logs/versões/build, HTTP autenticado e bundle contendo a recuperação T010. Promova **esse mesmo build**, sem rebuild. Confira o alias `tretta.vercel.app` diretamente e seu deployment ID; a lista de aliases embutida no deployment pode omitir o domínio principal. Ajuste somente esse alias se necessário e confira novamente.
5. Smoke público com sala e identidades próprias: criar/entrar/preparar/jogar; chat e preferência de aviso da vez; reload recupera a mesma identidade/mão. Abra segunda aba no mesmo contexto com a mesma identidade: exibe Retomando sem formulário de nova pessoa; primeira aba segue operável. Feche a primeira aba e confirme recuperação da segunda sem reload extra/participante duplicado, com ações só após vínculo confirmado. Verifique console/página, hooks ausentes e healthcheck Render. Para provar preservação de mão/credencial, use asserts/digests, sem publicar valores brutos. Nenhuma sala da família.
6. Readback final: domínio público no ID novo e HTTP 200; plano Hobby mantido; Render no deploy anterior à execução, sem escrita/reinício. Se algo falhar depois da promoção, preserve evidência e restaure o domínio ao build anterior conferido, sem mudar o backend; retorne a divergência.

As provas de blackhole, ack perdido e deadline/retomada entre ciclos já foram aceitas localmente. Não injetar falhas nem alterar a infraestrutura pública para repeti-las. Teste humano no celular após publicação é útil e deve ser diferenciado do smoke automatizado; não é razão para adiar as verificações que podem ser feitas nesta execução.

## Limites e aceite

- Frontend apenas: nenhum deploy, reinício, mudança de timeout/configuração Render ou push em main. Sem novas regras, dependências, serviços ou pagamentos. Commit/push futuros continuam dependendo de pedido humano específico.
- Working tree e evidências históricas preservados. Qualquer verificação local que regenere capturas/métricas roda em cópia isolada.
- Aceite: build READY no projeto/time corretos; domínio ligado ao mesmo build testado; fonte reconhecível por manifesto; configuração HTTPS real/sem hooks; smoke de recuperação e privacidade consistente; backend preservado.

## Report e parada

Report em `docs/work/reports/T010-publication.md`, evidências sanitizadas em `assets/T010-public/`: IDs/URLs, manifesto/digest, logs pertinentes, readback, resultados por critério, screenshots próprias sem cartas/credenciais e limites. Atualize status/runbook com fatos, marcando **“T010 publicada, aguardando validação do orquestrador”**. Preserve os reports anteriores e pare; upload aceito sozinho não conclui a tarefa.
