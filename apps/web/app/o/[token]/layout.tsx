import type { ReactNode } from 'react';
import './styles.css';

/**
 * Layout dla widoku klienta (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Design: Claude Design "Oferta K2Biznes" (corporate variant). 11 sekcji,
 * Fraunces (serif italic emphasis) + Inter, navy + red. Statyczna treść
 * doradcza w `staticContent.ts`, dynamiczna z DB (offer/contact/case).
 *
 * Klient nie jest zalogowany — brak chrome aplikacji.
 */
export default function OfferLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Fonts wymagane przez nowy design (corporate variant). Page-custom-font
          warning od @next/next ignorowany — to standalone offer page bez
          App layout fontów, więc per-page link jest właściwy. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
