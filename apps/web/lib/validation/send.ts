/**
 * Zod schema dla `POST /api/offers/[id]/send` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 */
import { z } from 'zod';
import { expiresAtSchema } from './shared';

export const SendOfferInput = z.object({
  recipientEmail: z.string().email().max(200),
  recipientName: z.string().max(200).optional(),
  subject: z.string().max(300).optional(),
  /** Opcjonalna wiadomość konsultanta — dodawana w treści maila. */
  message: z.string().max(2000).optional(),
  // M9 audit: walidacja expiresAt w lib/validation/shared.ts (współdzielona z offers PATCH).
  expiresAt: expiresAtSchema,
});

export type SendOfferInput = z.infer<typeof SendOfferInput>;
