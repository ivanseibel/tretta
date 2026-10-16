import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { botDeck, challengeDeck, moodDeck, penaltyDeck, reverseDeck, scenarioDeck, twoSkipsDeck } from './deck';
import {
  createRoom,
  drawAndPass,
  isMyTurn,
  joinRoom,
  playCard,
  readyAll,
  setEffectVariant,
  setNextDeck,
  waitMyTurn,
} from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T005C/', import.meta.url));
const adjustmentShotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T005C-adjustments/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });
mkdirSync(adjustmentShotsDir, { recursive: true });

function effectNode(page: Page, category: string): Locator {
  return page.getByTestId(`auto-effect-${category}`);
}

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

async function sendTaunt(sender: Page, type: string, target: string): Promise<void> {
  await sender.getByTestId('taunt-type').selectOption(type);
  await sender.getByTestId('taunt-target').selectOption({ label: target });
  await sender.getByTestId('taunt-send').click();
}

/**
 * Captura estável da apresentação: espera a fase da keyframe com opacidade alta
 * e deslocamento quase nulo (ou o modo sem animação, já estável) antes do PNG.
 */
async function captureStable(
  page: Page,
  selector: string,
  filename: string,
  directory = shotsDir,
): Promise<void> {
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
  await page.screenshot({ path: join(directory, filename), fullPage: true });
}

