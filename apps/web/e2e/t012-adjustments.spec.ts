/**
 * T012 — ajustes A1/A2: leitura e reflow dos assentos no celular, consulta de
 * nomes truncados por toque/teclado e resumo do percurso no sentido vigente.
 * Novas capturas e medidas vivem em `assets/T012-adjustments/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { circuitFourDeck, eightSeatValidationDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck } from './room';

const evidenceDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T012-adjustments/', import.meta.url));
mkdirSync(evidenceDir, { recursive: true });

/** Fontes auxiliares da mesa: nome 0,78 rem, badges 0,6 rem, contagem 0,66 rem (16 px base). */
const MIN_NAME_FONT = 12;
const MIN_TAG_FONT = 9.5;
const MIN_COUNT_FONT = 10.5;

interface ChildBox {
  readonly text: string;
  readonly font: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface SeatBox {
  readonly playerId: string | null;
  readonly nickname: string;
  readonly slot: string | null;
  readonly tags: string[];
  readonly truncated: boolean;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly children: ChildBox[];
}

interface CircuitMeasure {
  readonly viewportWidth: number;
  readonly documentWidth: number;
  readonly ring: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  readonly seats: SeatBox[];
  readonly outside: Array<{
    readonly nickname: string;
    readonly text: string;
    readonly fonte?: number;
    readonly filho?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
    readonly assento?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
  }>;
  readonly overlaps: string[];
  readonly arrowChip: string[];
  readonly arrowsOutsideRing: string[];
  readonly fonts: { readonly name: number[]; readonly tag: number[]; readonly count: number[] };
}

function watchPage(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
  const errors = { pageErrors: [] as string[], consoleErrors: [] as string[] };
  page.on('pageerror', (error) => errors.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.consoleErrors.push(message.text());
  });
  return errors;
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(evidenceDir, name), fullPage: true });
}

async function measureCircuit(page: Page): Promise<CircuitMeasure> {
  return page.getByTestId('seat-circuit').evaluate((circuit) => {
    const box = (node: Element): { left: number; top: number; right: number; bottom: number } => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const seats = [...circuit.querySelectorAll('.seat')].map((seat) => {
      const rect = box(seat);
      const nameNode = seat.querySelector('.participant-name');
      const children = [...seat.querySelectorAll('.avatar-badge,.seat-name,.participant-name,.hand-count,.tag,.status')].map((child) => {
        const childRect = box(child);
        return {
          text: child.textContent ?? '',
          font: Number.parseFloat(getComputedStyle(child).fontSize),
          left: childRect.left,
          top: childRect.top,
          right: childRect.right,
          bottom: childRect.bottom,
        };
      });
      return {
        playerId: seat.getAttribute('data-player-id'),
        nickname: nameNode?.textContent ?? '',
        slot: seat.getAttribute('data-ring-index'),
        tags: [...seat.querySelectorAll('.tag,.status')].map((tag) => tag.textContent ?? ''),
        truncated:
          nameNode !== null &&
          (nameNode.scrollHeight > nameNode.clientHeight + 1 || nameNode.scrollWidth > nameNode.clientWidth + 1),
        ...rect,
        children,
      };
    });
    const overlaps: string[] = [];
    for (let first = 0; first < seats.length; first++) {
      for (let second = first + 1; second < seats.length; second++) {
        const a = seats[first];
        const b = seats[second];
        if (a === undefined || b === undefined) continue;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push(`${String(first)}x${String(second)}`);
      }
    }
    const arrows = [...circuit.querySelectorAll('.seat-arrow')].map((arrow) => ({ node: arrow, box: box(arrow) }));
    const arrowChip: string[] = [];
    arrows.forEach((arrow, index) => {
      seats.forEach((seat, seatIndex) => {
        const overlapX = Math.min(arrow.box.right, seat.right) - Math.max(arrow.box.left, seat.left);
        const overlapY = Math.min(arrow.box.bottom, seat.bottom) - Math.max(arrow.box.top, seat.top);
        if (overlapX > 1 && overlapY > 1) arrowChip.push(`${String(index)}x${String(seatIndex)}`);
      });
    });
    const ringNode = circuit.querySelector('.seat-ring');
    const ring = ringNode === null ? { left: 0, top: 0, right: 0, bottom: 0 } : box(ringNode);
    const arrowsOutsideRing = arrows
      .filter((arrow) => arrow.box.left < ring.left - 1 || arrow.box.right > ring.right + 1 || arrow.box.top < ring.top - 1 || arrow.box.bottom > ring.bottom + 1)
      .map((arrow) => arrow.node.getAttribute('data-testid') ?? '');
      const outside = seats.flatMap((seat) =>
        seat.children
          .filter((child) => child.left < seat.left - 1 || child.right > seat.right + 1 || child.top < seat.top - 1 || child.bottom > seat.bottom + 1)
          .map((child) => ({
            nickname: seat.nickname,
            text: child.text,
            fonte: child.font,
            filho: { left: child.left, top: child.top, right: child.right, bottom: child.bottom },
            assento: { left: seat.left, top: seat.top, right: seat.right, bottom: seat.bottom },
          })),
      );
    const fontOf = (selector: string): number[] =>
      [...circuit.querySelectorAll(selector)].map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      ring,
      seats,
      outside,
      overlaps,
      arrowChip,
      arrowsOutsideRing,
      fonts: {
        name: fontOf('.participant-name'),
        tag: fontOf('.tag,.status'),
        count: fontOf('.hand-count'),
      },
    };
  });
}

