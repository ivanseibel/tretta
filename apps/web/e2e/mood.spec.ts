import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, joinRoom, openTauntPanel, readyAll, setNextDeck, waitMyTurn } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T014B/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

function reactionBadge(page: Page, label: string) {
  return page.locator('[data-testid^="reaction-badge-"]').filter({ hasText: label });
}

test('avatar provoca, destinatário responde e a sala vê reações simultâneas de assento e de quem aguarda', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const narrow = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageC = await narrow.newPage();

  try {
    const inviteUrl = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');

    // Provocar pelo avatar: dois toques, alvo visível e envio imediato.
    await pageA.getByRole('button', { name: 'Provocar Bia', exact: true }).click();
    await expect(pageA.getByTestId('mood-menu')).toBeVisible();
    await expect(pageA.getByRole('heading', { name: 'Provocar Bia' })).toBeVisible();
    await pageA.screenshot({ path: join(shotsDir, 'lobby-avatar-taunt-1280.png'), fullPage: true });
    await pageA.getByTestId('mood-taunt-tomate').click();

    await expect(pageB.getByTestId('taunt-notice')).toContainText('Ana provocou você');
    await expect(pageB.getByTestId('taunt-effect-tomate')).toBeVisible();
    await pageB.screenshot({ path: join(shotsDir, 'lobby-resposta-390.png'), fullPage: true });

    // Responder mantém o emissor selecionado; o envio é uma provocação normal.
    await pageB.getByTestId('taunt-respond').click();
    await expect(pageB.getByRole('heading', { name: 'Responder a Ana' })).toBeVisible();
    await pageB.screenshot({ path: join(shotsDir, 'lobby-responder-390.png'), fullPage: true });
    await pageB.getByTestId('mood-taunt-torta').click();
    await expect(pageA.getByTestId('taunt-notice')).toContainText('Bia provocou você');

    // Próprio avatar abre reações; toda a sala vê o mesmo evento uma vez.
    await pageB.getByRole('button', { name: 'Reagir como Bia', exact: true }).click();
    await expect(pageB.getByRole('heading', { name: 'Reagir' })).toBeVisible();
    await pageB.getByTestId('mood-reaction-rindo').click();
    await expect(pageB.getByTestId('mood-feedback')).toContainText('Reação enviada: Rindo');
    await expect(reactionBadge(pageA, 'Rindo')).toHaveCount(1);
    await expect(reactionBadge(pageB, 'Rindo')).toHaveCount(1);
    await pageA.screenshot({ path: join(shotsDir, 'lobby-reacao-1280.png'), fullPage: true });

    // Quatro segundos em todos os modos; sem duplicação por ack+broadcast.
    await expect(reactionBadge(pageA, 'Rindo')).toHaveCount(0, { timeout: 6_000 });

    // Rodada com quem aguarda: a pessoa de fora reage pela própria identificação
    // e os assentos veem a reação junto à linha dela.
    await setNextDeck(pageA, scenarioDeck());
    await readyAll(pageA, pageB);
    await waitMyTurn(pageA);
    await joinAsWatcher(pageC, inviteUrl, 'Cai');
    await expect(pageC.getByTestId('public-table')).toBeVisible();

    await pageC.getByTestId('self-reaction-button').click();
    await expect(pageC.getByRole('heading', { name: 'Reagir' })).toBeVisible();
    await pageC.screenshot({ path: join(shotsDir, 'waiting-reagir-320.png'), fullPage: true });
    await pageC.getByTestId('mood-reaction-bravo').click();
    await expect(reactionBadge(pageA, 'Bravo')).toHaveCount(1);
    await expect(reactionBadge(pageB, 'Bravo')).toHaveCount(1);

    // Assento também reage; as duas expressões coexistem sem fila central.
    await pageA.getByRole('button', { name: 'Reagir como Ana', exact: true }).click();
    await pageA.getByTestId('mood-reaction-rindo').click();
    await expect(reactionBadge(pageB, 'Rindo')).toHaveCount(1);
    await expect(reactionBadge(pageB, 'Bravo')).toHaveCount(1);
    await expect(pageC.locator('[data-testid^="reaction-badge-"]')).toHaveCount(2);
    await pageA.screenshot({ path: join(shotsDir, 'mesa-reacoes-1280.png'), fullPage: true });

    // Quem aguarda provoca um assento pelo avatar da mesa pública.
    await pageC.getByRole('button', { name: 'Provocar Ana', exact: true }).click();
    await expect(pageC.getByRole('heading', { name: 'Provocar Ana' })).toBeVisible();
    await pageC.getByTestId('mood-taunt-tomate').click();
    await expect(pageA.getByTestId('taunt-notice')).toContainText('Cai provocou você');
  } finally {
    await desktop.close();
    await mobile.close();
    await narrow.close();
  }
});

