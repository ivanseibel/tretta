# T011B — ajustes: isolar respostas de entrada obsoletas

Data: 17/10/2026. Execução manual (sem subagentes). **Estado: aguardando validação do orquestrador.** Corrige o achado R1/B6 da [validação](T011B.validation.md); nada foi publicado.

Registros preservados: [contrato deste ajuste](../T011B-adjustments.md), [report da entrega anterior](T011B.md), [validação do orquestrador](T011B.validation.md) e o runner preservado em [assets/T011B-validation](assets/T011B-validation/). Este documento cobre apenas o ajuste.

## Resultado

| Critério | Evidência | Situação |
| --- | --- | --- |
| J1 — Troca de sala | Runner do orquestrador executado sem alteração de bytes (sha256 `b9246b93…`): **7/7**, era 5 verdes e 2 vermelhos. Log [02](assets/T011B-adjustments/02-runner-orquestrador.log); antes em [T011B.validation](assets/T011B-validation/supplemental.log) | Satisfeito |
| J2 — Cancelamento/mesmo código | 5 casos determinísticos novos com provider/página reais em `apps/web/test/training-entry-context.test.tsx`; suíte web 126 → **131** testes, 17 arquivos | Satisfeito |
| J3 — Comportamento vigente | Suíte web completa 131/131 na cópia (T010 incluso: deadline, `ALREADY_CONNECTED` transitória, duas abas, intenção incerta entre ciclos); E2E treino+recuperação 7/7, incluindo recusa atual definitiva e duas abas reais | Satisfeito |
| J4 — Evidência e preservação | Cópia física sem symlink; 0 diferenças de fonte/doc entre cópia e entrega; 417/417 entradas históricas byte-idênticas (352 assets + 65 reports); hashes antes/depois em [04](assets/T011B-adjustments/04-preservacao-hashes.txt) | Satisfeito |

## Ajuste implementado

Tudo em `apps/web/app/providers.tsx` (correção na origem do estado; a página não mudou):

1. **Geração da tentativa manual** (`joinAttemptRef`): `joinRoom` captura a geração e o transporte vigente antes do `emitWithAck` e, após o `await`, só aplica efeitos se a tentativa ainda for a atual **e** o transporte não tiver caído — confere sala/tentativa/transporte antes de recusa, `busy`/erro, vínculo, identidade e navegação.
2. **Invalidação nos pontos únicos já existentes**: `cancelRecovery` (navegação/limpeza da página, saída, remoção — via `clearRoomState`) e `resetRoomState` (vínculo novo confirmado) avançam a geração; uma entrada manual mais nova também avança. Assim a proteção vale ao sair e voltar ao **mesmo código**: a geração distingue tentativas, igualdade de código não.
3. **`busy` sem dono**: as invalidações limpam `busy`, para o formulário do contexto novo não ficar preso pelo `busy` da tentativa antiga — o caminho obsoleto não toca mais nada do contexto atual.
4. **Transporte caído**: resposta de sucesso não confirma vínculo nem grava identidade; erro transitório não vira banner. A decisão definitiva do servidor (`TRAINING_ROOM_ENTRY_REFUSED`) continua aplicando mesmo com transporte caído em seguida, espelhando a semântica do `startRecovery` (mesma família: `CREDENTIAL_INVALID`/`ROOM_NOT_FOUND`).
5. **Preservado**: assinatura `joinRoom(code, nickname, avatar): Promise<boolean>` e guardas de retomada pendente/esgotada/recusa conhecida; nenhuma segunda máquina de recuperação; recusa atual segue definitiva, sem retry automático e sem tocar credenciais.

Testes permanentes novos (`apps/web/test/training-entry-context.test.tsx`, transporte controlado e relógio falso, componentes reais):

| Caso | Confirma |
| --- | --- |
| J1a — recusa tardia de A com B em formulário | B mantém formulário; sem painel de recusa; sem erro; identidade ausente; botão habilita (busy não fica preso) |
| J1b — recusa tardia de A com B autorizada | B mantém lobby (`ready-toggle`); sem recusa; credencial de B intacta; nada criado para A |
| J2a — sair e voltar ao mesmo código | resposta antiga não muda painel/busy/erro/identidade; o `busy` da tentativa nova segue ativo; a recusa da tentativa nova aparece |
| J2b — sucesso atrasado de tentativa antiga | não cria vínculo nem identidade; tentativa nova segue válida e recebe sua recusa |
| J2c — sucesso após queda de transporte | não confirma vínculo nem grava identidade; reconexão volta ao formulário |

## Comandos e resultados brutos (cópia isolada)

Cópia: `/private/tmp/tretta-t011b-adj-verify-01/tree` — `cp -Rc` do working tree completo em 17/10 11:28, arquivos físicos sem symlink; Node v22.23.1, pnpm 11.14.0; detalhes em [origin.txt](assets/T011B-adjustments/origin.txt).

