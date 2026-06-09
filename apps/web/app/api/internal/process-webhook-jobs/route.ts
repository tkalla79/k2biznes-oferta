/**
 * POST /api/internal/process-webhook-jobs (BACKEND_SPEC.md v1.1.1, sekcja 10.4).
 *
 * Cron consumer — wywoływany co minutę przez:
 *   - Vercel Pro cron (`vercel.json` w root deployu) — wysyła GET
 *   - Supabase pg_cron + Edge Function — wysyła POST
 *   - Zewnętrzny scheduler (Upstash QStash / GitHub Actions cron co 5min)
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel) lub `X-Cron-Secret`
 * (custom). Porównanie `timingSafeEqual` żeby uniknąć timing-side-channel
 * leakage'u sekretu (PR #5 code review).
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { processBatch } from '@/lib/webhooks/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// H9 audit: maxDuration honorowane tylko na Vercel Pro (Hobby = 10s hard).
// Ten endpoint i tak nie jest jeszcze wywoływany — brak skonfigurowanego crona
// (H8). batch processuje webhook_jobs porcjami, więc 10s wystarczy przy małej
// kolejce. Wartość 60 zostaje na wypadek Pro + dużej kolejki.
export const maxDuration = 60;

function safeEqualStr(a: string, b: string): boolean {
  // timingSafeEqual wymaga buffer'ów o tej samej długości — wczesny return przy
  // mismatch'u długości też jest timing-safe (długość secret'u nie jest tajna).
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  if (auth && safeEqualStr(auth, `Bearer ${secret}`)) return true;

  const custom = req.headers.get('x-cron-secret');
  if (custom && safeEqualStr(custom, secret)) return true;

  return false;
}

async function runBatch(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing/invalid cron secret.', details: {} } },
      { status: 401 },
    );
  }

  try {
    const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? 25)));
    const start = Date.now();
    const { picked, recovered, results } = await processBatch(limit);
    const durationMs = Date.now() - start;

    const summary = {
      picked,
      recovered,
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

export async function POST(req: NextRequest) {
  return runBatch(req);
}

/**
 * GET handler dla Vercel cron (który wysyła GET).
 *
 * UWAGA: ten handler MUTUJE (claim + dispatch + DB writes + outbound HTTP).
 * Code review PR #5 zwrócił uwagę że łamie to semantykę GET idempotency.
 * Trzymamy GET wyłącznie dla kompatybilności z Vercel cron, ale auth jest
 * twardo wymagany (CRON_SECRET) — uptime monitor / CDN bez secretu dostaje 401.
 */
export async function GET(req: NextRequest) {
  return runBatch(req);
}
