/**
 * Next.js middleware — auth + rate-limit + PDF bypass HMAC.
 * Reference: BACKEND_SPEC.md v1.1, sekcje 5.1.1, 7.2, 7.6, 9.1.1.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyPdfBypass } from '@/lib/pdf-bypass';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/client-ip';

export const config = {
  // Pomija statyczne assety i `_next/*` — middleware leci tylko na trasach aplikacji.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|css|js)$).*)',
  ],
};

const ADMIN_PREFIXES = ['/admin', '/(app)/admin'];
const APP_PROTECTED = ['/offers', '/(app)']; // wymaga zalogowania
const ALWAYS_PUBLIC = [
  '/o/',
  '/api/public/',
  '/api/health',
  '/api/internal/',
  '/auth/',
  '/api/auth/request-data-deletion', // RODO sekcja 11.4 — bez logowania
  '/privacy-policy',
];
// `/api/internal/*` ma własną auth (CRON_SECRET) — middleware przepuszcza,
// handler waliduje header przed wykonaniem.

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  // Spoof-resistant IP extraction (code review PR #2 — preferuj x-real-ip).
  const ip = getClientIp(req.headers);

  // ---------------------------------------------------------------------------
  // 1. PDF bypass (sekcja 9.1.1): omija rate-limit i auth dla `/o/<token>?print=true`
  // ---------------------------------------------------------------------------
  let isInternalPdf = false;
  if (pathname.startsWith('/o/')) {
    const sig = searchParams.get('__pdfBypass');
    const ts = searchParams.get('__pdfTs');
    if (sig && ts) {
      const token = pathname.split('/')[2] ?? '';
      try {
        isInternalPdf = await verifyPdfBypass(token, sig, ts);
      } catch {
        isInternalPdf = false;
      }
      if (!isInternalPdf) {
        return jsonError('INVALID_PDF_BYPASS', 'HMAC niepoprawny lub timestamp poza oknem.', 403);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Rate limit (sekcja 5.1.1)
  // ---------------------------------------------------------------------------
  if (!isInternalPdf) {
    if (pathname === '/api/auth/signin') {
      const r = await checkRateLimit('signin', `ip:${ip}`);
      if (!r.success) return rateLimited(r);
    } else if (pathname === '/api/auth/request-data-deletion') {
      // Sekcja 11.4 — public endpoint piszący do DB + wysyłka emaila. 5/24h/IP
      // chroni przed spamem (vs auth bucket 1000/min byłby zbyt liberalny).
      const r = await checkRateLimit('restrictive', `ip:${ip}`);
      if (!r.success) return rateLimited(r);
    } else if (pathname.startsWith('/api/public/offers/') && pathname.endsWith('/pdf')) {
      // PR #4 review: PDF render to ~17s CPU. 5/min/IP zamiast 100/min chroni
      // przed wyczerpaniem Lambda concurrency.
      const r = await checkRateLimit('expensive', `ip:${ip}`);
      if (!r.success) return rateLimited(r);
    } else if (pathname.startsWith('/api/public/')) {
      const r = await checkRateLimit('public', `ip:${ip}`);
      if (!r.success) return rateLimited(r);
    } else if (pathname.startsWith('/api/')) {
      // Klucz po user.id ustalimy poniżej, więc fallback na IP dla unauth.
      const r = await checkRateLimit('auth', `ip:${ip}`);
      if (!r.success) return rateLimited(r);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Public passthrough — bez auth check
  // ---------------------------------------------------------------------------
  if (ALWAYS_PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------------------------
  // 4. Auth — wymaga sesji dla `/admin`, `/offers`, `/api/*` (poza /api/public)
  // ---------------------------------------------------------------------------
  const requiresAuth =
    APP_PROTECTED.some((p) => pathname.startsWith(p)) ||
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/public/'));

  if (!requiresAuth) return NextResponse.next();

  const res = NextResponse.next();
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return jsonError('UNAUTHORIZED', 'Brak sesji.', 401);
    }
    const url = req.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // ---------------------------------------------------------------------------
  // 5. Admin gating + MFA (sekcja 7.6) — TODO: AAL check po wdrożeniu MFA UI
  // ---------------------------------------------------------------------------
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    const role = (user.app_metadata as { role?: string } | undefined)?.role ?? null;
    if (role !== 'admin' && role !== 'super_admin') {
      return jsonError('FORBIDDEN', 'Brak uprawnień admin.', 403);
    }
    // const aal = (user.app_metadata as any)?.aal;
    // if (aal !== 'aal2') return NextResponse.redirect(new URL('/auth/mfa-setup', req.url));
  }

  return res;
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message, details: {} } }, { status });
}

function rateLimited(r: { reset: number }) {
  return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Zbyt wiele żądań.', details: {} } },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, r.reset - Math.floor(Date.now() / 1000))),
      },
    },
  );
}
