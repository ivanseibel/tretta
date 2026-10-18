/**
 * T013 — evidência: texto central do descarte privado (GameTable) e público.
 *
 * Spec de evidência da execução manual T013: roda somente na cópia isolada,
 * nunca na árvore entregue. A fase vem de T013_PHASE (`before` = working tree
 * sem a correção, `after` = com a correção) e o diretório de saída de
 * T013_OUT. As mesmas medições/capturas/asserções são feitas nas duas fases
 * para comparação direta.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { createClassicDeck } from '@tretta/rules';
import { expect, test } from './fixtures';
import { createRoom, joinRoom, readyAll, setNextDeck } from './room';
import { startTrainingRound, trainSolo } from './training';

const phase = process.env.T013_PHASE;
const outRoot = process.env.T013_OUT;
if (phase !== 'before' && phase !== 'after') throw new Error('Defina T013_PHASE=before|after.');
if (outRoot === undefined) throw new Error('Defina T013_OUT.');
const shotsDir = join(outRoot, phase);
mkdirSync(shotsDir, { recursive: true });

const WIDTHS = [320, 390, 768, 1280] as const;

interface DeckSpec {
  readonly hands: readonly (readonly string[])[];
  readonly discard: string;
  readonly draw: readonly string[];
}

function buildDeck(spec: DeckSpec): string[] {
  const deck: string[] = [];
  const handSize = spec.hands[0]?.length ?? 0;
  for (let round = 0; round < handSize; round++) {
    for (const hand of spec.hands) {
      const cardId = hand[round];
      if (cardId === undefined) throw new Error('Mãos com tamanhos diferentes.');
      deck.push(cardId);
    }
  }
  deck.push(spec.discard);
  deck.push(...spec.draw);
  const used = new Set(deck);
  const remaining = createClassicDeck()
    .map((card) => card.id)
    .filter((id) => !used.has(id));
  deck.push(...remaining);
  if (deck.length !== 108) throw new Error(`Baralho com ${deck.length} cartas.`);
  return deck;
}

/**
 * Dois assentos: Ana abre com Bloqueio, Inversão, +2 e coringa de cor legais
 * em sequência (com dois assentos a Inversão vale como Bloqueio e a vez volta
 * para ela); Bia só tem azuis e não age. O descarte inicial é um número para
 * conservar a abertura normal.
 */
function discardTextDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-skip-1', 'red-reverse-1', 'red-draw-two-1', 'wild-color-1', 'red-1-1', 'red-2-1', 'red-3-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1'],
  });
}

/**
 * Treino: Ana abre com a Inversão vermelha e os três bots só têm números de
 * outras cores — sem carta que combine com a cor ativa (vermelho) ou com o
 * símbolo Inversão — e a pilha de compra imediata também é não vermelha; o
 * descarte permanece vermelho durante a captura.
 */
function trainingDiscardDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-reverse-1', 'red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'green-1-1', 'green-2-1', 'green-3-1', 'yellow-1-1'],
      ['blue-4-1', 'blue-5-1', 'blue-6-1', 'green-4-1', 'green-5-1', 'yellow-2-1', 'yellow-3-1'],
      ['blue-7-1', 'blue-8-1', 'green-6-1', 'green-7-1', 'yellow-4-1', 'yellow-5-1', 'yellow-6-1'],
    ],
    discard: 'red-9-1',
    draw: [
      'blue-9-1',
      'blue-0-1',
      'green-8-1',
      'green-9-1',
      'green-0-1',
      'yellow-7-1',
      'yellow-8-1',
      'yellow-9-1',
      'yellow-0-1',
      'blue-1-2',
    ],
  });
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface CardMeasure {
  cardId: string | null;
  text: string | null;
  dataLong: string | null;
  fontSize: string;
  overflowWrap: string;
  card: Rect;
  value: Rect;
  symbol: Rect | null;
  name: Rect | null;
  scrollWidth: number;
  clientWidth: number;
  lines: number;
  clippedHorizontally: boolean;
  insideCard: boolean;
  overlapsSymbol: boolean;
  overlapsName: boolean;
  ariaLabel: string | null;
}

