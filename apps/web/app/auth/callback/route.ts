/**
 * GET /auth/callback (BACKEND_SPEC.md v1.1.1, sekcja 7.2 + 7.3).
 *
 * Obsługuje callback po kliknięciu w magic link / link z invite. Supabase
 * wysyła `?code=...` które wymieniamy na sesję (`exchangeCodeForSession`).
 * Po sukcesie redirect do `?next=<path>` lub `/admin` defaultowo.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Walidacja `next` param — TYLKO relatywne ścieżki w obrębie aplikacji.
 * Blokuje open redirect: `?next=https://evil.com` lub `?next=//evil.com`
 * (protocol-relative) phishing po magic-link. Musi zaczynać się od pojedynczego
 * `/` i NIE od `//` ani `/\`. Inaczej fallback do `/admin`.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/admin';
  if (!raw.startsWith('/')) return '/admin'; // absolute URL / inny scheme
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/admin'; // protocol-relative
  return raw;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Supabase mógł zwrócić error w query (link wygasł, użyty już raz, etc.)
  if (error) {
    const dest = new URL('/auth/signin', req.url);
    dest.searchParams.set('error', errorDescription ?? error);
    return NextResponse.redirect(dest);
  }

  if (!code) {
    // Brak code — niepełny callback. Zachowanie defensywne: redirect do signin.
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }

  const dest = new URL(next, req.url);
  const res = NextResponse.redirect(dest);

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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const errDest = new URL('/auth/signin', req.url);
    errDest.searchParams.set('error', exchangeError.message);
    return NextResponse.redirect(errDest);
  }

  return res;
}
