# Prompt manual — Publicação dos refinamentos T008

Contrato histórico: **executado manualmente e aceito em 16/10/2026**. Report em [reports/T008-publication.md](reports/T008-publication.md) e aceite em [reports/T008-publication.validation.md](reports/T008-publication.validation.md). Não repetir esta publicação sem nova tarefa; o contrato abaixo preserva as instruções executadas. Nenhum commit/push foi feito.

## Papel e tarefa

Você é o executor de publicação T008. Preferência de modelo: `gpt-6-luna`, reasoning `max`. Publique apenas a interface T008 na Vercel Hobby e devolva report para validação do orquestrador. Não invoque outros agentes.

## Contexto e arquivos

Clone: `/Users/ivanseibel/dev/personal/tretta`. Leia AGENTS, `.agents/skills/orchestrate-work/SKILL.md`, `docs/work/status.md`, `plan.md`, `T008.md`, `reports/T008.validation.md`, `deployment-free.md` e as instruções do app/skills Vercel pertinentes. O usuário alterou o modo para acionamento manual de executores.

T008 altera visual/alinhamento, ordem do chat e aviso de vez com preferência. Motor, protocolo e servidor permanecem iguais. A implementação nova inclui arquivos ainda não rastreados (`TurnNotifier.tsx`, `turnNotifications.ts` e testes); a fonte correta é o working tree validado, não apenas HEAD. Preserve os reports/documentos preexistentes de T007 e T008. Se estiver em outro clone, obtenha os artefatos completos antes de executar.

Alvos existentes:

- Vercel workspace **Seibel — Hobby**, slug `seibel`, team `team_4mQparNtNCNqsb95uxf2FzoD`.
- Projeto `tretta`, ID `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, domínio `https://tretta.vercel.app`.
- Versão pública anterior: `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc`, fonte `8967e94`.
- Servidor já Live e saudável: `https://tretta-server.onrender.com`, Render Free, ID `srv-db95f2u7bikc73dpndt0`.

## Escopo

1. Confira os alvos, plano Hobby, fonte e validação local. Para CLI use Node 22 explicitamente: em diretórios temporários o shell pode selecionar Node 16. pnpm é 11.14.0. O CLI Vercel autenticado acessa Seibel; o conector MCP anteriormente não acessava esse workspace.
2. Prepare uma cópia temporária da fonte validada, incluindo arquivos novos, sem `.git`, `node_modules`, `.next`, `dist`, `.env*`, `.vercel` existente ou ZIPs brutos. Registre a lista/hashes dos arquivos publicados para identificar esta revisão sem commit. Vincule explicitamente ao projeto existente; qualquer `.env.local` efêmero gerado pelo CLI fica fora do upload e dos artefatos, sem leitura/registro de tokens. Confira `deploy --dry` antes de upload.
3. Verifique configuração existente: Next.js, root `apps/web`, fontes fora da raiz incluídas, Node `22.x`, Corepack ativo, `NEXT_PUBLIC_SERVER_URL=https://tretta-server.onrender.com`, `NEXT_PUBLIC_TEST_HOOKS=0`. Sem alterações de plano, cobrança ou proteção. Os comandos em `apps/web/vercel.json` precisam ser preservados.
4. Crie **staged production** com `--prod --skip-domain`, projeto e workspace explícitos. Valide READY, logs, pnpm/Node, HTTP autenticado e fonte. Promova o mesmo build após essas verificações; confira que o alias `tretta.vercel.app` aponta exatamente para o ID novo. Se a promoção não associar esse domínio já pertencente ao projeto, ajuste somente esse alias e confira novamente. Sem compra/DNS externo.
5. Smoke público com clientes próprios: criar/entrar/preparar, jogar, chat descendente, controle do aviso da vez persistido e alinhamento de campos. Conferir hooks ausentes, ausência de erros de console e endpoint Render saudável. Não usar sala da família, não registrar credenciais/mãos adversárias. Capturas em `docs/work/reports/assets/T008-public/`.

**Limites:** esta execução é frontend-only; nenhuma alteração, deploy ou reinício Render. Não fazer push em main só para publicar o frontend: o Render conectado à branch pode reiniciar salas. Commit/push dependem de pedido humano específico; o deploy CLI pode usar a fonte revisada sem eles. Não refatorar produto ou modificar regras para contornar falhas de publicação. Não cadastrar cartão, contratar serviço ou enfraquecer proteção.

## Aceite e retorno

- Novo deployment de produção READY no projeto/time corretos; domínio aponta ao build testado.
- Build usa versões/configurações aprovadas e URL HTTPS real, sem hooks.
- Smoke integrado confirma as mudanças; Render mantém seu deploy e as salas existentes.
- Report `docs/work/reports/T008-publication.md` com resultado por critério, ID/URL/hash da fonte, comandos/saídas sanitizadas, limitações e pendências. Atualize status/runbook com fatos e retorne ao orquestrador. Não declare concluído apenas por upload aceito.

Se houver falha funcional após promover, preserve evidência sanitizada e restaure o domínio para o deployment anterior conhecido, sem reconstruir ou reiniciar o backend; registre o resultado e devolva a divergência ao orquestrador.
