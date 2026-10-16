# T005C — Apresentações consecutivas, contexto e áudio

## Papel e objetivo

Você é o executor do Tretta em modo manual. Corrija os três achados de cliente da validação de T005C, preservando derivação autoritativa, oito variantes, regras e aceites anteriores. T001–T004 e T005A/B estão aceitas; T005C requer ajustes. T006 continua pendente.

## Contexto

Leia `AGENTS.md`, `.agents/skills/orchestrate-work/SKILL.md`, escopo/status/plano, `docs/work/T005C.md`, `docs/work/reports/T005C.md` e **`docs/work/reports/T005C.validation.md`**. Reproduções em `docs/work/reports/assets/T005C-validation/`; a validação distingue navegador/servidor reais de transporte/WebAudio controlados.

Confira o Git e preserve o working tree, prompts, reports, evidências e aceites anteriores. Nenhum commit solicitado. Use RTK, skills pertinentes e as instruções de `apps/web/AGENTS.md`. Mudanças limitadas ao cliente e cobertura necessária; decisões locais cabem ao executor. Necessidade de alterar regra/produto volta ao orquestrador com cenário concreto.

## Ajustes e aceite

### 1. Cada item automático inicia sua própria apresentação

Dois Bloqueios enfileirados com a mesma variação reutilizam o nó/animação CSS no ramo `EffectPresentation`, sem identidade por item. O segundo id chega ao DOM com a animação anterior já encerrando e termina invisível (opacidade zero). O E2E suplementar reproduz duas jogadas válidas reais em `twoSkipsDeck`, com `brick-wall` fixada.

Garantir uma apresentação própria para cada item novo, mantendo duplicata/replay do mesmo id sem nova apresentação. Identidade React por item ou solução equivalente é escolha local. Não resolver retirando o fade/fila, acrescentando sobreposição ou tornando toda apresentação permanentemente opaca.

Regressões permanentes:

- Duas jogadas reais consecutivas, mesma variação, segundo efeito enfileirado antes do primeiro terminar: ambos alcançam fase legível, um por vez, e encerram normalmente.
- Modo reduzido: dois automáticos consecutivos também são visíveis, incluindo categorias diferentes que usam `mood-fade`.
- Modo desligado mantém legenda estática e esvaziamento por timer; duplicata do mesmo id não reinicia animação/som nem ocupa fila.
- Preservar as oito variantes, sequência final e jogada enquanto animação está ativa.

Testar opacidade/fase visual em navegador real; presença de id/legenda no DOM e `toBeVisible` isolado não capturam a falha CSS observada.

### 2. Lotes antigos ficam fora da rodada nova

`server:events` verifica sala, mas não o contexto da rodada antes de alimentar feed e efeitos. Após refletir `r2`, lote ainda não observado de `r1` apresenta efeito e som na rodada nova.

Validar o contexto pertinente antes de qualquer efeito do lote no cliente. Uma rodada nova/preparação não pode receber efeito/feed/som de uma anterior. Preservar efeitos válidos do início/fim da rodada e sua ordem; não aplicar um filtro de versão que descarte um lote válido só porque seu snapshot já chegou. A transição para resultados da mesma rodada conserva os efeitos finais.

Regressões com provider/interface reais e transporte controlado:

- Refletir `r1`, depois `r2`, entregar lote antigo de `r1`: nenhum item, som ou linha antiga em `r2`. Lote válido de `r2` continua entrando exatamente uma vez.
- Preparação após resultado e remoção/troca de sala ignoram o passado; recuperação da mesma rodada não reapresenta ids vistos.
- Primeiro lote válido e efeitos finais (penalidade/bloqueio/inversão antes da vitória) continuam corretos; manter ordem documentada do servidor e cobrir os casos pertinentes de snapshot/lote sem esconder atualizações válidas.

A reprodução é uma entrega tardia controlada, não um achado de retransmissão pelo servidor. Não introduzir histórico/retransmissão de efeitos transitórios.

### 3. Ocultar cancela o som da provocação ativa

O caminho de ocultação só remove o item da fila, deixando os nós de áudio da provocação tocarem até o encerramento natural. Cancelar o som pertinente ao ocultar a apresentação ativa, antes de tocar o item seguinte ou por identificador de apresentação.

Regressões usando o módulo real de áudio com WebAudio observável, além do fluxo do provider:

- Ocultar provocação ativa corta imediatamente seus nós sonoros e remove a imagem.
- Provocação ativa seguida de automático: cortar os nós antigos, avançar uma vez e permitir o som automático novo. Evitar `stopAllSounds` tardio que também corte o automático recém-ativado.
- Ocultar apenas provocações pendentes preserva som/imagem do automático ativo. Reativar não reproduz as suprimidas.
- Silenciar continua cortando o som atual/bloqueando os seguintes; falha/ausência de áudio não trava a fila.

Se a API de áudio mudar, preservar o artefato histórico e acrescentar evidência equivalente do comportamento observável. Não é obrigatório chamar uma função específica; é obrigatório cortar os nós corretos sem cancelar o item seguinte indevidamente.

## Preservação e verificação

Servidor/protocolo/motor, RNG separado, atribuição ao substituto, limites de chat/provocação, gate de vínculo, idempotência e isolamento por operação já conformes devem permanecer cobertos. Preservar feed/avisos essenciais em todos os modos e os 21 E2E anteriores. Registrar regressões antes/depois e capturas adicionais em `docs/work/reports/assets/T005C-adjustments/`, sem substituir os PNGs anteriores.

Referências suplementares, da raiz e **isoladas de build/tipos/suítes/E2E**:

```sh
rtk proxy node docs/work/reports/assets/T005C-validation/run-client-check.mjs
rtk proxy node docs/work/reports/assets/T005C-validation/run-browser-check.mjs
rtk proxy node docs/work/reports/assets/T005C-validation/run-audio-check.mjs
```

Os runners criam/removem testes temporários próprios e recusam sobrescrita. Preservar scripts/artefatos; acrescer regressões permanentes adequadas. Executar instalação congelada, build, suíte, tipos após build (`rtk proxy pnpm -r --if-present typecheck`), E2E e diff-check sequencialmente. Registrar falhas, intermitências e limitações honestamente; instrumentação de áudio não é confirmação auditiva física.

## Retorno

Salvar `docs/work/reports/T005C-adjustments.md` conforme o protocolo: causas/correções, arquivos, evidência por achado, antes/depois, comandos/resultados e escolhas locais. Precisar canal (`server:events.effects`), fronteiras de limpeza dos ids e natureza da evidência de áudio/capturas. README atualizado se necessário.

Atualizar `docs/work/status.md` para **“T005C aguardando revalidação do orquestrador”**, mantendo os aceites anteriores e o modo manual. Nenhum commit solicitado. Parar após o report; o orquestrador revalida T005 antes de T006.
