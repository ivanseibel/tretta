import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, drawAndPass, handIds, isMyTurn, joinRoom, readyAll, setNextDeck, waitMyTurn } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T004/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

test('atualizar a página recupera identidade, mão e fase após compra; a conexão some e volta', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Avança até a vez de Bia e faz a compra que deixa a fase after-draw.
  if (!(await isMyTurn(pageB))) {
    await drawAndPass(pageA);
  }
  await waitMyTurn(pageB);
  await pageB.getByTestId('draw-button').click();
  await expect(pageB.getByTestId('after-draw-hint')).toBeVisible();
  const handBefore = await handIds(pageB);
  expect(handBefore).toHaveLength(8);

  // Atualizar a página: a credencial do próprio navegador recupera a mesma identidade.
  await pageB.reload();
  await expect(pageB.getByTestId('my-hand')).toBeVisible();
  await expect(pageB.getByTestId('join-name-input')).toHaveCount(0);
  await expect(pageB.getByTestId('after-draw-hint')).toBeVisible();
  expect(await handIds(pageB)).toEqual(handBefore);
  await pageB.screenshot({ path: join(shotsDir, 'mobile-recuperacao-apos-compra.png') });

  // A mão recuperada continua jogável.
  await pageB.getByTestId('pass-button').click();
  await waitMyTurn(pageA);
  const handABefore = await handIds(pageA);
  await pageA.reload();
  await expect(pageA.getByTestId('my-hand')).toBeVisible();
  expect(await handIds(pageA)).toEqual(handABefore);

  // Perda e recuperação de conexão aparecem no cliente e bloqueiam envios.
  await pageB.evaluate(() => window.__trettaTest!.disconnect());
  await expect(pageB.getByTestId('connection-lost')).toBeVisible();
  await expect(pageB.getByTestId('leave-button')).toBeDisabled();
  await expect(pageB.getByTestId('my-hand')).toBeVisible();
  await pageB.screenshot({ path: join(shotsDir, 'mobile-conexao-perdida.png') });

  // A queda pausa a mesa para a outra pessoa, que vê o motivo e a ausência.
  await expect(pageA.getByTestId('pause-panel')).toBeVisible();
  await expect(pageA.getByTestId('turn-indicator')).toHaveText('Rodada pausada');

  await pageB.evaluate(() => window.__trettaTest!.connect());
  await expect(pageB.getByTestId('connection-lost')).toHaveCount(0, { timeout: 20000 });
  await expect(pageB.getByTestId('my-hand')).toBeVisible();
  expect(await handIds(pageB)).toEqual(handBefore);

  // A mesa segue de pé para quem ficou: a rodada retoma depois da reconexão.
  await expect(pageA.getByTestId('pause-panel')).toHaveCount(0, { timeout: 20000 });
  await expect(pageA.getByTestId('turn-indicator')).toContainText(/Sua vez|Vez de/);

  await desktop.close();
  await mobile.close();
});
