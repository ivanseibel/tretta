/**
 * Cenário de jogo da T019F.
 *
 * Monta salas e partidas reais pelo navegador para os estados que não são uma
 * rota simples. Não altera o app: usa os mesmos controles da pessoa, os hooks
 * de teste já existentes e contextos isolados para os demais assentos.
 */
import { createClassicDeck } from '../../../../../../packages/rules/dist/index.js';

const NAMES = ['Ana', 'Bia', 'Cai', 'Davi', 'Eva', 'Fabi', 'Gui', 'Hugo'];
const DEFAULT_AVATARS = ['lobo', 'tucano', 'raposa', 'sapo', 'coruja', 'lince', 'polvo', 'pinguim'];

function scenarioDeck() {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'wild-color-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['blue-8-1', 'red-7-1', 'blue-9-1', 'green-1-1', 'green-2-1', 'green-3-1'],
  });
}

function fourSeatDeck() {
  return buildDeck({
    hands: [
      ['red-1-1', 'red-2-1', 'red-3-1', 'red-4-1', 'red-5-1', 'red-6-1', 'wild-color-1'],
      ['blue-1-1', 'blue-2-1', 'blue-3-1', 'blue-4-1', 'blue-5-1', 'blue-6-1', 'blue-7-1'],
      ['green-1-1', 'green-2-1', 'green-3-1', 'green-4-1', 'green-5-1', 'green-6-1', 'green-7-1'],
      ['yellow-1-1', 'yellow-2-1', 'yellow-3-1', 'yellow-4-1', 'yellow-5-1', 'yellow-6-1', 'yellow-7-1'],
    ],
    discard: 'red-9-1',
    draw: ['red-7-1', 'blue-8-1', 'green-8-1', 'yellow-8-1'],
  });
}

function eightSeatReverseDeck() {
  const all = createClassicDeck().map((card) => card.id);
  const reserved = new Set(['red-reverse-1', 'red-reverse-2', 'red-9-1']);
  const pool = all.filter((id) => !reserved.has(id));
  const hands = [];
  hands.push(['red-reverse-1', ...pool.splice(0, 6)]);
  hands.push(['red-reverse-2', ...pool.splice(0, 6)]);
  for (let seat = 2; seat < 8; seat++) hands.push(pool.splice(0, 7));
  return buildDeck({ hands, discard: 'red-9-1', draw: pool.slice(0, 20) });
}

function buildDeck({ hands, discard, draw }) {
  const deck = [];
  const handSize = hands[0]?.length ?? 0;
  for (let round = 0; round < handSize; round++) {
    for (const hand of hands) {
      const card = hand[round];
      if (card === undefined) throw new Error('Mãos com tamanhos diferentes.');
      deck.push(card);
    }
  }
  deck.push(discard, ...draw);
  const used = new Set(deck);
  const remaining = createClassicDeck()
    .map((card) => card.id)
    .filter((id) => !used.has(id));
  deck.push(...remaining);
  if (deck.length !== 108) throw new Error(`Baralho com ${deck.length} cartas.`);
  return deck;
}

async function setDeck(page, deck) {
  const result = await page.evaluate((cards) => window.__trettaTest.setNextDeck(cards), deck);
  if (!result.ok) throw new Error(`setNextDeck recusado: ${result.error?.message ?? 'sem motivo'}`);
}

function url(baseURL, path) {
  return new URL(path, baseURL).href;
}

async function fillUntilEnabled(page, input, buttonTestId, value) {
  await input.waitFor({ state: 'visible', timeout: 20_000 });
  for (let attempt = 0; attempt < 8; attempt++) {
    await input.fill(value);
    await page.waitForTimeout(120);
    const current = await input.inputValue().catch(() => '');
    const button = page.locator(`[data-testid="${buttonTestId}"]`);
    if (current === value && (await button.count()) > 0 && !(await button.isDisabled().catch(() => true))) return;
  }
  throw new Error(`campo ${buttonTestId} não aceitou o valor`);
}

async function fillNickname(page, nickname) {
  await fillUntilEnabled(page, page.locator('[data-testid="nickname-input"]'), 'create-room-button', nickname);
}

