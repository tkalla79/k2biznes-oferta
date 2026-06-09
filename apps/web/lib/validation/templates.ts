/**
 * Zod schemas dla szablonów oferty (feature #1).
 */
import { z } from 'zod';

export const TemplateCreateInput = z.object({
  name: z.string().min(1).max(120),
  // template_data = snapshot pól szablonowych (lib/offers/template.ts). Passthrough
  // record — kształt walidowany przez extractTemplate po stronie klienta; tu loose
  // bo struktura FormState może ewoluować bez migracji.
  template_data: z.record(z.unknown()),
});
export type TemplateCreateInput = z.infer<typeof TemplateCreateInput>;

export const TemplateRenameInput = z.object({
  name: z.string().min(1).max(120),
});
export type TemplateRenameInput = z.infer<typeof TemplateRenameInput>;