function expectReadable(measure: CircuitMeasure): void {
  expect(measure.outside).toEqual([]);
  expect(measure.overlaps).toEqual([]);
  expect(measure.arrowChip).toEqual([]);
  expect(measure.arrowsOutsideRing).toEqual([]);
  expect(measure.documentWidth).toBeLessThanOrEqual(measure.viewportWidth);
  expect(measure.seats.length).toBeGreaterThan(0);
  for (const seat of measure.seats) {
    expect(seat.nickname.length).toBeGreaterThan(0);
  }
  expect(Math.min(...measure.fonts.name)).toBeGreaterThanOrEqual(MIN_NAME_FONT);
  if (measure.fonts.tag.length > 0) expect(Math.min(...measure.fonts.tag)).toBeGreaterThanOrEqual(MIN_TAG_FONT);
  expect(Math.min(...measure.fonts.count)).toBeGreaterThanOrEqual(MIN_COUNT_FONT);
}

async function saveMeasure(name: string, measure: CircuitMeasure): Promise<void> {
  writeFileSync(join(evidenceDir, name), JSON.stringify(measure, null, 2));
}

/** Consulta de um assento pelo toque (clique) e confirma que o nome completo aparece na região de detalhes. */
async function consultByClick(page: Page, playerId: string, nickname: string): Promise<void> {
  const button = page.locator(`[data-player-id="${playerId}"] .seat-name`);
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const details = page.getByTestId('seat-details');
  await expect(details).toBeVisible();
  await expect(details).toContainText(nickname);
  await button.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
}

/** Consulta pelo teclado: foco no botão, Enter abre, Escape fecha, foco permanece. */
async function consultByKeyboard(page: Page, playerId: string, nickname: string): Promise<void> {
  const button = page.locator(`[data-player-id="${playerId}"] .seat-name`);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const details = page.getByTestId('seat-details');
  await expect(details).toContainText(nickname);
  await expect(button).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(details).toBeHidden();
  await expect(button).toBeFocused();
}

