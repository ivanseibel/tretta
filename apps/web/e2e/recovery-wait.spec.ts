import { expect, test } from './fixtures';
import { createRoom, joinRoom } from './room';

/**
 * T010 — a identidade única continua protegida no servidor, mas a segunda aba
 * deixa de cair no formulário/erro antigo: ela espera a retomada, preserva a
 * credencial e nunca oferece entrada como nova pessoa. A aba original segue
 * vinculada e operável.
 */
test('nova aba com a mesma identidade espera a retomada sem formulário e sem derrubar a aba original', async ({
  browser,
}) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  try {
    const inviteUrl = await createRoom(host, 'Ana');
    await joinRoom(player, inviteUrl, 'Bia');

    // Segunda aba do mesmo navegador: mesma credencial guardada, outra conexão.
    const secondTab = await playerContext.newPage();
    await secondTab.goto(inviteUrl);

    // Espera a retomada; nada de formulário, erro ou "já está conectada".
    await expect(secondTab.getByTestId('recovering')).toBeVisible();
    await expect(secondTab.getByTestId('join-name-input')).toHaveCount(0);
    await expect(secondTab.getByTestId('error-banner')).toHaveCount(0);
    await expect(secondTab.getByText(/já está conectada/i)).toHaveCount(0);

    // Passado o primeiro ciclo de recusas temporárias, segue só esperando.
    await secondTab.waitForTimeout(1_500);
    await expect(secondTab.getByTestId('recovering')).toBeVisible();
    await expect(secondTab.getByTestId('join-name-input')).toHaveCount(0);
    await expect(secondTab.getByTestId('error-banner')).toHaveCount(0);

    // A aba original permanece vinculada e operável.
    await player.getByTestId('ready-toggle').click();
    await expect(host.getByTestId('lobby-participant').filter({ hasText: 'Bia' })).toContainText('pronto');
    await player.getByTestId('ready-toggle').click();
    await expect(host.getByTestId('lobby-participant').filter({ hasText: 'Bia' })).toContainText('aguardando');

    // Fechar a aba que esperava cancela a retomada sem afetar o vínculo original.
    await secondTab.close();
    await expect(player.getByTestId('ready-toggle')).toBeEnabled();
    await expect(host.getByTestId('lobby-participant')).toHaveCount(2);
  } finally {
    await hostContext.close();
    await playerContext.close();
  }
});
