import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { scenarioDeck } from './deck';
import { createRoom, joinRoom, readyAll, setNextDeck, waitMyTurn } from './room';

const shotsDir = fileURLToPath(new URL('../../../docs/work/reports/assets/T005A/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

async function sendChat(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
  // Espera o ack confirmar antes do próximo envio: o sucesso limpa o rascunho
  // e preencher antes disso faria o clique cair em botão recém-desabilitado.
  await expect(page.getByTestId('chat-messages')).toContainText(text);
}

async function joinAsWatcher(page: Page, inviteUrl: string, nickname: string): Promise<void> {
  await page.goto(inviteUrl);
  await page.getByTestId('join-name-input').fill(nickname);
  await page.getByTestId('join-room-button').click();
  await expect(page.getByTestId('waiting-banner')).toBeVisible();
}

test('chat na preparação, mesa e resultado com desktop e celular, reload recupera histórico', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await expect(pageA.getByTestId('lobby-participant')).toHaveCount(2);

  // Preparação: troca de mensagens com ordem e autor coerentes.
  await sendChat(pageA, 'Oi, gente, na preparação');
  await sendChat(pageB, 'Boa, chegando!');
  await sendChat(pageA, '<b>isso é texto</b>');
  await expect(pageA.getByTestId('chat-messages')).toContainText('Oi, gente, na preparação');
  await expect(pageA.getByTestId('chat-messages')).toContainText('Boa, chegando!');
  await expect(pageB.getByTestId('chat-messages')).toContainText('Boa, chegando!');
  // Conteúdo parecido com HTML renderiza literalmente, sem interpretar.
  await expect(pageA.getByTestId('chat-messages')).toContainText('<b>isso é texto</b>');
  await expect(pageA.getByTestId('chat-messages').locator('b')).toHaveCount(0);
  await expect(pageB.getByTestId('chat-messages').locator('b')).toHaveCount(0);
  await pageA.screenshot({ path: join(shotsDir, 'desktop-lobby-chat.png'), fullPage: true });
  await pageB.screenshot({ path: join(shotsDir, 'mobile-lobby-chat.png'), fullPage: true });

  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);

  // Durante a mesa: conversa coexiste com jogada.
  await waitMyTurn(pageA);
  await sendChat(pageA, 'jogando enquanto converso');
  await pageA.getByTestId('card-red-1-1').click();
  await pageA.getByTestId('play-button').click();
  await expect(pageB.getByTestId('discard-top')).toHaveAttribute('data-card-id', 'red-1-1');
  await sendChat(pageB, 'boa jogada');
  await expect(pageA.getByTestId('chat-messages')).toContainText('boa jogada');
  await expect(pageA.getByTestId('my-hand')).toBeVisible();
  await expect(pageA.getByTestId('chat-panel')).toBeVisible();
  await pageA.screenshot({ path: join(shotsDir, 'desktop-table-chat.png'), fullPage: true });
  await pageB.screenshot({ path: join(shotsDir, 'mobile-table-chat.png'), fullPage: true });

  // Reload no celular: identidade volta e o histórico completo continua lá.
  await pageB.reload();
  await expect(pageB.getByTestId('my-hand')).toBeVisible();
  await expect(pageB.getByTestId('chat-messages')).toContainText('Oi, gente, na preparação');
  await expect(pageB.getByTestId('chat-messages')).toContainText('jogando enquanto converso');
  await expect(pageB.getByTestId('chat-messages')).toContainText('boa jogada');
  await pageB.screenshot({ path: join(shotsDir, 'mobile-reload-chat.png'), fullPage: true });

  // Resultado: chat segue disponível e preserva textos de rodadas anteriores.
  await pageA.getByTestId('end-round-button').click();
  await expect(pageA.getByTestId('results-winner')).toBeVisible();
  await sendChat(pageA, 'boa rodada!');
  await sendChat(pageB, 'até a próxima');
  await expect(pageA.getByTestId('chat-messages')).toContainText('boa rodada!');
  await expect(pageB.getByTestId('chat-messages')).toContainText('até a próxima');
  await pageA.screenshot({ path: join(shotsDir, 'desktop-results-chat.png'), fullPage: true });

  await pageA.getByTestId('return-to-lobby-button').click();
  await expect(pageA.getByTestId('ready-toggle')).toBeVisible();
  await expect(pageA.getByTestId('chat-messages')).toContainText('boa rodada!');
  await expect(pageA.getByTestId('chat-messages')).toContainText('<b>isso é texto</b>');

  await desktop.close();
  await mobile.close();
});