/** Mede cada elemento que casa com `selector` no contexto real da página. */
async function measureCards(page: Page, selector: string): Promise<CardMeasure[]> {
  return page.evaluate((sel) => {
    const rect = (el: Element): Rect => {
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    };
    return Array.from(document.querySelectorAll(sel)).flatMap((card) => {
      const value = card.querySelector('.card-value');
      if (value === null) return [];
      const style = getComputedStyle(value);
      const cardRect = rect(card);
      const valueRect = rect(value);
      const symbol = card.querySelector('.card-symbol') ?? card.querySelector('.color-symbol');
      const name = card.querySelector('.card-name');
      const symbolRect = symbol === null ? null : rect(symbol);
      const nameRect = name === null ? null : rect(name);
      const range = document.createRange();
      range.selectNodeContents(value);
      const lines = Array.from(range.getClientRects()).length;
      return [
        {
          cardId: card.getAttribute('data-card-id'),
          text: value.textContent,
          dataLong: value.getAttribute('data-long'),
          fontSize: style.fontSize,
          overflowWrap: style.overflowWrap,
          card: cardRect,
          value: valueRect,
          symbol: symbolRect,
          name: nameRect,
          scrollWidth: value.scrollWidth,
          clientWidth: value.clientWidth,
          lines,
          clippedHorizontally:
            valueRect.left < cardRect.left - 0.5 ||
            valueRect.right > cardRect.right + 0.5 ||
            value.scrollWidth > value.clientWidth + 0.5,
          insideCard:
            valueRect.left >= cardRect.left - 0.5 &&
            valueRect.right <= cardRect.right + 0.5 &&
            valueRect.top >= cardRect.top - 0.5 &&
            valueRect.bottom <= cardRect.bottom + 0.5,
          overlapsSymbol: symbolRect !== null && valueRect.top < symbolRect.bottom - 0.5,
          overlapsName: nameRect !== null && valueRect.bottom > nameRect.top + 0.5,
          ariaLabel: card.getAttribute('aria-label'),
        },
      ];
    });
  }, selector);
}

function only(measures: readonly CardMeasure[], where: string): CardMeasure {
  const first = measures[0];
  if (first === undefined || measures.length !== 1) throw new Error(`${where}: esperava exatamente uma carta.`);
  return first;
}

function find(measures: readonly CardMeasure[], cardId: string, where: string): CardMeasure {
  const found = measures.find((entry) => entry.cardId === cardId);
  if (found === undefined) throw new Error(`${where}: carta ${cardId} ausente.`);
  return found;
}

/** Propriedades registradas no JSON de medições (sem os retângulos brutos). */
function summary(target: string, m: CardMeasure): Record<string, unknown> {
  return {
    target,
    cardId: m.cardId,
    text: m.text,
    dataLong: m.dataLong,
    fontSize: m.fontSize,
    overflowWrap: m.overflowWrap,
    lines: m.lines,
    valueWidth: Number(m.value.width.toFixed(2)),
    cardWidth: Number(m.card.width.toFixed(2)),
    valueHeight: Number(m.value.height.toFixed(2)),
    clippedHorizontally: m.clippedHorizontally,
    insideCard: m.insideCard,
    overlapsSymbol: m.overlapsSymbol,
    overlapsName: m.overlapsName,
    ariaLabel: m.ariaLabel,
  };
}

function watchPage(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
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
  expect(widths.document, `overflow horizontal em ${String(widths.viewport)}px`).toBeLessThanOrEqual(widths.viewport);
}

/** Espera o overlay de efeito automático (fila T005C) sair antes de capturar. */
async function waitNoEffectOverlay(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid^="auto-effect-"]').length === 0,
    undefined,
    { timeout: 20_000 },
  );
}