test('A1: oito assentos no celular cabem com fontes auxiliares e consulta de nomes', async ({ browser }) => {
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

    // Todos os apelidos completos ficam no DOM; prefixos iguais continuam distinguíveis por id.
    const domNames = await circuit.locator('.seat .participant-name').evaluateAll((nodes) => nodes.map((node) => node.textContent));
    expect([...domNames].sort()).toEqual([...names].sort());

    const active = await measureCircuit(host);
    await saveMeasure('medidas-oito-320-ativo.json', active);
    expectReadable(active);
    await capture(host, 'oito-320-ativo.png');

    // Consulta por teclado para o assento de nome longo (truncado) e por toque para um prefixo igual.
    await consultByKeyboard(host, await playerIdOf(active, longName), longName);
    await consultByClick(host, await playerIdOf(active, 'Participante 2'), 'Participante 2');

    // Ausência real: badge “desconectado” precisa caber dentro do chip.
    const absentId = await playerIdOf(active, 'Participante 2');
    await pages[2]!.evaluate(() => window.__trettaTest!.disconnect());
    await expect(host.getByTestId('pause-panel')).toBeVisible();
    await expect(circuit.locator(`[data-player-id="${absentId}"]`)).toContainText('desconectado');
    const paused = await measureCircuit(host);
    await saveMeasure('medidas-oito-320-desconectado.json', paused);
    expectReadable(paused);
    expect(paused.seats.find((seat) => seat.playerId === absentId)?.tags).toContain('desconectado');
    await saveMeasure('medidas-oito-320-desconectado.json', paused);
    await capture(host, 'oito-320-desconectado.png');

    // Substituto assume a vaga depois do prazo: o rótulo muda, o chip continua cabendo e a consulta segue disponível.
    const substitute = host.getByTestId('substitute-Participante 2');
    await expect(substitute).toBeVisible({ timeout: 15_000 });
    await substitute.click();
    await expect(circuit.locator(`[data-player-id="${absentId}"]`)).toContainText('substituto', { timeout: 15_000 });
    const substituted = await measureCircuit(host);
    await saveMeasure('medidas-oito-320-substituto.json', substituted);
    expectReadable(substituted);
    expect(substituted.seats.find((seat) => seat.playerId === absentId)?.tags).toContain('substituto');
    await saveMeasure('medidas-oito-320-substituto.json', substituted);
    await capture(host, 'oito-320-substituto.png');
    await consultByClick(host, absentId, 'Participante 2');

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

async function playerIdOf(measure: CircuitMeasure, nickname: string): Promise<string> {
  const found = measure.seats.find((seat) => seat.nickname === nickname)?.playerId;
  if (found === null || found === undefined) throw new Error(`assento ausente para ${nickname}`);
  return found;
}

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
      const measure = await measureCircuit(host);
      await saveMeasure(`medidas-quatro-${String(width)}.json`, measure);
      expectReadable(measure);
      expect(measure.seats).toHaveLength(4);
      await capture(host, `quatro-${String(width)}.png`);
    }

    const widest = await measureCircuit(host);
    const truncated = widest.seats.filter((seat) => seat.truncated);
    for (const seat of truncated) {
      if (seat.playerId === null) continue;
      await consultByClick(host, seat.playerId, seat.nickname);
    }
    writeFileSync(join(evidenceDir, 'quatro-truncados.json'), JSON.stringify({ truncados: truncated.map((seat) => seat.nickname) }, null, 2));

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('A2: resumo acessível segue o percurso do sentido vigente com retorno à base', async ({ browser }) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  const watcher = pages[4];
  if (host === undefined || watcher === undefined) throw new Error('páginas ausentes');
  const errors = watchPage(host);
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(pages[1]!, invite, 'Bia', 'tucano');
    await joinRoom(pages[2]!, invite, 'Cai', 'raposa');
    await joinRoom(pages[3]!, invite, 'Davi', 'sapo');
    await setNextDeck(host, circuitFourDeck());
    await readyAll(host, pages[1]!, pages[2]!, pages[3]!);
    const readOrder = (page: Page): Promise<string> => page.getByTestId('circuit-order').evaluate((node) => node.textContent ?? '');
    const snapshot = (page: Page): Promise<Array<{ id: string | null; left: string; top: string }>> =>
      page.getByTestId('seat-circuit').locator('.seat').evaluateAll((nodes) =>
        nodes.map((node) => ({
          id: node.getAttribute('data-player-id'),
          left: (node as HTMLElement).style.left,
          top: (node as HTMLElement).style.top,
        })),
      );

    const before = await readOrder(host);
    const positionsBefore = await snapshot(host);
    expect(before).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Ana), Bia, Cai, Davi, de volta a Você (Ana). Sentido horário da rodada.',
    );
    await capture(host, 'rota-antes.png');

    await host.getByTestId('card-red-reverse-1').click();
    await host.getByTestId('play-button').click();
    await expect(host.getByTestId('circuit-direction')).toContainText('anti-horário');
    const afterFirst = await readOrder(host);
    expect(afterFirst).toBe(
      'Ordem dos assentos no circuito, a partir da base onde você está: Você (Ana), Davi, Cai, Bia, de volta a Você (Ana). Sentido anti-horário da rodada.',
    );
    expect(afterFirst).not.toMatch(/próximo|jogar/i);
    expect(await snapshot(host)).toEqual(positionsBefore);
    await capture(host, 'rota-apos-1.png');

    const secondActorPages = pages.slice(1, 4).filter((page) => page !== undefined);
    for (const page of await Promise.all(
      secondActorPages.map(async (candidate) => ((await candidate.getByTestId('turn-indicator').textContent()) === 'Sua vez' ? candidate : null)),
    )) {
      if (page === null) continue;
      await page.getByTestId('card-red-reverse-2').click();
      await page.getByTestId('play-button').click();
      break;
    }
    await expect(host.getByTestId('circuit-direction')).toContainText('Sentido horário');
    await expect(host.getByTestId('circuit-direction')).not.toContainText('anti-horário');
    expect(await readOrder(host)).toBe(before);
    expect(await snapshot(host)).toEqual(positionsBefore);
    await capture(host, 'rota-apos-2.png');

    // A observadora usa a base pública e recebe o mesmo percurso no sentido vigente.
    await watcher.goto(invite);
    await watcher.getByTestId('join-name-input').fill('Zoe');
    await watcher.getByTestId('join-room-button').click();
    await expect(watcher.getByTestId('waiting-banner')).toBeVisible();
    expect(await readOrder(watcher)).toBe(
      'Ordem dos assentos no circuito, a partir da base: Ana, Bia, Cai, Davi, de volta a Ana. Sentido horário da rodada.',
    );
    await watcher.setViewportSize({ width: 320, height: 900 });
    const watcherMeasure = await measureCircuit(watcher);
    expectReadable(watcherMeasure);
    expect(watcherMeasure.seats).toHaveLength(4);
    await saveMeasure('medidas-publico-320.json', watcherMeasure);
    await capture(watcher, 'publico-320.png');

    writeFileSync(
      join(evidenceDir, 'rotas.json'),
      JSON.stringify(
        {
          privadoAntes: before,
          privadoAposPrimeira: afterFirst,
          privadoAposSegunda: await readOrder(host),
          publico: await readOrder(watcher),
        },
        null,
        2,
      ),
    );
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
