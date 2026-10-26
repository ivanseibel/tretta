/**
 * T012 — legibilidade dos assentos no trilho novo: 8 assentos em 320 px,
 * nomes curtos sem truncar, nomes longos com o nome completo no diálogo,
 * sem micro-setas, sem sobreposição e sem rolagem horizontal.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { circuitFourDeck, eightSeatValidationDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T012/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

interface PageErrors {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
}

function watchPage(page: Page): PageErrors {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

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

async function circuitGeometry(page: Page): Promise<{
  count: number;
  overlaps: string[];
  outside: string[];
  fonts: { name: number[]; count: number[]; label: number[] };
  microArrows: number;
}> {
  return page.getByTestId('seat-circuit').evaluate((circuit) => {
    const seats = [...circuit.querySelectorAll<HTMLElement>('.seat')];
    const boxes = seats.map((seat) => {
      const rect = seat.getBoundingClientRect();
      return {
        name: seat.querySelector('.participant-name')?.textContent ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    });
    const overlaps: string[] = [];
    for (let first = 0; first < boxes.length; first++) {
      for (let second = first + 1; second < boxes.length; second++) {
        const a = boxes[first];
        const b = boxes[second];
        if (a === undefined || b === undefined) continue;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 1 && overlapY > 1) overlaps.push(`${a.name} × ${b.name}`);
      }
    }
    const outside = seats
      .filter((seat) => {
        const rect = seat.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5 || rect.top < -0.5 || rect.bottom > window.innerHeight + 0.5;
      })
      .map((seat) => seat.querySelector('.participant-name')?.textContent ?? '');
    const fontOf = (selector: string): number[] =>
      [...circuit.querySelectorAll<HTMLElement>(selector)].map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    return {
      count: seats.length,
      overlaps,
      outside,
      fonts: {
        name: fontOf('.tv2-seat-name'),
        count: fontOf('.tv2-seat-count strong'),
        label: fontOf('.tv2-seat-count > span'),
      },
      microArrows: circuit.querySelectorAll('.seat-arrow').length,
    };
  });
}

test('A1: oito assentos no celular cabem com fontes legíveis e consulta de nome completo', async ({ browser }) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(Array.from({ length: 8 }, () => browser.newContext({ viewport: { width: 320, height: 900 } })));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  if (host === undefined) throw new Error('página anfitriã ausente');
  const errors = watchPage(host);
  const longName = `${'W'.repeat(23)}x`;
  const names = Array.from({ length: 8 }, (_, index) => (index === 7 ? longName : index === 0 ? 'Ana' : `Participante ${String(index)}`));
  try {
    const invite = await createRoom(host, names[0]!);
    for (let index = 1; index < pages.length; index++) {
      const page = pages[index];
      if (page === undefined) continue;
      await joinRoom(page, invite, names[index]!, 'lobo');
    }
    await setNextDeck(host, eightSeatValidationDeck());
    await readyAll(host, ...pages.slice(1));

    const circuit = host.getByTestId('seat-circuit');
    await expect(circuit.locator('.seat')).toHaveCount(8);
    await expect(circuit.locator('.seat[data-current="true"]')).toHaveCount(1);
    const domNames = await circuit.locator('.seat .participant-name').evaluateAll((nodes) => nodes.map((node) => node.textContent));
    expect([...domNames].sort()).toEqual([...names].sort());

    const geometry = await circuitGeometry(host);
    expect(geometry.count).toBe(8);
    expect(geometry.overlaps).toEqual([]);
    expect(geometry.outside).toEqual([]);
    expect(geometry.microArrows).toBe(0);
    for (const size of geometry.fonts.name) expect(size).toBeGreaterThanOrEqual(16);
    for (const size of geometry.fonts.count) expect(size).toBeGreaterThanOrEqual(26);
    for (const size of geometry.fonts.label) expect(size).toBeGreaterThanOrEqual(14);
    await noHorizontalOverflow(host);
    await capture(host, 'oito-320.png');

    // Nome longo abre o diálogo com o texto completo, prende o foco e devolve ao gatilho.
    const longSeat = host.getByTestId(`seat-${longName}`);
    const opener = longSeat.getByRole('button', { name: /Abrir detalhes do assento/ });
    await opener.click();
    const dialog = host.getByTestId('seat-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(longName);
    await expect(host.getByTestId('seat-dialog-close')).toBeFocused();
    await host.keyboard.press('Tab');
    await expect(host.getByTestId('seat-dialog-close')).toBeFocused();
    await host.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('A1: quatro assentos legíveis de 320 px ao desktop com nomes longos', async ({ browser }) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  if (host === undefined) throw new Error('página anfitriã ausente');
  const errors = watchPage(host);
  try {
    const invite = await createRoom(host, 'Participante 1');
    await joinRoom(pages[1]!, invite, 'Participante 2', 'tucano');
    await joinRoom(pages[2]!, invite, `${'W'.repeat(20)}x`, 'raposa');
    await joinRoom(pages[3]!, invite, 'W'.repeat(24), 'sapo');
    await setNextDeck(host, circuitFourDeck());
    await readyAll(host, ...pages.slice(1));

    for (const width of [320, 390, 768, 1280]) {
      await host.setViewportSize({ width, height: 1000 });
      await noHorizontalOverflow(host);
      const geometry = await circuitGeometry(host);
      expect(geometry.count).toBe(4);
      expect(geometry.overlaps).toEqual([]);
      expect(geometry.outside).toEqual([]);
      expect(geometry.microArrows).toBe(0);
      await capture(host, `quatro-${String(width)}.png`);
    }

    const fullName = 'W'.repeat(24);
    const longSeat = host.getByTestId(`seat-${fullName}`);
    await expect(longSeat.getByRole('button', { name: /Abrir detalhes do assento/ })).toHaveAttribute(
      'aria-label',
      new RegExp(fullName),
    );
    await longSeat.getByRole('button', { name: /Abrir detalhes do assento/ }).click();
    await expect(host.getByTestId('seat-dialog')).toContainText(fullName);
    await host.keyboard.press('Escape');

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
