import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, SELECTORS } from './config.mjs';

let playwrightModule = null;

/**
 * Resolve o Playwright instalado em apps/web sem adicionar dependência ao
 * repositório. O harness é standalone: não é uma spec da suíte.
 */
export function getPlaywright() {
  if (playwrightModule) return playwrightModule;
  const errors = [];
  for (const specifier of ['@playwright/test', 'playwright']) {
    try {
      const requireFromWeb = createRequire(resolve(REPO_ROOT, 'apps/web/package.json'));
      playwrightModule = requireFromWeb(specifier);
      return playwrightModule;
    } catch (error) {
      errors.push(`${specifier}: ${error.message}`);
    }
    try {
      playwrightModule = createRequire(import.meta.url)(specifier);
      return playwrightModule;
    } catch (error) {
      errors.push(`${specifier} (raiz): ${error.message}`);
    }
  }
  throw new Error(
    `Playwright não encontrado. Instale as dependências do app com "pnpm install --frozen-lockfile".\n${errors.join('\n')}`
  );
}

export async function launchBrowser({ headed = false, browser = 'chromium' } = {}) {
  const { chromium } = getPlaywright();
  const options = {
    headless: !headed,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  };
  if (browser === 'chrome') options.channel = 'chrome';
  const instance = await chromium.launch(options);
  return instance;
}

export async function createContext(browser, viewport, extra = {}) {
  return browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    isMobile: !!viewport.mobile,
    hasTouch: !!viewport.mobile,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    ...extra
  });
}

export async function settle(page, { prototype = false, timeout = 15000 } = {}) {
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  }).catch(() => {});
  if (prototype) {
    await page.waitForFunction(() => !!window.__T018 || document.body.dataset.t018Ready === 'true', { timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch (error) {
        // Animações infinitas não podem ser finalizadas; seguem o curso normal.
      }
    }
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
  }).catch(() => {});
}

export async function screenshot(page, filePath, { fullPage = false } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(80);
  await page.screenshot({
    path: filePath,
    fullPage,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css'
  });
}

function activeElementInfo() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return { tag: 'body', name: '', ringVisible: false, ringContrast: null };
  }
  const cs = getComputedStyle(el);
  const outlineWidth = parseFloat(cs.outlineWidth) || 0;
  const outlineStyle = cs.outlineStyle;
  const hasOutline = outlineStyle !== 'none' && outlineWidth >= 2;
  const hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
  const ringVisible = hasOutline || hasShadow;

  const parse = (value) => {
    const rgb = String(value || '').match(/^rgba?\(([^)]+)\)$/);
    if (!rgb) return null;
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const composite = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a
    };
  };
  const luminance = (color) => {
    const channel = (n) => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const ratio = (a, b) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const extractColors = (value) => {
    const matches = String(value || '').match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|color\([^)]*\)/gi) || [];
    return matches.map((match) => parse(match)).filter((color) => color && color.a > 0);
  };
  const backgrounds = (() => {
    const resolveNode = (node, depth) => {
      if (!node || depth > 30) return [{ r: 255, g: 255, b: 255, a: 1 }];
      let candidates = resolveNode(node.parentElement, depth + 1);
      const nodeStyle = getComputedStyle(node);
      const color = parse(nodeStyle.backgroundColor);
      if (color && color.a > 0) {
        candidates = candidates.map((candidate) => composite(color, candidate));
      }
      const gradient = extractColors(nodeStyle.backgroundImage);
      if (gradient.length) {
        candidates = gradient.flatMap((stop) => candidates.map((candidate) => composite(stop, candidate)));
      }
      return candidates.slice(0, 8);
    };
    return resolveNode(el, 0);
  })();

  // Com outline-offset positivo o anel fica fora da caixa e é lido contra o
  // fundo do pai, não contra a superfície interna do próprio controle.
  const ringOffset = parseFloat(cs.outlineOffset) || 0;
  const ringBackgrounds = (() => {
    if (!hasOutline || ringOffset < 0 || !el.parentElement) return backgrounds;
    const resolveNode = (node, depth) => {
      if (!node || depth > 30) return [{ r: 255, g: 255, b: 255, a: 1 }];
      let candidates = resolveNode(node.parentElement, depth + 1);
      const nodeStyle = getComputedStyle(node);
      const color = parse(nodeStyle.backgroundColor);
      if (color && color.a > 0) candidates = candidates.map((candidate) => composite(color, candidate));
      const gradient = extractColors(nodeStyle.backgroundImage);
      if (gradient.length) {
        candidates = gradient.flatMap((stop) => candidates.map((candidate) => composite(stop, candidate)));
      }
      return candidates.slice(0, 8);
    };
    return resolveNode(el.parentElement, 0);
  })();

  const ringColor = parse(cs.outlineColor);
  const ringContrast = ringVisible && ringColor
    ? Math.round(
        Math.min(...ringBackgrounds.map((background) => ratio(composite(ringColor, background), background))) * 100
      ) / 100
    : null;

  const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  return {
    tag: el.tagName.toLowerCase(),
    name,
    role: el.getAttribute('role'),
    ringVisible,
    ringStyle: outlineStyle,
    ringWidth: outlineWidth,
    boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 120),
    ringContrast
  };
}