/** Conta criações de oscilador no navegador real: instrumentação do caminho de áudio. */
async function installSoundCounter(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const target = window as unknown as {
      __oscCount?: number;
      AudioContext?: { prototype: { createOscillator(): unknown } };
    };
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

async function turnPage(pages: readonly Page[]): Promise<Page> {
  await expect
    .poll(
      async () => {
        for (const page of pages) {
          if ((await page.getByTestId('turn-indicator').textContent()) === 'Sua vez') return true;
        }
        return false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  for (const page of pages) {
    if ((await page.getByTestId('turn-indicator').textContent()) === 'Sua vez') return page;
  }
  throw new Error('nenhuma página com a vez após o poll');
}

async function hasCard(page: Page, cardId: string): Promise<boolean> {
  return (await page.getByTestId(`card-${cardId}`).count()) > 0;
}

async function driveToReverse(pages: readonly Page[], variant: 'boomerang' | 'windmill'): Promise<Page> {
  for (let step = 0; step < 10; step++) {
    const current = await turnPage(pages);
    const holdsFirst = await hasCard(current, 'red-reverse-1');
    const holdsSecond = await hasCard(current, 'red-reverse-2');
    if (holdsFirst || holdsSecond) {
      await current.getByTestId(holdsFirst ? 'card-red-reverse-1' : 'card-red-reverse-2').click();
      await current.getByTestId('play-button').click();
      return current;
    }
    await current.getByTestId('draw-button').click();
    await current.getByTestId('pass-button').click();
  }
  throw new Error(`ninguém jogou Inversão para ${variant}`);
}

/** Sequência de duas rodadas de scenarioDeck até a carta final, como no teste de duas pessoas. */
async function playScenarioToFinal(pageA: Page, pageB: Page): Promise<void> {
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
}

test('fila serial de efeitos com provocação, jogada durante apresentação e expectador', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageW = await watcherContext.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, penaltyDeck());
  await readyAll(pageA, pageB);
  await waitMyTurn(pageA);

  await joinAsWatcher(pageW, inviteUrl, 'Davi');
  await expect(pageW.getByTestId('public-table')).toBeVisible();

  await setEffectVariant(pageA, 'cards-rain');
  await playCard(pageA, 'red-draw-two-1');

  // Lote único: compra e bloqueio; a mesma variação chega aos três clientes.
  const penalty = effectNode(pageA, 'penaltyDraw');
  await expect(penalty).toBeVisible();
  await expect(penalty).toHaveAttribute('data-effect-variant', 'cards-rain');
  const penaltyId = await penalty.getAttribute('data-effect-id');
  if (penaltyId === null) throw new Error('efeito sem id');
  await expect(pageA.getByTestId(`auto-effect-caption-${penaltyId}`)).toHaveText('Bia comprou 2 cartas de penalidade');
  await expect(effectNode(pageB, 'penaltyDraw')).toHaveAttribute('data-effect-id', penaltyId);
  await expect(effectNode(pageW, 'penaltyDraw')).toHaveAttribute('data-effect-id', penaltyId);
  await expect(pageB.getByTestId(`auto-effect-caption-${penaltyId}`)).toHaveText('Bia comprou 2 cartas de penalidade');

  await captureStable(pageA, '[data-effect-id]', 'queue-1-penalty-rain.png');

  // Jogada durante a apresentação: a fila não trava mesa nem comandos.
  await playCard(pageA, 'red-1-1');
  await expect(pageA.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-1-1');
  await expect(penalty).toBeVisible();
  await expect(pageA.getByTestId('taunt-effect-tomate')).toHaveCount(0);

  // Provocação enviada no meio da fila espera a vez, sem se sobrepor.
  await sendTaunt(pageB, 'tomate', 'Ana');
  await expect(pageA.getByTestId('taunt-effect-tomate')).toHaveCount(0);

  const blocked = effectNode(pageA, 'blocked');
  await expect(blocked).toBeVisible();
  await expect(blocked).toHaveAttribute('data-effect-variant', /^(brick-wall|stumble)$/);
  const blockedId = await blocked.getAttribute('data-effect-id');
  if (blockedId === null) throw new Error('bloqueio sem id');
  await expect(effectNode(pageB, 'blocked')).toHaveAttribute('data-effect-id', blockedId);
  await expect(effectNode(pageW, 'blocked')).toHaveAttribute('data-effect-id', blockedId);
  await expect(pageA.getByTestId('taunt-overlay').locator(':scope > *')).toHaveCount(1);
  await expect(pageA.getByTestId('taunt-effect-tomate')).toHaveCount(0);
  await captureStable(pageA, '[data-effect-id]', 'queue-2-blocked-serial.png');
  await captureStable(pageB, '[data-effect-id]', 'queue-2-blocked-mobile.png');
  await captureStable(pageW, '[data-effect-id]', 'queue-2-blocked-watcher.png');

  await expect(blocked).toBeHidden({ timeout: 5_000 });
  const taunt = pageA.getByTestId('taunt-effect-tomate');
  await expect(taunt).toBeVisible();
  await expect(pageA.getByText('Bia mandou tomate voador em Ana!')).toBeVisible();
  await expect(pageA.getByTestId('taunt-overlay').locator(':scope > *')).toHaveCount(1);
  await captureStable(pageA, '[data-taunt-id]', 'queue-3-taunt-after.png');
  await expect(taunt).toBeHidden({ timeout: 6_000 });
  await expect(pageA.getByTestId('taunt-overlay')).toHaveCount(0);

  await desktop.close();
  await mobile.close();
  await watcherContext.close();
});

test('as duas variações de Bloqueio e a compra por denúncia com variação fixada', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, twoSkipsDeck());
  await readyAll(pageA, pageB);

  await setEffectVariant(pageA, 'brick-wall');
  await playCard(pageA, 'red-skip-1');
  const first = effectNode(pageA, 'blocked');
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute('data-effect-variant', 'brick-wall');
  const firstId = await first.getAttribute('data-effect-id');
  if (firstId === null) throw new Error('efeito sem id');
  await expect(pageA.getByTestId(`auto-effect-caption-${firstId}`)).toHaveText('Bia perdeu a vez');
  await captureStable(pageA, '[data-effect-id]', 'variant-blocked-brick-wall.png');
  await expect(first).toBeHidden({ timeout: 5_000 });

  await setEffectVariant(pageA, 'stumble');
  await playCard(pageA, 'red-skip-2');
  const second = effectNode(pageA, 'blocked');
  await expect(second).toBeVisible();
  await expect(second).toHaveAttribute('data-effect-variant', 'stumble');
  await captureStable(pageA, '[data-effect-id]', 'variant-blocked-stumble.png');

  await desktop.close();
  await mobile.close();
});

