import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';
import { createRoom, joinRoom } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T004/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

test('reiniciar o processo real do servidor faz a interface informar que a sala deixou de existir', async ({
  browser,
  serverProc,
}) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(2);

  await serverProc.restart();

  // Os clientes reconectam ao servidor novo, a sala em memória não existe mais e a
  // interface oferece o caminho de volta — sem manter a mesa antiga ativa.
  await expect(pageA.getByTestId('room-not-found')).toBeVisible({ timeout: 30000 });
  await expect(pageB.getByTestId('room-not-found')).toBeVisible({ timeout: 30000 });
  await pageA.screenshot({ path: join(shotsDir, 'desktop-sala-encerrada.png') });

  await pageA.getByTestId('back-home').click();
  await expect(pageA.getByTestId('nickname-input')).toBeVisible();
  await expect(pageA.getByTestId('my-hand')).toHaveCount(0);

  await desktop.close();
  await mobile.close();
});
