/**
 * Relógio e agendamento da camada de sala/serviço. O motor de regras permanece
 * independente de rede, interface e relógio; apenas o serviço de salas consome
 * esta abstração. Em produção, a implementação padrão usa `Date.now` e `setTimeout`.
 */
export interface RoomClock {
  /** Instante atual em epoch ms. */
  now(): number;
  setTimer(delayMs: number, callback: () => void): TimerHandle;
  clearTimer(handle: TimerHandle): void;
}

export type TimerHandle = NodeJS.Timeout | number;

export const systemClock: RoomClock = {
  now: () => Date.now(),
  setTimer: (delayMs, callback) => setTimeout(callback, delayMs),
  clearTimer: (handle) => {
    clearTimeout(handle as NodeJS.Timeout);
  },
};
