import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { moodDeck, reverseDeck, scenarioDeck } from './deck';
import {
  closeDrawer,
  createRoom,
  drawAndPass,
  joinRoom,
  openDrawer,
  playCard,
  readyAll,
  setEffectVariant,
  setNextDeck,
  waitMyTurn,
} from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T019F/effects/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

function effectNode(page: Page, category: string): Locator {
  return page.getByTestId(`auto-effect-${category}`);
}

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

async function installSoundCounter(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const target = window as unknown as { __oscCount?: number; AudioContext?: { prototype: { createOscillator(): unknown } } };
    target.__oscCount = 0;
    const proto = target.AudioContext?.prototype;
    if (proto === undefined) return;
    const original = proto.createOscillator;
    proto.createOscillator = function (this: unknown): unknown {
      target.__oscCount = (target.__oscCount ?? 0) + 1;
      return original.call(this);
    };
  });
}

async function oscCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __oscCount?: number }).__oscCount ?? 0);
}

async function captureStable(page: Page, selector: string, filename: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const node = document.querySelector(sel);
          if (node === null) return false;
          const style = getComputedStyle(node);
          if (Number.parseFloat(style.opacity) < 0.95) return false;
          const matrix = new DOMMatrixReadOnly(style.transform);
          return Math.abs(matrix.e) < 40 && Math.abs(matrix.f) < 40;
        }, selector),
      { timeout: 5_000 },
    )
    .toBe(true);
  await page.screenshot({ path: join(shotsDir, filename) });
}

test('efeitos automáticos chegam iguais à mesa e a quem aguarda, com fila serial', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageW = await watcherContext.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, moodDeck());
  await readyAll(pageA, pageB);
  await waitMyTurn(pageA);
  await joinAsWatcher(pageW, inviteUrl, 'Cai');
  await expect(pageW.getByTestId('public-table')).toBeVisible();

  // Bloqueio com variação fixada: todos recebem o mesmo id e legenda.
  await setEffectVariant(pageA, 'brick-wall');
  await pageA.getByTestId('card-red-skip-1').click();
  await pageA.getByTestId('play-button').click();
  const blockedA = effectNode(pageA, 'blocked');
  const blockedW = effectNode(pageW, 'blocked');
  await expect(blockedA).toBeVisible();
  await expect(blockedA).toHaveAttribute('data-effect-variant', 'brick-wall');
  await expect(blockedW).toBeVisible();
  const blockedId = await blockedA.getAttribute('data-effect-id');
  if (blockedId === null) throw new Error('efeito sem id');
  await expect(blockedW).toHaveAttribute('data-effect-id', blockedId);
  await captureStable(pageA, '[data-effect-id]', 'blocked-queue-first.png');

  // A jogada seguinte entra na fila: só uma apresentação por vez.
  await setEffectVariant(pageA, 'cards-rain');
  await pageA.getByTestId('card-red-draw-two-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageA.locator('[data-effect-id]')).toHaveCount(1);
  await expect(blockedA).toHaveAttribute('data-effect-id', blockedId);
  const penaltyA = effectNode(pageA, 'penaltyDraw');
  await expect(penaltyA).toBeVisible({ timeout: 6_000 });
  await expect(penaltyA).toHaveAttribute('data-effect-variant', 'cards-rain');
  const penaltyId = await penaltyA.getAttribute('data-effect-id');
  if (penaltyId === null) throw new Error('efeito sem id');
  await expect(effectNode(pageW, 'penaltyDraw')).toHaveAttribute('data-effect-id', penaltyId);
  await captureStable(pageW, '[data-effect-id]', 'penalty-queue-second.png');

  await desktop.close();
  await mobile.close();
  await watcherContext.close();
});

test('Inversão com três pessoas apresenta a variação escolhida', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [pageA, pageB, pageC] = pages;
  if (pageA === undefined || pageB === undefined || pageC === undefined) throw new Error('contextos ausentes');

  try {
    const inviteUrl = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, inviteUrl, 'Bia');
    await joinRoom(pageC, inviteUrl, 'Cai');
    await setNextDeck(pageA, reverseDeck());
    await readyAll(pageA, pageB, pageC);
    await waitMyTurn(pageA);
    await setEffectVariant(pageA, 'windmill');
    await playCard(pageA, 'red-reverse-1');
    const effect = effectNode(pageA, 'directionReversed');
    await expect(effect).toBeVisible();
    await expect(effect).toHaveAttribute('data-effect-variant', 'windmill');
    await expect(pageB.getByTestId('auto-effect-directionReversed')).toBeVisible();
    await expect(pageC.getByTestId('auto-effect-directionReversed')).toBeVisible();
    await expect(pageA.getByTestId('table-direction')).toContainText('anti-horário');
    await captureStable(pageB, '[data-effect-id]', 'reverse-windmill.png');
  } finally {
    for (const context of contexts) await context.close();
  }
});

