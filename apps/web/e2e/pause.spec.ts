import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T004/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

test('pausa por queda, substituição após o prazo e retorno pela mesma vaga', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Fechar a página de Bia é uma desconexão real: a mesa pausa para todo mundo.
  await pageB.close();
  await expect(pageA.getByTestId('pause-panel')).toBeVisible();
  await expect(pageA.getByTestId('turn-indicator')).toHaveText('Rodada pausada');
  await expect(pageA.getByTestId('draw-button')).toHaveCount(0);
  await expect(pageA.getByTestId('pause-waiting-host')).toHaveCount(0);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-pausa.png') });

  // Depois do prazo encurtado do ambiente de teste, o anfitrião pode substituir.
  const substitute = pageA.getByTestId('substitute-Bia');
  await expect(substitute).toBeVisible({ timeout: 15000 });
  await expect(pageA.getByTestId('end-round-button').first()).toBeVisible();
  await substitute.click();

  await expect(pageA.getByTestId('pause-panel')).toHaveCount(0);
  await expect(pageA.getByTestId('seat-Bia').getByText('substituto')).toBeVisible();
  await expect(pageA.locator('[data-testid="seat-circuit"] .seat')).toHaveCount(2);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-substituto.png') });

  // Bia volta pela credencial do próprio navegador e retoma a mão do assento.
  const reopened = await mobile.newPage();
  await reopened.goto(inviteUrl);
  await expect(reopened.getByTestId('my-hand')).toBeVisible();
  await expect(reopened.getByTestId('join-name-input')).toHaveCount(0);
  await expect(pageA.getByTestId('seat-Bia').getByText('substituto')).toHaveCount(0);
  const handCount = await reopened.getByTestId('my-hand').locator('[data-testid^="card-"]').count();
  expect(handCount).toBeGreaterThanOrEqual(7);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-retorno.png') });

  await desktop.close();
  await mobile.close();
});

test('anfitrião encerra a rodada sem vencedor e reabre a preparação', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Só o anfitrião tem o controle; Bia não vê o botão.
  await expect(pageB.getByTestId('end-round-button')).toHaveCount(0);
  await pageA.getByTestId('end-round-button').first().click();

  await expect(pageA.getByTestId('results-winner')).toContainText('sem vencedor');
  await expect(pageB.getByTestId('results-winner')).toContainText('sem vencedor');
  await expect(pageA.getByTestId('score-Ana')).toContainText('0 rodada');
  await expect(pageB.getByTestId('score-Bia')).toContainText('0 rodada');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-sem-vencedor.png') });

  // Nova preparação com prontidão renovada.
  await pageA.getByTestId('return-to-lobby-button').click();
  await expect(pageA.getByTestId('start-round-button')).toBeDisabled();
  await pageA.getByTestId('ready-toggle').click();
  await pageB.getByTestId('ready-toggle').click();
  await expect(pageA.getByTestId('start-round-button')).toBeEnabled();
  await pageA.getByTestId('start-round-button').click();
  await expect(pageA.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(7);

  await desktop.close();
  await mobile.close();
});