test('quem aguarda vê a mesa pública, participa do chat e o silêncio local vale por identidade', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const pageA = await desktop.newPage();
  const pageB = await mobile.newPage();

  const inviteUrl = await createRoom(pageA, 'Ana');
  await joinRoom(pageB, inviteUrl, 'Bia', 'tucano');
  await setNextDeck(pageA, scenarioDeck());
  await readyAll(pageA, pageB);
  await waitMyTurn(pageA);
  await pageA.getByTestId('card-red-1-1').click();
  await pageA.getByTestId('play-button').click();

  // Quem entra durante a rodada: mesa pública imediata, sem mão e com aviso de espera.
  const watcherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageW = await watcherContext.newPage();
  await joinAsWatcher(pageW, inviteUrl, 'Cai');
  await expect(pageW.getByTestId('public-table')).toBeVisible();
  await expect(pageW.getByTestId('public-discard-top')).toBeVisible();
  await expect(pageW.getByTestId('public-table-status')).toContainText('Vez de');
  await expect(pageW.getByTestId('public-hand-count-Ana')).toContainText('cartas');
  await expect(pageW.getByTestId('my-hand')).toHaveCount(0);
  await pageW.screenshot({ path: join(shotsDir, 'desktop-waiting-public-table.png'), fullPage: true });

  // Chat disponível também na espera.
  await sendChat(pageW, 'torcendo da espera');
  await expect(pageA.getByTestId('chat-messages')).toContainText('torcendo da espera');
  await expect(pageB.getByTestId('chat-messages')).toContainText('torcendo da espera');

  // Silêncio local: A silencia B; antigas e novas de B somem só para A.
  await sendChat(pageB, 'primeira da Bia');
  await expect(pageA.getByTestId('chat-messages')).toContainText('primeira da Bia');
  const biaRow = pageA.getByTestId('chat-messages').locator('li').filter({ hasText: 'primeira da Bia' });
  await biaRow.getByRole('button', { name: 'Silenciar Bia' }).click();
  await expect(pageA.getByTestId('chat-messages')).not.toContainText('primeira da Bia');
  await sendChat(pageB, 'segunda da Bia');
  await expect(pageA.getByTestId('chat-messages')).not.toContainText('segunda da Bia');
  await expect(pageA.getByTestId('chat-messages')).toContainText('Mensagem oculta de Bia.');
  // Quem não silenciou continua vendo tudo.
  await expect(pageW.getByTestId('chat-messages')).toContainText('primeira da Bia');
  await expect(pageW.getByTestId('chat-messages')).toContainText('segunda da Bia');
  await pageA.screenshot({ path: join(shotsDir, 'desktop-chat-silenced.png'), fullPage: true });

  // Outra identidade com o mesmo apelido não é silenciada por engano.
  const twinContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageTwin = await twinContext.newPage();
  await joinAsWatcher(pageTwin, inviteUrl, 'Bia');
  await sendChat(pageTwin, 'sou outra Bia');
  await expect(pageA.getByTestId('chat-messages')).toContainText('sou outra Bia');
  await expect(pageA.getByTestId('chat-messages')).toContainText('Mensagem oculta de Bia.');

  // Reload mantém a escolha; desfazer restaura.
  await pageA.reload();
  await expect(pageA.getByTestId('my-hand')).toBeVisible();
  await expect(pageA.getByTestId('chat-messages')).not.toContainText('primeira da Bia');
  await expect(pageA.getByTestId('chat-messages')).not.toContainText('segunda da Bia');
  await pageA.getByTestId('chat-messages').locator('li').filter({ hasText: 'Mensagem oculta de Bia.' }).getByRole('button', { name: 'Mostrar mensagens de Bia' }).first().click();
  await expect(pageA.getByTestId('chat-messages')).toContainText('primeira da Bia');
  await expect(pageA.getByTestId('chat-messages')).toContainText('segunda da Bia');
  await pageA.screenshot({ path: join(shotsDir, 'desktop-chat-unmuted.png'), fullPage: true });

  await desktop.close();
  await mobile.close();
  await watcherContext.close();
  await twinContext.close();
});

test('limite de envio, contador Unicode e recusa explicada preservam o texto', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await createRoom(page, 'Ana');
  await expect(page.getByTestId('chat-send')).toBeDisabled();

  // Acima do limite: contador mostra o excesso e o envio fica bloqueado.
  await page.getByTestId('chat-input').fill('a'.repeat(501));
  await expect(page.getByTestId('chat-counter')).toHaveText('501/500');
  await expect(page.getByTestId('chat-too-long')).toBeVisible();
  await expect(page.getByTestId('chat-send')).toBeDisabled();

  // Emoji fora do BMP vale 1 caractere: 500 passa, 501 não.
  await page.getByTestId('chat-input').fill('😀'.repeat(500));
  await expect(page.getByTestId('chat-counter')).toHaveText('500/500');
  await expect(page.getByTestId('chat-send')).toBeEnabled();
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-messages')).toContainText('😀');
  await page.getByTestId('chat-input').fill('😀'.repeat(501));
  await expect(page.getByTestId('chat-counter')).toHaveText('501/500');
  await expect(page.getByTestId('chat-send')).toBeDisabled();
  await page.screenshot({ path: join(shotsDir, 'desktop-chat-counter.png'), fullPage: true });

  // Cinco aceitas na janela; a sexta é recusada com explicação e texto preservado.
  for (let index = 2; index <= 5; index++) {
    await sendChat(page, `envio ${index}`);
  }
  await page.getByTestId('chat-input').fill('sexto envio');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-error')).toContainText('Muitas mensagens em pouco tempo');
  await expect(page.getByTestId('chat-input')).toHaveValue('sexto envio');
  await expect(page.getByTestId('chat-messages')).not.toContainText('sexto envio');
  await page.screenshot({ path: join(shotsDir, 'desktop-chat-rate-limit.png'), fullPage: true });

  // A janela móvel libera sozinha depois de dez segundos.
  await page.waitForTimeout(10_500);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-messages')).toContainText('sexto envio');
  await expect(page.getByTestId('chat-error')).toHaveCount(0);

  await context.close();
});
