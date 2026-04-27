import type { ReactNode } from 'react';
import './styles.css';

/**
 * Layout dla widoku klienta (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Brak chrome aplikacji — klient nie jest zalogowany, widzi tylko ofertę.
 * CSS K2 portowany z `OFERTA_INTERAKTYWNA/css/styles.css` (1471L) — Fraunces
 * + Roboto Condensed, motion, print styles, nav-dots, sections z bg, pricing
 * cards, timeline, CTA bar.
 */
export default function OfferLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
