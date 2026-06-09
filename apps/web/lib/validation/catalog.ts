/**
 * Zod schemas dla katalogów `/api/admin/{programs,case-studies,contact-persons}`
 * (BACKEND_SPEC.md v1.1.1, sekcja 3.2 — programs/case_studies/contact_persons).
 *
 * Single source of truth — typy są pochodne od schematów.
 */
import { z } from 'zod';

// =============================================================================
// Wspólne helpery
// =============================================================================

/** Slug: lowercase, [a-z0-9-], 2-80 znaków. Używany jako PK tabel katalogowych. */
const Slug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Slug może zawierać tylko małe litery, cyfry i myślniki.');

const URL_OR_NULL = z
  .string()
  .url()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const STORAGE_KEY_OR_NULL = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Auto-generuje slug z labela jeśli user nie poda swojego. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // zdejmij polskie znaki
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// =============================================================================
// programs
// =============================================================================

export const ProgramInput = z.object({
  id: Slug.optional(), // auto-gen z label gdy brak
  group_name: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  cover_storage_key: STORAGE_KEY_OR_NULL,
  is_custom: z.boolean().default(false),
  display_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type ProgramInput = z.infer<typeof ProgramInput>;

export const ProgramUpdate = ProgramInput.partial().omit({ id: true });
export type ProgramUpdate = z.infer<typeof ProgramUpdate>;

// Alt-programy ("Inne możliwości wsparcia") — biblioteka do wyboru w ofercie.
// Feature #2 (spec 2026-06-09). Pola = struktura content.altPrograms.
export const AltProgramInput = z.object({
  id: Slug.optional(), // auto-gen z name gdy brak
  name: z.string().min(1).max(120),
  program: z.string().min(1).max(120),
  nabor: z.string().max(80).optional().nullable(),
  desc: z.string().max(2000).optional().nullable(),
  url: z.string().url().max(500).optional().nullable().or(z.literal('')),
  display_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type AltProgramInput = z.infer<typeof AltProgramInput>;

export const AltProgramUpdate = AltProgramInput.partial().omit({ id: true });
export type AltProgramUpdate = z.infer<typeof AltProgramUpdate>;

// =============================================================================
// case_studies
// =============================================================================

/**
 * Industries i program_tags są tablicami — UI przyjmuje CSV string. Konwertujemy.
 * Stats jsonb pomijamy w MVP (zostaje pustą tablicą).
 */
const csvArray = z
  .union([
    z.string().transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0),
    ),
    z.array(z.string().min(1).max(60)),
  ])
  .pipe(z.array(z.string().min(1).max(60)).max(20));

export const CaseStudyInput = z.object({
  id: Slug.optional(),
  client: z.string().min(1).max(200),
  tag: z.string().max(100).optional().nullable(),
  title: z.string().min(1).max(200),
  paragraph_1: z.string().max(4000).optional().nullable(),
  paragraph_2: z.string().max(4000).optional().nullable(),
  industries: csvArray.default([]),
  program_tags: csvArray.default([]),
  logo_big: URL_OR_NULL,
  logo_sm: URL_OR_NULL,
  logo_storage_key: STORAGE_KEY_OR_NULL,
  display_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type CaseStudyInput = z.infer<typeof CaseStudyInput>;

export const CaseStudyUpdate = CaseStudyInput.partial().omit({ id: true });
export type CaseStudyUpdate = z.infer<typeof CaseStudyUpdate>;

// =============================================================================
// contact_persons
// =============================================================================

export const ContactPersonInput = z.object({
  id: Slug.optional(),
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  photo_url: URL_OR_NULL,
  photo_storage_key: STORAGE_KEY_OR_NULL,
  display_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type ContactPersonInput = z.infer<typeof ContactPersonInput>;

export const ContactPersonUpdate = ContactPersonInput.partial().omit({ id: true });
export type ContactPersonUpdate = z.infer<typeof ContactPersonUpdate>;

// =============================================================================
// faq_items (PR-D / uwaga 19)
// =============================================================================

export const FaqItemInput = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(4000),
  display_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type FaqItemInput = z.infer<typeof FaqItemInput>;

export const FaqItemUpdate = FaqItemInput.partial();
export type FaqItemUpdate = z.infer<typeof FaqItemUpdate>;
