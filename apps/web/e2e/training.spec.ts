/**
 * T011B — mesa de treino no navegador: entrada, preparação, rodada real contra
 * os bots do servidor, resultado, recuperação no meio da rodada e recusa de
 * entrada individual. As capturas novas vão para `assets/T011B/`; os baralhos
 * determinísticos e roteiros vivem em `e2e/training.ts`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { handIds, setNextDeck } from './room';
import { botWinsDeck, playTrainingRound, startTrainingRound, trainSolo, trainingDeck, trainingWildDeck } from './training';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T011B/', import.meta.url));
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

async function capturePair(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: join(shotsDir, `${name}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: join(shotsDir, `${name}-320.png`), fullPage: true });
}

test('entrada, preparação, cor do coringa, vitória da pessoa, nova rodada e saída', async ({ page }) => {
  const errors = watchPage(page);

  await page.goto('/');
  await expect(page.getByTestId('train-solo-button')).toBeVisible();
  await capturePair(page, 'home-treino');

  await page.getByTestId('nickname-input').fill('Ana');
  await page.getByTestId('train-solo-button').click();
  await expect(page.getByTestId('ready-toggle')).toBeVisible();

  // Preparação de treino: sem convite, sem remoção, três bots rotulados.
  await expect(page.getByTestId('invite-link')).toHaveCount(0);
  await expect(page.getByTestId('copy-invite')).toHaveCount(0);
  await expect(page.getByTestId('training-note')).toContainText('três bots simples');
  const rows = page.getByTestId('lobby-participant');
  await expect(rows).toHaveCount(4);
  for (const name of ['Tico', 'Lila', 'Nino']) {
    const row = rows.filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('bot');
    await expect(row).toContainText('pronto');
    await expect(row).not.toContainText('desconectado');
  }
  await expect(page.getByTestId('start-round-button')).toBeDisabled();
  await expect(page.getByTestId('start-hint')).toContainText('pronto para iniciar');
  await capturePair(page, 'preparacao-treino');

  await setNextDeck(page, trainingWildDeck());
  await startTrainingRound(page);
  await expect(page.getByTestId('seat-Tico')).toContainText('bot');
  await expect(page.getByTestId('seat-Tico')).not.toContainText('desconectado');
  await capturePair(page, 'mesa-treino');

  // Teclado na mão: setas movem o foco, Enter seleciona, Escape cancela.
  await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez', { timeout: 120_000 });
  const handCards = page.getByTestId('my-hand').locator('[data-card-id]');
  const firstCard = handCards.first();
  await firstCard.focus();
  await page.keyboard.press('ArrowRight');
  await expect(handCards.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(firstCard).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

  // Rodada completa: a última carta da pessoa é o coringa, com escolha de cor.
  const outcome = await playTrainingRound(page, 'win');
  expect(outcome.colorChoices).toBe(1);
  await expect(page.getByTestId('results-winner')).toHaveText('Ana venceu a rodada!');
  await expect(page.getByTestId('results-winner')).not.toContainText('bot');
  await expect(page.getByTestId('score-Ana')).toContainText('você');
  await expect(page.getByTestId('score-Ana')).toContainText('1 rodada(s)');
  for (const name of ['Tico', 'Lila', 'Nino']) {
    await expect(page.getByTestId(`score-${name}`)).toContainText('bot');
    await expect(page.getByTestId(`score-${name}`)).toContainText('0 rodada(s)');
  }
  await capturePair(page, 'resultados-treino-pessoa');

  // Nova rodada reusa os mesmos bots e o placar, sem início automático.
  await page.getByTestId('return-to-lobby-button').click();
  await expect(page.getByTestId('ready-toggle')).toContainText('Estou pronto');
  await expect(page.getByTestId('start-round-button')).toBeDisabled();
  await expect(page.getByTestId('lobby-participant')).toHaveCount(4);
  await expect(rows.filter({ hasText: 'você' })).toContainText('1 v.');
  await setNextDeck(page, trainingDeck());
  await startTrainingRound(page);
  await expect(page.getByTestId('my-hand')).toBeVisible();

  // Saída deliberada: volta ao início e não dispara recuperação automática.
  await page.getByTestId('leave-button').click();
  await expect(page.getByTestId('create-room-button')).toBeVisible();
  const homeUrl = page.url();
  await page.waitForTimeout(4_000);
  expect(page.url()).toBe(homeUrl);

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test('vitória de bot com apelido coincidente: rótulos e placar desambiguam', async ({ page }) => {
  const errors = watchPage(page);

  // Movimento reduzido pelo sistema é respeitado dentro do treino.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await trainSolo(page, 'Tico');
  const rows = page.getByTestId('lobby-participant');
  await expect(rows).toHaveCount(4);
  const ticoRows = rows.filter({ hasText: 'Tico' });
  await expect(ticoRows).toHaveCount(2);
  await expect(ticoRows.filter({ hasText: 'você' })).toHaveCount(1);
  await expect(ticoRows.filter({ hasText: 'bot' })).toHaveCount(1);
  await expect(page.getByTestId('pref-animations-note')).toBeVisible();

  await setNextDeck(page, botWinsDeck());
  await startTrainingRound(page);
  const outcome = await playTrainingRound(page, 'lose');
  expect(outcome.colorChoices).toBe(0);

  const scoreTico = page.getByTestId('score-Tico');
  await expect(page.getByTestId('results-winner')).toHaveText(/(Tico|Lila|Nino) \(bot\) venceu a rodada!/);
  await expect(scoreTico).toHaveCount(2);
  await expect(scoreTico.filter({ hasText: 'bot' })).toContainText('1 rodada(s)');
  await expect(scoreTico.filter({ hasText: 'você' })).toContainText('0 rodada(s)');
  await expect(page.getByText('desconectado')).toHaveCount(0);
  await expect(page.getByText('substituto')).toHaveCount(0);
  await capturePair(page, 'resultados-treino-bot');

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test('retomada no treino: pausa com continuação explícita preserva mão, fase e placar', async ({ page }) => {
  const errors = watchPage(page);

  await trainSolo(page, 'Bia');
  await setNextDeck(page, trainingDeck());
  await startTrainingRound(page);
  const first = await playTrainingRound(page, 'win');
  expect(first.colorChoices).toBe(0);
  await expect(page.getByTestId('results-winner')).toHaveText('Bia venceu a rodada!');
  await page.getByTestId('return-to-lobby-button').click();

  await setNextDeck(page, trainingDeck());
  await startTrainingRound(page);
  await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez', { timeout: 120_000 });
  await page.getByTestId('draw-button').click();
  await expect(page.getByTestId('after-draw-hint')).toBeVisible();
  const before = await handIds(page);
  expect(before).toHaveLength(8);

  // Recarga: identidade, mão e fase pós-compra voltam; a mesa retém e pausa.
  await page.reload();
  await expect(page.getByTestId('recovering')).toBeVisible();
  await expect(page.getByTestId('my-hand')).toBeVisible({ timeout: 60_000 });
  expect(await handIds(page)).toEqual(before);
  await expect(page.getByTestId('pause-panel')).toBeVisible();
  await expect(page.getByTestId('pause-retention')).toContainText('Os bots esperam por você');
  expect(await page.locator('[data-testid^="pause-absent-"]').count()).toBe(0);
  for (const name of ['Tico', 'Lila', 'Nino']) {
    await expect(page.getByTestId(`seat-${name}`)).toContainText('bot');
  }
  await capturePair(page, 'pausa-treino');

  // Continuação explícita pelo dono: a mesma fase pós-compra segue jogável e
  // só a carta recém-comprada pode ser descartada.
  await page.getByTestId('continue-round-button').click();
  await expect(page.getByTestId('pause-panel')).toHaveCount(0);
  await expect(page.getByTestId('after-draw-hint')).toBeVisible();
  const playable = page.getByTestId('my-hand').locator('[data-card-id][aria-disabled="false"]');
  await expect(playable).toHaveCount(1);
  await playable.click();
  await page.getByTestId('play-button').click();

  // Placar não zero atravessa a retomada.
  await expect(page.getByTestId('turn-indicator')).not.toHaveText('Sua vez');
  await page.getByTestId('end-round-button').click();
  await expect(page.getByTestId('results-winner')).toHaveText('Rodada encerrada sem vencedor.');
  await expect(page.getByTestId('score-Bia')).toContainText('1 rodada(s)');
  for (const name of ['Tico', 'Lila', 'Nino']) {
    await expect(page.getByTestId(`score-${name}`)).toContainText('0 rodada(s)');
  }

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
});

test('duas abas protegem a primeira e a segunda retoma depois', async ({ page }) => {
  await trainSolo(page, 'Ana');
  await setNextDeck(page, trainingDeck());
  await startTrainingRound(page);
  const hand = await handIds(page);

  const second = await page.context().newPage();
  const secondErrors = watchPage(second);
  await second.goto(page.url());
  await expect(second.getByTestId('recovering')).toBeVisible();
  await expect(second.getByTestId('join-name-input')).toHaveCount(0);
  await expect(second.getByTestId('my-hand')).toHaveCount(0);
  await expect(page.getByTestId('my-hand')).toBeVisible();

  // Fechar a primeira libera a identidade; a segunda converge para a mesa.
  await page.close();
  await expect(second.getByTestId('my-hand')).toBeVisible({ timeout: 60_000 });
  expect(await handIds(second)).toEqual(hand);
  await expect(second.getByTestId('pause-panel')).toBeVisible();
  await second.getByTestId('continue-round-button').click();
  await expect(second.getByTestId('pause-panel')).toHaveCount(0);

  expect(secondErrors.pageErrors).toEqual([]);
});

test('entrada recusada no treino é definitiva, explica e não cria identidade', async ({ page, browser }) => {
  const errors = watchPage(page);
  const url = await trainSolo(page, 'Ana');
  const code = url.split('/').pop() ?? '';
  expect(code).toHaveLength(6);

  // Outra pessoa, sem credencial: o formulário é substituído pela recusa.
  const outsider = await browser.newContext();
  const pageB = await outsider.newPage();
  const errorsB = watchPage(pageB);
  await pageB.goto(url);
  await expect(pageB.getByTestId('join-name-input')).toBeVisible();
  await pageB.getByTestId('join-name-input').fill('Bia');
  await pageB.getByTestId('join-room-button').click();
  await expect(pageB.getByTestId('training-entry-refused')).toBeVisible();
  await expect(pageB.getByTestId('training-entry-refused')).toContainText(/individual/i);
  await expect(pageB.getByTestId('training-entry-refused')).toContainText('bots');
  await expect(pageB.getByTestId('back-home')).toHaveAttribute('href', '/');
  await expect(pageB.getByTestId('join-name-input')).toHaveCount(0);
  await expect(pageB.getByTestId('my-hand')).toHaveCount(0);
  await pageB.waitForTimeout(3_000);
  expect(await pageB.evaluate((key) => window.localStorage.getItem(key), `tretta.identity.${code}`)).toBeNull();
  // Recarregar não cria identidade nem vínculo: a recusa continua.
  await pageB.reload();
  await expect(pageB.getByTestId('join-name-input')).toBeVisible();
  await expect(pageB.getByTestId('training-entry-refused')).toHaveCount(0);
  // A mesa original segue intacta com a pessoa e os três bots.
  await expect(page.getByTestId('lobby-participant')).toHaveCount(4);

  // Identidade salva de outro contexto: recusa imediata e credencial intocada.
  const stale = await browser.newContext();
  await stale.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      `tretta.identity.${code}`,
      JSON.stringify({ playerId: 'player_fake', credential: 'cred_falsa_1234567890', nickname: 'Outro contexto', avatar: 'lobo' }),
    ] as [string, string],
  );
  const pageC = await stale.newPage();
  const errorsC = watchPage(pageC);
  await pageC.goto(url);
  await expect(pageC.getByTestId('training-entry-refused')).toBeVisible();
  await expect(pageC.getByTestId('join-name-input')).toHaveCount(0);
  await pageC.waitForTimeout(2_000);
  expect(await pageC.evaluate((key) => window.localStorage.getItem(key), `tretta.identity.${code}`)).toContain('cred_falsa_1234567890');

  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleErrors).toEqual([]);
  expect(errorsB.pageErrors).toEqual([]);
  expect(errorsC.pageErrors).toEqual([]);
});
