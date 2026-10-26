import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { eightSeatValidationDeck } from './deck';
import { closeDrawer, createRoom, handIds, joinRoom, openDrawer, readyAll, setNextDeck } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T007/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });
/** Diagnóstico de A3 (T012-adjustments): dumps sanitizados de uma falha de vez. */
const turnDumpDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T012-adjustments/', import.meta.url));
mkdirSync(turnDumpDir, { recursive: true });

interface PageMonitor {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
}

interface StepMark {
  readonly passo: number;
  readonly acao: string;
  readonly ator: number;
  readonly carta: string | null;
  readonly ms: number;
}

interface ActionContext {
  readonly step: number;
  readonly action: string;
  readonly actor: number;
  readonly playedCardId: string | null;
}

function watchPage(page: Page): PageMonitor {
  const monitor: PageMonitor = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (error) => monitor.pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') monitor.consoleErrors.push(message.text());
  });
  return monitor;
}

async function safeRead<T>(action: () => T | Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch {
    return fallback;
  }
}

/** Leitura com teto curto: uma página em estado inesperado não derruba o diagnóstico. */
async function readText(page: Page, testId: string): Promise<string | null> {
  return safeRead(async () => {
    const locator = page.getByTestId(testId);
    if ((await locator.count()) === 0) return null;
    return (await locator.first().textContent({ timeout: 2_000 }))?.trim() ?? '';
  }, null);
}

async function countOf(page: Page, testId: string): Promise<number> {
  return safeRead(() => page.getByTestId(testId).count(), -1);
}

async function visibleOf(page: Page, testId: string): Promise<boolean> {
  return safeRead(() => page.getByTestId(testId).first().isVisible({ timeout: 2_000 }), false);
}

async function handTestIds(page: Page): Promise<string[]> {
  return safeRead(
    () =>
      page.getByTestId('my-hand').locator('[data-testid^="card-"]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-testid') ?? '').filter((id) => id !== ''),
      ),
    [] as string[],
  );
}

/** Estado de cada cliente no ponto da falha: vez, mão, pilhas, pausa/recuperação e erros. */
async function turnStateDump(
  pages: readonly Page[],
  monitors: readonly PageMonitor[],
  context: ActionContext | null,
): Promise<string> {
  const states = await Promise.all(
    pages.map(async (page, index) => {
      const hand = await handTestIds(page);
      const playedCardId = context === null ? null : `card-${context.playedCardId ?? ''}`;
      const results = (await countOf(page, 'results-winner')) > 0;
      const lobby = (await countOf(page, 'lobby-participants')) > 0;
      const recovering = (await countOf(page, 'recovering')) > 0;
      const pause = (await countOf(page, 'pause-panel')) > 0;
      const table = (await countOf(page, 'my-hand')) > 0 || (await countOf(page, 'turn-indicator')) > 0;
      const tela = results ? 'resultados' : lobby ? 'sala-de-espera' : recovering ? 'recuperando' : table ? 'mesa' : 'desconhecida';
      let lastEvent: string | null = null;
      const feed = page.getByTestId('event-feed').locator('li');
      if (await safeRead(async () => (await feed.count()) > 0, false)) {
        lastEvent = await safeRead(async () => (await feed.last().textContent({ timeout: 2_000 }))?.trim() ?? null, null);
      }
      return {
        cliente: index,
        tela,
        vez: await readText(page, 'turn-indicator'),
        mao: hand.length,
        cartas: index === context?.actor ? hand.map((id) => id.replace(/^card-/, '')) : undefined,
        cartaJogadaAindaNaMao: playedCardId === null ? undefined : hand.includes(playedCardId),
        compra: await safeRead(() => page.getByTestId('draw-pile').getAttribute('aria-label', { timeout: 2_000 }), null),
        descarte: await readText(page, 'discard-top'),
        corAtiva: await readText(page, 'active-color'),
        erroVisivel: await readText(page, 'error-banner'),
        conexaoPerdida: await visibleOf(page, 'connection-lost'),
        pausa: pause,
        recuperando: recovering,
        vencedorVisivel: results,
        ultimoEvento: lastEvent,
        errosDePagina: monitors[index]?.pageErrors ?? [],
        errosDeConsole: monitors[index]?.consoleErrors ?? [],
      };
    }),
  );
  const payload = {
    quando: new Date().toISOString(),
    acao: context,
    clientes: states,
  };
  return JSON.stringify(payload, null, 2);
}

async function failWithDump(message: string, dump: string, name: string): Promise<never> {
  writeFileSync(join(turnDumpDir, name), dump);
  throw new Error(`${message}\n--- estado no ponto da falha (sanitizado) ---\n${dump}`);
}