export async function keyboardProbe(page, { drawer = false } = {}) {
  const result = { tabStops: [], drawer: null, reducedMotion: null };

  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }).catch(() => {});

  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(activeElementInfo);
    if (info.tag !== 'body') result.tabStops.push(info);
  }

  if (drawer) {
    const focusableSelector = SELECTORS.focusable.join(',');
    const drawerSelectors = SELECTORS.drawer;
    const state = await page.evaluate(({ drawerSelectors, focusableSelector }) => {
      const drawerEl = drawerSelectors
        .map((selector) => document.querySelector(selector))
        .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      if (!drawerEl) return { found: false, count: 0 };
      const focusables = Array.from(drawerEl.querySelectorAll(focusableSelector))
        .filter((element) => element.getClientRects().length > 0);
      return {
        found: true,
        count: focusables.length,
        first: focusables[0]
          ? (focusables[0].getAttribute('aria-label') || focusables[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)
          : null,
        last: focusables.length
          ? (focusables[focusables.length - 1].getAttribute('aria-label') ||
              focusables[focusables.length - 1].textContent ||
              '').replace(/\s+/g, ' ').trim().slice(0, 90)
          : null
      };
    }, { drawerSelectors, focusableSelector });

    if (state.found && state.count > 0) {
      await page.evaluate(({ drawerSelectors, focusableSelector }) => {
        const drawerEl = drawerSelectors
          .map((selector) => document.querySelector(selector))
          .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const focusables = Array.from(drawerEl.querySelectorAll(focusableSelector))
          .filter((element) => element.getClientRects().length > 0);
        focusables[focusables.length - 1].focus();
      }, { drawerSelectors, focusableSelector });
      await page.keyboard.press('Tab');
      const forward = await page.evaluate(({ drawerSelectors, focusableSelector }) => {
        const drawerEl = drawerSelectors
          .map((selector) => document.querySelector(selector))
          .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const focusables = Array.from(drawerEl.querySelectorAll(focusableSelector))
          .filter((element) => element.getClientRects().length > 0);
        return document.activeElement === focusables[0];
      }, { drawerSelectors, focusableSelector });

      await page.evaluate(({ drawerSelectors, focusableSelector }) => {
        const drawerEl = drawerSelectors
          .map((selector) => document.querySelector(selector))
          .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const focusables = Array.from(drawerEl.querySelectorAll(focusableSelector))
          .filter((element) => element.getClientRects().length > 0);
        focusables[0].focus();
      }, { drawerSelectors, focusableSelector });
      await page.keyboard.press('Shift+Tab');
      const backward = await page.evaluate(({ drawerSelectors, focusableSelector }) => {
        const drawerEl = drawerSelectors
          .map((selector) => document.querySelector(selector))
          .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const focusables = Array.from(drawerEl.querySelectorAll(focusableSelector))
          .filter((element) => element.getClientRects().length > 0);
        return document.activeElement === focusables[focusables.length - 1];
      }, { drawerSelectors, focusableSelector });

      await page.keyboard.press('Escape');
      // A gaveta usa transição de visibilidade; 450 ms cobre o fechamento sem
      // transformar a espera em flutuação de tempo.
      await page.waitForTimeout(450);
      const afterEscape = await page.evaluate(({ drawerSelectors }) => {
        const drawerEl = drawerSelectors
          .map((selector) => document.querySelector(selector))
          .find((element) => element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const active = document.activeElement;
        return {
          closed: !drawerEl,
          activeTag: active ? active.tagName.toLowerCase() : null,
          activeName: active
            ? (active.getAttribute('aria-label') || active.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)
            : null,
          opener: window.__t019fOpener
            ? {
                tag: window.__t019fOpener.tagName.toLowerCase(),
                name: (window.__t019fOpener.getAttribute('aria-label') || window.__t019fOpener.textContent || '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 90)
              }
            : null
        };
      }, { drawerSelectors });

      let focusReturned = null;
      if (afterEscape.opener && afterEscape.activeName) {
        focusReturned = afterEscape.opener.name === afterEscape.activeName;
      }

      result.drawer = {
        found: true,
        count: state.count,
        first: state.first,
        last: state.last,
        trapForward: forward,
        trapBackward: backward,
        escapeClosed: afterEscape.closed,
        focusReturned,
        activeAfterEscape: afterEscape.activeName
      };
    } else {
      result.drawer = { found: false, count: 0, trapForward: false, trapBackward: false, escapeClosed: false, focusReturned: null };
    }
  }

  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    result.reducedMotion = await page.evaluate(() => {
      const walk = (rules) => {
        for (const rule of rules) {
          if (rule.type === CSSRule.MEDIA_RULE) {
            if (/prefers-reduced-motion/i.test(rule.conditionText || '')) {
              if (/animation|transition/i.test(rule.cssText || '')) return true;
            }
            if (rule.cssRules && walk(rule.cssRules)) return true;
          } else if (rule.cssRules && walk(rule.cssRules)) {
            return true;
          }
        }
        return false;
      };
      let hasMediaRule = false;
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.cssRules && walk(sheet.cssRules)) {
            hasMediaRule = true;
            break;
          }
        } catch (error) {
          // Folha externa opaca; a checagem segue nas demais.
        }
      }
      const durations = document.getAnimations()
        .map((animation) => {
          try {
            return animation.effect ? animation.effect.getTiming().duration : null;
          } catch (error) {
            return null;
          }
        })
        .filter((duration) => typeof duration === 'number' && Number.isFinite(duration));
      return {
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        hasMediaRule,
        animations: durations.length,
        maxDuration: durations.length ? Math.max(...durations) : 0
      };
    });
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    await cdp.detach().catch(() => {});
  } catch (error) {
    result.reducedMotion = {
      matches: false,
      hasMediaRule: false,
      animations: 0,
      maxDuration: 0,
      error: error.message
    };
  }

  return result;
}

export function fileUrl(filePath) {
  return pathToFileURL(filePath).href;
}
