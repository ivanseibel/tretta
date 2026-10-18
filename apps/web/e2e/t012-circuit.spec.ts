/**
 * T012 — mesa em circuito: ordem dos assentos, própria pessoa na base, vez,
 * inversão do sentido com servidor real, mesa pública, pausa/reload e larguras
 * do celular ao desktop. Novas capturas vivem em `assets/T012/`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { circuitFourDeck, eightSeatValidationDeck, trainingReverseDeck, twoSeatReverseDeck } from './deck';
import { createRoom, handIds, joinRoom, readyAll, setNextDeck } from './room';
import { startTrainingRound, trainSolo } from './training';

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

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(shotsDir, name), fullPage: true });
}

async function capturePair(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: join(shotsDir, `${name}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: join(shotsDir, `${name}-320.png`), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function noHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

function effectNode(page: Page, category: string): Locator {
  return page.getByTestId(`auto-effect-${category}`);
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

async function playReverse(page: Page): Promise<void> {
  const card = page.getByTestId('my-hand').locator('[data-testid^="card-red-reverse-"]');
  await expect(card).toHaveCount(1);
  await card.click();
  await page.getByTestId('play-button').click();
}

/** Ordem cíclica dos assentos como aparecem no circuito, começando na base. */
async function cyclicOrder(page: Page): Promise<string[]> {
  return page
    .getByTestId('seat-circuit')
    .locator('.seat')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          ring: Number(node.getAttribute('data-ring-index')),
          name: node.querySelector('.participant-name')?.textContent ?? '',
        }))
        .sort((a, b) => a.ring - b.ring)
        .map((entry) => entry.name),
    );
}

/** Mesmo ciclo começa em pontos diferentes conforme a perspectiva; espelhar falharia aqui. */
function assertSameCycle(reference: readonly string[], candidate: readonly string[]): void {
  expect(candidate).toHaveLength(reference.length);
  const start = candidate.indexOf(reference[0] ?? '');
  expect(start).toBeGreaterThanOrEqual(0);
  for (let index = 0; index < reference.length; index++) {
    expect(candidate[(start + index) % candidate.length]).toBe(reference[index]);
  }
}

async function ringSnapshot(circuit: Locator): Promise<Array<{ id: string | null; left: string; top: string }>> {
  return circuit.locator('.seat').evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute('data-player-id'),
      left: (node as HTMLElement).style.left,
      top: (node as HTMLElement).style.top,
    })),
  );
}

async function arrowRotations(circuit: Locator): Promise<number[]> {
  return circuit
    .locator('.seat-arrow')
    .evaluateAll((nodes) => nodes.map((node) => Number.parseFloat(node.getAttribute('data-rotation') ?? 'NaN')));
}

async function currentRing(circuit: Locator): Promise<number> {
  const current = circuit.locator('.seat[data-current="true"]');
  await expect(current).toHaveCount(1);
  return Number(await current.getAttribute('data-ring-index'));
}

async function expectNoSeatOverlap(page: Page): Promise<void> {
  const overlaps = await page
    .getByTestId('seat-circuit')
    .locator('.seat')
    .evaluateAll((nodes) => {
      const boxes = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const found: string[] = [];
      for (let first = 0; first < boxes.length; first++) {
        for (let second = first + 1; second < boxes.length; second++) {
          const a = boxes[first];
          const b = boxes[second];
          if (a === undefined || b === undefined) continue;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapX > 1 && overlapY > 1) found.push(`${String(first)}x${String(second)}`);
        }
      }
      return found;
    });
  expect(overlaps).toEqual([]);
}

async function expectSeatsInsideViewport(page: Page): Promise<void> {
  const offenders = await page
    .getByTestId('seat-circuit')
    .locator('.seat')
    .evaluateAll((nodes) =>
      nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < -0.5 || rect.right > window.innerWidth + 0.5;
      }).length,
    );
  expect(offenders).toBe(0);
}