test('vitória com confete e troféu preservando a sequência final', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  await playCard(pageA, 'red-1-1');
  await drawAndPass(pageB);
  await playCard(pageA, 'red-2-1');
  await waitMyTurn(pageB);
  await pageB.getByTestId('draw-button').click();
  await expect(pageB.getByTestId('after-draw-hint')).toBeVisible();
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

  await setEffectVariant(pageA, 'confetti');
  await pageA.getByTestId('card-wild-color-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageA.getByTestId('color-chooser')).toBeVisible();
  await pageA.getByTestId('color-option-green').click();
  await expect(pageA.getByTestId('results-winner')).toContainText('Ana venceu');
  const victory = effectNode(pageA, 'victory');
  await expect(victory).toBeVisible();
  await expect(victory).toHaveAttribute('data-effect-variant', 'confetti');
  const victoryId = await victory.getAttribute('data-effect-id');
  if (victoryId === null) throw new Error('efeito sem id');
  await expect(pageA.getByTestId(`auto-effect-caption-${victoryId}`)).toHaveText('Ana venceu a rodada!');
  await expect(pageB.getByTestId('auto-effect-victory')).toHaveAttribute('data-effect-id', victoryId);
  await captureStable(pageB, '[data-effect-id]', 'victory-confetti-mobile.png');

  await desktop.close();
  await mobile.close();
});

test('preferências na gaveta controlam animação e som; histórico vive na aba', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const systemContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await installSoundCounter(desktop);
  await installSoundCounter(mobile);
  await installSoundCounter(systemContext);
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageC = await systemContext.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, moodDeck());
  await readyAll(pageA, pageB);
  await joinAsWatcher(pageC, inviteUrl, 'Cai');

  // A gaveta é a única casa das preferências; o sistema reduzido aparece nela.
  await openDrawer(pageC, 'sala');
  await expect(pageC.getByTestId('pref-animations-note')).toBeVisible();
  await expect(pageC.getByTestId('pref-animations-full')).toBeChecked();
  await closeDrawer(pageC);

  await openDrawer(pageA, 'sala');
  await pageA.getByTestId('pref-animations-reduced').check();
  await pageA.getByTestId('pref-sound-mute').check();
  await closeDrawer(pageA);
  await expect(pageA.locator('.tv2-table-root')).not.toHaveCount(0);

  await waitMyTurn(pageA);
  const mutedBaseline = await oscCount(pageA);
  await setEffectVariant(pageA, 'brick-wall');
  await playCard(pageA, 'red-skip-1');
  const blocked = effectNode(pageA, 'blocked');
  await expect(blocked).toBeVisible();
  await expect(pageA.getByTestId('effect-overlay')).toHaveAttribute('data-anim', 'reduced');
  await expect(pageC.getByTestId('effect-overlay')).toHaveAttribute('data-anim', 'reduced');
  await expect(pageB.getByTestId('effect-overlay')).toHaveAttribute('data-anim', 'full');
  await expect.poll(() => oscCount(pageB), { timeout: 5_000 }).toBeGreaterThan(0);
  expect(await oscCount(pageA)).toBe(mutedBaseline);
  await captureStable(pageA, '[data-effect-id]', 'pref-reduced-muted.png');

  // Desligada mantém o aviso estático, sem animação.
  await openDrawer(pageA, 'sala');
  await pageA.getByTestId('pref-animations-off').check();
  await closeDrawer(pageA);
  await setEffectVariant(pageA, 'stumble');
  await playCard(pageA, 'red-draw-two-1');
  await expect(pageA.getByTestId('effect-overlay')).toHaveAttribute('data-anim', 'off');
  await expect(pageA.getByTestId('turn-indicator')).toBeVisible();

  // Histórico agora é a aba Histórico da gaveta, com os eventos reais.
  await openDrawer(pageA, 'historico');
  await expect(pageA.getByTestId('event-feed')).toBeVisible();
  await expect(pageA.getByTestId('event-feed').locator('li').first()).toBeVisible();
  await pageA.screenshot({ path: join(shotsDir, 'drawer-history.png') });
  await closeDrawer(pageA);

  // Reload recupera as escolhas; o histórico continua na gaveta.
  await pageA.reload();
  await expect(pageA.getByTestId('my-hand')).toBeVisible({ timeout: 60_000 });
  await openDrawer(pageA, 'sala');
  await expect(pageA.getByTestId('pref-animations-off')).toBeChecked();
  await expect(pageA.getByTestId('pref-sound-mute')).toBeChecked();
  await closeDrawer(pageA);
  await openDrawer(pageA, 'historico');
  await expect(pageA.getByTestId('event-feed')).toBeVisible();
  await closeDrawer(pageA);

  await desktop.close();
  await mobile.close();
  await systemContext.close();
});
