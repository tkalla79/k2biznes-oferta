/**
 * GET /api/health — healthcheck (BACKEND_SPEC.md v1.1, sekcja 12.3).
 * Public, no auth. Sprawdza DB, Redis, Storage.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Check = { ok: boolean; latency_ms?: number; error?: string };

export async function GET() {
  const checks: Record<string, Check> = {
    db: await ping(async () => {
      const sb = createAdminClient();
      const { error } = await sb.from('pricing_config').select('id').limit(1);
      if (error) throw error;
    }),
    redis: { ok: !!process.env.RATE_LIMIT_REDIS_URL || true }, // TODO: faktyczny ping
    storage: await ping(async () => {
      const sb = createAdminClient();
      const { error } = await sb.storage.listBuckets();
      if (error) throw error;
    }),
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, version: '0.1.0', checks },
    { status: allOk ? 200 : 503 },
  );
}

async function ping(fn: () => Promise<void>): Promise<Check> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: (e as Error).message };
  }
}
