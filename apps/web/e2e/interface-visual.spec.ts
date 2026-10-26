import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import {
  closeDrawer,
  createRoom,
  drawAndPass,
  joinRoom,
  openDrawer,
  playCard,
  readyAll,
  setNextDeck,
  waitMyTurn,
} from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T019F/visual/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function noHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(shotsDir, name) });
}

async function capturePair(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await noHorizontalOverflow(page);
  await capture(page, `${name}-desktop.png`);
  await page.setViewportSize({ width: 320, height: 900 });
  await noHorizontalOverflow(page);
  await capture(page, `${name}-320.png`);
  await page.setViewportSize({ width: 1280, height: 900 });
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (channels === undefined || channels.length !== 3) throw new Error(`cor CSS inválida: ${color}`);
    const linear = channels.map((value) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('telas reais na linguagem nova: home, entrada, preparação, mesa, espera, pausa e resultado', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const watcher = await watcherContext.newPage();
  try {
    await host.goto('/');
    await expect(host.getByTestId('create-room-button')).toBeVisible();
    await capturePair(host, 'home');

    const invite = await createRoom(host, 'Ana');
    await guest.goto(invite);
    await expect(guest.getByTestId('join-name-input')).toBeVisible();
    await capturePair(guest, 'join');
    await guest.setViewportSize({ width: 1280, height: 900 });
    await guest.getByTestId('join-name-input').fill('Bia');
    await guest.getByTestId('join-room-button').click();
    await expect(guest.getByTestId('ready-toggle')).toBeVisible();
    await expect(host.getByTestId('lobby-participant')).toHaveCount(2);
    await capturePair(host, 'lobby');

    await setNextDeck(host, scenarioDeck());
    await readyAll(host, guest);
    await expect(host.getByTestId('turn-indicator')).toHaveText('Sua vez');
    await capturePair(host, 'table');
    const draw = host.getByTestId('draw-button');
    const drawColors = await draw.evaluate((element) => ({
      foreground: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
    }));
    expect(contrastRatio(drawColors.foreground, drawColors.background)).toBeGreaterThanOrEqual(4.5);
    const drawBounds = await draw.boundingBox();
    expect(drawBounds).not.toBeNull();
    expect(drawBounds!.height).toBeGreaterThanOrEqual(44);
    for (const id of ['table-bar-conversa', 'table-bar-reagir', 'table-bar-historico']) {
      await expect(host.getByTestId(id)).toBeVisible();
    }

    // Escolha de cor: quatro símbolos nomeados, contraste e retorno de foco.
    await host.getByTestId('card-wild-color-1').click();
    await host.getByTestId('play-button').click();
    await expect(host.getByTestId('color-chooser').locator('.tv2-color-button')).toHaveCount(4);
    const chooserColors = await host.getByTestId('color-chooser').locator('.tv2-color-button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        label: button.getAttribute('aria-label'),
        foreground: getComputedStyle(button).color,
        background: getComputedStyle(button).backgroundColor,
        symbol: button.querySelector('.color-symbol')?.textContent,
      })),
    );
    expect(new Set(chooserColors.map((choice) => choice.symbol)).size).toBe(4);
    for (const choice of chooserColors) {
      expect(
        contrastRatio(choice.foreground, choice.background),
        `${choice.label}: ${choice.foreground} on ${choice.background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    const grayscale = await host.addStyleTag({
      content: '.tv2-table-root .tv2-card, .tv2-table-root .tv2-color-button { filter: grayscale(1) !important; }',
    });
    await capture(host, 'wild-colors-desaturated-1280.png');
    await grayscale.evaluate((node) => node.parentNode?.removeChild(node));
    await host.getByTestId('color-option-red').press('Escape');
    await expect(host.getByTestId('play-button')).toBeFocused();
    await host.getByTestId('cancel-play').click();

    // Quem entra durante a rodada vê a mesa pública sem mão.
    await watcher.goto(invite);
    await watcher.getByTestId('join-name-input').fill('Cai');
    await watcher.getByTestId('join-room-button').click();
    await expect(watcher.getByTestId('waiting-banner')).toBeVisible();
    await expect(watcher.getByTestId('public-table')).toBeVisible();
    await expect(watcher.getByTestId('my-hand')).toHaveCount(0);
    const waitingParticipant = host.getByTestId('waiting-participant-Cai');
    await expect(waitingParticipant).toContainText('aguarda próxima rodada');
    await expect(host.getByTestId('seat-Cai')).toHaveCount(0);
    const publicDiscard = watcher.getByTestId('public-discard-top');
    await expect(publicDiscard).toHaveAttribute('role', 'img');
    await expect(publicDiscard).toHaveAttribute('aria-label', /^Descarte:/);
    const publicCardColors = await publicDiscard.evaluate((card) => ({
      foreground: getComputedStyle(card).color,
      background: getComputedStyle(card).backgroundColor,
    }));
    expect(contrastRatio(publicCardColors.foreground, publicCardColors.background)).toBeGreaterThanOrEqual(4.5);
    await capturePair(watcher, 'waiting-table');

    // Queda: a pausa mantém as decisões do anfitrião e a etiqueta de ausência.
    await guest.evaluate(() => window.__trettaTest!.disconnect());
    await expect(host.getByTestId('pause-panel')).toBeVisible();
    const pauseColors = await host.locator('.pause-panel h2').evaluate((heading) => {
      const panel = heading.closest('.pause-panel');
      if (panel === null) throw new Error('painel de pausa ausente');
      return {
        foreground: getComputedStyle(heading).color,
        background: getComputedStyle(panel).backgroundColor,
      };
    });
    expect(contrastRatio(pauseColors.foreground, pauseColors.background)).toBeGreaterThanOrEqual(4.5);
    await expect(host.locator('[data-testid="seat-circuit"] .status.disconnected').first()).toBeVisible();
    await capturePair(host, 'pause');
    await guest.evaluate(() => window.__trettaTest!.connect());
    await expect(host.getByTestId('pause-panel')).toHaveCount(0, { timeout: 20_000 });

    // Resultado dedicado, com placar e retorno do anfitrião.
    await playCard(host, 'red-1-1');
    await drawAndPass(guest);
    await playCard(host, 'red-2-1');
    await drawAndPass(guest);
    await playCard(host, 'red-3-1');
    await drawAndPass(guest);
    await playCard(host, 'red-4-1');
    await drawAndPass(guest);
    await playCard(host, 'red-5-1');
    await drawAndPass(guest);
    await waitMyTurn(host);
    await host.getByTestId('card-red-6-1').click();
    await host.getByTestId('last-card-checkbox').check();
    await host.getByTestId('play-button').click();
    await expect(guest.getByTestId('last-card-note')).toContainText('Ana');
    await drawAndPass(guest);
    await waitMyTurn(host);
    await host.getByTestId('card-wild-color-1').click();
    await host.getByTestId('play-button').click();
    await host.getByTestId('color-option-green').click();
    await expect(host.getByTestId('results-winner')).toContainText('Ana venceu');
    await expect(host.getByTestId('return-to-lobby-button')).toBeVisible();
    await capturePair(host, 'results');
  } finally {
    await hostContext.close();
    await guestContext.close();
    await watcherContext.close();
  }
});

test('oito assentos com apelidos longos cabem em 320 px, com foco e gaveta legíveis', async ({ browser }) => {
  const contexts = await Promise.all(
    Array.from({ length: 8 }, () => browser.newContext({ viewport: { width: 320, height: 900 } })),
  );
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    const host = pages[0];
    if (host === undefined) throw new Error('página anfitriã ausente');
    const longNickname = 'W'.repeat(24);
    const nickname = (index: number): string => (index === 1 ? longNickname : `${'W'.repeat(23)}${index}`);
    const invite = await createRoom(host, longNickname);
    for (let index = 1; index < pages.length; index++) {
      const page = pages[index];
      if (page === undefined) continue;
      await joinRoom(page, invite, nickname(index + 1));
    }
    await expect(host.getByTestId('lobby-participant')).toHaveCount(8);
    await noHorizontalOverflow(host);
    await readyAll(host, ...pages.slice(1));
    await expect(host.locator('[data-testid="seat-circuit"] .seat')).toHaveCount(8);
    await expect
      .poll(async () => {
        const turns = await Promise.all(
          pages.map(async (page) => (await page.getByTestId('turn-indicator').textContent()) === 'Sua vez'),
        );
        return turns.filter(Boolean).length;
      })
      .toBe(1);

    const activeIndex = await Promise.all(
      pages.map(async (page) => (await page.getByTestId('turn-indicator').textContent()) === 'Sua vez'),
    ).then((turns) => turns.findIndex(Boolean));
    expect(activeIndex).toBeGreaterThanOrEqual(0);
    const activePage = pages[activeIndex];
    if (activePage === undefined) throw new Error('página da vez atual ausente');
    await expect(activePage.getByTestId('draw-button')).toBeVisible();
    await noHorizontalOverflow(activePage);
    const drawBox = await activePage.getByTestId('draw-button').boundingBox();
    expect(drawBox).not.toBeNull();
    expect(drawBox!.x).toBeGreaterThanOrEqual(0);
    expect(drawBox!.x + drawBox!.width).toBeLessThanOrEqual(320);

    // A gaveta cabe na largura e mantém as três abas e as seções.
    await openDrawer(host, 'sala');
    await noHorizontalOverflow(host);
    const drawerBox = await host.getByTestId('table-drawer-layer').boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
    expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(321);
    await expect(host.getByRole('tab')).toHaveCount(3);
    await expect(host.getByTestId('drawer-players')).toBeVisible();
    await closeDrawer(host);

    // Nome completo no chat da gaveta, com quebra e anel de foco contrastante.
    await openDrawer(host, 'conversa');
    await host.getByTestId('chat-input').fill('Uma mensagem do apelido comprido.');
    await host.getByTestId('chat-send').click();
    const chatAuthor = host.getByTestId('chat-messages').getByText(longNickname, { exact: true });
    await expect(chatAuthor).toBeVisible();
    await expect(chatAuthor).toHaveCSS('overflow-wrap', 'anywhere');
    await host.getByTestId('chat-input').focus();
    const paperFocus = await host.getByTestId('chat-input').evaluate((input) => ({
      outline: getComputedStyle(input).outlineColor,
      background: getComputedStyle(input.closest('.chat-panel')!).backgroundColor,
    }));
    expect(contrastRatio(paperFocus.outline, paperFocus.background)).toBeGreaterThanOrEqual(3);
    await capture(host, 'long-names-320.png');
    await closeDrawer(host);

    // Fora da vez, o foco percorre a mão sem abrir a confirmação.
    const nonTurnPage = pages[(activeIndex + 1) % pages.length];
    if (nonTurnPage === undefined) throw new Error('página fora da vez ausente');
    const hand = nonTurnPage.getByTestId('my-hand');
    const cards = hand.locator('[data-testid^="card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(1);
    await expect(cards.first()).toHaveAttribute('aria-disabled', 'true');
    await cards.first().focus();
    await nonTurnPage.keyboard.press('ArrowRight');
    await expect(cards.nth(1)).toBeFocused();
    await nonTurnPage.keyboard.press('Enter');
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await expect(nonTurnPage.getByTestId('play-strip')).toHaveCount(0);

    // O topo com nome longo quebra e permanece dentro da tela.
    const currentNickname = activeIndex === 0 ? longNickname : nickname(activeIndex + 1);
    await nonTurnPage.setViewportSize({ width: 320, height: 900 });
    const longTurnIndicator = nonTurnPage.getByTestId('turn-indicator');
    await expect(longTurnIndicator).toHaveText(`Vez de ${currentNickname}`);
    await expect(longTurnIndicator).toHaveCSS('overflow-wrap', 'anywhere');
    await noHorizontalOverflow(nonTurnPage);
    const longTurnBox = await longTurnIndicator.boundingBox();
    expect(longTurnBox).not.toBeNull();
    expect(longTurnBox!.x).toBeGreaterThanOrEqual(0);
    expect(longTurnBox!.x + longTurnBox!.width).toBeLessThanOrEqual(320);
    await capture(nonTurnPage, 'long-turn-320.png');

    await activePage.getByTestId('draw-button').click();
    await expect(activePage.getByTestId('pass-button')).toBeFocused();
    await activePage.getByTestId('pass-button').click();
    await expect(activePage.getByTestId('turn-indicator')).toBeFocused();
    await expect(activePage.getByTestId('turn-indicator')).toBeInViewport();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