test('itens consecutivos reiniciam a apresentação completa e o modo reduzido', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await context.newPage();
  const pageB = await guest.newPage();

  try {
    const inviteUrl = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
    await setNextDeck(pageA, twoSkipsDeck());
    await readyAll(pageA, pageB);
    await setEffectVariant(pageA, 'brick-wall');

    await playCard(pageA, 'red-skip-1');
    const blocked = effectNode(pageA, 'blocked');
    await expect(blocked).toHaveAttribute('data-effect-variant', 'brick-wall');
    await expect(blocked).toBeVisible();
    const firstId = await blocked.getAttribute('data-effect-id');
    if (firstId === null) throw new Error('primeiro efeito sem id');
    await blocked.evaluate((node) => {
      const target = window as unknown as { __firstEffect?: Element; __firstAnimation?: Animation };
      target.__firstEffect = node;
      target.__firstAnimation = node.getAnimations()[0];
    });

    await playCard(pageA, 'red-skip-2');
    await expect(pageA.getByTestId('event-feed').getByText('Bia foi bloqueado e perde a vez')).toHaveCount(2);
    await expect(blocked).toHaveAttribute('data-effect-id', firstId);
    await expect(pageA.getByTestId('taunt-overlay').locator(':scope > *')).toHaveCount(1);
    await expect
      .poll(() => blocked.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)), { timeout: 2_000 })
      .toBeGreaterThan(0.9);
    await captureStable(pageA, '[data-effect-id]', 'consecutive-full-first.png', adjustmentShotsDir);

    await expect
      .poll(() => blocked.getAttribute('data-effect-id'), { timeout: 4_000, intervals: [50] })
      .not.toBe(firstId);
    const secondId = await blocked.getAttribute('data-effect-id');
    if (secondId === null) throw new Error('segundo efeito sem id');
    const restarted = await blocked.evaluate((node) => {
      const target = window as unknown as { __firstEffect?: Element; __firstAnimation?: Animation };
      return {
        sameNode: target.__firstEffect === node,
        sameAnimation: target.__firstAnimation === node.getAnimations()[0],
      };
    });
    expect(restarted).toEqual({ sameNode: false, sameAnimation: false });
    await expect
      .poll(() => blocked.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)), { timeout: 2_000 })
      .toBeGreaterThan(0.9);
    await captureStable(pageA, '[data-effect-id]', 'consecutive-full-second.png', adjustmentShotsDir);
    await expect(blocked).toBeHidden({ timeout: 4_000 });

  } finally {
    await context.close();
    await guest.close();
  }

  const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const reducedGuest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const reducedA = await reducedContext.newPage();
  const reducedB = await reducedGuest.newPage();
  try {
    const inviteUrl = await createRoom(reducedA, 'Ana');
    await joinRoom(reducedB, inviteUrl, 'Bia', 'tucano');
    await setNextDeck(reducedA, penaltyDeck());
    await readyAll(reducedA, reducedB);
    await reducedA.getByTestId('pref-animations-reduced').check();

    await setEffectVariant(reducedA, 'cards-rain');
    await playCard(reducedA, 'red-draw-two-1');
    const penalty = effectNode(reducedA, 'penaltyDraw');
    await expect(penalty).toBeVisible();
    await expect(reducedA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'reduced');
    expect(await penalty.evaluate((node) => getComputedStyle(node).animationName)).toBe('mood-fade');
    await captureStable(reducedA, '[data-effect-id]', 'consecutive-reduced-penalty.png', adjustmentShotsDir);
    await expect(penalty).toBeHidden({ timeout: 4_000 });

    const blockedReduced = effectNode(reducedA, 'blocked');
    await expect(blockedReduced).toBeVisible();
    await expect(reducedA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'reduced');
    expect(await blockedReduced.evaluate((node) => getComputedStyle(node).animationName)).toBe('mood-fade');
    await expect
      .poll(() => blockedReduced.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity)), { timeout: 2_000 })
      .toBeGreaterThan(0.9);
    await captureStable(reducedA, '[data-effect-id]', 'consecutive-reduced-blocked.png', adjustmentShotsDir);
    await expect(blockedReduced).toBeHidden({ timeout: 4_000 });
  } finally {
    await reducedContext.close();
    await reducedGuest.close();
  }
});

test('denúncia por penalidade com a variação de avalanche em desktop e celular', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, challengeDeck());
  await readyAll(pageA, pageB);

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

  await setEffectVariant(pageA, 'cards-avalanche');
  await expect(pageB.getByTestId('challenge-button')).toBeVisible();
  await pageB.getByTestId('challenge-button').click();
  await expect(pageA.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(3);

  const penalty = effectNode(pageA, 'penaltyDraw');
  await expect(penalty).toBeVisible();
  await expect(penalty).toHaveAttribute('data-effect-variant', 'cards-avalanche');
  const penaltyId = await penalty.getAttribute('data-effect-id');
  if (penaltyId === null) throw new Error('efeito sem id');
  await expect(pageA.getByTestId(`auto-effect-caption-${penaltyId}`)).toHaveText('Ana comprou 2 cartas por denúncia');
  await expect(effectNode(pageB, 'penaltyDraw')).toHaveAttribute('data-effect-id', penaltyId);
  await captureStable(pageA, '[data-effect-id]', 'variant-penalty-challenge-avalanche.png');
  await captureStable(pageB, '[data-effect-id]', 'variant-penalty-challenge-avalanche-mobile.png');

  await desktop.close();
  await mobile.close();
});

