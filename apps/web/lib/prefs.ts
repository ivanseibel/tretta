/**
 * Preferências individuais de apresentação: animação, som e ocultação de
 * provocações. Valem só para este navegador, sem conta e sem tocar na sala.
 * Armazenamento indisponível ou corrompido cai nos padrões sem lançar.
 */
export type AnimationPreference = 'full' | 'reduced' | 'off';

export interface MoodPreferences {
  readonly animations: AnimationPreference;
  readonly soundMuted: boolean;
  readonly turnNotificationEnabled: boolean;
  readonly hideTaunts: boolean;
}

export const DEFAULT_PREFERENCES: MoodPreferences = {
  animations: 'full',
  soundMuted: false,
  turnNotificationEnabled: true,
  hideTaunts: false,
};

const STORAGE_KEY = 'tretta.mood';

function normalizeAnimations(value: unknown): AnimationPreference {
  return value === 'full' || value === 'reduced' || value === 'off'
    ? value
    : DEFAULT_PREFERENCES.animations;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Normaliza qualquer entrada gravada; formato desconhecido vira o padrão. */
export function parsePreferences(raw: string | null): MoodPreferences {
  if (raw === null) return DEFAULT_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const record = parsed as Record<string, unknown>;
    return {
      animations: normalizeAnimations(record.animations),
      soundMuted: normalizeBoolean(record.soundMuted, DEFAULT_PREFERENCES.soundMuted),
      turnNotificationEnabled: normalizeBoolean(
        record.turnNotificationEnabled,
        DEFAULT_PREFERENCES.turnNotificationEnabled,
      ),
      hideTaunts: normalizeBoolean(record.hideTaunts, DEFAULT_PREFERENCES.hideTaunts),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function loadPreferences(): MoodPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    return parsePreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: MoodPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Modo restrito/gravador cheio: a escolha vale na sessão, sem quebrar a sala.
  }
}

/**
 * `prefers-reduced-motion` limita "completa" a "reduced"; "reduced" e "off"
 * não são rebaixados. A escolha explícita segue registrada no storage e o
 * efeito do sistema vale enquanto a mídia corresponder.
 */
export function effectiveAnimations(
  preference: AnimationPreference,
  systemReduced: boolean,
): AnimationPreference {
  if (systemReduced && preference === 'full') return 'reduced';
  return preference;
}

/**
 * Assina a mídia do sistema e devolve a inscrição. Chama `onChange` uma vez
 * já com o valor atual; sem `matchMedia` (ambiente sem janela) vira no-op.
 */
export function watchSystemReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  onChange(query.matches);
  if (typeof query.addEventListener !== 'function') return () => {};
  const listener = (event: MediaQueryListEvent): void => onChange(event.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
