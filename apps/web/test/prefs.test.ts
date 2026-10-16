/**
 * Preferências locais (T005C): normalização de storage corrompido, roundtrip,
 * limitação por prefers-reduced-motion e assinatura da mídia do sistema.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  effectiveAnimations,
  loadPreferences,
  parsePreferences,
  savePreferences,
  watchSystemReducedMotion,
} from '@/lib/prefs';

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(query: unknown): void {
  Object.defineProperty(window, 'matchMedia', {
    value: query,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  if (originalMatchMedia === undefined) {
    Reflect.deleteProperty(window, 'matchMedia');
  } else {
    stubMatchMedia(originalMatchMedia);
  }
  vi.restoreAllMocks();
});

describe('storage das preferências', () => {
  it('roundtrip save/load preserva as escolhas', () => {
    savePreferences({ animations: 'off', soundMuted: true, hideTaunts: true });
    expect(loadPreferences()).toEqual({ animations: 'off', soundMuted: true, hideTaunts: true });

    savePreferences({ animations: 'reduced', soundMuted: false, hideTaunts: false });
    expect(loadPreferences()).toEqual({ animations: 'reduced', soundMuted: false, hideTaunts: false });
  });

  it('sem nada gravado usa os padrões', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ animations: 'full', soundMuted: false, hideTaunts: false });
  });

  it('entrada corrompida, parcial ou de tipos errados cai nos padrões', () => {
    expect(parsePreferences('não é json{')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('"string"')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('null')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"animations":"turbo"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"soundMuted":"sim"}')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('{"hideTaunts":1}')).toEqual(DEFAULT_PREFERENCES);
    // Parcial válido preserva o que há e completa o resto com o padrão.
    expect(parsePreferences('{"animations":"off"}')).toEqual({
      animations: 'off',
      soundMuted: false,
      hideTaunts: false,
    });
  });

  it('storage indisponível não lança nem quebra a leitura', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => loadPreferences()).not.toThrow();
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();
  });
});

describe('prefers-reduced-motion', () => {
  it('limita "completa" a "reduced"; "reduced" e "off" não são rebaixados', () => {
    expect(effectiveAnimations('full', true)).toBe('reduced');
    expect(effectiveAnimations('full', false)).toBe('full');
    expect(effectiveAnimations('reduced', true)).toBe('reduced');
    expect(effectiveAnimations('reduced', false)).toBe('reduced');
    expect(effectiveAnimations('off', true)).toBe('off');
    expect(effectiveAnimations('off', false)).toBe('off');
  });

  it('assina a mídia, reflete mudanças ao vivo e cancela a inscrição', () => {
    const listeners: ((event: MediaQueryListEvent) => void)[] = [];
    const query = {
      matches: false,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
    };
    stubMatchMedia(() => query as unknown as MediaQueryList);

    const seen: boolean[] = [];
    const stop = watchSystemReducedMotion((reduced) => seen.push(reduced));
    expect(seen).toEqual([false]);

    listeners[0]?.({ matches: true } as MediaQueryListEvent);
    expect(seen).toEqual([false, true]);

    stop();
    expect(listeners).toHaveLength(0);
  });

  it('ambiente sem matchMedia vira no-op', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    const stop = watchSystemReducedMotion(() => {
      throw new Error('não deve chamar');
    });
    expect(() => stop()).not.toThrow();
  });
});