/** Seleciona na mão e confirma a jogada, por teclado ou clique. */
async function selectAndPlay(page: Page, cardId: string, viaKeyboard: boolean, wildColor?: 'red'): Promise<void> {
  const card = page.getByTestId(`card-${cardId}`);
  await expect(card).toBeVisible();
  if (viaKeyboard) {
    await card.focus();
    await page.keyboard.press('Enter');
  } else {
    await card.click();
  }
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  const play = page.getByTestId('play-button');
  if (viaKeyboard) {
    await play.focus();
    await page.keyboard.press('Enter');
  } else {
    await play.click();
  }
  if (wildColor !== undefined) {
    await expect(page.getByTestId('color-chooser')).toBeVisible();
    if (viaKeyboard) {
      // O foco inicial vai para a primeira opção (vermelho); Enter confirma.
      await expect(page.getByTestId(`color-option-${wildColor}`)).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await page.getByTestId(`color-option-${wildColor}`).click();
    }
  }
}

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

/* ---------- asserções por fase ---------- */

/** Carta longa correta: esperado da mão, do descarte público e do pós-correção. */
function assertLongOk(m: CardMeasure, where: string, handRef?: CardMeasure): void {
  expect(m.dataLong, `${where} data-long`).toBe('true');
  expect(m.clippedHorizontally, `${where} recorte horizontal`).toBe(false);
  expect(m.insideCard, `${where} dentro da carta`).toBe(true);
  expect(m.overlapsSymbol, `${where} sobrepõe símbolo`).toBe(false);
  expect(m.overlapsName, `${where} sobrepõe nome auxiliar`).toBe(false);
  if (handRef !== undefined) expect(m.fontSize, `${where} fonte igual à mão`).toBe(handRef.fontSize);
}

/** Carta longa cortada: sintoma relatado que a fase `before` deve reproduzir. */
function assertLongClipped(m: CardMeasure, where: string): void {
  expect(m.dataLong, `${where} data-long na fase before`).toBeNull();
  expect(m.clippedHorizontally, `${where} recorte na fase before`).toBe(true);
}

/** Carta curta (número, +2, Cor): apresentação inalterada nas duas fases. */
function assertShortOk(m: CardMeasure, where: string): void {
  expect(m.dataLong, `${where} data-long`).toBeNull();
  expect(m.clippedHorizontally, `${where} recorte horizontal`).toBe(false);
  expect(m.insideCard, `${where} dentro da carta`).toBe(true);
}

function assertLongPerPhase(m: CardMeasure, where: string, handRef?: CardMeasure): void {
  if (phase === 'before') assertLongClipped(m, where);
  else assertLongOk(m, where, handRef);
}

/* ---------- coleta por estado ---------- */

interface SurveyMeasures {
  readonly discard: CardMeasure;
  readonly hand: readonly CardMeasure[];
  readonly publicDiscard: CardMeasure;
  readonly otherDiscard: CardMeasure;
  readonly drawPile: CardMeasure;
  readonly publicDrawPile: CardMeasure;
}

interface SurveyOptions {
  readonly record: Record<string, unknown>[];
  readonly state: string;
  readonly fullWidths: readonly number[];
  readonly zoomWidths: readonly number[];
  readonly check?: (width: number, m: SurveyMeasures) => void;
}