test('Inversão com três pessoas: boomerangue e moinho em sequência', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const thirdContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageC = await thirdContext.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await joinRoom(pageC, inviteUrl, 'Cai', 'raposa');
  await setNextDeck(pageA, reverseDeck());
  await readyAll(pageA, pageB, pageC);
  const pages = [pageA, pageB, pageC] as const;

  await setEffectVariant(pageA, 'boomerang');
  const firstHolder = await driveToReverse(pages, 'boomerang');
  const first = effectNode(firstHolder, 'directionReversed');
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute('data-effect-variant', 'boomerang');
  const firstId = await first.getAttribute('data-effect-id');
  if (firstId === null) throw new Error('efeito sem id');
  await expect(firstHolder.getByTestId(`auto-effect-caption-${firstId}`)).toHaveText('Sentido anti-horário');
  const firstOther = firstHolder === pageA ? pageB : pageA;
  await expect(effectNode(firstOther, 'directionReversed')).toHaveAttribute('data-effect-id', firstId);
  await captureStable(firstHolder, '[data-effect-id]', 'variant-reverse-boomerang.png');

  await setEffectVariant(pageA, 'windmill');
  const secondHolder = await driveToReverse(pages, 'windmill');
  const second = effectNode(secondHolder, 'directionReversed');
  await expect(second).toBeVisible({ timeout: 20_000 });
  await expect(second).toHaveAttribute('data-effect-variant', 'windmill');
  const secondId = await second.getAttribute('data-effect-id');
  if (secondId === null) throw new Error('efeito sem id');
  await expect(secondHolder.getByTestId(`auto-effect-caption-${secondId}`)).toHaveText('Sentido horário');
  expect(secondId).not.toBe(firstId);
  const secondOther = secondHolder === pageA ? pageB : pageA;
  await expect(effectNode(secondOther, 'directionReversed')).toHaveAttribute('data-effect-id', secondId);
  await captureStable(secondHolder, '[data-effect-id]', 'variant-reverse-windmill.png');

  await desktop.close();
  await mobile.close();
  await thirdContext.close();
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

  await playScenarioToFinal(pageA, pageB);
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
  await expect(effectNode(pageB, 'victory')).toHaveAttribute('data-effect-id', victoryId);
  await captureStable(pageA, '[data-effect-id]', 'variant-victory-confetti.png');
  await captureStable(pageB, '[data-effect-id]', 'variant-victory-confetti-mobile.png');
  await expect(victory).toBeHidden({ timeout: 5_000 });

  await pageA.getByTestId('return-to-lobby-button').click();
  await expect(pageA.getByTestId('ready-toggle')).toBeVisible();
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  await playScenarioToFinal(pageA, pageB);
  await setEffectVariant(pageA, 'trophy');
  await pageA.getByTestId('card-wild-color-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageA.getByTestId('color-chooser')).toBeVisible();
  await pageA.getByTestId('color-option-green').click();

  await expect(pageA.getByTestId('results-winner')).toContainText('Ana venceu');
  const victory2 = effectNode(pageA, 'victory');
  await expect(victory2).toBeVisible();
  await expect(victory2).toHaveAttribute('data-effect-variant', 'trophy');
  await captureStable(pageA, '[data-effect-id]', 'variant-victory-trophy.png');

  await desktop.close();
  await mobile.close();
});

