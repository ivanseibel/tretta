import { expect, test } from './fixtures';
import { challengeDeck, scenarioDeck } from './deck';
import { createRoom, drawAndPass, joinRoom, playCard, readyAll, setNextDeck, waitMyTurn } from './room';

async function activate(page: import('@playwright/test').Page, testId: string, key = 'Enter'): Promise<void> {
  const button = page.getByTestId(testId);
  await button.focus();
  await page.keyboard.press(key);
}

async function playWithKeyboard(page: import('@playwright/test').Page, cardId: string, announce = false): Promise<void> {
  await waitMyTurn(page);
  const card = page.getByTestId(`card-${cardId}`);
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  if (announce) {
    const checkbox = page.getByTestId('last-card-checkbox');
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.keyboard.press('Tab');
  }
  const play = page.getByTestId('play-button');
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('my-hand')).toBeFocused();
}

async function drawAndPassWithKeyboard(page: import('@playwright/test').Page): Promise<void> {
  await waitMyTurn(page);
  await activate(page, 'draw-button');
  const pass = page.getByTestId('pass-button');
  await expect(pass).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('turn-indicator')).toBeFocused();
}

test('criação, sala e rodada completa operáveis por teclado com foco e coringa', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await host.goto('/');
    await host.getByTestId('nickname-input').fill('Ana');
    const hostAvatar = host.getByTestId('avatar-option-pinguim');
    await hostAvatar.focus();
    await host.keyboard.press('Space');
    await expect(hostAvatar).toHaveAttribute('aria-pressed', 'true');
    await activate(host, 'create-room-button');
    const invite = await host.getByTestId('invite-link').textContent();
    if (invite === null) throw new Error('link de convite ausente');

    await guest.goto(invite);
    await guest.getByTestId('join-name-input').fill('Bia');
    const guestAvatar = guest.getByTestId('avatar-option-tucano');
    await guestAvatar.focus();
    await guest.keyboard.press('Space');
    await expect(guestAvatar).toHaveAttribute('aria-pressed', 'true');
    await activate(guest, 'join-room-button');
    await expect(guest.getByTestId('ready-toggle')).toBeVisible();

    await setNextDeck(host, scenarioDeck());
    await activate(host, 'ready-toggle', 'Space');
    await activate(guest, 'ready-toggle', 'Space');
    await expect(host.getByTestId('start-round-button')).toBeEnabled();
    await activate(host, 'start-round-button');
    await expect(host.getByTestId('my-hand')).toBeVisible();
    await expect(host.locator('[data-focus-target]')).toBeFocused();

    // Escape cancela a seleção e devolve o foco à carta escolhida.
    await waitMyTurn(host);
    const firstCard = host.getByTestId('card-red-1-1');
    await firstCard.focus();
    await host.keyboard.press('Enter');
    await host.keyboard.press('Escape');
    await expect(host.getByTestId('play-strip')).toHaveCount(0);
    await expect(firstCard).toBeFocused();
    await playWithKeyboard(host, 'red-1-1');
    await drawAndPassWithKeyboard(guest);

    // Uma mudança de turno não tira o foco nem apaga um rascunho do chat.
    const draft = guest.getByTestId('chat-input');
    await draft.fill('rascunho preservado');
    await playWithKeyboard(host, 'red-2-1');
    await waitMyTurn(guest);
    await expect(draft).toBeFocused();
    await expect(draft).toHaveValue('rascunho preservado');
    await draft.fill('');
    await drawAndPassWithKeyboard(guest);

    for (const cardId of ['red-3-1', 'red-4-1', 'red-5-1']) {
      await playWithKeyboard(host, cardId);
      await drawAndPassWithKeyboard(guest);
    }

    await playWithKeyboard(host, 'red-6-1', true);
    await expect(guest.getByTestId('challenge-button')).toHaveCount(0);
    await drawAndPassWithKeyboard(guest);

    const wild = host.getByTestId('card-wild-color-1');
    await waitMyTurn(host);
    await wild.focus();
    await host.keyboard.press('Enter');
    await host.keyboard.press('Tab');
    const play = host.getByTestId('play-button');
    await expect(play).toBeFocused();
    await host.keyboard.press('Enter');
    const firstColor = host.getByTestId('color-option-red');
    await expect(firstColor).toBeFocused();
    await host.keyboard.press('Escape');
    await expect(play).toBeFocused();
    await host.keyboard.press('Enter');
    await expect(firstColor).toBeFocused();
    await host.keyboard.press('Tab');
    await host.keyboard.press('Tab');
    const green = host.getByTestId('color-option-green');
    await expect(green).toBeFocused();
    await host.keyboard.press('Enter');

    await expect(host.getByTestId('results-winner')).toContainText('Ana venceu');
    await expect(guest.getByTestId('results-winner')).toContainText('Ana venceu');
    await expect(host.locator('[data-focus-target]')).toBeFocused();
    await expect(host.getByTestId('results-winner')).toHaveAttribute('aria-live', 'polite');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('denúncia de última carta aceita por teclado com retorno de foco', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia', 'tucano');
    await setNextDeck(host, challengeDeck());
    await readyAll(host, guest);

    for (const cardId of ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1']) {
      await playCard(host, cardId);
      await drawAndPass(guest);
    }
    await playCard(host, 'red-6-1');
    const challenge = guest.getByTestId('challenge-button');
    await challenge.focus();
    await guest.keyboard.press('Enter');
    await expect(host.getByTestId('my-hand').locator('[data-testid^="card-"]')).toHaveCount(3);
    await expect(guest.getByTestId('turn-indicator')).toBeFocused();
    await expect(guest.getByTestId('challenge-button')).toHaveCount(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('chat, provocações e preferências funcionam sem mouse', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    const invite = await createRoom(host, 'Ana');
    await joinRoom(guest, invite, 'Bia', 'tucano');

    const message = host.getByTestId('chat-input');
    await message.focus();
    await message.fill('Mensagem enviada por teclado.');
    await host.keyboard.press('Enter');
    await expect(host.getByTestId('chat-messages')).toContainText('Mensagem enviada por teclado.');

    const full = host.getByTestId('pref-animations-full');
    const reduced = host.getByTestId('pref-animations-reduced');
    const off = host.getByTestId('pref-animations-off');
    await full.focus();
    await host.keyboard.press('ArrowRight');
    await expect(reduced).toBeChecked();
    await host.keyboard.press('ArrowRight');
    await expect(off).toBeChecked();
    await host.keyboard.press('ArrowLeft');
    await expect(reduced).toBeChecked();
    await host.keyboard.press('ArrowLeft');
    await expect(full).toBeChecked();
    const sound = host.getByTestId('pref-sound-mute');
    await sound.focus();
    await host.keyboard.press('Space');
    await expect(sound).toBeChecked();
    await host.keyboard.press('Space');
    await expect(sound).not.toBeChecked();
    const hideTaunts = host.getByTestId('pref-hide-taunts');
    await hideTaunts.focus();
    await host.keyboard.press('Space');
    await expect(hideTaunts).toBeChecked();
    await host.keyboard.press('Space');
    await expect(hideTaunts).not.toBeChecked();

    const tauntType = host.getByTestId('taunt-type');
    await tauntType.focus();
    await expect(tauntType).toBeFocused();
    const target = host.getByTestId('taunt-target');
    await host.keyboard.press('Tab');
    await expect(target).toBeFocused();
    const sendTaunt = host.getByTestId('taunt-send');
    await host.keyboard.press('Tab');
    await expect(sendTaunt).toBeFocused();
    await host.keyboard.press('Enter');
    await expect(host.getByTestId('taunt-effect-tomate')).toBeVisible();
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

