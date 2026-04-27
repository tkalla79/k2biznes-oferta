/**
 * Dispatcher webhook'ów (BACKEND_SPEC.md v1.1.1, sekcja 10.4).
 *
 * Retry policy: backoff [30s, 2min, 10min, 1h, 6h], max 5 prób, potem `dead`.
 * Idempotency: `X-K2-Idempotency-Key: <webhook_jobs.id>` — CRM dedupuje.
 * Signature: `X-K2-Signature: sha256=<hmac>` — CRM weryfikuje source.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { signWebhookBody } from './signature';
import type { WebhookTarget } from './types';
import type { Database, Json } from '@k2/database/types';

type WebhookJob = Database['public']['Tables']['webhook_jobs']['Row'];

/**
 * Backoff (sekcja 10.4): delay przed N-tą próbą (po N-1 nieudanych).
 *
 * Code review PR #5 fix: poprzednio `nextAttemptAtAfterFailure(attempts)` po
 * pierwszej awarii dostawał `attempts=1` i sięgał `BACKOFF_SEC[1]=120s`,
 * przeskakując 30s. Teraz `attempts=N` (po N-tej awarii, kolejna to N+1)
 * indeksuje `BACKOFF_SEC[attempts-1]` żeby dostać 30s przed 2. próbą.
 *
 *   attempts=1 (po 1 fail) → BACKOFF[0] = 30s (delay przed 2. próbą)
 *   attempts=2             → BACKOFF[1] = 120s (przed 3.)
 *   attempts=3             → BACKOFF[2] = 600s (przed 4.)
 *   attempts=4             → BACKOFF[3] = 3600s (przed 5.)
 */
const BACKOFF_SEC = [30, 120, 600, 3600, 21_600] as const; // 30s, 2min, 10min, 1h, 6h
const MAX_ATTEMPTS_DEFAULT = 5;