async function createRoom(page, baseURL, nickname) {
  await page.goto(url(baseURL, '/'), { waitUntil: 'domcontentloaded' });
  await fillNickname(page, nickname);
  await page.locator('[data-testid="create-room-button"]').click();
  await page.waitForURL(/\/sala\//, { timeout: 20_000 });
  const link = page.locator('[data-testid="invite-link"]');
  await link.waitFor({ state: 'visible', timeout: 20_000 });
  const invite = await link.textContent();
  if (invite === null) throw new Error('convite ausente');
  return invite;
}

async function joinRoom(page, invite, nickname, avatar = 'lobo', { waiting = false } = {}) {
  await page.goto(invite, { waitUntil: 'domcontentloaded' });
  const name = page.locator('[data-testid="join-name-input"]');
  await fillUntilEnabled(page, name, 'join-room-button', nickname);
  await page.locator(`[data-testid="avatar-option-${avatar}"]`).click();
  await page.locator('[data-testid="join-room-button"]').click();
  if (waiting) await page.locator('[data-testid="waiting-banner"]').waitFor({ state: 'visible', timeout: 20_000 });
  else await page.locator('[data-testid="ready-toggle"]').waitFor({ state: 'visible', timeout: 20_000 });
}

async function clickReady(page) {
  const toggle = page.locator('[data-testid="ready-toggle"]');
  await toggle.waitFor({ state: 'visible', timeout: 20_000 });
  const pressed = await toggle.getAttribute('aria-pressed');
  if (pressed !== 'true') await toggle.click();
}

async function startRound(host, players) {
  for (const page of players) await clickReady(page);
  const start = host.locator('[data-testid="start-round-button"]');
  await start.waitFor({ state: 'visible', timeout: 20_000 });
  await pageWait(host, 20_000, () => {
    const button = document.querySelector('[data-testid="start-round-button"]');
    return button !== null && !button.disabled;
  }, 'iniciar rodada habilitado');
  await start.click();
  for (const page of players) {
    await page.locator('[data-testid="my-hand"]').waitFor({ state: 'visible', timeout: 30_000 });
  }
}

async function pageWait(page, timeout, predicate, label, arg) {
  await page.waitForFunction(predicate, arg, { timeout, polling: 100 }).catch(() => {
    throw new Error(`tempo esgotado: ${label}`);
  });
}

async function isMyTurn(page) {
  const text = await page.locator('[data-testid="turn-indicator"]').textContent({ timeout: 5_000 }).catch(() => null);
  return text === 'Sua vez';
}

async function waitAnyTurn(pages, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const page of pages) {
      if (await isMyTurn(page)) return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error('nenhuma página com a vez');
}

async function drawAndPass(page) {
  await page.locator('[data-testid="draw-button"]').click();
  const pass = page.locator('[data-testid="pass-button"]');
  await pass.waitFor({ state: 'visible', timeout: 20_000 });
  await pass.click();
  await pageWait(page, 20_000, () => {
    const node = document.querySelector('[data-testid="turn-indicator"]');
    return node !== null && node.textContent !== 'Sua vez';
  }, 'turno passar');
}

async function advanceToHostTurn(players, host) {
  for (let step = 0; step < 20; step++) {
    const current = await waitAnyTurn(players);
    if (current === host) return;
    await drawAndPass(current);
  }
  throw new Error('a vez não chegou ao anfitrião');
}

async function playHostCards(host, other, count, { announceLast = false } = {}) {
  for (let index = 0; index < count; index++) {
    if (!(await isMyTurn(host))) await advanceToHostTurn([host, other], host);
    const cards = host.locator('[data-testid^="card-"]');
    const countBefore = await cards.count();
    const card = cards.first();
    const cardId = await card.getAttribute('data-testid');
    await card.click();
    const checkbox = host.locator('[data-testid="last-card-checkbox"]');
    if (announceLast && (await checkbox.count()) > 0) await checkbox.check();
    await host.locator('[data-testid="play-button"]').click();
    await pageWait(host, 20_000, (expected) => {
      const hand = document.querySelector('[data-testid="my-hand"]');
      return hand !== null && hand.querySelectorAll('[data-testid^="card-"]').length === expected;
    }, `mão com ${String(countBefore - 1)} cartas`, countBefore - 1);
    if (index < count - 1) await drawAndPass(other);
  }
}

async function waitForSeat(page, nickname, text, timeout = 20_000) {
  await pageWait(page, timeout, ({ nickname: name, text: expected }) => {
    const seats = [...document.querySelectorAll('[data-testid^="seat-"]')];
    const seat = seats.find((node) => node.textContent?.includes(name));
    return seat !== undefined && seat.textContent?.includes(expected);
  }, `assento ${nickname} com ${text}`, { nickname, text });
}

async function openDrawer(page, tab) {
  const layer = page.locator('[data-testid="table-drawer-layer"]');
  if (!(await layer.isVisible().catch(() => false))) {
    const top = page.locator('[data-testid="open-room-drawer"]');
    if ((await top.count()) > 0 && (await top.first().isVisible().catch(() => false))) await top.first().click();
    else await page.locator('[data-testid="table-bar-conversa"]').click();
    await layer.waitFor({ state: 'visible', timeout: 10_000 });
  }
  const target = page.locator(`#table-drawer-aba-${tab}`);
  if ((await target.getAttribute('aria-selected')) !== 'true') await target.click();
  await pageWait(page, 10_000, (id) => document.getElementById(`table-drawer-aba-${id}`)?.getAttribute('aria-selected') === 'true', `aba ${tab}`, tab);
}

async function disconnect(page) {
  await page.evaluate(() => window.__trettaTest.disconnect());
}

export async function createScenario({ baseURL, browser, viewport, log = () => {} }) {
  let extras = [];

  async function extraPage(nickname) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    extras.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    if (nickname !== undefined) await page.goto(url(baseURL, '/'), { waitUntil: 'domcontentloaded' });
    return page;
  }

  async function cleanup() {
    const closing = extras;
    extras = [];
    await Promise.all(closing.map((context) => context.close().catch(() => {})));
  }

  async function roomWithPlayers(host, count) {
    const invite = await createRoom(host, baseURL, NAMES[0]);
    const players = [host];
    for (let index = 1; index < count; index++) {
      const page = await extraPage(NAMES[index]);
      await joinRoom(page, invite, NAMES[index], DEFAULT_AVATARS[index] ?? 'lobo');
      players.push(page);
    }
    return { invite, players };
  }

  async function roomWithObserver(count) {
    const host = await extraPage(NAMES[0]);
    const invite = await createRoom(host, baseURL, NAMES[0]);
    const players = [host];
    for (let index = 1; index < count; index++) {
      const page = await extraPage(NAMES[index]);
      await joinRoom(page, invite, NAMES[index], DEFAULT_AVATARS[index] ?? 'lobo');
      players.push(page);
    }
    return { invite, players };
  }

  async function prepareTable(page, state) {
    const count = state.seats?.exact ?? 4;
    if (count <= 2) {
      const { players } = await roomWithPlayers(page, count);
      await setDeck(page, scenarioDeck());
      await startRound(page, players);
      return players;
    }
    if (count === 4 && (state.id === 'carta' || state.id === 'cor' || state.id === 'reacoes' || state.id === 'reacao' || state.drawer)) {
      const { players } = await roomWithPlayers(page, 4);
      await setDeck(page, fourSeatDeck());
      await startRound(page, players);
      return players;
    }
    const { players } = await roomWithPlayers(page, count);
    await startRound(page, players);
    return players;
  }

  return {
    async prepare(state, { page }) {
      await cleanup();
      const id = state.id;
      log(`preparando ${id} @ ${viewport.id}`);

      if (id === 'home') {
        await page.goto(url(baseURL, '/'), { waitUntil: 'domcontentloaded' });
        return;
      }
      if (id === 'preview') {
        await page.goto(url(baseURL, '/preview'), { waitUntil: 'domcontentloaded' });
        return;
      }
      if (id === 'erro-link') {
        await page.goto(url(baseURL, '/sala/LINK-INVALIDO'), { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="room-not-found"]').waitFor({ state: 'visible', timeout: 20_000 });
        return;
      }
      if (id === 'erro-sala') {
        // Sala real, dois participantes e todos desconectados: a retenção curta
        // do servidor de verificação expira de verdade e a retomada recebe
        // ROOM_NOT_FOUND, sem inventar uma tela de erro por rota.
        const host = await extraPage(NAMES[0]);
        const invite = await createRoom(host, baseURL, NAMES[0]);
        await joinRoom(page, invite, NAMES[1], DEFAULT_AVATARS[1]);
        await disconnect(host);
        await disconnect(page);
        await new Promise((resolve) => setTimeout(resolve, 5_700));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="room-not-found"]').waitFor({ state: 'visible', timeout: 30_000 });
        return;
      }
      if (id === 'erro-conexao') {
        await createRoom(page, baseURL, NAMES[0]);
        await disconnect(page);
        await page.locator('[data-testid="connection-lost"]').waitFor({ state: 'visible', timeout: 20_000 });
        return;
      }

      if (id === 'preparacao' || id === 'preparacao-8') {
        const count = id === 'preparacao' ? 2 : 8;
        await roomWithPlayers(page, count);
        return;
      }

      if (id === 'espera' || id === 'observador') {
        const { invite, players } = await roomWithObserver(2);
        await startRound(players[0], players);
        await joinRoom(page, invite, 'Zoe', 'coruja', { waiting: true });
        return;
      }

      if (id === 'treino' || id === 'bots') {
        await page.goto(url(baseURL, '/'), { waitUntil: 'domcontentloaded' });
        await fillNickname(page, NAMES[0]);
        await page.locator('[data-testid="train-solo-button"]').click();
        await page.waitForURL(/\/sala\//, { timeout: 20_000 });
        await clickReady(page);
        await pageWait(page, 20_000, () => {
          const button = document.querySelector('[data-testid="start-round-button"]');
          return button !== null && !button.disabled;
        }, 'treino pronto');
        await page.locator('[data-testid="start-round-button"]').click();
        await page.locator('[data-testid="my-hand"]').waitFor({ state: 'visible', timeout: 30_000 });
        return;
      }

      if (id === 'pausa' || id === 'substituto') {
        const count = id === 'pausa' ? 4 : 8;
        const { players } = await roomWithPlayers(page, count);
        await startRound(page, players);
        await disconnect(players[1]);
        await page.locator('[data-testid="pause-panel"]').waitFor({ state: 'visible', timeout: 20_000 });
        const absentName = NAMES[1];
        await page.locator(`[data-testid="substitute-${absentName}"]`).waitFor({ state: 'visible', timeout: 20_000 });
        if (id === 'substituto') {
          await page.locator(`[data-testid="substitute-${absentName}"]`).click();
          await page.locator('[data-testid="pause-panel"]').waitFor({ state: 'hidden', timeout: 20_000 });
          await waitForSeat(page, absentName, 'substituto');
        }
        return;
      }

      if (id === 'resultado' || id === 'resultado-sem-vencedor' || id === 'ultima' || id === 'denuncia') {
        if (id === 'denuncia') {
          const host = await extraPage(NAMES[0]);
          const { players } = { players: [host] };
          const invite = await createRoom(host, baseURL, NAMES[0]);
          await joinRoom(page, invite, NAMES[1], DEFAULT_AVATARS[1]);
          players.push(page);
          await setDeck(host, scenarioDeck());
          await startRound(host, players);
          await advanceToHostTurn(players, host);
          await playHostCards(host, page, 6);
          await page.locator('[data-testid="challenge-button"]').waitFor({ state: 'visible', timeout: 20_000 });
          return;
        }
        const { players } = await roomWithPlayers(page, 2);
        await setDeck(page, scenarioDeck());
        await startRound(page, players);
        await advanceToHostTurn(players, page);
        if (id === 'resultado-sem-vencedor') {
          await openDrawer(page, 'sala');
          await page.locator('[data-testid="drawer-end-round"]').click();
          await page.locator('[data-testid="results-winner"]').waitFor({ state: 'visible', timeout: 20_000 });
          return;
        }
        await playHostCards(page, players[1], 6, { announceLast: id === 'resultado' });
        if (id === 'ultima') {
          await pageWait(page, 20_000, () => {
            const hand = document.querySelector('[data-testid="my-hand"]');
            return hand !== null && hand.querySelectorAll('[data-testid^="card-"]').length === 1;
          }, 'última carta');
          return;
        }
        await drawAndPass(players[1]);
        await advanceToHostTurn(players, page);
        await page.locator('[data-testid^="card-wild-"]').first().click();
        await page.locator('[data-testid="play-button"]').click();
        await page.locator('[data-testid="color-option-green"]').click();
        await page.locator('[data-testid="results-winner"]').waitFor({ state: 'visible', timeout: 20_000 });
        return;
      }

      if (id === 'inversao') {
        const { players } = await roomWithPlayers(page, 8);
        await setDeck(page, eightSeatReverseDeck());
        await startRound(page, players);
        for (let step = 0; step < 12; step++) {
          const current = await waitAnyTurn(players);
          const reverse = current.locator('[data-testid="card-red-reverse-1"], [data-testid="card-red-reverse-2"]');
          if ((await reverse.count()) > 0) {
            await reverse.first().click();
            await current.locator('[data-testid="play-button"]').click();
            await pageWait(page, 20_000, () => {
              const direction = document.querySelector('[data-testid="table-direction"]');
              return direction !== null && /anti-horário/i.test(direction.textContent ?? '');
            }, 'sentido anti-horário');
            return;
          }
          await drawAndPass(current);
        }
        throw new Error('ninguém jogou a Inversão');
      }

      const tableStates = new Set([
        'mesa-2', 'mesa-3', 'mesa-4', 'mesa-5', 'mesa-6', 'mesa-7', 'mesa-8', 'mesa-cheia',
        'carta', 'cor', 'reacoes', 'reacao', 'sala', 'sala-apresentacao', 'sala-anfitriao', 'conversa', 'historico',
      ]);
      if (tableStates.has(id)) {
        const seatCount = id === 'mesa-2' ? 2 : id === 'mesa-3' ? 3 : id === 'mesa-5' ? 5 : id === 'mesa-6' ? 6 : id === 'mesa-7' ? 7 : id === 'mesa-8' || id === 'mesa-cheia' ? 8 : id === 'inversao' ? 8 : 4;
        const { players } = await roomWithPlayers(page, seatCount);
        if (id === 'carta' || id === 'cor') await setDeck(page, fourSeatDeck());
        await startRound(page, players);
        await advanceToHostTurn(players, page);
        if (id.startsWith('mesa-')) {
          await page.locator('[data-testid="draw-button"]').click();
          await page.locator('[data-testid="pass-button"]').waitFor({ state: 'visible', timeout: 20_000 });
          return;
        }
        if (id === 'carta') {
          const playable = page.locator('[data-testid^="card-"][data-playable="true"]').first();
          await playable.click();
          await page.locator('[data-testid="play-strip"]').waitFor({ state: 'visible', timeout: 10_000 });
          return;
        }
        if (id === 'cor') {
          await page.locator('[data-testid^="card-wild-"]').first().click();
          await page.locator('[data-testid="play-button"]').click();
          await page.locator('[data-testid="color-chooser"]').waitFor({ state: 'visible', timeout: 10_000 });
          return;
        }
        if (id === 'reacoes' || id === 'reacao') {
          await page.locator('[data-testid="table-bar-reagir"]').click();
          await page.locator('[data-testid="reaction-tray"]').waitFor({ state: 'visible', timeout: 10_000 });
          if (id === 'reacao') {
            await page.locator('[data-testid="reaction-option-eita"]').click();
            await page.locator('[data-testid="reaction-overlay"]').waitFor({ state: 'visible', timeout: 10_000 });
          }
          return;
        }
        const drawerTab = id === 'conversa' ? 'conversa' : id === 'historico' ? 'historico' : 'sala';
        await openDrawer(page, drawerTab);
        if (id === 'sala-apresentacao') {
          await page.locator('#tv2-secao-apresentacao').scrollIntoViewIfNeeded();
        } else if (id === 'sala-anfitriao') {
          await page.locator('#tv2-secao-anfitriao').scrollIntoViewIfNeeded();
        }
        return;
      }

      throw new Error(`estado sem cenário: ${id}`);
    },

    async teardownState() {
      await cleanup();
    },

    async teardown() {
      await cleanup();
    },
  };
}
