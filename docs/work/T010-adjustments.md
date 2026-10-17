# Prompt manual — T010: ajustes após validação

**Executado e revalidado; três achados corrigidos.** Resta o caso entre ciclos de [T010-adjustments-2.md](T010-adjustments-2.md), ainda não executado; ver [revalidação](reports/T010.revalidation.md). Contrato original abaixo preservado. Executor manual: **GPT-6 Luna (`gpt-6-luna`), reasoning `max`**. Não acione outros agentes. Corrija os achados abaixo e devolva report para revalidação; preserve o restante da entrega.

## Contexto

Repositório `/Users/ivanseibel/dev/personal/tretta`, com T008/T010 no working tree e arquivos novos ainda sem commit. Leia AGENTS, protocolo local, status/plano, escopo aprovado, `docs/work/T010-recovery-fix.md`, `reports/T010.md` e `reports/T010.validation.md`. A recuperação principal demonstrada pelo harness é válida, mas o orquestrador ainda não aceitou T010.

Use os artefatos em `docs/work/reports/assets/T010-validation/`: runner do provider, resultado dos três casos adicionais e lista de evidências históricas alteradas. O runner inclui nove testes originais do executor mais três adicionais; copie para `apps/web/test` **numa cópia isolada** para executar. Não deixe esse arquivo duplicando a suíte no produto; incorpore regressões próprias nos testes permanentes apropriados.

## 1. Deadline efetivo com ack pendente

Hoje o ciclo espera um `emitWithAck` de até 6 s mesmo se o prazo de 60 s acabar durante a espera. Também aceita sucesso depois do deadline. O teste do orquestrador mantém um ack em voo perto do limite e observa recovering aos 60 s.

Faça o ciclo encerrar no deadline efetivo, inclusive enquanto espera ack ou backoff. O ciclo vencido não pode habilitar vínculo/salvar identidade ao receber callback tardio. Preserve os efeitos de falhas definitivas e não deixe timers/listeners ou promises de recuperação sem encerramento ao cancelar. Teste tanto vencimento sem resposta quanto sucesso que chega após o limite. Não ampliar o prazo aprovado para contornar o problema.

## 2. Ack deve pertencer ao transporte/contexto vigente

No teste, o callback do ack de sucesso resolve a promessa; em seguida o transporte cai, antes de a continuação do await rodar. O ramo de sucesso só confere token da recuperação e restaura chatLinkReady. Na conexão seguinte, o atalho de “vínculo já pronto” retorna ok, sem novo join, e interactive fica true.

Associe a confirmação à geração de transporte e ao contexto correto. Ack de transporte anterior não habilita UI/APIs no transporte novo nem sobrescreve contexto/identidade. Preserve um único ciclo lógico e seu deadline durante quedas; invalidar uma tentativa não deve reiniciar automaticamente 60 s a cada evento. Teste a ordem ack → disconnect → continuação, reconexão, cancelamento e troca de contexto, incluindo sucesso atrasado do ciclo anterior depois de outro já iniciado.

## 3. Resultado incerto do join não pode prender a recuperação

Considere: servidor aceita o join e envia estado; o ack demora além do timeout de 6 s. O cliente recebe TIMEOUT, tenta com id novo e recebe ALREADY_IN_ROOM, porque aquela conexão já está vinculada. O ack original, quando chega, já não resolve a promessa encerrada. Repetir ids novos não recupera essa confirmação.

Resolva a ambiguidade preservando autorização e deduplicação. Diferencie uma nova tentativa após **recusa conhecida** (id novo, para não perpetuar ALREADY_CONNECTED cacheado) da confirmação de **resultado ainda incerto**. Pode recuperar o resultado da mesma intenção ou usar outra estratégia cliente segura que justifique. Não interprete ALREADY_IN_ROOM isoladamente como autorização para a identidade/sala desejada. Não tome a sessão de outra aba, diminua caches ou altere protocolo/produção para esconder o caso.

Adicione regressão com servidor real atrasando/perdendo controladamente o ack de um join aceito, sem alterar código de produção do servidor. Exija recuperação automática da mesma identidade/mão dentro do deadline, sem reload extra, participante duplicado ou ações habilitadas antes da confirmação válida. O teste controlado entregue pelo orquestrador evidencia o estado atual; se a solução usar confirmação posterior ou reconectar o transporte, ajuste o fixture para modelar fielmente a semântica real, justificando qualquer mudança de asserção. Não exigir sucesso síncrono de uma estratégia legitimamente assíncrona.

## 4. Preservar e restaurar evidências históricas

Há **88 caminhos** históricos em `reports/assets/T003`–`T007` e ajustes que foram regenerados. Consulte `assets/T010-validation/historical-artifacts.json`: hash HEAD e manifesto T008 coincidem, os arquivos atuais divergem.

Preserve primeiro as versões novas numa área separada, com índice/hash registrado, sem sobrescrever o diagnóstico do executor/orquestrador. Depois restaure **somente** os originais listados e comprovados contra o manifesto, a partir dos blobs Git correspondentes. Preserve qualquer alteração que não pertença à lista ou não corresponda aos hashes registrados; relate divergências em vez de descartar trabalho desconhecido. Não use reset/clean/restore abrangente. Execute E2E em cópia isolada para não sobrescrever novamente os originais. O working tree final deve manter as provas históricas iguais à base de T008 nesses caminhos.

## Aceite e verificação

- Reproduções novas falham na entrega atual e passam após correção; registrar antes/depois sem reescrever a evidência anterior.
- Deadline de 60 s, vínculo por transporte/contexto e recuperação de resultado incerto demonstrados por testes pertinentes.
- Todos os critérios originais T010 preservados: blackhole seletivo, proteção de duas abas, preservação de credencial/mão/fase, bloqueios de envio, cancelamento, falhas definitivas e preferências/aviso de vez.
- Histórico preservado e artefatos novos separados; lista/hash de restauração verificável.
- Com Node 22/pnpm 11.14.0 e `rtk`, verificar instalação congelada, build, testes, tipos, E2E pertinentes, smoke de produção e diff-check sequencialmente, evitando interferência em processos/arquivos gerados do clone principal. Não repetir a reprodução longa padrão sem necessidade; repita quando mudanças no ciclo exigirem comprovar que o caso principal continua funcionando.

## Limites e retorno

Manter servidor/protocolo/motor e configuração de hospedagem. Sem commit/push/deploy, reinício Render ou intervenção em salas públicas. Sem novas dependências ou regra de transferência de identidade. Preserve reports originais e alterações preexistentes.

Report em `docs/work/reports/T010-adjustments.md`: achados corrigidos, arquivos, decisão sobre confirmação de resultado incerto, testes/medidas antes e depois, recuperação real, histórico restaurado, comandos e limitações. Evidências novas em `assets/T010-adjustments/`. Atualize trecho atual e retomada de status para **“T010 aguardando revalidação do orquestrador”** e pare. Publicação continua posterior ao aceite.