/** Fixa as larguras, mede, confere e captura um estado. */
async function survey(
  pageA: Page,
  pageB: Page,
  pageW: Page,
  discardPile: Locator,
  publicPile: Locator,
  options: SurveyOptions,
): Promise<void> {
  for (const width of WIDTHS) {
    await pageA.setViewportSize({ width, height: 900 });
    await pageW.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(pageA);
    const overflowW = await pageW.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    await expect(pageA.getByTestId('seat-circuit')).toBeVisible();
    await expect(pageW.getByTestId('public-table')).toBeVisible();
    await waitNoEffectOverlay(pageA);
    await waitNoEffectOverlay(pageW);
    const discard = only(await measureCards(pageA, '[data-testid="discard-top"]'), 'descarte privado');
    const hand = await measureCards(pageA, '[data-testid="my-hand"] [data-card-id]');
    const publicDiscard = only(await measureCards(pageW, '[data-testid="public-discard-top"]'), 'descarte público');
    const otherDiscard = only(await measureCards(pageB, '[data-testid="discard-top"]'), 'descarte de B');
    const drawPile = only(await measureCards(pageA, '[data-testid="draw-pile"]'), 'pilha de compra');
    const publicDrawPile = only(
      await measureCards(pageW, '[data-testid="public-draw-pile"]'),
      'pilha de compra pública',
    );
    for (const [target, m] of [
      ['descarte-privado-A', discard],
      ['descarte-publico', publicDiscard],
      ['pilha-compra', drawPile],
      ['pilha-compra-publica', publicDrawPile],
    ] as const) {
      options.record.push({ phase, state: options.state, width, target, ...summary(target, m) });
    }
    if (width === 1280) {
      options.record.push({
        phase,
        state: options.state,
        width,
        target: 'descarte-privado-B',
        ...summary('descarte-privado-B', otherDiscard),
      });
    }
    options.record.push({ phase, state: options.state, width, target: 'overflow-publico', ...overflowW });
    for (const m of hand) options.record.push({ phase, state: options.state, width, target: 'mao', ...summary('mao', m) });
    options.check?.(width, { discard, hand, publicDiscard, otherDiscard, drawPile, publicDrawPile });
    if (options.fullWidths.includes(width)) {
      await pageA.screenshot({ path: join(shotsDir, `${options.state}-A-${String(width)}.png`), fullPage: true });
      await pageW.screenshot({ path: join(shotsDir, `${options.state}-W-${String(width)}.png`), fullPage: true });
    }
    if (options.zoomWidths.includes(width)) {
      await discardPile.screenshot({ path: join(shotsDir, `${options.state}-A-${String(width)}-zoom.png`) });
      await publicPile.screenshot({ path: join(shotsDir, `${options.state}-W-${String(width)}-zoom.png`) });
    }
  }
}

