import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck, waitMyTurn } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T004/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function playCard(page: Page, cardId: string): Promise<void> {
  await waitMyTurn(page);
  await page.getByTestId(`card-${cardId}`).click();
  await page.getByTestId('play-button').click();
}

async function drawAndPass(page: Page): Promise<void> {
  await waitMyTurn(page);
  await page.getByTestId('draw-button').click();
  await page.getByTestId('pass-button').click();
}

test('vitórias humanas permanecem no placar depois da saída e a vaga liberada aceita pessoa nova', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const third = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Rodada determinística: Ana vence com o coringa.
  await playCard(pageA, 'red-1-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-2-1');
  await waitMyTurn(pageB);
  await pageB.getByTestId('draw-button').click();
  await pageB.getByTestId('card-red-7-1').click();
  await pageB.getByTestId('play-button').click();
  await playCard(pageA, 'red-3-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-4-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-5-1');
  await drawAndPass(pageB);
  await waitMyTurn(pageA);
  await pageA.getByTestId('card-red-6-1').click();
  await pageA.getByTestId('last-card-checkbox').check();
  await pageA.getByTestId('play-button').click();
  await drawAndPass(pageB);
  await waitMyTurn(pageA);
  await pageA.getByTestId('card-wild-color-1').click();
  await pageA.getByTestId('play-button').click();
  await pageA.getByTestId('color-option-green').click();

  await expect(pageA.getByTestId('results-winner')).toContainText('Ana venceu');
  await expect(pageB.getByTestId('score-Ana')).toContainText('1 rodada');

  // Ana sai na tela de resultado: a vitória fica no placar histórico da sala.
  await pageA.getByTestId('leave-button').click();
  await expect(pageA).toHaveURL('/');
  await expect(pageB.getByTestId('results-winner')).toContainText('Ana venceu');
  await expect(pageB.getByTestId('score-Ana')).toContainText('1 rodada');
  await expect(pageB.getByTestId('score-Ana')).toContainText('saiu da sala');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-placar-apos-saida.png') });

  // Bia vira anfitriã e reabre a preparação com o placar histórico visível.
  await expect(pageB.getByTestId('return-to-lobby-button')).toBeVisible();
  await pageB.getByTestId('return-to-lobby-button').click();
  await expect(pageB.getByTestId('lobby-participant')).toHaveCount(1);
  await expect(pageB.getByTestId('history-Ana')).toContainText('1 v.');

  // Pessoa nova ocupa a vaga liberada; o placar de Ana continua na sala.
  const pageC = await third.newPage();
  await joinRoom(pageC, inviteUrl, 'Cai', 'sapo');
  await expect(pageB.getByTestId('lobby-participant')).toHaveCount(2);
  await expect(pageB.getByTestId('history-Ana')).toContainText('1 v.');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-lobby-placar-conservado.png') });

  await desktop.close();
  await mobile.close();
  await third.close();
});
