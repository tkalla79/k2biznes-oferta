/**
 * POST /api/internal/process-webhook-jobs (BACKEND_SPEC.md v1.1.1, sekcja 10.4).
 *
 * Cron consumer — wywoływany co minutę przez:
 *   - Vercel Pro cron (`vercel.json` w root deployu)  LUB
 *   - Supabase pg_cron + Edge Function  LUB
 *   - Zewnętrzny scheduler (Upstash QStash / GitHub Actions cron co 5min)
 *
 * Auth: header `X-Cron-Secret` musi się zgadzać z `CRON_SECRET` env. Wybranie
 * tego dotyczy każdego z trzech środowisk — Vercel automatycznie wstrzykuje
 * `Authorization: Bearer <CRON_SECRET>` przy `vercel cron`, my akceptujemy oba.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { processBatch } from '@/lib/webhooks/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // 1) Vercel cron Authorization header
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  // 2) Custom header X-Cron-Secret (zewnętrzny scheduler)
  if (req.headers.get('x-cron-secret') === secret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing/invalid cron secret.', details: {} } },
      { status: 401 },
    );
  }

  try {
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? 25)));
    const start = Date.now();
    const { picked, results } = await processBatch(limit);
    const durationMs = Date.now() - start;

    const summary = {
      picked,
      sent: results.filter((r) => r.result.status === 'sent').length,
      failed: results.filter((r) => r.result.status === 'failed').length,
      dead: results.filter((r) => r.result.status === 'dead').length,
      durationMs,
    };

    return NextResponse.json({ data: summary });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Cron batch failed.',
          details: { reason: (e as Error).message },
        },
      },
      { status: 500 },
    );
  }
}

// Vercel cron wysyła GET przy default config — pozwalamy też GET (idempotent).
export const GET = POST;