test('T013 — Bloqueio e Inversão no descarte privado e público, 320–1280 px', async ({ browser }) => {
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const contextW = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageW = await contextW.newPage();
  const errorsA = watchPage(pageA);
  const errorsB = watchPage(pageB);
  const errorsW = watchPage(pageW);
  const record: Record<string, unknown>[] = [];
  // Referências da mão por largura (o componente da mão já usa data-long).
  const handSkipAt = new Map<number, CardMeasure>();
  const handReverseAt = new Map<number, CardMeasure>();
  try {
    const invite = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, invite, 'Bia', 'tucano');
    await setNextDeck(pageA, discardTextDeck());
    await readyAll(pageA, pageB);
    // Semente da fixture (7): o assento 0 (Ana) abre a rodada.
    await expect(pageA.getByTestId('turn-indicator')).toHaveText('Sua vez');

    await joinAsWatcher(pageW, invite, 'Zoe');
    await expect(pageW.getByTestId('public-table')).toBeVisible();
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('data-card-id', 'red-9-1');

    const discardPile = pageA.locator('div.pile').filter({ has: pageA.getByTestId('discard-top') });
    const publicPile = pageW.locator('div.pile').filter({ has: pageW.getByTestId('public-discard-top') });

    // Estado 0: descarte numérico "9", "?" na compra e mão com as duas palavras.
    await survey(pageA, pageB, pageW, discardPile, publicPile, {
      record,
      state: '0-inicial',
      fullWidths: [320, 1280],
      zoomWidths: [320, 1280],
      check: (width, m) => {
        expect(m.discard.text, 'descarte 9').toBe('9');
        assertShortOk(m.discard, 'descarte 9');
        expect(m.drawPile.text, 'pilha de compra').toBe('?');
        const skip = find(m.hand, 'red-skip-1', 'mão inicial');
        const reverse = find(m.hand, 'red-reverse-1', 'mão inicial');
        expect(skip.text, 'mão Bloqueio').toBe('Bloqueio');
        expect(reverse.text, 'mão Inversão').toBe('Inversão');
        assertLongOk(skip, `mão Bloqueio ${String(width)}`);
        assertLongOk(reverse, `mão Inversão ${String(width)}`);
        expect(find(m.hand, 'red-draw-two-1', 'mão inicial').text).toBe('+2');
        expect(find(m.hand, 'wild-color-1', 'mão inicial').text).toBe('Cor');
        assertShortOk(find(m.hand, 'red-draw-two-1', 'mão inicial'), 'mão +2');
        assertShortOk(find(m.hand, 'wild-color-1', 'mão inicial'), 'mão Cor');
        handSkipAt.set(width, skip);
        handReverseAt.set(width, reverse);
      },
    });
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho 9');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho 9');

    // Estado 1: Bloqueio jogado por teclado (setas + Enter).
    const skipCard = pageA.getByTestId('card-red-skip-1');
    await expect(skipCard).toHaveAttribute('aria-label', 'Vermelho Bloqueio, jogável');
    await skipCard.focus();
    await pageA.keyboard.press('ArrowRight');
    await expect(pageA.getByTestId('card-red-reverse-1')).toBeFocused();
    await pageA.keyboard.press('ArrowLeft');
    await expect(skipCard).toBeFocused();
    await pageA.keyboard.press('Enter');
    await expect(skipCard).toHaveAttribute('aria-pressed', 'true');
    await pageA.getByTestId('play-button').focus();
    await pageA.keyboard.press('Enter');
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-skip-1');
    await expect(pageB.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-skip-1');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('data-card-id', 'red-skip-1');
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho Bloqueio');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho Bloqueio');

    await survey(pageA, pageB, pageW, discardPile, publicPile, {
      record,
      state: '1-bloqueio',
      fullWidths: [...WIDTHS],
      zoomWidths: [...WIDTHS],
      check: (width, m) => {
        expect(m.discard.text, 'descarte Bloqueio').toBe('Bloqueio');
        assertLongPerPhase(m.discard, `descarte Bloqueio ${String(width)}`, handSkipAt.get(width));
        assertLongPerPhase(m.otherDiscard, `descarte Bloqueio de B ${String(width)}`, handSkipAt.get(1280));
        assertLongOk(m.publicDiscard, `descarte público Bloqueio ${String(width)}`, handSkipAt.get(width));
      },
    });

    // Estado 2: Inversão em seguida (com dois assentos vale como Bloqueio).
    await selectAndPlay(pageA, 'red-reverse-1', false);
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-reverse-1');
    await expect(pageB.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-reverse-1');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('data-card-id', 'red-reverse-1');
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho Inversão');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho Inversão');

    await survey(pageA, pageB, pageW, discardPile, publicPile, {
      record,
      state: '2-inversao',
      fullWidths: [...WIDTHS],
      zoomWidths: [...WIDTHS],
      check: (width, m) => {
        expect(m.discard.text, 'descarte Inversão').toBe('Inversão');
        assertLongPerPhase(m.discard, `descarte Inversão ${String(width)}`, handReverseAt.get(width));
        assertLongPerPhase(m.otherDiscard, `descarte Inversão de B ${String(width)}`, handReverseAt.get(1280));
        assertLongOk(m.publicDiscard, `descarte público Inversão ${String(width)}`, handReverseAt.get(width));
      },
    });

    // Estado 3: +2 curto preservado.
    await selectAndPlay(pageA, 'red-draw-two-1', true);
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-draw-two-1');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('data-card-id', 'red-draw-two-1');
    await survey(pageA, pageB, pageW, discardPile, publicPile, {
      record,
      state: '3-mais-dois',
      fullWidths: [320, 1280],
      zoomWidths: [320, 1280],
      check: (width, m) => {
        expect(m.discard.text, 'descarte +2').toBe('+2');
        assertShortOk(m.discard, `descarte +2 ${String(width)}`);
        assertShortOk(m.publicDiscard, `descarte público +2 ${String(width)}`);
      },
    });

    // Estado 4: coringa de cor descartado com escolha por teclado (vermelho).
    await selectAndPlay(pageA, 'wild-color-1', true, 'red');
    await expect(pageA.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'wild-color-1');
    await expect(pageW.getByTestId('public-discard-top')).toHaveAttribute('data-card-id', 'wild-color-1');
    await expect(pageA.getByTestId('active-color')).toContainText('Vermelho');
    await survey(pageA, pageB, pageW, discardPile, publicPile, {
      record,
      state: '4-coringa',
      fullWidths: [320, 1280],
      zoomWidths: [320, 1280],
      check: (width, m) => {
        expect(m.discard.text, 'descarte Cor').toBe('Cor');
        assertShortOk(m.discard, `descarte Cor ${String(width)}`);
        assertShortOk(m.publicDiscard, `descarte público Cor ${String(width)}`);
      },
    });

    // Bloqueio, Inversão e +2 devolvem a vez a Ana com dois assentos; o
    // coringa não bloqueia e passa a vez para Bia, que não age.
    await expect(pageA.getByTestId('turn-indicator')).toHaveText('Vez de Bia');
    const handEnd = await measureCards(pageA, '[data-testid="my-hand"] [data-card-id]');
    expect(handEnd).toHaveLength(3);

    expect(errorsA.pageErrors).toEqual([]);
    expect(errorsA.consoleErrors).toEqual([]);
    expect(errorsB.pageErrors).toEqual([]);
    expect(errorsB.consoleErrors).toEqual([]);
    expect(errorsW.pageErrors).toEqual([]);
    expect(errorsW.consoleErrors).toEqual([]);
  } finally {
    writeFileSync(join(shotsDir, 'measurements-sala.json'), `${JSON.stringify(record, null, 2)}\n`);
    await Promise.all([contextA.close(), contextB.close(), contextW.close()]);
  }
});

