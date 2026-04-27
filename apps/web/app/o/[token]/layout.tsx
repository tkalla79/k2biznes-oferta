import type { ReactNode } from 'react';

/**
 * Layout dla widoku klienta (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Brak chrome aplikacji — klient nie jest zalogowany, widzi tylko ofertę.
 * Branding K2 (CSS z OFERTA_INTERAKTYWNA) będzie portowany w osobnym PR (UI).
 */
export default function OfferLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        background: '#fbfaf7',
        color: '#1B2A4A',
        minHeight: '100vh',
        padding: 0,
        margin: 0,
      }}
    >
      {children}
    </div>
  );
}