test('preferências individuais: animação, som, ocultação, sistema e reload', async ({ browser }) => {
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

  await joinAsWatcher(pageC, inviteUrl, 'Davi');
  await expect(pageC.getByTestId('pref-animations-note')).toBeVisible();
  await expect(pageC.getByTestId('pref-animations-full')).toBeChecked();

  if (!(await isMyTurn(pageA))) await drawAndPass(pageB);
  await waitMyTurn(pageA);

  // 1) Bloqueio completo com som tentado nos três navegadores.
  await setEffectVariant(pageA, 'brick-wall');
  await playCard(pageA, 'red-skip-1');
  const blocked1 = effectNode(pageA, 'blocked');
  await expect(blocked1).toBeVisible();
  await expect(blocked1).toHaveAttribute('data-effect-variant', 'brick-wall');
  await expect(pageA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'full');
  await expect(pageC.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'reduced');
  const blocked1Id = await blocked1.getAttribute('data-effect-id');
  if (blocked1Id === null) throw new Error('efeito sem id');
  await expect(effectNode(pageC, 'blocked')).toHaveAttribute('data-effect-id', blocked1Id);
  await expect.poll(() => oscCount(pageA), { timeout: 5_000 }).toBeGreaterThan(0);
  await expect.poll(() => oscCount(pageB), { timeout: 5_000 }).toBeGreaterThan(0);
  await expect.poll(() => oscCount(pageC), { timeout: 5_000 }).toBeGreaterThan(0);
  await captureStable(pageA, '[data-effect-id]', 'pref-full-sound.png');

  // 2) Silenciar só em Ana: Bia segue tocando.
  await pageA.getByTestId('pref-sound-mute').check();
  const countABefore = await oscCount(pageA);
  const countBBefore = await oscCount(pageB);
  await setEffectVariant(pageA, 'cards-rain');
  await playCard(pageA, 'red-draw-two-1');
  const penalty = effectNode(pageA, 'penaltyDraw');
  await expect(penalty).toBeVisible();
  await expect(penalty).toHaveAttribute('data-effect-variant', 'cards-rain');
  const penaltyId = await penalty.getAttribute('data-effect-id');
  if (penaltyId === null) throw new Error('efeito sem id');
  await expect(pageA.getByTestId(`auto-effect-caption-${penaltyId}`)).toHaveText('Bia comprou 2 cartas de penalidade');
  await captureStable(pageA, '[data-effect-id]', 'pref-muted-effect.png');
  await expect.poll(() => oscCount(pageB), { timeout: 5_000 }).toBeGreaterThan(countBBefore);
  await expect.poll(() => oscCount(pageA), { timeout: 1_000 }).toBe(countABefore);

  // 3) Animações desligadas: o bloqueio seguinte aparece estático com os avisos.
  await pageA.getByTestId('pref-animations-off').check();
  const blocked2 = effectNode(pageA, 'blocked');
  await expect(blocked2).toBeVisible();
  await expect(pageA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'off');
  await expect(pageA.getByTestId('turn-indicator')).toBeVisible();
  await expect(pageA.getByTestId('event-feed')).toBeVisible();
  await expect(pageA.getByTestId('my-hand')).toBeVisible();
  await captureStable(pageA, '[data-effect-id]', 'pref-off-static.png');
  await expect(blocked2).toBeHidden({ timeout: 4_000 });
  await expect.poll(() => oscCount(pageA), { timeout: 1_000 }).toBe(countABefore);

  // 4) Movimento reduzido do sistema limita a animação completa.
  await pageA.getByTestId('pref-animations-full').check();
  await pageA.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pageA.getByTestId('pref-animations-note')).toBeVisible();
  await setEffectVariant(pageA, 'stumble');
  await playCard(pageA, 'red-skip-2');
  const blocked3 = effectNode(pageA, 'blocked');
  await expect(blocked3).toBeVisible();
  await expect(blocked3).toHaveAttribute('data-effect-variant', 'stumble');
  await expect(pageA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'reduced');
  await captureStable(pageA, '[data-effect-id]', 'pref-system-limited.png');
  await pageA.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(pageA.getByTestId('pref-animations-note')).toHaveCount(0);
  await expect(blocked3).toBeHidden({ timeout: 5_000 });

  // 5) Modo reduzido próprio e a segunda variação de penalidade.
  await pageA.getByTestId('pref-animations-reduced').check();
  await setEffectVariant(pageA, 'cards-avalanche');
  await playCard(pageA, 'red-draw-two-2');
  const penalty2 = effectNode(pageA, 'penaltyDraw');
  await expect(penalty2).toBeVisible();
  await expect(penalty2).toHaveAttribute('data-effect-variant', 'cards-avalanche');
  await expect(pageA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'reduced');
  await captureStable(pageA, '[data-effect-id]', 'pref-reduced.png');

  // 6) Ocultar provocações: Bia envia, quem aguarda recebe, Ana não apresenta.
  await pageA.getByTestId('pref-hide-taunts').check();
  const countAMuted = await oscCount(pageA);
  await sendTaunt(pageB, 'tomate', 'Ana');
  await expect(pageC.getByTestId('taunt-effect-tomate')).toBeVisible({ timeout: 20_000 });
  await expect(pageA.getByTestId('taunt-effect-tomate')).toHaveCount(0);
  await expect.poll(() => oscCount(pageA), { timeout: 1_000 }).toBe(countAMuted);
  await pageA.screenshot({ path: join(shotsDir, 'pref-hide-taunt.png'), fullPage: true });

  // 7) Reload recupera as escolhas sem perder os avisos da rodada.
  await pageA.getByTestId('pref-animations-off').check();
  await pageA.reload();
  await expect(pageA.getByTestId('my-hand')).toBeVisible();
  await expect(pageA.getByTestId('pref-animations-off')).toBeChecked();
  await expect(pageA.getByTestId('pref-sound-mute')).toBeChecked();
  await expect(pageA.getByTestId('pref-hide-taunts')).toBeChecked();
  await expect(pageA.getByTestId('event-feed')).toBeVisible();
  await pageA.screenshot({ path: join(shotsDir, 'pref-reload-persist.png'), fullPage: true });

  // 8) As escolhas de Bia ficam intactas pelas de Ana.
  await expect(pageB.getByTestId('pref-animations-full')).toBeChecked();
  await expect(pageB.getByTestId('pref-sound-mute')).not.toBeChecked();
  await expect(pageB.getByTestId('pref-hide-taunts')).not.toBeChecked();
  await pageB.screenshot({ path: join(shotsDir, 'mobile-prefs.png'), fullPage: true });

  await desktop.close();
  await mobile.close();
  await systemContext.close();
});

