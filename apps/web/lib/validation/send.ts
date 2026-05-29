/**
 * Zod schema dla `POST /api/offers/[id]/send` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 */
import { z } from 'zod';

export const SendOfferInput = z.object({
  recipientEmail: z.string().email().max(200),
  recipientName: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  /** Opcjonalna wiadomość konsultanta — dodawana w treści maila. */
  message: z.string().max(2000).optional(),
  /**
   * ISO 8601 datetime — musi byc PRZYSZLOSCIA (min. 1h od teraz, max 365 dni).
   * `null` → wyczysc expires_at (oferta bezterminowa).
   *
   * Wczesniej (bug 2026-05-29): brak walidacji przyszlosci → konsultant mogl
   * wpisac "dzis 18:34" w UI picker, wyslac za 35 sekund → oferta natychmiast
   * expired → klient klika link z maila → 404 (`fetchPublicOffer` zwraca 410
   * dla `expires_at < now()`, page-level renderuje 404).
   * Patrz docs/BACKEND_SPEC.md sekcja 5.3.
   */
  expiresAt: z
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
    .optional(),
});

export type SendOfferInput = z.infer<typeof SendOfferInput>;
