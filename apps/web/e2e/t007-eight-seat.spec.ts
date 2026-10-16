import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { eightSeatValidationDeck } from './deck';
import { createRoom, handIds, joinRoom, readyAll, setNextDeck } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T007/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function currentTurnIndices(pages: Page[]): Promise<number[]> {
  const turns = await Promise.all(pages.map(async (page) => (await page.getByTestId('turn-indicator').textContent()) === 'Sua vez'));
  return turns.flatMap((active, index) => active ? [index] : []);
}

async function waitForTurn(pages: Page[]): Promise<number> {
  await expect.poll(() => currentTurnIndices(pages), { timeout: 15_000 }).not.toEqual([]);
  const indices = await currentTurnIndices(pages);
  if (indices.length !== 1) throw new Error(`Esperava exatamente uma vez ativa, encontrei ${indices.length}.`);
  return indices[0]!;
}

async function waitForTurnChange(pages: Page[], previous: number): Promise<void> {
  await expect.poll(async () => {
    if (await pages[0]!.getByTestId('results-winner').count() > 0) return true;
    const indices = await currentTurnIndices(pages);
    return indices.length === 1 && indices[0] !== previous;
  }, { timeout: 15_000 }).toBe(true);
}

test('T007: oito clientes entram por convite, jogam e concluem uma rodada', async ({ browser }) => {
  test.setTimeout(180_000);
  const contexts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    browser.newContext(index === 0
      ? { ...devices['Pixel 7'] }
      : { viewport: { width: 1280, height: 900 } }),
  ));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const names = Array.from({ length: 8 }, (_, index) => `Jogador ${index + 1}`);
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

    await host.getByTestId('chat-input').fill('Mensagem compartilhada da mesa T007.');
    await host.getByTestId('chat-send').click();
    await Promise.all(pages.map((page) => expect(page.getByTestId('chat-messages')).toContainText('Mensagem compartilhada da mesa T007.')));

    await host.getByTestId('taunt-type').selectOption('tomate');
    await host.getByTestId('taunt-target').selectOption({ label: names[1]! });
    await host.getByTestId('taunt-send').click();
    await Promise.all(pages.map((page) => expect(page.getByTestId('taunt-effect-tomate')).toBeVisible({ timeout: 8_000 })));

    await host.screenshot({ path: join(shotsDir, 'eight-seat-table-mobile.png'), fullPage: true });
    await pages[1]!.screenshot({ path: join(shotsDir, 'eight-seat-table-desktop.png'), fullPage: true });

    const returningIndex = (await waitForTurn(pages) + 1) % pages.length;
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
      if (await host.getByTestId('results-winner').count() > 0) break;
      const activeIndex = await waitForTurn(pages);
      const page = pages[activeIndex]!;
      const hands = await Promise.all(pages.map((candidate) => handIds(candidate)));
      const myHand = hands[activeIndex]!.map((testId) => testId.replace(/^card-/, ''));
      const matching = myHand.find((id) => id.startsWith(`${activeColor}-`));
      if (matching !== undefined) {
        await page.getByTestId(`card-${matching}`).click();
        const lastCard = page.getByTestId('last-card-checkbox');
        if (await lastCard.count() > 0) await lastCard.check();
        await page.getByTestId('play-button').click();
      } else {
        const colorInHands = hands.some((hand) => hand.some((testId) => testId.startsWith(`card-${activeColor}-`)));
        const wild = myHand.find((id) => id.startsWith('wild-color-'));
        if (!colorInHands && wild !== undefined) {
          await page.getByTestId(`card-${wild}`).click();
          await page.getByTestId('play-button').click();
          const chosenColor = nextColor[activeColor] ?? 'yellow';
          await page.getByTestId(`color-option-${chosenColor}`).click();
          activeColor = chosenColor;
        } else {
          await page.getByTestId('draw-button').click();
          await page.getByTestId('pass-button').click();
        }
      }
      await waitForTurnChange(pages, activeIndex);
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
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
