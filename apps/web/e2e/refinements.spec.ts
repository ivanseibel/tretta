import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, drawAndPass, joinRoom, openTauntPanel, readyAll, setNextDeck, waitMyTurn } from './room';

const shots = fileURLToPath(new URL('../../../docs/work/reports/assets/T008/', import.meta.url));
mkdirSync(shots, { recursive: true });

test('mesa e pares de provocação cabem de celular a desktop', async ({ browser }) => {
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
    await openTauntPanel(host);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await host.setViewportSize({ width, height: 900 });
      const metrics = await host.evaluate(() => {
        const field = (id: string) => {
          const select = document.getElementById(id)!;
          const label = select.closest('label')!.querySelector('.taunt-label')!;
          const control = select.getBoundingClientRect();
          const caption = label.getBoundingClientRect();
          return { x: control.x, top: control.top, width: control.width, right: control.right, labelX: caption.x, labelBottom: caption.bottom };
        };
        return { viewport: innerWidth, document: document.documentElement.scrollWidth, type: field('taunt-type'), target: field('taunt-target') };
      });
      expect(metrics.document, `${width}: overflow da página`).toBeLessThanOrEqual(width);
      for (const field of [metrics.type, metrics.target]) {
        expect(field.labelBottom).toBeLessThanOrEqual(field.top);
        expect(Math.abs(field.labelX - field.x)).toBeLessThanOrEqual(1);
        expect(field.width).toBeGreaterThan(120);
        expect(field.right).toBeLessThanOrEqual(width);
      }
      if (width >= 641) expect(Math.abs(metrics.type.top - metrics.target.top)).toBeLessThanOrEqual(1);
      else expect(metrics.target.top).toBeGreaterThan(metrics.type.top);
      if ([1440, 768, 390].includes(width)) await host.screenshot({ path: join(shots, `table-${width}.png`), fullPage: true });
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
    for (let index = 1; index <= 5; index++) {
      await send(index % 2 ? host : guest, `Mensagem ${index}\n${'Linha de conversa\n'.repeat(18)}`);
    }
    const list = host.getByTestId('chat-messages');
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '5');
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await list.evaluate((element) => new Promise<void>((resolve) => {
      element.scrollTop = 120;
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const anchor = await list.evaluate((element) => {
      const top = element.getBoundingClientRect().top;
      const child = Array.from(element.querySelectorAll<HTMLElement>('[data-chat-seq]')).find((item) => item.getBoundingClientRect().bottom > top)!;
      return { seq: child.dataset.chatSeq!, offset: child.getBoundingClientRect().top - top };
    });
    await send(guest, `Mensagem 6\n${'Nova linha\n'.repeat(18)}`);
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '6');
    await expect.poll(() => list.evaluate((element, seq) => {
      const item = element.querySelector(`[data-chat-seq="${seq}"]`)!;
      return item.getBoundingClientRect().top - element.getBoundingClientRect().top;
    }, anchor.seq)).toBeCloseTo(anchor.offset, 0);
    await send(host, 'Mensagem 7, voltando às novidades');
    await expect(list.locator('[data-chat-seq]').first()).toHaveAttribute('data-chat-seq', '7');
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await host.screenshot({ path: join(shots, 'chat-newest-first.png'), fullPage: true });
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
  const count = (page: Page): Promise<number> => page.evaluate(() =>
    (window as Window & { __t008Oscillators?: number }).__t008Oscillators ?? 0);
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia');
    await expect(host.getByTestId('pref-turn-notification')).toBeChecked();
    await expect(guest.getByTestId('pref-turn-notification')).toBeChecked();
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

    await host.getByTestId('pref-turn-notification').uncheck();
    const beforeDisabled = await count(host);
    await drawAndPass(host);
    await drawAndPass(guest);
    await waitMyTurn(host);
    expect(await count(host)).toBe(beforeDisabled);
    await host.reload();
    await waitMyTurn(host);
    await expect(host.getByTestId('pref-turn-notification')).not.toBeChecked();
    expect(await count(host)).toBe(0);
    await host.getByTestId('pref-turn-notification').check();
    expect(await count(host)).toBe(0);
    await host.getByTestId('pref-sound-mute').check();
    await drawAndPass(host);
    await drawAndPass(guest);
    await waitMyTurn(host);
    expect(await count(host)).toBe(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
