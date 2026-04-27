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
  /** ISO 8601 datetime — null → wyczyść expires_at. */
  expiresAt: z.string().datetime().nullable().optional(),
});

export type SendOfferInput = z.infer<typeof SendOfferInput>;
