import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices } from '@playwright/test';
import { expect, test } from './fixtures';
import { createRoom, joinRoom, readyAll } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T004/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

test('saída voluntária ativa o substituto e a saída do anfitrião transfere o papel', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const third = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();
  const pageC = await third.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await joinRoom(pageC, inviteUrl, 'Cai', 'sapo');
  await readyAll(pageA, pageB, pageC);

  // Bia sai voluntariamente: o substituto assume a vaga sem pausa e a página volta ao início.
  await expect(pageB.getByTestId('leave-button')).toBeVisible();
  await pageB.getByTestId('leave-button').click();
  await expect(pageB).toHaveURL('/');
  await expect(pageA.getByTestId('seat-Bia').getByText('substituto')).toBeVisible();
  await expect(pageA.getByTestId('pause-panel')).toHaveCount(0);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-saida-substituto.png') });

  // Ana (anfitriã) sai: o papel passa para quem está conectado há mais tempo — Cai.
  await pageA.getByTestId('leave-button').click();
  await expect(pageA).toHaveURL('/');
  await expect(pageC.getByTestId('end-round-button').first()).toBeVisible();
  await expect(pageC.getByTestId('seat-Ana').getByText('substituto')).toBeVisible();

  // Cai encerra a rodada sem vencedor: substituídos desconectados são retirados.
  await pageC.getByTestId('end-round-button').first().click();
  await expect(pageC.getByTestId('results-winner')).toContainText('sem vencedor');
  await expect(pageC.getByTestId('score-Cai')).toBeVisible();
  await expect(pageC.getByTestId('score-Bia')).toHaveCount(0);
  await expect(pageC.getByTestId('score-Ana')).toHaveCount(0);

  await desktop.close();
  await mobile.close();
  await third.close();
});

test('anfitrião remove participante no lobby e o removido vê o aviso e pode voltar como nova pessoa', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');

  await expect(pageB.getByTestId('remove-Bia')).toHaveCount(0);
  await pageA.getByTestId('remove-Bia').click();
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(1);
  await expect(pageB.getByTestId('removed-message')).toContainText('removido');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-removido.png') });
  await pageB.getByTestId('back-home').click();
  await expect(pageB.getByTestId('nickname-input')).toBeVisible();

  // A credencial revogada não volta como a Bia anterior; entrar como nova pessoa funciona.
  await pageB.goto(inviteUrl);
  await expect(pageB.getByTestId('join-name-input')).toBeVisible();
  await pageB.getByTestId('join-name-input').fill('Bia de novo');
  await pageB.getByTestId('join-room-button').click();
  await expect(pageB.getByTestId('ready-toggle')).toBeVisible();
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(2);

  await desktop.close();
  await mobile.close();
});