/** Registra a trilha dos passos e um dump de estado quando a rodada falha. */
async function recordFailure(
  pages: readonly Page[],
  monitors: readonly PageMonitor[],
  marks: readonly StepMark[],
  error: unknown,
  name: string,
): Promise<void> {
  const last = marks[marks.length - 1];
  const context: ActionContext | null =
    last === undefined ? null : { step: last.passo, action: last.acao, actor: last.ator, playedCardId: last.carta };
  const estado = await safeRead(async () => JSON.parse(await turnStateDump(pages, monitors, context)) as unknown, null);
  writeFileSync(
    join(turnDumpDir, name),
    JSON.stringify(
      {
        quando: new Date().toISOString(),
        erro: String(error),
        totalPassos: marks.length,
        ultimosPassos: marks.slice(-60),
        estado,
      },
      null,
      2,
    ),
  );
}

async function pageShowsResults(page: Page): Promise<boolean> {
  return safeRead(async () => (await page.getByTestId('results-winner').count()) > 0, false);
}

async function anyResultsVisible(pages: readonly Page[]): Promise<boolean> {
  const results = await Promise.all(pages.map((page) => pageShowsResults(page)));
  return results.some((visible) => visible);
}

/**
 * Vez ativa por cliente. A leitura é limitada: quando a rodada termina a tela de
 * mesa dá lugar ao resultado e o indicador some — esperar por ele travaria a espera.
 */
async function currentTurnIndices(pages: Page[]): Promise<number[]> {
  const turns = await Promise.all(
    pages.map(async (page) => {
      const indicator = page.getByTestId('turn-indicator');
      const present = await safeRead(async () => (await indicator.count()) > 0, false);
      if (!present) return false;
      const text = await safeRead(async () => (await indicator.textContent({ timeout: 2_000 })) ?? '', '');
      return text === 'Sua vez';
    }),
  );
  return turns.flatMap((active, index) => (active ? [index] : []));
}

async function waitForTurn(pages: Page[], monitors: readonly PageMonitor[], context: ActionContext | null): Promise<number> {
  try {
    await expect.poll(() => currentTurnIndices(pages), { timeout: 15_000 }).not.toEqual([]);
  } catch (error) {
    const dump = await turnStateDump(pages, monitors, context);
    await failWithDump(`Nenhuma vez ativa em 15 s: ${String(error)}`, dump, `t007-sem-vez-${String(context?.step ?? -1)}.json`);
  }
  const indices = await currentTurnIndices(pages);
  if (indices.length !== 1) {
    const dump = await turnStateDump(pages, monitors, context);
    await failWithDump(`Esperava exatamente uma vez ativa, encontrei ${String(indices.length)}.`, dump, `t007-vez-ambigua-${String(context?.step ?? -1)}.json`);
  }
  return indices[0]!;
}

async function waitForTurnChange(
  pages: Page[],
  previous: number,
  monitors: readonly PageMonitor[],
  context: ActionContext,
): Promise<void> {
  try {
    await expect.poll(async () => {
      if (await anyResultsVisible(pages)) return true;
      const indices = await currentTurnIndices(pages);
      return indices.length === 1 && indices[0] !== previous;
    }, { timeout: 15_000 }).toBe(true);
  } catch (error) {
    const dump = await turnStateDump(pages, monitors, context);
    await failWithDump(
      `A vez não mudou de ${String(previous)} em 15 s após "${context.action}": ${String(error)}`,
      dump,
      `t007-vez-nao-mudou-${String(context.step)}.json`,
    );
  }
}

