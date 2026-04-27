/**
 * Zod schematy dla auth endpointów (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 7).
 */
import { z } from 'zod';

export const SigninInput = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});
export type SigninInput = z.infer<typeof SigninInput>;

export const MagicLinkInput = z.object({
  email: z.string().email().max(200),
  /** Optional redirect po kliknięciu w link. Default = `/admin`. */
  redirectTo: z.string().max(500).optional(),
});
export type MagicLinkInput = z.infer<typeof MagicLinkInput>;

export const InviteUserInput = z.object({
  email: z.string().email().max(200),
  fullName: z.string().min(1).max(200),
  role: z.enum(['consultant', 'admin', 'super_admin']).default('consultant'),
});
export type InviteUserInput = z.infer<typeof InviteUserInput>;

export const UpdateRoleInput = z.object({
  role: z.enum(['consultant', 'admin', 'super_admin']),
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleInput>;
