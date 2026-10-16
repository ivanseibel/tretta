import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RoomProvider } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tretta',
  description: 'Jogo de cartas para amigos e família.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RoomProvider>{children}</RoomProvider>
      </body>
    </html>
  );
}
