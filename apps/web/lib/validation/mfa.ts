/**
 * Zod schematy dla MFA endpointów (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * Wykorzystuje Supabase Auth MFA (TOTP). API: enroll → otp_secret + qr →
 * user wpisuje kod z aplikacji TOTP → verify finalizes factor → przy każdym
 * signinie challenge → verify code → AAL upgrade do aal2.
 */
import { z } from 'zod';

export const EnrollMfaInput = z.object({
  /** Friendly name dla factor'a — np. "iPhone 14" / "Google Authenticator". */
  friendlyName: z.string().min(1).max(80).default('TOTP'),
});
export type EnrollMfaInput = z.infer<typeof EnrollMfaInput>;

/** TOTP code — zwykle 6 cyfr, ale Supabase akceptuje 6-8. */
const TotpCode = z
  .string()
  .regex(/^\d{6,8}$/, 'Kod TOTP musi mieć 6-8 cyfr.');

/**
 * Wspólny payload dla verify-enrollment i sign-in challenge — w obu przypadkach
 * server robi `mfa.challenge({factorId})` żeby dostać challengeId, a potem
 * `mfa.verify({factorId, challengeId, code})`. Klient nie musi znać challengeId.
 */
export const VerifyMfaInput = z.object({
  factorId: z.string().uuid(),
  code: TotpCode,
});
export type VerifyMfaInput = z.infer<typeof VerifyMfaInput>;

export const UnenrollMfaInput = z.object({
  factorId: z.string().uuid(),
});
export type UnenrollMfaInput = z.infer<typeof UnenrollMfaInput>;
