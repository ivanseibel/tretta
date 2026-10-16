# T007 — proposta de hospedagem gratuita

**Resultado: preparação documental concluída; publicação pendente.** A proposta é Vercel Hobby para `apps/web` e Render Free para o servidor Node/Socket.IO, sem banco, Redis ou alteração do motor. T001–T006 e as provas locais de T007 permanecem aceitas conforme o estado do trabalho.

## Entregáveis e evidências

- Runbook em [deployment-free.md](../deployment-free.md), com configuração do monorepo, comandos filtrados, `PORT`, CORS, URLs HTTPS/WSS, hooks/seed desligados, smoke test, limites de custo zero e efeito de reinícios.
- O orquestrador informou que `pnpm --filter @tretta/server... build` terminou com código 0 e selecionou `rules`, `protocol` e `server`, sem compilar o Next.js. Este executor não repetiu builds nem suítes.
- Fontes oficiais Render, Vercel, Next.js e pnpm consultadas em 15/10/2026 e listadas no runbook. Riscos registrados: suspensão Render após 15 minutos de inatividade, partida fria aproximada de um minuto, reinícios a qualquer momento, cotas de workspace, elegibilidade Hobby não comercial e suporte WebSocket Vercel em beta com duração limitada.

## Bloqueio e próximos passos

O código do jogo e os manifestos do workspace ainda não estão rastreados por Git; `origin` existir não torna o working tree disponível para deploy. O fluxo padrão Render exige uma branch Git com commits ou uma imagem publicada. Publicar exige commit/push pedido pelo usuário ou outra fonte publicada explicitamente autorizada. Nenhum commit, push, upload, conta ou recurso externo foi criado. Não há validação pública de HTTPS/WSS.

Sem método de pagamento no Render, excedentes de tráfego suspendem serviços e excedentes de build bloqueiam novos builds; com método cadastrado, podem gerar cobrança. Render pode reiniciar ou suspender e apagar o estado em memória, então as regras de pausa de 90 segundos e retenção de 15 minutos só valem enquanto o processo continua vivo. A compatibilidade Vercel com pnpm 11.14.0 também requer confirmação nos logs do primeiro build usando Corepack, pois a tabela geral publicada consultada lista pnpm até 10.

## Verificação desta tarefa

- Leitura do protocolo local e do escopo, conferência dos comandos/variáveis do servidor e da estrutura de workspaces.
- Nenhuma suíte de produto, deploy, alteração de app, criação de conta/recurso ou operação Git de escrita foi feita. As provas de T007 já aceitas não foram repetidas.
