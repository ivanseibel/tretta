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
  openReactions,
  readyAll,
  setNextDeck,
  waitMyTurn,
} from './room';

const shots = fileURLToPath(new URL('../../../docs/work/reports/assets/T008/', import.meta.url));
mkdirSync(shots, { recursive: true });

async function overflow(page: Page): Promise<{ viewport: number; document: number }> {
  return page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
}

test('mesa, gaveta e bandeja de reações cabem de 320 a 1440 px', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'W'.repeat(24));
    await setNextDeck(host, scenarioDeck());
    await readyAll(host, guest);
    await expect(host.getByTestId('turn-indicator')).toHaveText('Sua vez');

    for (const width of [1440, 1024, 768, 390, 320]) {
      await host.setViewportSize({ width, height: 900 });
      const table = await overflow(host);
      expect(table.document, `${width}: overflow da mesa`).toBeLessThanOrEqual(width);

      await openDrawer(host, 'conversa');
      const drawer = await overflow(host);
      expect(drawer.document, `${width}: overflow da gaveta`).toBeLessThanOrEqual(width);
      const drawerBox = await host.getByTestId('table-drawer-layer').boundingBox();
      expect(drawerBox).not.toBeNull();
      expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
      expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(width + 1);
      await closeDrawer(host);

      await openReactions(host);
      const tray = await overflow(host);
      expect(tray.document, `${width}: overflow da bandeja`).toBeLessThanOrEqual(width);
      await expect(host.locator('[data-testid^="reaction-option-"]')).toHaveCount(12);
      await expect(host.getByTestId('reaction-option-eita')).toBeFocused();
      await host.keyboard.press('Escape');
      await expect(host.getByTestId('reaction-tray')).toHaveCount(0);
      if ([1440, 768, 390].includes(width)) {
        await host.screenshot({ path: join(shots, `table-${width}.png`) });
      }
    }

    await host.emulateMedia({ reducedMotion: 'reduce' });
    await host.getByTestId('card-red-1-1').click();
    await expect(host.getByTestId('card-red-1-1')).toHaveCSS('transform', 'none');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-input')).toHaveValue('');
  await expect(page.getByTestId('chat-messages')).toContainText(text);
}

test('chat recente no topo preserva leitura e volta ao topo ao enviar', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 768, height: 900 } });
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia');
    await openDrawer(host, 'conversa');
    await openDrawer(guest, 'conversa');
    for (let index = 1; index <= 5; index++) {
      await send(index % 2 ? host : guest, `Mensagem ${index}\n${'Linha de conversa\n'.repeat(18)}`);
    }
    const list = host.getByTestId('chat-messages');
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '5');
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await list.evaluate(
      (element) =>
        new Promise<void>((resolve) => {
          element.scrollTop = 120;
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const anchor = await list.evaluate((element) => {
      const top = element.getBoundingClientRect().top;
      const child = Array.from(element.querySelectorAll<HTMLElement>('[data-chat-seq]')).find(
        (item) => item.getBoundingClientRect().bottom > top,
      )!;
      return { seq: child.dataset.chatSeq!, offset: child.getBoundingClientRect().top - top };
    });
    await send(guest, `Mensagem 6\n${'Nova linha\n'.repeat(18)}`);
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '6');
    await expect
      .poll(() =>
        list.evaluate((element, seq) => {
          const item = element.querySelector(`[data-chat-seq="${seq}"]`)!;
          return item.getBoundingClientRect().top - element.getBoundingClientRect().top;
        }, anchor.seq),
      )
      .toBeCloseTo(anchor.offset, 0);
    await send(host, 'Mensagem 7, voltando às novidades');
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '7');
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await host.screenshot({ path: join(shots, 'chat-newest-first.png') });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('aviso de vez nasce ligado, não repete durante a vez e respeita preferências', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  for (const context of [hostContext, guestContext]) {
    await context.addInitScript(() => {
      const target = window as Window & { __t008Oscillators?: number };
      target.__t008Oscillators = 0;
      const original = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        target.__t008Oscillators = (target.__t008Oscillators ?? 0) + 1;
        return original.call(this);
      };
    });
  }
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const count = (page: Page): Promise<number> =>
    page.evaluate(() => (window as Window & { __t008Oscillators?: number }).__t008Oscillators ?? 0);
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia');
    await openDrawer(host, 'sala');
    await expect(host.getByTestId('pref-turn-notification')).toBeChecked();
    await closeDrawer(host);
    await openDrawer(guest, 'sala');
    await expect(guest.getByTestId('pref-turn-notification')).toBeChecked();
    await closeDrawer(guest);

    await setNextDeck(host, scenarioDeck());
    await readyAll(host, guest);
    await waitMyTurn(host);
    await expect.poll(() => count(host)).toBeGreaterThan(0);
    const initial = await count(host);
    await host.getByTestId('card-red-1-1').click();
    await host.getByTestId('cancel-play').click();
    expect(await count(host)).toBe(initial);
    await host.getByTestId('draw-button').click();
    await expect(host.getByTestId('pass-button')).toBeVisible();
    expect(await count(host)).toBe(initial);
    await host.getByTestId('pass-button').click();
    await waitMyTurn(guest);
    await expect.poll(() => count(guest)).toBeGreaterThan(0);
    await drawAndPass(guest);
    await waitMyTurn(host);
    await expect.poll(() => count(host)).toBeGreaterThan(initial);

    await openDrawer(host, 'sala');
    await host.getByTestId('pref-turn-notification').uncheck();
    await closeDrawer(host);
    const beforeDisabled = await count(host);
    await drawAndPass(host);
    await drawAndPass(guest);
    await waitMyTurn(host);
    expect(await count(host)).toBe(beforeDisabled);

    await host.reload();
    await waitMyTurn(host);
    await openDrawer(host, 'sala');
    await expect(host.getByTestId('pref-turn-notification')).not.toBeChecked();
    await closeDrawer(host);
    expect(await count(host)).toBe(0);
    await openDrawer(host, 'sala');
    await host.getByTestId('pref-turn-notification').check();
    await host.getByTestId('pref-sound-mute').check();
    await closeDrawer(host);
    expect(await count(host)).toBe(0);
    await drawAndPass(host);
    await drawAndPass(guest);
    await waitMyTurn(host);
    expect(await count(host)).toBe(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
