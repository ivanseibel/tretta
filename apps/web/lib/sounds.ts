import type { AutomaticEffect, TauntType } from '@tretta/protocol';
import { EFFECT_VARIANTS } from '@tretta/protocol/shared';

/**
 * Sons sintetizados com WebAudio, sem asset de terceiros. Tudo é best-effort:
 * contexto indisponível, autoplay bloqueado ou `resume()` rejeitado viram
 * silêncio — nunca erro de jogo nem trava de fila. Reprodução é uma por
 * ativação de item; silenciar corta o que estiver tocando e bloqueia os
 * seguintes.
 */
let context: AudioContext | null = null;
let muted = false;
const liveNodes = new Set<AudioScheduledSourceNode>();

interface Tone {
  readonly frequency: number;
  /** Rampa exponencial de frequência ao final do tom (sweep curto). */
  readonly rampTo?: number;
  readonly startAt: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return null;
    if (context === null) context = new Ctor();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch {
    return null;
  }
}

function playTones(tones: readonly Tone[]): void {
  if (muted) return;
  const audio = ensureContext();
  if (audio === null) return;
  try {
    const base = audio.currentTime;
    for (const tone of tones) {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      const start = base + tone.startAt;
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.rampTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.rampTo, start + tone.duration);
      }
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(tone.gain, start + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(envelope);
      envelope.connect(audio.destination);
      const node: AudioScheduledSourceNode = oscillator;
      node.onended = () => {
        liveNodes.delete(node);
        oscillator.disconnect();
        envelope.disconnect();
      };
      liveNodes.add(node);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.03);
    }
  } catch {
    // Áudio bloqueado/indisponível é tolerado em silêncio.
  }
}

/** Corta tudo que estiver tocando; chamado ao silenciar ou sair da sala. */
export function stopAllSounds(): void {
  for (const node of liveNodes) {
    try {
      node.stop();
    } catch {
      // Nó já parado; seguir para o próximo.
    }
  }
  liveNodes.clear();
}

export function setSoundMuted(next: boolean): void {
  const wasMuted = muted;
  muted = next;
  if (next && !wasMuted) stopAllSounds();
}

export function playTauntSound(type: TauntType): void {
  if (type === 'tomate') {
    playTones([
      { frequency: 240, rampTo: 90, startAt: 0, duration: 0.22, type: 'sine', gain: 0.25 },
      { frequency: 520, startAt: 0.06, duration: 0.1, type: 'triangle', gain: 0.12 },
    ]);
    return;
  }
  if (type === 'torta') {
    playTones([
      { frequency: 640, rampTo: 140, startAt: 0, duration: 0.3, type: 'triangle', gain: 0.22 },
      { frequency: 120, startAt: 0.18, duration: 0.14, type: 'sine', gain: 0.18 },
    ]);
    return;
  }
  if (type === 'risadas') {
    playTones([
      { frequency: 480, startAt: 0, duration: 0.09, type: 'square', gain: 0.1 },
      { frequency: 560, startAt: 0.09, duration: 0.09, type: 'square', gain: 0.1 },
      { frequency: 700, startAt: 0.18, duration: 0.12, type: 'square', gain: 0.1 },
    ]);
    return;
  }
  playTones([
    { frequency: 520, startAt: 0, duration: 0.1, type: 'sine', gain: 0.16 },
    { frequency: 430, startAt: 0.11, duration: 0.1, type: 'sine', gain: 0.16 },
    { frequency: 340, startAt: 0.22, duration: 0.1, type: 'sine', gain: 0.16 },
    { frequency: 250, startAt: 0.33, duration: 0.16, type: 'sine', gain: 0.16 },
  ]);
}

/** Tom curto por categoria, com a variação cosmética alterando o contorno. */
export function playEffectSound(effect: AutomaticEffect): void {
  const isSecondVariant = EFFECT_VARIANTS[effect.category][1] === effect.variant;
  switch (effect.category) {
    case 'penaltyDraw': {
      // Queda de cartas: notas descendentes; a segunda variação cai mais fundo.
      playTones(
        isSecondVariant
          ? [
              { frequency: 720, rampTo: 300, startAt: 0, duration: 0.28, type: 'triangle', gain: 0.2 },
              { frequency: 300, rampTo: 140, startAt: 0.2, duration: 0.26, type: 'triangle', gain: 0.18 },
            ]
          : [
              { frequency: 620, rampTo: 340, startAt: 0, duration: 0.24, type: 'triangle', gain: 0.2 },
              { frequency: 340, rampTo: 200, startAt: 0.18, duration: 0.2, type: 'triangle', gain: 0.16 },
            ],
      );
      return;
    }
    case 'blocked': {
      // Muro: zumbido grave; variação b é duplo e seco.
      playTones(
        isSecondVariant
          ? [
              { frequency: 130, startAt: 0, duration: 0.16, type: 'square', gain: 0.14 },
              { frequency: 130, startAt: 0.2, duration: 0.16, type: 'square', gain: 0.14 },
            ]
          : [{ frequency: 110, startAt: 0, duration: 0.34, type: 'square', gain: 0.14 }],
      );
      return;
    }
    case 'directionReversed': {
      // Bumerangue: varredura para cima; moinho: varredura para baixo.
      playTones(
        isSecondVariant
          ? [{ frequency: 880, rampTo: 260, startAt: 0, duration: 0.34, type: 'sawtooth', gain: 0.12 }]
          : [{ frequency: 260, rampTo: 880, startAt: 0, duration: 0.34, type: 'sawtooth', gain: 0.12 }],
      );
      return;
    }
    case 'victory': {
      // Confete: arpejo agudo; troféu: arpejo grave e mais lento.
      playTones(
        isSecondVariant
          ? [
              { frequency: 392, startAt: 0, duration: 0.14, type: 'triangle', gain: 0.18 },
              { frequency: 523, startAt: 0.13, duration: 0.14, type: 'triangle', gain: 0.18 },
              { frequency: 659, startAt: 0.26, duration: 0.22, type: 'triangle', gain: 0.18 },
            ]
          : [
              { frequency: 523, startAt: 0, duration: 0.12, type: 'triangle', gain: 0.18 },
              { frequency: 659, startAt: 0.11, duration: 0.12, type: 'triangle', gain: 0.18 },
              { frequency: 784, startAt: 0.22, duration: 0.12, type: 'triangle', gain: 0.18 },
              { frequency: 1046, startAt: 0.33, duration: 0.2, type: 'triangle', gain: 0.16 },
            ],
      );
      return;
    }
  }
}
