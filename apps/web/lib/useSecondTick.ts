'use client';

import { useEffect, useState } from 'react';

/**
 * Re-renderiza a cada segundo enquanto `active` para contagens regressivas.
 * Componentes que exibem intervalos chamam os getters do provider no render;
 * o relógio do aparelho só mede tempo decorrido, nunca alinha epoch.
 */
export function useSecondTick(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, [active]);
}
