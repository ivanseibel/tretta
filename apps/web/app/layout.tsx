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
      <head>
        <link rel="preload" href="/fonts/fraunces.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/atkinson.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <RoomProvider>{children}</RoomProvider>
      </body>
    </html>
  );
}
