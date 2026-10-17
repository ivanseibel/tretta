/**
 * T011B — roteiros determinísticos da mesa de treino no navegador.
 *
 * Os baralhos espelham `apps/server/test/training.ts` (mesmos ids e desfechos):
 * a pessoa dona vence descartando a mão vermelha; os bots vencem quando a
 * pessoa só compra lixo e passa; a variante com coringa exercita a escolha de
 * cor no descarte. `buildDeck` replica a montagem de `deck.ts` para quatro
 * assentos (o baralho inteiro termina com as cartas não usadas).
 */
import { createClassicDeck } from '@tretta/rules';
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

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
 * Vitória da pessoa: mão vermelha 1..7 sempre jogável (o descarte começa em
 * `red-9-1` e os descartes da pilha de compra também são vermelhos); os bots
 * têm símbolos/zeros fora do vermelho e nunca descartam da própria mão.
 */
export function trainingDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
      ['blue-skip-1', 'blue-skip-2', 'blue-reverse-1', 'blue-reverse-2', 'blue-draw-two-1', 'blue-draw-two-2', 'blue-0-1'],
      ['green-skip-1', 'green-skip-2', 'green-reverse-1', 'green-reverse-2', 'green-draw-two-1', 'green-draw-two-2', 'green-0-1'],
      ['yellow-skip-1', 'yellow-skip-2', 'yellow-reverse-1', 'yellow-reverse-2', 'yellow-draw-two-1', 'yellow-draw-two-2', 'yellow-0-1'],
    ],
    discard: 'red-9-1',
    draw: [
      'red-8-1',
      'red-8-2',
      'red-9-2',
      'red-1-2',
      'red-2-2',
      'red-3-2',
      'red-4-2',
      'red-5-2',
      'red-6-2',
      'red-7-2',
      'blue-8-1',
      'blue-8-2',
      'blue-9-1',
      'blue-9-2',
      'green-8-1',
      'green-8-2',
      'green-9-1',
      'green-9-2',
      'yellow-8-1',
      'yellow-8-2',
      'yellow-9-1',
      'yellow-9-2',
    ],
  });
}

/**
 * Vitória da pessoa com escolha de cor: a mão vermelha termina no coringa de
 * cor, descartado como última carta com a cor anunciada na interface.
 */
export function trainingWildDeck(): string[] {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'wild-color-1'],
      ['blue-skip-1', 'blue-skip-2', 'blue-reverse-1', 'blue-reverse-2', 'blue-draw-two-1', 'blue-draw-two-2', 'blue-0-1'],
      ['green-skip-1', 'green-skip-2', 'green-reverse-1', 'green-reverse-2', 'green-draw-two-1', 'green-draw-two-2', 'green-0-1'],
      ['yellow-skip-1', 'yellow-skip-2', 'yellow-reverse-1', 'yellow-reverse-2', 'yellow-draw-two-1', 'yellow-draw-two-2', 'yellow-0-1'],
    ],
    discard: 'red-9-1',
    draw: [
      'red-8-1',
      'red-8-2',
      'red-9-2',
      'red-1-2',
      'red-2-2',
      'red-3-2',
      'red-4-2',
      'red-5-2',
      'red-6-2',
      'red-7-2',
      'blue-8-1',
      'blue-8-2',
      'blue-9-1',
      'blue-9-2',
      'green-8-1',
      'green-8-2',
      'green-9-1',
      'green-9-2',
      'yellow-8-1',
      'yellow-8-2',
      'yellow-9-1',
      'yellow-9-2',
    ],
  });
}

/**
 * Vitória de bot: os três bots descartam a mão vermelha a cada vez e o
 * primeiro a esvaziar vence; a pessoa compra lixo de propósito e passa.
 */
