# Prompt manual — T010: confirmar resultado incerto após esgotar o prazo

**Executado e aceito localmente em 17/10/2026.** [Aceite final](reports/T010.final-validation.md). Próxima tarefa [T010-publication.md](T010-publication.md) preparada, ainda não executada. Contrato original abaixo preservado. Executor manual, **GPT-6 Luna (`gpt-6-luna`), reasoning `max`**. Não acione outros agentes.

## Contexto e objetivo

Repositório `/Users/ivanseibel/dev/personal/tretta`, com working tree acumulado e sem commit. Leia AGENTS/protocolo local, status/plano, contrato original T010, primeiro prompt de ajustes e `docs/work/reports/T010.revalidation.md`. Preserve reports e artefatos anteriores.

Os três achados anteriores estão corrigidos e os testes ajustados foram aceitos. Falta um caso funcional: **Tentar novamente depois do deadline perde a intenção cujo resultado continua incerto**, podendo ficar preso em ALREADY_IN_ROOM se a conexão já estava autorizada no servidor. Corrija esse caso preservando o deadline e o isolamento conquistados.

## Reprodução e resultado esperado

Runner: `docs/work/reports/assets/T010-revalidation/orchestrator-cross-cycle.test.tsx`; saída em `result.txt` no mesmo diretório. Ele contém os 15 casos permanentes atuais mais um caso novo. Execute em cópia isolada, sob `apps/web/test`, para resolver aliases/dependências sem duplicar a suíte permanente no produto.

Sequência: servidor aceita primeiro join e memoriza sucesso → todos os acks ficam indisponíveis durante o ciclo → vence 60 s, credencial preservada e UI exhausted → a rede volta a entregar acks → clique em Tentar novamente. No mesmo socket autorizado, outro id recebe ALREADY_IN_ROOM; replay exato pode confirmar o sucesso original.

Esperado: o ciclo novo obtém confirmação válida da mesma identidade e recupera a sessão sem reload ou nova pessoa, respeitando novamente o prazo de 60 s desse ciclo explícito. Ack espontâneo do ciclo vencido continua inerte; transporte/contexto/identidade antigos não habilitam vínculo nem sobrescrevem o contexto atual.

## Escopo

1. Preserve um caminho seguro para resultado incerto entre ciclos explícitos. Pode manter informação contextual suficiente para replay ou usar outra estratégia cliente segura. Justifique o desenho. Não habilite por ALREADY_IN_ROOM isolado, não tome a sessão de outra aba e não altere servidor/protocolo/deduplicação.
2. Diferencie: recusa conhecida exige tentativa lógica nova; resultado incerto pode exigir confirmação/replay. Troca de sala/identidade, remoção, invalidação e saída não devem reutilizar informação de outro contexto. A confirmação de um replay novo não significa aceitar callback antigo.
3. Mantenha deadline efetivo por ciclo, cancelamento, geração do transporte, um ciclo ativo por contexto, credencial/mão/fase e bloqueios de UI/APIs até ack autorizado. Mantenha o comportamento de falta de identidade/falhas definitivas e duas abas vivas.
4. Incorpore regressão permanente que falhe antes e passe depois; teste também que um callback do ciclo vencido não encerra/habilita o ciclo novo e que informação incerta não contamina outra identidade/sala.
5. Faça uma reprodução integrada com servidor real que aceite o join, retenha/descarte confirmações até o primeiro ciclo vencer e depois permita confirmar ao usar Tentar novamente. Transporte ainda vivo no servidor é parte essencial; reconexão só vale se for uma ação controlada da solução. Nenhum reload adicional, participante duplicado ou perda de mão/credencial. Um harness de teste pode controlar tempo; deixe explícito se acelerou e mantenha as provas anteriores do heartbeat padrão.

## Único artefato histórico restante

O orquestrador autorizou a restauração específica de `docs/work/reports/assets/T007/ten-room-load.json`, após preservar a versão atual. Hash atual conferido na revalidação: `2fd39f6e34ee03b6bf33c5ae302d9c382baa12f0da0a5a0a4f3c0f4ddf4fad9f`. Blob histórico já comprovado em `assets/T010-validation/historical-artifacts.json` e manifesto T008.

Antes de restaurar, confira os hashes e guarde a versão atual com índice/hash em `assets/T010-adjustments-2/`. Se mudou desde a revalidação, preserve e identifique essa versão também. Escreva somente esse blob histórico comprovado; confira o hash final. Preserve os 87 arquivos já restaurados e os backups. Sem reset/clean/restauração geral. Rode testes de servidor e E2E em cópia isolada para não regenerar métricas/capturas históricas no clone principal.

## Verificação e limites

Use `rtk`, Node 22 e pnpm 11.14.0. Execute testes novos antes/depois, suíte web, verificações pertinentes de recuperação/deduplicação no servidor, build/tipos e E2E pertinentes sequencialmente em cópia isolada. Os reports anteriores já registram frozen install e suítes completas; repita apenas o necessário às mudanças e requisitos ainda pendentes, justificando a seleção. Não precisa repetir novamente todo o harness longo A se a correção ficar restrita à transição entre ciclos; a nova prova integrada deve cobrir essa transição.

Nenhum commit/push/deploy, reinício Render, dependência nova, mudança de plano/custo ou teste em salas públicas. A produção permanece T008. Fonte funcional do servidor/protocolo/motor preservada.

## Report e parada

Entregue `docs/work/reports/T010-adjustments-2.md` com causa/correção, estratégia contextual, regressões antes/depois, prova real entre ciclos, verificações/limites e restauração do histórico com hashes. Evidências novas em `assets/T010-adjustments-2/`. Atualize trecho atual e retomada do status para **“T010 aguardando revalidação final do orquestrador”**, sem declarar aceite/publicação. Pare e devolva o report; não avance para deploy.