| Comando (em `apps/web`, na cópia) | Log | Resultado |
| --- | --- | --- |
| `pnpm vitest run` (suíte web completa, sem runner) | [01](assets/T011B-adjustments/01-units-web.log) | 17 arquivos, **131/131**, EXIT 0 |
| `pnpm vitest run test/orchestrator-training-refusal.test.tsx` (runner copiado de assets/T011B-validation) | [02](assets/T011B-adjustments/02-runner-orquestrador.log) | **7/7**, EXIT 0 |
| `pnpm build` (raiz) | [00b](assets/T011B-adjustments/00b-build-typecheck.log) | EXIT 0 |
| `pnpm -r --if-present typecheck` | [00b](assets/T011B-adjustments/00b-build-typecheck.log) | EXIT 0 |
| `pnpm exec playwright test training.spec.ts recovery.spec.ts recovery-wait.spec.ts` | [03](assets/T011B-adjustments/03-e2e-treino-recuperacao.log) | **7 passed (1.4m)**, EXIT 0 |

E2E do log 03: 5 do treino (inclui “entrada recusada no treino é definitiva, explica e não cria identidade” e “duas abas protegem a primeira e a segunda retoma depois”), 1 de recuperação e 1 de espera de retomada em nova aba. O caso de recuperação é o smoke local de duas pessoas (Ana em desktop + Bia em celular): entram, jogam, a página atualiza e a **mesma identidade/mão/fase é recuperada**; a conexão ainda cai e volta no mesmo teste.

## Falhas e intermitências

- **Falha de tipos na primeira rodada do build, corrigida**: `TS2345` em `training-entry-context.test.tsx` (`noUncheckedIndexedAccess`; `expect(...).toBeDefined()` não estreita tipos). Corrigido com o helper `requireJoin`, arquivo ressincronizado byte a byte na cópia (`diff -q` idêntico) e todas as rodadas refeitas. Log bruto da falha preservado em [00a](assets/T011B-adjustments/00a-build-typecheck-falha-tipos-corrigida.log).
- **Nenhuma intermitência observada**: unitários web verdes nas 4 rodadas de vitest da execução (2 no primário — direcionada + suíte completa — e 2 suítes completas na cópia), runner 7/7 nas 3 execuções (1 no primário, 2 na cópia), E2E verde de primeira. Nada precisou de repetição “até ficar verde”.
- **T007 fora do escopo** (conforme o contrato): não foi re-executado. Registro das medições anteriores preservado: a assinatura de timeout apareceu tanto na base pré-T011B quanto na entrega, e a atribuição ao estado acumulado de `.next` é **hipótese**, não demonstrada por isolamento causal.
- **Observação não investigada**: o próprio `training.spec.ts` regrava capturas em `assets/T011B/` e o `recovery.spec.ts` em `assets/T004/`; na cópia, 8 das 12 capturas PNG de T011B e 2 de T004 saíram com bytes diferentes da execução aceita (as 4 demais saíram byte-idênticas). Capturas com áreas animadas/ao vivo não são byte-determinísticas entre execuções; nada no primário foi tocado.

## J4 — proveniência e preservação

- **Fonte verificada = entrega**: comparação cópia × primário pelo critério de manifesto (fora de `.git/node_modules/.next/dist/test-results/playwright-report`): **0 diferenças de código ou documento**; as 12 diferenças de hash são gerados dentro da cópia (`next-env.d.ts`, `tsconfig.tsbuildinfo`) e capturas regravadas pelos próprios specs (acima). O runner rodou a partir de cópia byte-idêntica do preservado (sha256 `b9246b93…` nos dois lados) e foi removido da cópia antes de build/tipos.
- **Históricos**: manifesto disponível tem **417 entradas** (352 assets + 65 reports) — `shasum -c`: **417/417 OK** na entrega final. Corrige a contagem de 352 citada no report original, **sem reescrever reports anteriores**.
- **Antes/depois desta execução**: baseline dos 650 arquivos capturado antes das edições; diferenças finais = `providers.tsx` e `docs/work/status.md`/`docs/work/plan.md` modificados; novos = teste `training-entry-context.test.tsx`, este report e os arquivos de `assets/T011B-adjustments/`; nada removido. Listas completas em [04](assets/T011B-adjustments/04-preservacao-hashes.txt).
- `git diff --check` sem erros; working tree preservado (T008–T011A, T011B e validação intactos); sem commit, push, deploy, restart do Render, mudança de custo ou uso de salas públicas/familiares; nenhuma credencial, storage bruto ou mão adversária em logs.

## Decisões e limitações

- **Decisão**: invalidar na origem usando os pontos únicos existentes (`cancelRecovery`/`resetRoomState`) em vez de comparação de código na página ou de uma segunda máquina de recuperação — exigência 4 do contrato.
- **Decisão**: manter recusa definitiva válida com transporte caído em seguida (consistente com o ciclo de retomada T010); o caminho obsoleto por contexto nunca aplica nada.
- **Limitação**: 320px continua sendo emulação, sem teste físico de dispositivo (herdado de T011B; nada mudou nesse aspecto).
- **Limitação**: os testes novos usam transporte controlado (determinísticos); a cobertura de navegador real vem dos E2E existentes de treino/recuperação.
- **Limitação**: verificação proporcional executada 1× na cópia para E2E (verde de primeira); sem repetição além do necessário, já que não houve falha intermitente.
- **Limitação**: um futuro caminho que emita `client:joinRoom` fora de `joinRoom` precisará repetir o mesmo vínculo tentativa/transporte (comentado no código).

## Estado final e parada

`docs/work/status.md` e `docs/work/plan.md` atualizados para “ajustes de T011B aguardando validação do orquestrador”, referenciando este report. Report original e validação permanecem como registro. Treino não publicado; publicação só depois do aceite de T011B e de pedido humano específico. Aguardo a validação do orquestrador.
