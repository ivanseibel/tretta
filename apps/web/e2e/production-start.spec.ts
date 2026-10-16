import { expect, test } from '@playwright/test';

test('build compilado inicia a mesa sem hooks de teste e conecta no servidor publicado localmente', async ({ page }) => {
  const websocketUrls: string[] = [];
  page.on('websocket', (socket) => websocketUrls.push(socket.url()));
  await page.goto('/');
  await expect(page.getByTestId('nickname-input')).toBeVisible();
  expect(await page.evaluate(() => window.__trettaTest)).toBeUndefined();
  await page.getByTestId('nickname-input').fill('Smoke compilado');
  await page.getByTestId('create-room-button').click();
  await expect(page.getByTestId('invite-link')).toBeVisible();
  await expect.poll(() => websocketUrls.some((url) => {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' && parsed.hostname === '127.0.0.1' && parsed.port === '3100' && parsed.pathname.startsWith('/socket.io/');
  }), { timeout: 10_000 }).toBe(true);
});