test('ordem, vez e duas inversões consecutivas com quatro assentos', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  const [contextA, contextB, contextC, contextD, contextW] = contexts;
  if (
    contextA === undefined ||
    contextB === undefined ||
    contextC === undefined ||
    contextD === undefined ||
    contextW === undefined
  ) {
    throw new Error('contextos ausentes');
  }
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();
  const pageD = await contextD.newPage();
  const pageW = await contextW.newPage();
  const errors = watchPage(pageA);
  const players = [pageA, pageB, pageC, pageD] as const;
  try {
    const invite = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, invite, 'Bia', 'tucano');
    await joinRoom(pageC, invite, 'Cai', 'raposa');
    await joinRoom(pageD, invite, 'Davi', 'sapo');
    await setNextDeck(pageA, circuitFourDeck());
    await readyAll(pageA, pageB, pageC, pageD);

    // Cada pessoa vê os quatro assentos uma vez, com o próprio assento na base.
    for (const page of players) {
      const circuit = page.getByTestId('seat-circuit');
      await expect(circuit.locator('.seat')).toHaveCount(4);
      const self = circuit.locator('.seat[data-self="true"]');
      await expect(self).toHaveCount(1);
      await expect(self).toHaveAttribute('data-ring-index', '0');
      await expect(self).toContainText('Você');
      await expect(circuit.locator('.seat-arrow')).toHaveCount(4);
      await expect(page.getByTestId('circuit-direction')).toContainText('Sentido horário');
      await expect(page.getByTestId('circuit-order')).toContainText('Ordem dos assentos');
    }

    // Mesma ordem cíclica em todas as perspectivas: rotação preserva a orientação.
    const orderA = await cyclicOrder(pageA);
    for (const page of [pageB, pageC, pageD]) {
      assertSameCycle(orderA, await cyclicOrder(page));
    }

    // Observadora entra no meio da rodada: fica fora do circuito, sem mão.
    await joinAsWatcher(pageW, invite, 'Zoe');
    await expect(pageW.getByTestId('public-table')).toBeVisible();
    const watcherCircuit = pageW.getByTestId('seat-circuit');
    await expect(watcherCircuit.locator('.seat')).toHaveCount(4);
    await expect(watcherCircuit.locator('[data-self="true"]')).toHaveCount(0);
    await expect(watcherCircuit).not.toContainText('Você');
    await expect(pageW.getByTestId('my-hand')).toHaveCount(0);
    assertSameCycle(orderA, await cyclicOrder(pageW));

    const circuitA = pageA.getByTestId('seat-circuit');
    const actor = await turnPage(players);
    await expect(actor.getByTestId('seat-circuit').locator('.seat[data-self="true"]')).toHaveAttribute('data-current', 'true');
    const positionsBefore = await ringSnapshot(circuitA);
    const rotationsBefore = await arrowRotations(circuitA);
    const watcherCurrentBefore = await currentRing(watcherCircuit);
    await capture(pageA, 'circuito-4-antes.png');
    await capture(pageW, 'circuito-publico-antes.png');

    // Primeira Inversão: setas e texto do estado mudam junto com o efeito.
    await playReverse(actor);
    await expect(actor.getByTestId('circuit-direction')).toContainText('Sentido anti-horário');
    await expect(effectNode(actor, 'directionReversed')).toBeVisible();
    for (const page of players) {
      await expect(page.getByTestId('circuit-direction')).toContainText('Sentido anti-horário');
    }

    // O sentido anti-horário anda para o índice anterior; a observadora acompanha.
    await expect.poll(async () => currentRing(watcherCircuit)).toBe((watcherCurrentBefore + 3) % 4);
    const rotationsAfterFirst = await arrowRotations(circuitA);
    expect(await ringSnapshot(circuitA)).toEqual(positionsBefore);
    for (let index = 0; index < rotationsAfterFirst.length; index++) {
      const diff = ((((rotationsAfterFirst[index] ?? 0) - (rotationsBefore[index] ?? 0)) % 360) + 360) % 360;
      expect(Math.abs(diff - 180)).toBeLessThanOrEqual(0.1);
    }
    await capture(pageA, 'circuito-4-apos-1.png');
    await capture(pageW, 'circuito-publico-apos-1.png');

    // Segunda Inversão imediata pelo assento seguinte, também com a carta.
    const second = await turnPage(players);
    expect(second).not.toBe(actor);
    await playReverse(second);
    for (const page of players) {
      await expect(page.getByTestId('circuit-direction')).toContainText('Sentido horário');
      await expect(page.getByTestId('circuit-direction')).not.toContainText('anti-horário');
    }
    await expect.poll(async () => currentRing(watcherCircuit)).toBe(watcherCurrentBefore);
    expect(await ringSnapshot(circuitA)).toEqual(positionsBefore);
    await capture(pageA, 'circuito-4-apos-2.png');
    await capture(pageW, 'circuito-publico-apos-2.png');

    // Pausa por ausência: assentos e sentido ficam, a vez some e os comandos bloqueiam.
    const bystander = [pageB, pageC, pageD].find((page) => page !== actor && page !== second);
    if (bystander === undefined) throw new Error('sem página de reserva');
    await bystander.evaluate(() => window.__trettaTest!.disconnect());
    await expect(pageA.getByTestId('pause-panel')).toBeVisible();
    await expect(pageA.getByTestId('circuit-direction')).toContainText('rodada pausada');
    await expect(pageA.getByTestId('circuit-direction')).toContainText('Sentido horário');
    await expect(circuitA.locator('.seat')).toHaveCount(4);
    await expect(circuitA.locator('[data-current="true"]')).toHaveCount(0);
    await expect(pageA.getByTestId('draw-button')).toHaveCount(0);
    await expect(pageA.getByTestId('play-button')).toHaveCount(0);
    await capture(pageA, 'circuito-4-pausa.png');
    await bystander.evaluate(() => window.__trettaTest!.connect());
    await expect(pageA.getByTestId('pause-panel')).toHaveCount(0, { timeout: 20_000 });
    await expect(pageA.getByTestId('circuit-direction')).not.toContainText('rodada pausada');
    await expect(circuitA.locator('[data-current="true"]')).toHaveCount(1);

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('inversão com dois assentos devolve a vez sem anunciar mudança de sentido', async ({ browser }) => {
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const errorsA = watchPage(pageA);
  const errorsB = watchPage(pageB);
  try {
    const invite = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, invite, 'Bia', 'tucano');
    await setNextDeck(pageA, twoSeatReverseDeck());
    await readyAll(pageA, pageB);
    const pages = [pageA, pageB] as const;

    const actor = await turnPage(pages);
    const other = actor === pageA ? pageB : pageA;
    const actorName = actor === pageA ? 'Ana' : 'Bia';
    const actorCircuit = actor.getByTestId('seat-circuit');
    const positions = await ringSnapshot(actorCircuit);
    const rotations = await arrowRotations(actorCircuit);
    await expect(actor.getByTestId('circuit-direction')).toContainText('Sentido horário');
    await expect(other.getByTestId('circuit-direction')).toContainText('Sentido horário');

    await playReverse(actor);

    // Com dois assentos o motor trata a Inversão como Bloqueio: a vez volta
    // para quem jogou, o sentido não muda e nada é anunciado como mudança.
    await expect(actor.getByTestId('turn-indicator')).toHaveText('Sua vez');
    await expect(other.getByTestId('turn-indicator')).toHaveText(`Vez de ${actorName}`);
    await expect(other.getByTestId('draw-button')).toHaveCount(0);
    await expect(other.getByTestId('seat-circuit').locator('.seat[data-current="true"]')).toHaveAttribute(
      'data-testid',
      `seat-${actorName}`,
    );
    for (const page of pages) {
      await expect(page.getByTestId('circuit-direction')).toContainText('Sentido horário');
      await expect(page.getByTestId('circuit-direction')).not.toContainText('anti-horário');
      await expect(effectNode(page, 'directionReversed')).toHaveCount(0);
    }
    expect(await ringSnapshot(actorCircuit)).toEqual(positions);
    expect(await arrowRotations(actorCircuit)).toEqual(rotations);
    await capture(actor, 'circuito-2-bloqueio.png');

    expect(errorsA.pageErrors).toEqual([]);
    expect(errorsA.consoleErrors).toEqual([]);
    expect(errorsB.pageErrors).toEqual([]);
    expect(errorsB.consoleErrors).toEqual([]);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('treino com três bots mantém rótulos, ids e alternativas textuais', async ({ page }) => {
  const errors = watchPage(page);
  await trainSolo(page, 'Ana');
  await setNextDeck(page, trainingReverseDeck());
  await startTrainingRound(page);

  const circuit = page.getByTestId('seat-circuit');
  await expect(circuit.locator('.seat')).toHaveCount(4);
  const ids = await circuit.locator('.seat').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-player-id')));
  expect(new Set(ids).size).toBe(4);
  const self = circuit.locator('.seat[data-self="true"]');
  await expect(self).toHaveCount(1);
  await expect(self).toHaveAttribute('data-ring-index', '0');
  await expect(page.getByTestId('seat-Ana')).toContainText('Você');
  for (const name of ['Tico', 'Lila', 'Nino']) {
    const chip = page.getByTestId(`seat-${name}`);
    await expect(chip).toContainText('bot');
    await expect(chip).toHaveAttribute('data-self', 'false');
    await expect(chip).not.toContainText('desconectado');
  }
  await expect(circuit.locator('.seat-arrow[aria-hidden="true"]')).toHaveCount(4);
  await expect(page.getByTestId('circuit-order')).toContainText('Tico (bot)');
  await expect(page.getByText('desconectado')).toHaveCount(0);
  await expect(page.getByTestId('my-hand')).toBeVisible();
  await capturePair(page, 'circuito-treino');

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test('pausa e reload após Inversão preservam o sentido sem repetir o evento', async ({ page }) => {
  const errors = watchPage(page);
  await trainSolo(page, 'Bia');
  await setNextDeck(page, trainingReverseDeck());
  await startTrainingRound(page);

  await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez', { timeout: 120_000 });
  const handBefore = await handIds(page);
  expect(handBefore).toHaveLength(7);
  const reverseCard = page.getByTestId('my-hand').locator('[data-testid^="card-red-reverse-"]');
  await expect(reverseCard).toHaveCount(1);
  const reverseId = await reverseCard.getAttribute('data-testid');
  if (reverseId === null) throw new Error('Inversão sem testid');
  await reverseCard.click();
  await page.getByTestId('play-button').click();
  await expect(page.getByTestId('circuit-direction')).toContainText('Sentido anti-horário');
  await expect(page.getByTestId('seat-circuit').locator('.seat[data-self="true"]')).toHaveCount(1);
  const handAfterPlay = await handIds(page);
  expect(handAfterPlay).toHaveLength(6);
  expect(handAfterPlay).not.toContain(reverseId);

  // Reload durante a rodada invertida: o snapshot volta com a mesma direção.
  await page.reload();
  await expect(page.getByTestId('recovering')).toBeVisible();
  await expect(page.getByTestId('my-hand')).toBeVisible({ timeout: 60_000 });

  await expect(page.getByTestId('pause-panel')).toBeVisible();
  await expect(page.getByTestId('pause-retention')).toContainText('Os bots esperam por você');
  await expect(page.getByTestId('circuit-direction')).toContainText('Sentido anti-horário');
  await expect(page.getByTestId('circuit-direction')).toContainText('rodada pausada');
  await expect(page.getByTestId('seat-circuit').locator('.seat')).toHaveCount(4);
  await expect(page.getByTestId('seat-circuit').locator('[data-current="true"]')).toHaveCount(0);
  await expect(effectNode(page, 'directionReversed')).toHaveCount(0);
  await expect(page.getByTestId('draw-button')).toHaveCount(0);
  expect(await handIds(page)).toEqual(handAfterPlay);
  await capturePair(page, 'circuito-inversao-pausa');

  // Retomada explícita: o sentido invertido continua valendo.
  await page.getByTestId('continue-round-button').click();
  await expect(page.getByTestId('pause-panel')).toHaveCount(0);
  await expect(page.getByTestId('circuit-direction')).not.toContainText('rodada pausada');
  await expect(page.getByTestId('circuit-direction')).toContainText('Sentido anti-horário');
  expect(await handIds(page)).toEqual(handAfterPlay);

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test('quatro assentos legíveis em 320, 390, 768 e 1280 px', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  const host = await contexts[0]?.newPage();
  if (host === undefined) throw new Error('página anfitriã ausente');
  const errors = watchPage(host);
  try {
    const invite = await createRoom(host, 'Ana');
    const pages: Page[] = [host];
    for (const [index, nickname] of ['Bia', 'B'.repeat(24), 'Davi'].entries()) {
      const context = contexts[index + 1];
      if (context === undefined) throw new Error('contexto ausente');
      const page = await context.newPage();
      pages.push(page);
      await joinRoom(page, invite, nickname, 'tucano');
    }
    await setNextDeck(host, circuitFourDeck());
    await readyAll(host, ...pages.slice(1));

    for (const width of [320, 390, 768, 1280]) {
      await host.setViewportSize({ width, height: 900 });
      await noHorizontalOverflow(host);
      await expect(host.getByTestId('seat-circuit').locator('.seat')).toHaveCount(4);
      await expectNoSeatOverlap(host);
      await expectSeatsInsideViewport(host);
      await capture(host, `circuito-4-${String(width)}.png`);
    }

    // Mão e ações seguem utilizáveis na menor largura.
    await host.setViewportSize({ width: 320, height: 900 });
    const actor = await turnPage(pages);
    await actor.setViewportSize({ width: 320, height: 900 });
    await noHorizontalOverflow(actor);
    await expect(actor.getByTestId('draw-button')).toBeVisible();
    await actor.getByTestId('draw-button').click();
    await expect(actor.getByTestId('after-draw-hint')).toBeVisible();
    await actor.getByTestId('pass-button').click();
    await expect(actor.getByTestId('turn-indicator')).not.toHaveText('Sua vez');
    await expect(actor.getByTestId('my-hand')).toBeVisible();
    await noHorizontalOverflow(actor);

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('oito assentos preservam o circuito sem overflow horizontal', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 8 }, () => browser.newContext({ viewport: { width: 1280, height: 1000 } })));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const host = pages[0];
  if (host === undefined) throw new Error('página anfitriã ausente');
  const errors = watchPage(host);
  try {
    const longNickname = 'W'.repeat(24);
    const invite = await createRoom(host, longNickname);
    for (let index = 1; index < pages.length; index++) {
      const page = pages[index];
      if (page === undefined) continue;
      await joinRoom(page, invite, index === 7 ? 'W'.repeat(23) + 'x' : `J${String(index)}`, 'lobo');
    }
    await setNextDeck(host, eightSeatValidationDeck());
    await readyAll(host, ...pages.slice(1));

    const circuit = host.getByTestId('seat-circuit');
    await expect(circuit.locator('.seat')).toHaveCount(8);
    const ringIndexes = await circuit
      .locator('.seat')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-ring-index'))).sort((a, b) => a - b));
    expect(ringIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    await expect(circuit.locator('.seat[data-self="true"]')).toHaveAttribute('data-ring-index', '0');
    await expect(host.getByTestId(`seat-${longNickname}`)).toBeVisible();

    for (const width of [320, 390, 768, 1280]) {
      await host.setViewportSize({ width, height: 1000 });
      await noHorizontalOverflow(host);
      await expectNoSeatOverlap(host);
      await expectSeatsInsideViewport(host);
      await capture(host, `circuito-8-${String(width)}.png`);
    }

    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