test('T013 — treino (mesmo GameTable): Inversão no descarte em 390 px', async ({ page }) => {
  const errors = watchPage(page);
  const record: Record<string, unknown>[] = [];
  try {
    await trainSolo(page, 'Ana');
    await setNextDeck(page, trainingDiscardDeck());
    await startTrainingRound(page);
    await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez', { timeout: 120_000 });
    await page.setViewportSize({ width: 390, height: 900 });
    await noHorizontalOverflow(page);

    const hand = await measureCards(page, '[data-testid="my-hand"] [data-card-id]');
    const handRef = find(hand, 'red-reverse-1', 'mão treino');
    expect(handRef.text).toBe('Inversão');
    assertLongOk(handRef, 'mão treino Inversão');

    await selectAndPlay(page, 'red-reverse-1', false);
    await expect(page.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-reverse-1');
    await expect(page.getByTestId('discard-top')).toHaveAttribute('aria-label', 'Descarte: Vermelho Inversão');
    await noHorizontalOverflow(page);
    const discard = only(await measureCards(page, '[data-testid="discard-top"]'), 'descarte treino');
    expect(discard.text).toBe('Inversão');
    record.push({ phase, state: 'treino-390', width: 390, target: 'descarte-privado-treino', ...summary('descarte', discard) });
    record.push({ phase, state: 'treino-390', width: 390, target: 'mao-treino-referencia', ...summary('mão', handRef) });
    await waitNoEffectOverlay(page);
    await page.screenshot({ path: join(shotsDir, 'treino-390.png'), fullPage: true });
    await page.locator('div.pile').filter({ has: page.getByTestId('discard-top') }).screenshot({ path: join(shotsDir, 'treino-390-zoom.png') });

    assertLongPerPhase(discard, 'descarte treino', handRef);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  } finally {
    writeFileSync(join(shotsDir, 'measurements-treino.json'), `${JSON.stringify(record, null, 2)}\n`);
  }
});