test('T007: oito clientes entram por convite, jogam e concluem uma rodada', async ({ browser }) => {
  test.setTimeout(180_000);
  const contexts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    browser.newContext(index === 0
      ? { ...devices['Pixel 7'] }
      : { viewport: { width: 1280, height: 900 } }),
  ));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  // Ações com teto curto: uma espera travada vira falha explicada com dump, não um silêncio de 3 minutos.
  for (const page of pages) page.setDefaultTimeout(10_000);
  const monitors = pages.map((page) => watchPage(page));
  const names = Array.from({ length: 8 }, (_, index) => `Jogador ${index + 1}`);
  const marks: StepMark[] = [];
  const startedAt = Date.now();
  try {
    const host = pages[0]!;
    const invite = await createRoom(host, names[0]!);
    await Promise.all(pages.slice(1).map((page, index) => joinRoom(page, invite, names[index + 1]!)));
    await expect(host.getByTestId('lobby-participant')).toHaveCount(8);

    await setNextDeck(host, eightSeatValidationDeck());
    await readyAll(host, ...pages.slice(1));
    const dealtHands = await Promise.all(pages.map((page) => handIds(page)));
    expect(dealtHands.every((hand) => hand.length === 7)).toBe(true);
    const dealtCards = dealtHands.flat().map((testId) => testId.replace(/^card-/, ''));
    expect(new Set(dealtCards).size).toBe(56);
    await expect.poll(async () => (await currentTurnIndices(pages)).length).toBe(1);

    await openDrawer(host, 'conversa');
    await host.getByTestId('chat-input').fill('Mensagem compartilhada da mesa T007.');
    await host.getByTestId('chat-send').click();
    await expect(host.getByTestId('chat-messages')).toContainText('Mensagem compartilhada da mesa T007.');
    await closeDrawer(host);
    for (const page of pages.slice(1)) {
      await openDrawer(page, 'conversa');
      await expect(page.getByTestId('chat-messages')).toContainText('Mensagem compartilhada da mesa T007.');
      await closeDrawer(page);
    }

    await host.screenshot({ path: join(shotsDir, 'eight-seat-table-mobile.png'), fullPage: true });
    await pages[1]!.screenshot({ path: join(shotsDir, 'eight-seat-table-desktop.png'), fullPage: true });

    const returningIndex = (await waitForTurn(pages, monitors, null) + 1) % pages.length;
    const returningPage = pages[returningIndex]!;
    const handBeforeReload = await handIds(returningPage);
    expect(handBeforeReload).toHaveLength(7);
    await returningPage.reload();
    await expect(returningPage.getByTestId('my-hand')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => handIds(returningPage), { timeout: 20_000 }).toEqual(handBeforeReload);
    await expect(returningPage.getByTestId('pause-panel')).toHaveCount(0, { timeout: 20_000 });

    const nextColor: Record<string, string> = { red: 'blue', blue: 'green', green: 'yellow', yellow: 'yellow' };
    let activeColor = 'red';
    for (let step = 0; step < 320; step++) {
      if (await anyResultsVisible(pages)) break;
      const activeIndex = await waitForTurn(pages, monitors, { step, action: 'aguardar a vez antes de agir', actor: -1, playedCardId: null });
      const page = pages[activeIndex]!;
      const hands = await Promise.all(pages.map((candidate) => handIds(candidate)));
      const myHand = hands[activeIndex]!.map((testId) => testId.replace(/^card-/, ''));
      const matching = myHand.find((id) => id.startsWith(`${activeColor}-`));
      let actionLabel: string;
      let playedCardId: string | null = null;
      const markIndex = marks.length;
      if (matching !== undefined) {
        actionLabel = `jogar ${matching}`;
        playedCardId = matching;
        marks.push({ passo: step, acao: `${actionLabel} (selecionar e confirmar)`, ator: activeIndex, carta: playedCardId, ms: Date.now() - startedAt });
        await page.getByTestId(`card-${matching}`).click();
        const lastCard = page.getByTestId('last-card-checkbox');
        if (await lastCard.count() > 0) await lastCard.check();
        await page.getByTestId('play-button').click();
      } else {
        const colorInHands = hands.some((hand) => hand.some((testId) => testId.startsWith(`card-${activeColor}-`)));
        const wild = myHand.find((id) => id.startsWith('wild-color-'));
        if (!colorInHands && wild !== undefined) {
          const chosenColor = nextColor[activeColor] ?? 'yellow';
          actionLabel = `jogar coringa ${wild} e escolher ${chosenColor}`;
          playedCardId = wild;
          marks.push({ passo: step, acao: `${actionLabel} (selecionar e confirmar)`, ator: activeIndex, carta: playedCardId, ms: Date.now() - startedAt });
          await page.getByTestId(`card-${wild}`).click();
          await page.getByTestId('play-button').click();
          await page.getByTestId(`color-option-${chosenColor}`).click();
          activeColor = chosenColor;
        } else {
          actionLabel = 'comprar e passar';
          marks.push({ passo: step, acao: 'comprar e passar', ator: activeIndex, carta: null, ms: Date.now() - startedAt });
          await page.getByTestId('draw-button').click();
          await page.getByTestId('pass-button').click();
        }
      }
      await waitForTurnChange(pages, activeIndex, monitors, { step, action: actionLabel, actor: activeIndex, playedCardId });
      marks[markIndex] = { passo: step, acao: actionLabel, ator: activeIndex, carta: playedCardId, ms: Date.now() - startedAt };
      if (step === 319) throw new Error('Mesa de oito excedeu o teto de 320 jogadas.');
    }

    await Promise.all(pages.map((page) => expect(page.getByTestId('results-winner')).toBeVisible({ timeout: 15_000 })));
    const winnerText = await host.getByTestId('results-winner').textContent();
    expect(winnerText).toMatch(/^Jogador [1-8] venceu a rodada!$/);
    const winner = winnerText!.match(/^(.+) venceu a rodada!$/)?.[1];
    if (winner === undefined) throw new Error('Resultado sem vencedor identificado.');
    await Promise.all(pages.map(async (page) => {
      await expect(page.getByTestId('results-winner')).toHaveText(winnerText!);
      await expect(page.locator('[data-testid^="score-"]')).toHaveCount(8);
      await expect(page.getByTestId(`score-${winner}`)).toContainText('1 rodada(s)');
    }));
    await host.screenshot({ path: join(shotsDir, 'eight-seat-results.png'), fullPage: true });
    if (Date.now() - startedAt > 60_000) {
      writeFileSync(
        join(turnDumpDir, 't007-passagem-lenta.json'),
        JSON.stringify({ quando: new Date().toISOString(), duracaoMs: Date.now() - startedAt, passos: marks }, null, 2),
      );
    }
  } catch (error) {
    await recordFailure(pages, monitors, marks, error, 't007-falha.json');
    throw error;
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
