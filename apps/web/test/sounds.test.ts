/**
 * Sons sintetizados (T005C): agendamento real de osciladores, distinção por
 * variação/tipo, corte no mute e tolerância a ambiente sem WebAudio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomaticEffect, EffectVariant, TauntType } from '@tretta/protocol';
import {
  playEffectSound,
  playTauntSound,
  playTurnNotificationSound,
  prepareSoundPlayback,
  setSoundMuted,
  stopAllSounds,
} from '@/lib/sounds';

class FakeOscillator {
  static readonly all: FakeOscillator[] = [];
  type: OscillatorType = 'sine';
  readonly frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  /** `stop(time)` agendado pela reprodução; `stop()` sem argumento é o corte do mute. */
  stopScheduledAt: number | null = null;
  constructor() {
    FakeOscillator.all.push(this);
  }
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn(() => {
    this.started = true;
  });
  stop = vi.fn((when?: number) => {
    if (when === undefined) {
      this.stopped = true;
      this.onended?.();
    } else {
      this.stopScheduledAt = when;
    }
  });
}

class FakeGain {
  readonly gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeAudioContext {
  static created = 0;
  static readonly instances: FakeAudioContext[] = [];
  currentTime = 0;
  state = 'running';
  destination = {};
  constructor() {
    FakeAudioContext.created += 1;
    FakeAudioContext.instances.push(this);
  }
  resume = vi.fn((): Promise<void> => Promise.resolve());
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
}

function effectFixture(variant: EffectVariant): AutomaticEffect {
  const base = { id: `fx_${variant}`, roundId: 'r1', seq: 1, eventIndex: 0, variant };
  if (variant === 'cards-rain' || variant === 'cards-avalanche') {
    return {
      ...base,
      category: 'penaltyDraw',
      targetId: 'p2',
      targetNickname: 'Bia',
      drawn: 2,
      requested: 2,
      reason: 'penalty',
    };
  }
  if (variant === 'brick-wall' || variant === 'stumble') {
    return { ...base, category: 'blocked', playerId: 'p2', playerNickname: 'Bia' };
  }
  if (variant === 'boomerang' || variant === 'windmill') {
    return { ...base, category: 'directionReversed', direction: 'clockwise' };
  }
  return {
    ...base,
    category: 'victory',
    winnerId: 'p1',
    winnerNickname: 'Ana',
    substitute: false,
  };
}

function installFakeAudio(): void {
  Object.defineProperty(window, 'AudioContext', {
    value: FakeAudioContext,
    configurable: true,
    writable: true,
  });
  Reflect.deleteProperty(
    window as Window & { webkitAudioContext?: unknown },
    'webkitAudioContext',
  );
}

function tonesOf(variant: EffectVariant): FakeOscillator[] {
  FakeOscillator.all.length = 0;
  playEffectSound(effectFixture(variant));
  return [...FakeOscillator.all];
}

beforeEach(() => {
  FakeOscillator.all.length = 0;
  FakeAudioContext.created = 0;
  for (const audio of FakeAudioContext.instances) {
    audio.state = 'running';
    audio.resume.mockClear();
  }
  installFakeAudio();
  setSoundMuted(false);
  stopAllSounds();
});

afterEach(() => {
  setSoundMuted(false);
  stopAllSounds();
  Reflect.deleteProperty(window, 'AudioContext');
});

describe('indisponibilidade antes da primeira reprodução', () => {
  it('sem WebAudio não lança nem gera som', () => {
    Reflect.deleteProperty(window, 'AudioContext');
    const before = FakeOscillator.all.length;
    expect(() => prepareSoundPlayback()).not.toThrow();
    expect(() => playEffectSound(effectFixture('confetti'))).not.toThrow();
    expect(() => playTauntSound('tomate')).not.toThrow();
    expect(() => playTurnNotificationSound()).not.toThrow();
    expect(FakeOscillator.all.length).toBe(before);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it('falha ao criar o contexto é tolerada em silêncio', () => {
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        constructor() {
          throw new Error('autoplay bloqueado');
        }
      },
      configurable: true,
      writable: true,
    });
    expect(() => prepareSoundPlayback()).not.toThrow();
    expect(() => playEffectSound(effectFixture('trophy'))).not.toThrow();
    expect(FakeOscillator.all).toHaveLength(0);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});

describe('sons dos efeitos automáticos', () => {
  it('agenda osciladores reais e toca uma vez por ativação', () => {
    const tones = tonesOf('brick-wall');
    expect(tones.length).toBeGreaterThan(0);
    expect(tones.every((tone) => tone.started)).toBe(true);
    expect(FakeAudioContext.created).toBe(1);
  });

  it('as duas variações de cada categoria geram contornos sonoros distintos', () => {
    const pairs: readonly [EffectVariant, EffectVariant][] = [
      ['cards-rain', 'cards-avalanche'],
      ['brick-wall', 'stumble'],
      ['boomerang', 'windmill'],
      ['confetti', 'trophy'],
    ];
    for (const [first, second] of pairs) {
      const a = tonesOf(first);
      const b = tonesOf(second);
      const signature = (tones: FakeOscillator[]): string =>
        tones
          .map(
            (tone) =>
              `${tone.type}:${tone.frequency.setValueAtTime.mock.calls
                .map((call) => String(call[0]))
                .join('/')}:${tone.frequency.exponentialRampToValueAtTime.mock.calls
                .map((call) => String(call[0]))
                .join('/')}`,
          )
          .join('|');
      expect(signature(a)).not.toBe(signature(b));
    }
  });
});

describe('sons das provocações', () => {
  it('cada tipo tem padrão próprio', () => {
    const types: readonly TauntType[] = ['tomate', 'torta', 'risadas', 'choro'];
    const signatures = types.map((type) => {
      FakeOscillator.all.length = 0;
      playTauntSound(type);
      return FakeOscillator.all
        .map((tone) => `${tone.type}:${tone.frequency.setValueAtTime.mock.calls[0]?.[0] ?? ''}`)
        .join('|');
    });
    expect(new Set(signatures).size).toBe(types.length);
  });
});

describe('aviso sonoro da vez e preparação do WebAudio', () => {
  it('toca dois tons curtos ascendentes', () => {
    playTurnNotificationSound();
    expect(FakeOscillator.all).toHaveLength(2);
    expect(FakeOscillator.all.every((tone) => tone.started)).toBe(true);
    expect(FakeOscillator.all.map((tone) => tone.frequency.setValueAtTime.mock.calls[0]?.[0])).toEqual([660, 880]);
  });

  it('prepara o contexto sem criar osciladores audíveis', () => {
    prepareSoundPlayback();
    expect(FakeAudioContext.instances.length).toBeGreaterThan(0);
    expect(FakeOscillator.all).toHaveLength(0);

    const audio = FakeAudioContext.instances.at(-1);
    if (audio === undefined) throw new Error('Contexto de áudio não criado.');
    audio.state = 'suspended';
    prepareSoundPlayback();
    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(FakeOscillator.all).toHaveLength(0);
  });

  it('descarta sons pedidos enquanto suspenso para não reproduzi-los depois de um gesto', () => {
    prepareSoundPlayback();
    const audio = FakeAudioContext.instances.at(-1);
    if (audio === undefined) throw new Error('Contexto de áudio não criado.');
    audio.state = 'suspended';

    playTurnNotificationSound();

    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(FakeOscillator.all).toHaveLength(0);
  });

  it('tolera rejeição de resume e API ausente', async () => {
    prepareSoundPlayback();
    const audio = FakeAudioContext.instances.at(-1);
    if (audio === undefined) throw new Error('Contexto de áudio não criado.');
    audio.state = 'suspended';
    audio.resume.mockRejectedValueOnce(new Error('autoplay bloqueado'));

    expect(() => prepareSoundPlayback()).not.toThrow();
    await Promise.resolve();
    Reflect.deleteProperty(window, 'AudioContext');
    expect(() => prepareSoundPlayback()).not.toThrow();
  });
});

describe('mute e indisponibilidade', () => {
  it('silenciar corta o som em andamento e bloqueia os seguintes', () => {
    const first = tonesOf('cards-rain');
    expect(first.every((tone) => tone.stopped)).toBe(false);

    setSoundMuted(true);
    expect(first.every((tone) => tone.stopped)).toBe(true);

    const blocked = tonesOf('cards-rain');
    expect(blocked).toHaveLength(0);

    setSoundMuted(false);
    const resumed = tonesOf('cards-rain');
    expect(resumed.length).toBeGreaterThan(0);
  });

});
