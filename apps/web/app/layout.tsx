import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import CookieConsent from '@/components/CookieConsent';

export const metadata: Metadata = {
  title: 'K2Biznes Oferta',
  description: 'Platforma ofertowa K2Biznes',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
