/**
 * GET /api/health — healthcheck (BACKEND_SPEC.md v1.1, sekcja 12.3).
 * Public, no auth. Sprawdza DB, Redis, Storage.
 *
 * Redis: jesli `RATE_LIMIT_REDIS_URL`/`TOKEN` nie sa skonfigurowane (np. lokalny
 * dev albo prod bez aktywnego Upstash) → `skipped: true`, nie liczy sie do
 * `allOk`. Jesli skonfigurowane → realny PING z timeout 2s.
 */
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Check = {
  ok: boolean;
  latency_ms?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
};

const REDIS_PING_TIMEOUT_MS = 2000;

export async function GET() {
  const checks: Record<string, Check> = {
    db: await ping(async () => {
      const sb = createAdminClient();
      const { error } = await sb.from('pricing_config').select('id').limit(1);
      if (error) throw error;
    }),
    redis: await pingRedis(),
    storage: await ping(async () => {
      const sb = createAdminClient();
      const { error } = await sb.storage.listBuckets();
      if (error) throw error;
    }),
  };

  // `skipped` nie liczy sie jako fail — to konfiguracja, nie awaria.
  const allOk = Object.values(checks).every((c) => c.ok || c.skipped);
  return NextResponse.json(
    { ok: allOk, version: '0.1.0', checks },
    { status: allOk ? 200 : 503 },
  );
}

const CHECK_TIMEOUT_MS = 3000;

/** Race fn() przeciw timeout — Q7 audit: slow Storage/DB nie blokuje całego
 *  health checka (UptimeRobot dostaje 503 zamiast wisieć do Vercel 10s limitu). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function ping(fn: () => Promise<void>): Promise<Check> {
  const t0 = Date.now();
  try {
    await withTimeout(fn(), CHECK_TIMEOUT_MS, 'check');
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: (e as Error).message };
  }
}

async function pingRedis(): Promise<Check> {
  const url = process.env.RATE_LIMIT_REDIS_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;

  if (!url || !token) {
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  const t0 = Date.now();
  try {
    const redis = new Redis({ url, token });
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error(`timeout after ${REDIS_PING_TIMEOUT_MS}ms`)),
          REDIS_PING_TIMEOUT_MS,
        ),
      ),
    ]);
    if (result !== 'PONG') {
      throw new Error(`unexpected response: ${String(result)}`);
    }
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: (e as Error).message };
  }
}
