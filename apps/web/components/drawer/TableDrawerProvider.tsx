'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRoom } from '@/app/providers';

export type TableDrawerTab = 'conversa' | 'historico' | 'sala';

export interface TableDrawerContextValue {
  readonly aberta: boolean;
  readonly aba: TableDrawerTab;
  readonly abrir: (aba?: TableDrawerTab, trigger?: HTMLElement | null) => void;
  readonly fechar: () => void;
  readonly selecionarAba: (aba: TableDrawerTab) => void;
  /** Controle que abriu a gaveta; recebe o foco de volta ao fechar. */
  readonly gatilho: HTMLElement | null;
}

const FALLBACK: TableDrawerContextValue = {
  aberta: false,
  aba: 'conversa',
  abrir: () => {},
  fechar: () => {},
  selecionarAba: () => {},
  gatilho: null,
};

const TableDrawerContext = createContext<TableDrawerContextValue>(FALLBACK);

/**
 * Estado da gaveta da sala. A gaveta é uma sobreposição fixa montada uma vez
 * pela página; a barra da mesa só pede para abrir a aba certa. A altura da
 * mesa nunca depende dela.
 */
export function TableDrawerProvider({ children }: { children: ReactNode }): ReactNode {
  const room = useRoom();
  const [aberta, setAberta] = useState(false);
  const [aba, setAba] = useState<TableDrawerTab>('conversa');
  const [gatilho, setGatilho] = useState<HTMLElement | null>(null);
  const statusRef = useRef(room.state?.room.status ?? null);

  const abrir = useCallback((proxima: TableDrawerTab = 'conversa', trigger?: HTMLElement | null) => {
    const origem = trigger ?? (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null));
    setGatilho(origem);
    setAba(proxima);
    setAberta(true);
  }, []);

  const fechar = useCallback(() => {
    setAberta(false);
  }, []);

  const selecionarAba = useCallback((proxima: TableDrawerTab) => {
    setAba(proxima);
  }, []);

  // Troca de fase ou de sala fecha a gaveta: o conteúdo e o gatilho pertencem
  // ao contexto anterior e não podem reaparecer sobre a tela nova.
  useEffect(() => {
    const status = room.state?.room.status ?? null;
    if (statusRef.current === status) return;
    statusRef.current = status;
    setAberta(false);
  }, [room.state?.room.status]);

  useEffect(() => {
    setAberta(false);
  }, [room.state?.room.roomCode]);

  const value = useMemo<TableDrawerContextValue>(
    () => ({ aberta, aba, abrir, fechar, selecionarAba, gatilho }),
    [aba, aberta, abrir, fechar, gatilho, selecionarAba],
  );

  return <TableDrawerContext.Provider value={value}>{children}</TableDrawerContext.Provider>;
}

export function useTableDrawer(): TableDrawerContextValue {
  return useContext(TableDrawerContext);
}
