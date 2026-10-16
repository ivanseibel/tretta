import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck, waitMyTurn } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T005B/', import.meta.url));
const adjustDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T005B-adjustments/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });
mkdirSync(adjustDir, { recursive: true });

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

async function sendTaunt(viewer: Page, sender: Page, type: string, target: string): Promise<void> {
  // Efeito é transitório: quem envia e quem recebe precisam conferir juntos.
  await sender.getByTestId('taunt-type').selectOption(type);
  await sender.getByTestId('taunt-target').selectOption({ label: target });
  await sender.getByTestId('taunt-send').click();
  await expect(viewer.getByTestId(`taunt-effect-${type}`)).toBeVisible();
}

/**
 * Captura de evidência com a legenda do tipo correspondente legível:
 * espera a apresentação anterior sumir (só a nossa fica) e o efeito assentar
 * no centro (transform quase nulo — fase 40–70% da keyframe), antes do PNG,
 * dentro da janela de ~3 s.
 */
async function captureTaunt(viewer: Page, caption: string, filename: string): Promise<void> {
  const captions = viewer.locator('[data-testid^="taunt-caption-"]');
  await expect(captions).toHaveCount(1);
  await expect(viewer.getByText(caption)).toBeVisible();
  await expect
    .poll(
      () =>
        viewer.evaluate(() => {
          const node = document.querySelector('[data-testid^="taunt-effect-"]');
          if (node === null) return false;
          const style = getComputedStyle(node);
          if (Number.parseFloat(style.opacity) < 0.95) return false;
          const matrix = new DOMMatrixReadOnly(style.transform);
          return Math.abs(matrix.e) < 40 && Math.abs(matrix.f) < 40;
        }),
      { timeout: 4_000 },
    )
    .toBe(true);
  await viewer.screenshot({ path: join(adjustDir, filename), fullPage: true });
}

test('quatro provocações com emissores distintos, recusa de cooldown e jogada com efeito', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await expect(pageA.getByTestId('taunt-panel')).toBeVisible();

  // Três emissores na preparação: Ana, Bia e o terceiro jogador.
  const thirdContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageC = await thirdContext.newPage();
  await joinRoom(pageC, inviteUrl, 'Cai', 'raposa');
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(3);

  await sendTaunt(pageB, pageA, 'tomate', 'Bia');
  await expect(pageA.getByText('Ana mandou tomate voador em Bia!')).toBeVisible();
  await pageA.screenshot({ path: join(shotsDir, 'desktop-taunt-tomate.png'), fullPage: true });
  await captureTaunt(pageA, 'Ana mandou tomate voador em Bia!', 'desktop-tomate-legenda.png');

  await sendTaunt(pageA, pageB, 'torta', 'Ana');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-taunt-torta.png'), fullPage: true });
  await captureTaunt(pageB, 'Bia mandou torta na cara em Ana!', 'mobile-torta-legenda.png');

  await sendTaunt(pageA, pageC, 'risadas', 'Ana');
  await pageC.screenshot({ path: join(shotsDir, 'desktop-third-taunt-risadas.png'), fullPage: true });
  await captureTaunt(pageC, 'Cai mandou chuva de risadas em Ana!', 'desktop-risadas-legenda.png');

  // O mesmo emissor cai no cooldown: recusa explicada com seleção preservada.
  await pageA.getByTestId('taunt-type').selectOption('choro');
  await pageA.getByTestId('taunt-target').selectOption({ label: 'Bia' });
  await pageA.getByTestId('taunt-send').click();
  await expect(pageA.getByTestId('taunt-error')).toContainText('Você pode provocar de novo em');
  expect(await pageA.getByTestId('taunt-type').inputValue()).toBe('choro');
  expect(await pageA.getByTestId('taunt-target').inputValue()).toBeTruthy();
  await pageA.screenshot({ path: join(shotsDir, 'desktop-taunt-cooldown.png'), fullPage: true });

  // Depois do cooldown o quarto tipo passa; o efeito some sozinho em ~3s.
  await pageA.waitForTimeout(15_500);
  await sendTaunt(pageB, pageA, 'choro', 'Bia');
  await captureTaunt(pageA, 'Ana mandou choro dramático em Bia!', 'desktop-choro-legenda.png');
  await expect(pageA.getByTestId('taunt-effect-choro')).toBeHidden({ timeout: 5_000 });

  // Durante a rodada: quem aguarda provoca e a jogada segue normalmente.
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB, pageC);
  await waitMyTurn(pageA);

  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageW = await watcherContext.newPage();
  await joinAsWatcher(pageW, inviteUrl, 'Davi');
  await expect(pageW.getByTestId('public-table')).toBeVisible();

  await sendTaunt(pageA, pageW, 'tomate', 'Ana');
  await expect(pageW.getByTestId('taunt-panel')).toBeVisible();
  await pageW.screenshot({ path: join(shotsDir, 'desktop-waiting-taunt.png'), fullPage: true });

  await pageA.getByTestId('card-red-1-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageB.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-1-1');
  await pageA.screenshot({ path: join(shotsDir, 'desktop-table-taunt.png'), fullPage: true });

  await desktop.close();
  await mobile.close();
  await thirdContext.close();
  await watcherContext.close();
});
