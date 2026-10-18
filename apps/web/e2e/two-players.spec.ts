import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { challengeDeck, scenarioDeck } from './deck';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T003/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('create-room-button').click();
  const link = page.getByTestId('invite-link');
  await expect(link).toBeVisible();
  const href = await link.textContent();
  if (href === null) throw new Error('link de convite ausente');
  return href;
}

async function joinRoom(page: Page, inviteUrl: string, nickname: string, avatar: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId(`avatar-option-${avatar}`).click();
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('lobby-participant').nth(1)).toBeVisible();
}

async function setNextDeck(page: Page, deck: string[]): Promise<void> {
  const result = await page.evaluate((cards) => window.__trettaTest!.setNextDeck(cards), deck);
  expect(result.ok).toBe(true);
}

async function waitMyTurn(page: Page): Promise<void> {
  await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez');
}

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

async function readyBoth(desktop: Page, mobile: Page): Promise<void> {
  await desktop.getByTestId('ready-toggle').click();
  await mobile.getByTestId('ready-toggle').click();
  await expect(desktop.getByTestId('start-round-button')).toBeEnabled();
  await desktop.getByTestId('start-round-button').click();
  await expect(desktop.getByTestId('my-hand')).toBeVisible();
  await expect(mobile.getByTestId('my-hand')).toBeVisible();
}

test('rodada completa com desktop e celular', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(2);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-lobby.png') });
  await pageB.screenshot({ path: join(shotsDir, 'mobile-lobby.png') });

  await setNextDeck(pageA, scenarioDeck());
  await readyBoth(pageA, pageB);

  await expect(pageA.getByTestId('turn-indicator')).toHaveText('Sua vez');
  await expect(pageB.getByTestId('seat-Ana')).toBeVisible();
  await expect(pageB.getByTestId('card-blue-1-1')).toBeVisible();
  await expect(pageB.getByTestId('card-red-1-1')).toHaveCount(0);

  await playCard(pageA, 'red-1-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-2-1');

  await waitMyTurn(pageB);
  await pageB.getByTestId('draw-button').click();
  await expect(pageB.getByTestId('after-draw-hint')).toBeVisible();
  await pageB.getByTestId('card-red-7-1').click();
  await pageB.getByTestId('play-button').click();
  await pageA.screenshot({ path: join(shotsDir, 'desktop-table.png') });
  await pageB.screenshot({ path: join(shotsDir, 'mobile-table.png') });

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
  await expect(pageB.getByTestId('last-card-note')).toContainText('Ana');

  await drawAndPass(pageB);

  await waitMyTurn(pageA);
  await pageA.getByTestId('card-wild-color-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageA.getByTestId('color-chooser')).toBeVisible();
  await pageA.getByTestId('color-option-green').click();

  await expect(pageA.getByTestId('results-winner')).toContainText('Ana venceu');
  await expect(pageB.getByTestId('results-winner')).toContainText('Ana venceu');
  await expect(pageA.getByTestId('score-Ana')).toContainText('1 rodada');
  await expect(pageA.getByTestId('score-Bia')).toContainText('0 rodada');
  await pageA.screenshot({ path: join(shotsDir, 'desktop-results.png') });
  await pageB.screenshot({ path: join(shotsDir, 'mobile-results.png') });

  await pageA.getByTestId('return-to-lobby-button').click();
  await expect(pageA.getByTestId('ready-toggle')).toBeVisible();
  await expect(pageA.getByTestId('lobby-participant').getByText('1 v.')).toBeVisible();

  await readyBoth(pageA, pageB);
  await expect(pageA.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(7);
  await expect(pageB.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(7);

  await desktop.close();
  await mobile.close();
});

test('denúncia pela interface e entrada durante a rodada', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, challengeDeck());
  await readyBoth(pageA, pageB);

  await playCard(pageA, 'red-1-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-2-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-3-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-4-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-5-1');
  await drawAndPass(pageB);

  await playCard(pageA, 'red-6-1');
  await expect(pageA.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(1);

  await expect(pageB.getByTestId('challenge-button')).toBeVisible();
  await pageB.screenshot({ path: join(shotsDir, 'mobile-challenge.png') });
  await pageB.getByTestId('challenge-button').click();
  await expect(pageA.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(3);

  const watcherContext = await browser.newContext({ ...devices['Pixel 7'] });
  const pageC = await watcherContext.newPage();
  await pageC.goto(inviteUrl);
  await pageC.getByTestId('join-name-input').fill('Cai');
  await pageC.getByTestId('join-room-button').click();
  await expect(pageC.getByTestId('waiting-banner')).toBeVisible();
  await expect(pageC.getByTestId('my-hand')).toHaveCount(0);
  await pageC.screenshot({ path: join(shotsDir, 'mobile-waiting.png') });

  await desktop.close();
  await mobile.close();
  await watcherContext.close();
});

test('convite inválido mostra mensagem compreensível', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/sala/ZZZZZZ');
  await page.getByTestId('join-name-input').fill('Bia');
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('error-banner')).toContainText('Sala não encontrada');
  await context.close();
});
