import type { Page } from '@playwright/test';
import type { EffectVariant } from '@tretta/protocol';
import { expect } from './fixtures';

export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('create-room-button').click();
  const link = page.getByTestId('invite-link');
  await expect(link).toBeVisible();
  const href = await link.textContent();
  if (href === null) throw new Error('link de convite ausente');
  return href;
}

export async function joinRoom(page: Page, inviteUrl: string, nickname: string, avatar = 'lobo'): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId(`avatar-option-${avatar}`).click();
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('ready-toggle')).toBeVisible();
}

export async function setNextDeck(page: Page, deck: string[]): Promise<void> {
  const result = await page.evaluate((cards) => window.__trettaTest!.setNextDeck(cards), deck);
  expect(result.ok).toBe(true);
}

/** Fixa a variação do próximo efeito (e dos seguintes) até limpar com `null`. */
export async function setEffectVariant(page: Page, variant: EffectVariant | null): Promise<void> {
  const result = await page.evaluate((value) => window.__trettaTest!.setEffectVariant(value), variant);
  expect(result.ok).toBe(true);
}

export async function readyAll(host: Page, ...others: Page[]): Promise<void> {
  for (const page of [host, ...others]) {
    await page.getByTestId('ready-toggle').click();
  }
  await expect(host.getByTestId('start-round-button')).toBeEnabled();
  await host.getByTestId('start-round-button').click();
  for (const page of [host, ...others]) {
    await expect(page.getByTestId('my-hand')).toBeVisible();
  }
}

export async function isMyTurn(page: Page): Promise<boolean> {
  return (await page.getByTestId('turn-indicator').textContent()) === 'Sua vez';
}

export async function waitMyTurn(page: Page): Promise<void> {
  await expect(page.getByTestId('turn-indicator')).toHaveText('Sua vez');
}

export async function playCard(page: Page, cardId: string): Promise<void> {
  await waitMyTurn(page);
  await page.getByTestId(`card-${cardId}`).click();
  await page.getByTestId('play-button').click();
}

export async function drawAndPass(page: Page): Promise<void> {
  await waitMyTurn(page);
  await page.getByTestId('draw-button').click();
  await page.getByTestId('pass-button').click();
}

export async function handIds(page: Page): Promise<string[]> {
  return page
    .getByTestId('my-hand')
    .locator('[data-testid^="card-"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? ''));
}
