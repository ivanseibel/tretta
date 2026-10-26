# Cenários de jogo da T019F

O harness mede o DOM da página atual. Para estados que não são uma rota simples (mesa de 2–8 pessoas, pausa, última, denúncia, resultado, gaveta), a T019F fornece um **cenário** que monta o estado antes da medição.

O cenário roda no mesmo processo Node do harness e recebe o Playwright já iniciado. Ele não é uma spec, não usa fixture do `apps/web/e2e` e não deve alterar nenhum arquivo de aplicação.

## Contrato

Crie `docs/work/reports/assets/T019F/scenarios/t019f.mjs`:

```js
export async function createScenario({ baseURL, browser, viewport, runDir, log }) {
  return {
    /**
     * Prepara a página para o estado. Pode navegar, criar salas com outros
     * contextos e aguardar a UI. Devolva { page } para substituir a página
     * principal, ou nada para continuar na página recebida.
     */
    async prepare(state, { page, context }) {
      if (state.id === 'home') {
        await page.goto(`${baseURL}/`);
        return;
      }
      // ...
    },

    /** Opcional: chamado ao final de cada estado, antes de fechar o contexto. */
    async teardownState(state) {},

    /** Opcional: chamado ao final de cada viewport. */
    async teardown() {}
  };
}
```

`state` é o objeto de `lib/config.mjs` (id, kind, seats, hand, drawer, reactions, features…). Use `state.id` para decidir o fluxo. `viewport` é `{ id, width, height, dpr, mobile }`.

## Helpers disponíveis

`lib/scenario.mjs` exporta:

- `fillNickname(page, nome)`;
- `clickTrain(page)`;
- `clickReady(page)`;
- `clickStart(page)`;
- `waitForRoom(page)`;
- `defaultNickname(index)`;
- `ScenarioUnavailableError`.

Eles usam ARIA/testids comuns e podem precisar de ajuste se a T019E mudar a home. Ajuste o cenário, não o app.

## Estratégia recomendada

1. **Cache por viewport:** crie uma sala de 2 pessoas e uma de 8 pessoas uma vez por viewport; reuse os contextos entre `preparacao`, `mesa-2`…`mesa-8`, `espera` e `observador`.
2. **Uma sala por estado sensível:** pausa, última, denúncia, resultado e resultado sem vencedor precisam de uma partida própria. Use `prepare` para criar, jogar e parar no estado; `teardownState` fecha os contextos extras.
3. **Observador:** entre na sala com um contexto extra e mantenha a página principal na mesa pública; `state.id === 'observador'` deve medir a página do observador, sem mão.
4. **Gaveta:** abra por “Conversa”/“Sala”, selecione a aba e deixe o overlay aberto. O `keyboardProbe` fecha com Escape depois da captura.
5. **Acessibilidade:** mantenha o foco inicial previsível. Se quiser que o teste de retorno de foco valide o opener, guarde o elemento em `window.__t019fOpener` no contexto da página.
6. **Estados destrutivos:** não reaproveite a mesma sala para pausa/resultado; o estado muda.

## Sem cenário

Para inspeção rápida de uma tela já aberta:

```sh
node docs/work/reports/assets/T019F/run.mjs \
  --mode=app --url=http://127.0.0.1:3100 \
  --state=mesa-4 \
  --states-file=/tmp/t019f-states.json
```

`/tmp/t019f-states.json`:

```json
{
  "mesa-4": "/sala/ABC234"
}
```

Isso mede a página, mas não garante que o estado seja mesa-4; confira `state` na medição e as capturas. Para a matriz oficial, use cenário.

## O que o cenário não deve fazer

- alterar `apps/web`, `packages`, servidor ou protocolo;
- iniciar/reiniciar servidor de produção;
- usar o perfil pessoal do Chrome;
- declarar aceite (o report e a decisão são da T019F/orquestrador).
