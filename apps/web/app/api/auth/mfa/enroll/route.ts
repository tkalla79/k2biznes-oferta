/**
 * POST /api/auth/mfa/enroll (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * Rozpoczyna enrollment TOTP factor'a. Zwraca:
 * - `factorId` — UUID dla następnego verify
 * - `secret` — base32 secret
 * - `qrCode` — data:image/svg+xml dla skanowania w aplikacji TOTP
 *
 * Wymagana sesja (user musi być zalogowany żeby dodać sobie MFA).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { EnrollMfaInput } from '@/lib/validation/mfa';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = EnrollMfaInput.parse(await req.json().catch(() => ({})));

    const res = NextResponse.json({ data: null });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) =>
            res.cookies.set({ name, value, ...options }),
          remove: (name: string, options: CookieOptions) =>
            res.cookies.set({ name, value: '', ...options }),
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: body.friendlyName,
    });
    if (error || !data) {
      throw new ApiError('INTERNAL_ERROR', `MFA enroll failed: ${error?.message}`, 500);
    }

    return NextResponse.json(
      {
        data: {
          factorId: data.id,
          secret: data.totp.secret,
          qrCode: data.totp.qr_code, // data: URI z SVG
          uri: data.totp.uri, // otpauth:// URI fallback
        },
      },
      { headers: res.headers },
    );
  } catch (e) {
    return handleError(e);
  }
}