export function botWinsDeck(): string[] {
  return buildDeck({
    hands: [
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'red-7-1'],
      ['red-1-2', 'red-2-2', 'red-3-2', 'red-4-2', 'red-5-2', 'red-6-2', 'red-7-2'],
      ['red-0-1', 'red-8-1', 'red-8-2', 'red-9-2', 'wild-color-1', 'wild-color-2', 'wild-color-3'],
    ],
    discard: 'red-9-1',
    draw: [
      'blue-skip-1',
      'blue-skip-2',
      'blue-reverse-1',
      'blue-reverse-2',
      'blue-draw-two-1',
      'blue-draw-two-2',
      'green-skip-1',
      'green-skip-2',
      'green-reverse-1',
      'green-reverse-2',
      'green-draw-two-1',
      'green-draw-two-2',
      'yellow-skip-1',
      'yellow-skip-2',
      'yellow-reverse-1',
      'yellow-reverse-2',
      'yellow-draw-two-1',
      'yellow-draw-two-2',
    ],
  });
}

/** Cria a mesa de treino pela página inicial e espera a preparação. */
export async function trainSolo(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('train-solo-button').click();
  await expect(page.getByTestId('ready-toggle')).toBeVisible();
  return page.url();
}

/** Confirma a prontidão da pessoa e inicia a rodada. */
export async function startTrainingRound(page: Page): Promise<void> {
  await page.getByTestId('ready-toggle').click();
  await expect(page.getByTestId('start-round-button')).toBeEnabled();
  await page.getByTestId('start-round-button').click();
  await expect(page.getByTestId('my-hand')).toBeVisible();
}

/**
 * Espera a vez da pessoa ou o resultado da rodada; devolve qual veio.
 * A checagem é reavaliada no DOM a cada ciclo para nunca confundir a vez da
 * pessoa com a tela de resultados já montada.
 */
async function waitMyTurnOrResults(page: Page): Promise<'mine' | 'results'> {
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-testid="results-winner"]') !== null) return true;
      const indicator = document.querySelector('[data-testid="turn-indicator"]');
      return indicator?.textContent === 'Sua vez';
    },
    undefined,
    { timeout: 120_000 },
  );
  const finished = await page.evaluate(() => document.querySelector('[data-testid="results-winner"]') !== null);
  return finished ? 'results' : 'mine';
}

/**
 * Espera a ação anterior refletir no estado (a vez sai da pessoa ou a rodada
 * termina) antes de reavaliar. Sem isso, o próximo clique pode começar enquanto
 * o ack anterior ainda não chegou e mirar um elemento que a nova tela removeu.
 */
async function waitTurnLeft(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      if (document.querySelector('[data-testid="results-winner"]') !== null) return true;
      const indicator = document.querySelector('[data-testid="turn-indicator"]');
      return indicator !== null && indicator.textContent !== 'Sua vez';
    },
    undefined,
    { timeout: 120_000 },
  );
}

/**
 * Joga a rodada até o fim com a pessoa agindo quando é a vez dela:
 * `win` descarta a primeira carta jogável, cobrindo a cor quando a carta é o
 * coringa (a escolha é lida do próprio nó antes do clique); `lose` compra e
 * passa, sem usar a carta comprada.
 */
export async function playTrainingRound(
  page: Page,
  mode: 'win' | 'lose',
): Promise<{ colorChoices: number }> {
  let colorChoices = 0;
  for (let guard = 0; guard < 80; guard++) {
    const turn = await waitMyTurnOrResults(page);
    if (turn === 'results') return { colorChoices };
    if (mode === 'win') {
      const playable = page.getByTestId('my-hand').locator('[data-card-id][aria-disabled="false"]').first();
      const isWild = (await playable.getAttribute('data-color')) === 'wild';
      await playable.click();
      await page.getByTestId('play-button').click();
      if (isWild) {
        colorChoices += 1;
        // O clique espera o grupo de cores aparecer depois da confirmação.
        await page.getByTestId('color-option-green').click();
      }
    } else {
      await page.getByTestId('draw-button').click();
      await expect(page.getByTestId('after-draw-hint')).toBeVisible();
      await page.getByTestId('pass-button').click();
    }
    await waitTurnLeft(page);
  }
  throw new Error('A rodada de treino não terminou dentro do limite de turnos.');
}
