# T007 — Aceite da publicação gratuita

Data: 16 de outubro de 2026. Papel: orquestrador.

## Resultado

Publicação aceita: [Tretta](https://tretta.vercel.app), frontend Vercel Hobby no workspace Seibel e servidor Render Free em `https://tretta-server.onrender.com`. Não foram adicionados banco, Redis, disco, plano pago ou cartão. T007 mantém a pendência de confirmação em aparelhos físicos; a publicação e as provas locais já aceitas estão concluídas.

## Revisão e recursos

- Fonte: `8967e94eae18a351c6c7b4c81a1f00ea5d6d1837`, que contém a implementação `10367a6` e as configurações gratuitas revisadas.
- Vercel: projeto `prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`, workspace `seibel`, plano Hobby; build de produção `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc`. A API de alias confirmou independentemente que `tretta.vercel.app` aponta para esse ID e projeto. Foi promovido o mesmo build testado, sem rebuild.
- Render: workspace `My Workspace` (`tea-cuhq60rv2p9s738m7us0`), Hobby sem cartão; serviço `srv-db95f2u7bikc73dpndt0`, plano Free, deploy Live `dep-db95f367bikc73dpnfs0`. CLI 2.29.0 instalada/autorizada pelo usuário; workspace selecionado e leituras independentes conferidas.
- Build Render: Node 22.23.1, pnpm 11.14.0, instalação congelada e builds rules/protocol/server aprovados. Build Vercel: Node 22, Corepack/pnpm 11.14.0, instalação congelada, pacotes e Next 16.4.1 aprovados. URL HTTPS real e hooks desligados nos ambientes de produção; seed ausente no servidor.

## Verificação independente

1. Readbacks autenticados confirmaram os alvos, plano Free Render, revisão Live, configuração Next.js/Node 22 e build Vercel READY com target production. O HTTP autenticado do staged retornou 200 com HTML Tretta, formulário Criar sala e assets Next; a proteção de preview foi preservada.
2. `/healthz` público retornou 200 com `{"ok":true}`. Dois clientes próprios conectaram por WebSocket/TLS usando a origem pública, criaram/entraram/prepararam uma sala e concluíram uma rodada com vencedor único após 28 comandos. Chat entregue aos dois; 58 verificações da estrutura de projeções; retorno à preparação e saída confirmados. Evidência sanitizada em [socket-smoke.json](assets/T007-public/socket-smoke.json). Não foram usados hooks ou semente de teste.
3. Pelo navegador integrado, no domínio público sem autenticação Vercel: criação de sala, entrada de segundo cliente próprio pelo protocolo normal, prontidão/início, seleção e descarte de carta válida, ida e volta de chat, encerramento controlado sem vencedor, retorno à preparação e saída. O segundo cliente atuou somente sobre a própria projeção. Console do navegador: zero erros capturados. A rodada com vencedor completo está coberta pelo teste WSS acima; o smoke de interface usou encerramento controlado.
4. Captura da página inicial publicada, sem dados de sessão: [home-public.png](assets/T007-public/home-public.png), inspecionada pelo orquestrador. A página inicial permaneceu aberta como entrega; os clientes de teste saíram.

## Limites e operação

- Não houve teste em celular físico nem nova mesa de oito navegadores na nuvem; as provas locais aceitas permanecem válidas. O smoke público de dois clientes não mede a capacidade do plano Free nem substitui o alvo local de dez salas.
- Render pode suspender após inatividade; despertar pode levar cerca de um minuto. Reinícios apagam salas, chats e placares em memória. Sem cartão, limites podem suspender serviços/builds; não adicionar método de pagamento ou upgrade sem nova decisão do usuário.
- `browser-harness` ficou indisponível por permissão de depuração. Render foi configurado pela extensão CUA na sessão autenticada. Na validação final, a nova aba Chrome sofreu falhas de automação/crash; o smoke foi concluído no navegador integrado. Não há evidência para atribuir essa falha local ao produto.
- Reports e estado desta publicação permanecem no working tree. Não foi feito push apenas documental após a publicação: o serviço Render conectado a main pode fazer deploy automático e reiniciar salas. Integrar esses registros numa janela planejada.

Reports dos executores: [Render Free](T007-render-free-deploy.md), [build Vercel staged](T007-vercel-staged-deploy.md) e [promoção](T007-vercel-promotion.md). Nenhuma suíte local foi repetida sem alteração de comportamento.
