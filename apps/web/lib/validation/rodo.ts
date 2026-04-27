/**
 * Zod schematy dla `/api/auth/request-data-deletion` + admin approve/reject
 * + `/api/public/offers/[token]/export` (BACKEND_SPEC.md v1.1.1, sekcja 11).
 */
import { z } from 'zod';

export const RequestDeletionInput = z.object({
  email: z.string().email().max(200),
  reason: z.string().max(2000).optional(),
});
export type RequestDeletionInput = z.infer<typeof RequestDeletionInput>;

export const ReviewDeletionInput = z.object({
  decision: z.enum(['approve', 'reject', 'execute']),
  rejectReason: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});
export type ReviewDeletionInput = z.infer<typeof ReviewDeletionInput>;

export const ExportRequestInput = z.object({
  email: z.string().email().max(200),
});
export type ExportRequestInput = z.infer<typeof ExportRequestInput>;