test('menu por teclado, Escape devolve o foco e toque fora não aciona a carta', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia', 'tucano');
    await setNextDeck(host, scenarioDeck());
    await readyAll(host, guest);
    await waitMyTurn(host);

    const targetAvatar = host.getByRole('button', { name: 'Provocar Bia', exact: true });
    await targetAvatar.focus();
    await host.keyboard.press('Enter');
    await expect(host.getByTestId('mood-menu')).toBeVisible();
    await expect(host.getByTestId('mood-taunt-tomate')).toBeFocused();
    await host.keyboard.press('Escape');
    await expect(host.getByTestId('mood-menu')).toHaveCount(0);
    await expect(targetAvatar).toBeFocused();

    // Toque fora fecha sem executar controle por baixo; a mesa segue jogável.
    await targetAvatar.click();
    await expect(host.getByTestId('mood-menu')).toBeVisible();
    await host.getByTestId('mood-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(host.getByTestId('mood-menu')).toHaveCount(0);
    await expect(host.getByTestId('play-strip')).toHaveCount(0);
    await host.getByTestId('card-red-1-1').click();
    await host.getByTestId('play-button').click();
    await expect(guest.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-1-1');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('intervalos, ocultar reações/provocações e recuperação da mesma identidade', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  try {
    const inviteUrl = await createRoom(pageA, 'Ana');
    await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');

    // Intervalo de reação próprio e independente: após o envio, o menu mostra
    // a espera e desabilita a opção sem depender do relógio do aparelho.
    await pageA.getByRole('button', { name: 'Reagir como Ana', exact: true }).click();
    await pageA.getByTestId('mood-reaction-rindo').click();
    await expect(pageA.getByTestId('mood-feedback')).toContainText('Reação enviada');
    await pageA.getByRole('button', { name: 'Reagir como Ana', exact: true }).click();
    await expect(pageA.getByTestId('mood-countdown')).toBeVisible();
    await expect(pageA.getByTestId('mood-reaction-rindo')).toHaveAttribute('aria-disabled', 'true');
    await pageA.screenshot({ path: join(shotsDir, 'reaction-cooldown-1280.png'), fullPage: true });
    await expect(pageA.getByTestId('mood-countdown')).toBeHidden({ timeout: 7_000 });
    await expect(pageA.getByTestId('mood-reaction-rindo')).toHaveAttribute('aria-disabled', 'false');
    await pageA.getByTestId('mood-menu-close').click();

    // Ocultar reações limpa na hora, não reproduz ao reativar e mantém a
    // confirmação textual do envio.
    await pageB.getByTestId('pref-hide-reactions').check();
    await pageA.getByRole('button', { name: 'Reagir como Ana', exact: true }).click();
    await pageA.getByTestId('mood-reaction-chorando').click();
    await expect(reactionBadge(pageB, 'Chorando')).toHaveCount(0);
    await expect(pageB.getByTestId('mood-feedback')).toHaveCount(0);
    await pageB.getByRole('button', { name: 'Reagir como Bia', exact: true }).click();
    await pageB.getByTestId('mood-reaction-rindo').click();
    await expect(pageB.getByTestId('mood-feedback')).toContainText('Reação enviada: Rindo');
    await expect(reactionBadge(pageB, 'Rindo')).toHaveCount(0);
    await expect(reactionBadge(pageA, 'Rindo')).toHaveCount(1);
    await pageB.getByTestId('pref-hide-reactions').uncheck();
    await expect(reactionBadge(pageB, 'Rindo')).toHaveCount(0);

    // Ocultar provocações esconde aviso e apresentação central.
    await pageB.getByTestId('pref-hide-taunts').check();
    await pageA.getByRole('button', { name: 'Provocar Bia', exact: true }).click();
    await pageA.getByTestId('mood-taunt-tomate').click();
    await expect(pageA.getByTestId('mood-feedback')).toContainText('Provocação enviada');
    await expect(pageB.getByTestId('taunt-notice')).toHaveCount(0);
    await expect(pageB.getByTestId('taunt-effect-tomate')).toHaveCount(0);
    await pageB.getByTestId('pref-hide-taunts').uncheck();

    // Reload da mesma identidade: a janela de provocação em andamento é
    // recuperada do estado; nada antigo é reapresentado.
    await pageA.reload();
    await expect(pageA.getByTestId('invite-link')).toBeVisible();
    await pageA.getByRole('button', { name: 'Provocar Bia', exact: true }).click();
    await expect(pageA.getByTestId('mood-countdown')).toBeVisible();
    await expect(pageA.getByTestId('mood-taunt-tomate')).toHaveAttribute('aria-disabled', 'true');
    await expect(pageA.getByTestId('taunt-notice')).toHaveCount(0);
    await expect(pageA.locator('[data-testid^="reaction-badge-"]')).toHaveCount(0);
    await pageA.getByTestId('mood-menu-close').click();
    await expect(pageA.getByTestId('taunt-panel-toggle')).toBeVisible();
    await openTauntPanel(pageA);
    await expect(pageA.getByTestId('taunt-panel')).toHaveAttribute('open', '');
  } finally {
    await desktop.close();
    await mobile.close();
  }
});