function nextAttemptAtAfterFailure(attempts: number): string {
  const idx = Math.min(Math.max(0, attempts - 1), BACKOFF_SEC.length - 1);
  const delaySec = BACKOFF_SEC[idx];
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

export type DispatchResult =
  | { status: 'sent'; httpStatus: number }
  | { status: 'failed'; httpStatus: number | null; willRetryAt: string | null; error: string }
  | { status: 'dead'; httpStatus: number | null; error: string };

/**
 * Dispatch jednego job'a. Update statusu w DB w jednym round-tripie po HTTP.
 *
 * Atomicznie: claim'ujemy job (status pending → processing) optimistycznym
 * lock'iem, żeby równoległy cron tick nie wysłał tego samego payloadu dwa razy.
 */
export async function dispatchJob(jobId: string): Promise<DispatchResult> {
  const sb = createAdminClient();

  // Claim — atomic update pending|failed → processing + claimed_at = now
  // (claimed_at używane przez `sweepStuckClaims` do recovery padłych workerów —
  // PR #5 code review: brak claimed_at oznacza że job zostawiony przez crash'a
  // workerów był stuck na `processing` bez ścieżki recovery)
  const { data: claimed, error: claimErr } = await sb
    .from('webhook_jobs')
    .update({ status: 'processing', claimed_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .select()
    .maybeSingle();

  if (claimErr) {
    return { status: 'failed', httpStatus: null, willRetryAt: null, error: claimErr.message };
  }
  if (!claimed) {
    // Inny worker już zaclaim'ował lub job nie jest pending/failed.
    return {
      status: 'failed',
      httpStatus: null,
      willRetryAt: null,
      error: 'job not claimable',
    };
  }

  return await sendAndRecord(claimed);
}

async function sendAndRecord(job: WebhookJob): Promise<DispatchResult> {
  const sb = createAdminClient();
  const target = job.target as WebhookTarget;

  const bodyStr = JSON.stringify(job.payload);
  const headers: Record<string, string> = {
    ...((job.headers as Record<string, string> | null) ?? {}),
    'X-K2-Event': job.event,
    'X-K2-Idempotency-Key': job.id,
    'X-K2-Timestamp': new Date().toISOString(),
  };

  // Sygnatura wymaga env'a — gdy brak, log warn ale nie blokuj wysyłki.
  try {
    headers['X-K2-Signature'] = signWebhookBody(target, bodyStr);
  } catch (e) {
    console.warn('[webhooks] sign failed:', (e as Error).message);
  }

  const attempts = job.attempts + 1;
  let httpStatus: number | null = null;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(job.url, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(15_000),
    });
    httpStatus = res.status;
    if (res.ok) {
      await sb
        .from('webhook_jobs')
        .update({
          status: 'sent',
          attempts,
          last_response_status: httpStatus,
          completed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id);
      return { status: 'sent', httpStatus };
    }
    errorMsg = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`;
  } catch (e) {
    errorMsg = (e as Error).message;
  }

  // Failure path — zwiększ attempts, ustaw next_attempt_at lub mark dead.
  // Code review PR #5: czytaj `max_attempts` z job'a (kolumna w schemie webhook_jobs)
  // żeby per-event override był respektowany. Default = 5 (zgodne ze spec sekcja 10.4).
  const maxAttempts = job.max_attempts ?? MAX_ATTEMPTS_DEFAULT;
  const isDead = attempts >= maxAttempts;
  const willRetryAt = isDead ? null : nextAttemptAtAfterFailure(attempts);

  await sb
    .from('webhook_jobs')
    .update({
      status: isDead ? 'dead' : 'failed',
      attempts,
      last_response_status: httpStatus,
      next_attempt_at: willRetryAt ?? job.next_attempt_at,
      last_error: errorMsg,
    })
    .eq('id', job.id);

  if (isDead) {
    console.error(
      `[webhooks] DEAD job=${job.id} target=${job.target} event=${job.event} attempts=${attempts}: ${errorMsg}`,
    );
    return { status: 'dead', httpStatus, error: errorMsg ?? 'unknown' };
  }
  return { status: 'failed', httpStatus, willRetryAt, error: errorMsg ?? 'unknown' };
}

/** Stuck-job recovery threshold — claim'er padł i nigdy nie sfinalizował joba. */
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

/**
 * Code review PR #5: workery które padły mid-flight zostawiają job'y na
 * `status='processing'` bez ścieżki recovery. Każdy tick cron'a najpierw
 * przesweepuje takie sieroty z powrotem na `pending`, potem dispatch'uje batch.
 */
async function sweepStuckClaims(): Promise<number> {
  const sb = createAdminClient();
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MS).toISOString();
  const { data, error } = await sb
    .from('webhook_jobs')
    .update({
      status: 'pending',
      claimed_at: null,
      last_error: 'recovered from stuck processing (worker timeout)',
    })
    .eq('status', 'processing')
    .lte('claimed_at', cutoff)
    .select('id');
  if (error) {
    console.error('[webhooks.sweep] failed:', error.message);
    return 0;
  }
  const n = data?.length ?? 0;
  if (n > 0) console.warn(`[webhooks.sweep] recovered ${n} stuck job(s)`);
  return n;
}

/**
 * Pobiera batch (max `limit`) job'ów gotowych do dispatchu i wysyła równolegle.
 * Wołane z cron endpoint'u (/api/internal/process-webhook-jobs).
 *
 * Najpierw sweep stuck claims (PR #5 review), potem normalny pickup.
 */
export async function processBatch(limit = 25): Promise<{
  picked: number;
  recovered: number;
  results: { id: string; result: DispatchResult }[];
}> {
  const sb = createAdminClient();
  const recovered = await sweepStuckClaims();

  const { data, error } = await sb
    .from('webhook_jobs')
    .select('id')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`processBatch list failed: ${error.message}`);
  if (!data || data.length === 0) return { picked: 0, recovered, results: [] };

  const results = await Promise.all(
    data.map(async (j) => ({ id: j.id, result: await dispatchJob(j.id) })),
  );

  return { picked: data.length, recovered, results };
}

/**
 * Helper exportowany dla tests — sprawdza krzywą backoff.
 * Semantyka spójna z `nextAttemptAtAfterFailure`: arg `attempts` to liczba
 * dotychczasowych awarii; zwraca delay przed kolejną próbą.
 */
export function _backoffSecondsForAttempt(attempts: number): number {
  const idx = Math.min(Math.max(0, attempts - 1), BACKOFF_SEC.length - 1);
  return BACKOFF_SEC[idx];
}

export const _MAX_ATTEMPTS = MAX_ATTEMPTS_DEFAULT;
export const _BACKOFF_SEC = BACKOFF_SEC;

export type { Json };
