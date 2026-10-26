import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export class ScenarioUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScenarioUnavailableError';
  }
}

export async function loadScenarioFactory(filePath) {
  if (!filePath) return null;
  const absolute = resolve(filePath);
  const module = await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`);
  if (typeof module.createScenario === 'function') return module.createScenario;
  if (typeof module.default === 'function') return module.default;
  throw new Error(`Cenário ${absolute} precisa exportar createScenario() ou default function.`);
}

const FIRST_NAMES = ['Bia', 'Léo', 'Vó Cida', 'Seu Nilton', 'Rita', 'Tio Zeca', 'Fernanda Albuquerque'];

export async function fillNickname(page, nickname) {
  const byTestId = page.locator('[data-testid="nickname-input"]');
  const byLabel = page.getByLabel(/seu apelido|apelido/i);
  const field = (await byTestId.count()) ? byTestId : byLabel;
  await field.first().fill(nickname);
}

export async function clickTrain(page) {
  const candidates = [
    page.getByRole('button', { name: /treinar|treino/i }),
    page.locator('[data-testid="train-solo-button"]'),
    page.getByRole('link', { name: /treinar|treino/i })
  ];
  for (const candidate of candidates) {
    if (await candidate.count()) {
      await candidate.first().click();
      return;
    }
  }
  throw new ScenarioUnavailableError('Botão de treino não encontrado na home.');
}

export async function clickReady(page) {
  const candidates = [
    page.getByRole('button', { name: /estou pronto|marcar pronto|pronto/i }),
    page.locator('[data-testid="ready-button"]')
  ];
  for (const candidate of candidates) {
    if (await candidate.count()) {
      const button = candidate.first();
      if (await button.isEnabled().catch(() => false)) {
        await button.click();
        return true;
      }
    }
  }
  return false;
}

export async function clickStart(page) {
  const candidates = [
    page.getByRole('button', { name: /iniciar rodada|começar rodada|iniciar/i }),
    page.locator('[data-testid="start-round-button"]')
  ];
  for (const candidate of candidates) {
    if (await candidate.count()) {
      const button = candidate.first();
      if (await button.isEnabled().catch(() => false)) {
        await button.click();
        return true;
      }
    }
  }
  return false;
}

export async function waitForRoom(page) {
  await page.waitForURL(/\/sala\//, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(250);
}

export function defaultNickname(index) {
  return FIRST_NAMES[index % FIRST_NAMES.length];
}
