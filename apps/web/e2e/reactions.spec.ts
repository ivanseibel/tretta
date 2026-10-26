import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  closeDrawer,
  createRoom,
  joinRoom,
  openDrawer,
  openReactions,
  readyAll,
  setNextDeck,
} from './room';
import { scenarioDeck } from './deck';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T019F/reactions/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

const LABELS = [
  'Eita!',
  'Que injustiça!',
  'Aí eu gostei!',
  'Não acredito!',
  'Boa jogada!',
  'Que comédia!',
  'Que tédio!',
  'Uau!',
  'Já era!',
  'Suspeito...',
  'Com carinho!',
  'Tá pegando fogo!',
];

test('doze reações sem alvo, apresentação central de 4 s e intervalo de 5 s', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');

  await openReactions(pageA);
  await expect(pageA.getByTestId('reaction-tray')).toBeVisible();
  await expect(pageA.locator('[data-testid^="reaction-option-"]')).toHaveCount(12);
  for (const label of LABELS) {
    await expect(pageA.getByRole('button', { name: `Reagir: ${label}` })).toBeVisible();
  }
  // Sem alvo, sem texto livre e sem seletor de destinatário.
  await expect(pageA.getByTestId('reaction-tray').locator('select, input, textarea')).toHaveCount(0);
  await expect(pageA.getByTestId('reaction-tray')).toContainText('individual, sem destinatário');
  await pageA.screenshot({ path: join(shotsDir, 'reaction-tray-1280.png') });

  // Uma reação individual chega a todos com quem reagiu e o rótulo aprovado.
  await pageA.getByTestId('reaction-option-eita').click();
  await expect(pageA.getByTestId('mood-feedback')).toContainText('Reação enviada: Eita!');
  const overlayA = pageA.getByTestId('reaction-overlay');
  const overlayB = pageB.getByTestId('reaction-overlay');
  await expect(overlayA).toBeVisible();
  await expect(overlayA).toContainText('Ana');
  await expect(overlayA).toContainText('Eita!');
  await expect(overlayB).toContainText('Eita!');
  expect(await overlayA.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe('none');
  await pageA.screenshot({ path: join(shotsDir, 'reaction-overlay-1280.png') });

  // O emissor respeita o intervalo de 5 s; o contador aparece na bandeja.
  await openReactions(pageA);
  await expect(pageA.getByTestId('reaction-countdown')).toBeVisible();
  await expect(pageA.getByTestId('reaction-option-eita')).toHaveAttribute('aria-disabled', 'true');
  await pageA.keyboard.press('Escape');
  await expect(pageA.getByTestId('reaction-tray')).toHaveCount(0);
  await expect(pageA.getByTestId('table-bar-reagir')).toBeFocused();
  await expect(overlayA).toBeHidden({ timeout: 6_000 });
  await openReactions(pageA);
  await expect(pageA.getByTestId('reaction-option-eita')).toHaveAttribute('aria-disabled', 'false', {
    timeout: 3_000,
  });
  await pageA.keyboard.press('Escape');

  await desktop.close();
  await mobile.close();
});

test('reações funcionam na mesa e o ocultar é local, sem som e com confirmação textual', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Bia oculta reações na gaveta Apresentação; a preferência é só dela.
  await openDrawer(pageB, 'sala');
  await pageB.getByTestId('pref-hide-reactions').check();
  await closeDrawer(pageB);

  await openReactions(pageA);
  await pageA.getByTestId('reaction-option-uau').click();
  await expect(pageA.getByTestId('reaction-overlay')).toContainText('Uau!');
  await expect(pageB.getByTestId('reaction-overlay')).toHaveCount(0);
  await expect(pageA.getByTestId('mood-feedback')).toContainText('Reação enviada: Uau!');

  // Reativar na gaveta mostra apenas as reações novas.
  await openDrawer(pageB, 'sala');
  await pageB.getByTestId('pref-hide-reactions').uncheck();
  await closeDrawer(pageB);
  await pageB.getByTestId('table-bar-reagir').click();
  await pageB.getByTestId('reaction-option-carinho').click();
  await expect(pageB.getByTestId('reaction-overlay')).toContainText('Com carinho!');
  await expect(pageA.getByTestId('reaction-overlay')).toContainText('Com carinho!');
  await pageB.screenshot({ path: join(shotsDir, 'reaction-overlay-mobile.png') });

  await desktop.close();
  await mobile.close();
});
