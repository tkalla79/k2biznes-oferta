/**
 * Współdzielone walidatory Zod (M9 audit — dedup).
 */
import { z } from 'zod';

/**
 * ISO 8601 datetime — musi być PRZYSZŁOŚCIĄ (min. 1h od teraz, max 365 dni).
 * `null` → wyczyść expires_at (oferta bezterminowa).
 *
 * Wcześniej (bug 2026-05-29): brak walidacji przyszłości → konsultant mógł
 * wpisać "dziś 18:34" w UI picker, wysłać za 35 sekund → oferta natychmiast
 * expired → klient klika link z maila → 404. Walidacja w 2 schemas (send +
 * offers PATCH) była duplikowana — M9 audit scalił do jednego źródła.
 * Patrz docs/BACKEND_SPEC.md sekcja 5.3.
 */
export const expiresAtSchema = z
  .string()
  .datetime()
  .refine(
    (iso) => {
      const t = new Date(iso).getTime();
      const minMs = Date.now() + 60 * 60 * 1000; // +1h
      const maxMs = Date.now() + 365 * 24 * 60 * 60 * 1000; // +365d
      return t >= minMs && t <= maxMs;
    },
    { message: 'expiresAt musi byc w przyszlosci (min. 1h, max 365 dni od teraz)' },
  )
  .nullable()
  .optional();
