/**
 * Cenário padrão para `--mode=app`.
 *
 * Cobre as telas que não dependem de uma partida preparada: home, preview,
 * treino/bots e rotas de erro. Estados de mesa, pausa, última, denúncia,
 * resultado e gaveta precisam de um cenário de jogo (veja scenarios/README.md)
 * ou de uma URL preparada em `--states-file`.
 */
import {
  ScenarioUnavailableError,
  clickStart,
  clickTrain,
  fillNickname,
  waitForRoom
} from '../lib/scenario.mjs';

const SIMPLE_ROUTES = {
  home: '/',
  preview: '/preview',
  'erro-link': '/sala/LINK-INVALIDO'
};

export async function createScenario({ baseURL, urlMap = {}, log = () => {} }) {
  return {
    async prepare(state, { page }) {
      if (urlMap[state.id]) {
        await page.goto(new URL(urlMap[state.id], baseURL).href, { waitUntil: 'domcontentloaded' });
        return;
      }

      if (SIMPLE_ROUTES[state.id]) {
        await page.goto(new URL(SIMPLE_ROUTES[state.id], baseURL).href, { waitUntil: 'domcontentloaded' });
        return;
      }

      if (state.id === 'treino' || state.id === 'bots') {
        await page.goto(new URL('/', baseURL).href, { waitUntil: 'domcontentloaded' });
        await fillNickname(page, 'Bia');
        await clickTrain(page);
        await waitForRoom(page);
        await clickStart(page);
        await page.waitForTimeout(600);
        log('treino preparado; se a partida não iniciou, o cenário precisa de ajuste de seletores');
        return;
      }

      throw new ScenarioUnavailableError(
        `Estado "${state.id}" exige um cenário de jogo ou --states-file. ` +
          'Veja docs/work/reports/assets/T019F/scenarios/README.md.'
      );
    }
  };
}
