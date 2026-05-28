/**
 * POST /api/auth/forgot-password
 *
 * Wysyła email z linkiem do resetu hasła. Link prowadzi do
 * /auth/reset-password gdzie user ustawia nowe hasło.
 * Anti-enum: zwracamy ok:true niezależnie od tego czy email istnieje.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError } from '@/lib/api/error';
import { ForgotPasswordInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = ForgotPasswordInput.parse(await req.json());

    const res = NextResponse.json({
      data: { ok: true, message: 'Link został wysłany na podany email (jeśli istnieje konto).' },
    });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) => {
            res.cookies.set({ name, value, ...options });
          },
          remove: (name: string, options: CookieOptions) => {
            res.cookies.set({ name, value: '', ...options });
          },
        },
      },
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    // PKCE flow: link z maila idzie do /auth/callback (exchangeCodeForSession),
    // a callback redirect na /auth/reset-password z aktywna sesja recovery.
    // Bez tego /auth/reset-password page nie ma sesji i POST zwraca 401.
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`;

    // Anti-enum: ignorujemy error (np. brak konta) — zwracamy ok:true.
    await supabase.auth.resetPasswordForEmail(body.email, { redirectTo });

    return res;
  } catch (e) {
    return handleError(e);
  }
}