test('entrada de quem aguarda durante a vez do substituto com apresentação diferente', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageC = await watcherContext.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await pageA.getByTestId('pref-animations-off').check();
  await setNextDeck(pageA, botDeck());
  await readyAll(pageA, pageB);
  if (!(await isMyTurn(pageA))) await drawAndPass(pageB);
  await waitMyTurn(pageA);

  // A queda de Bia pausa a mesa; o substituto só entra depois do prazo.
  await pageB.evaluate(() => window.__trettaTest!.disconnect());
  await expect(pageA.getByTestId('pause-panel')).toBeVisible();
  const substitute = pageA.getByTestId('substitute-Bia');
  await expect(substitute).toBeVisible({ timeout: 15_000 });

  // Formulário pronto para entrar no clique seguinte, dentro da vez do bot.
  await pageC.goto(inviteUrl);
  await pageC.getByTestId('join-name-input').fill('Davi');

  await substitute.click();
  await expect(pageA.getByTestId('pause-panel')).toHaveCount(0);
  await expect(pageA.getByTestId('opponent-Bia')).toContainText('substituto');

  // Cede a vez para a vaga do substituto e entra na janela de ação dele.
  await pageA.getByTestId('draw-button').click();
  await pageA.getByTestId('pass-button').click();
  await pageC.getByTestId('join-room-button').click();
  await expect(pageC.getByTestId('public-table')).toBeVisible();
  await expect(pageC.getByTestId('public-table-status')).toContainText('Vez de Bia', { timeout: 15_000 });
  await expect(pageC.getByTestId('waiting-banner')).toBeVisible();

  // O substituto joga o Bloqueio; a variação chega igual com formas diferentes.
  const effectA = effectNode(pageA, 'blocked');
  await expect(effectA).toBeVisible({ timeout: 15_000 });
  const effectC = effectNode(pageC, 'blocked');
  await expect(effectC).toBeVisible();
  const effectId = await effectC.getAttribute('data-effect-id');
  if (effectId === null) throw new Error('efeito sem id');
  await expect(effectA).toHaveAttribute('data-effect-id', effectId);
  await expect(pageA.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'off');
  await expect(pageC.getByTestId('taunt-overlay')).toHaveAttribute('data-anim', 'full');
  await captureStable(pageC, '[data-effect-id]', 'watcher-during-bot.png');
  await captureStable(pageA, '[data-effect-id]', 'watcher-during-bot-off.png');

  // A Bia volta pela credencial e retoma a vaga com a mão preservada.
  await pageB.evaluate(() => window.__trettaTest!.connect());
  await expect(pageB.getByTestId('connection-lost')).toHaveCount(0, { timeout: 20_000 });
  await expect(pageB.getByTestId('my-hand')).toBeVisible();
  const handCount = await pageB.getByTestId('my-hand').locator('[data-testid^="card-"]').count();
  expect(handCount).toBeGreaterThanOrEqual(7);
  await expect(pageA.getByTestId('pause-panel')).toHaveCount(0);
  await expect(pageA.getByTestId('opponent-Bia').getByText('substituto')).toHaveCount(0);

  await desktop.close();
  await mobile.close();
  await watcherContext.close();
});
