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
 * Backoff (sekcja 10.4): step n (0-indexed) → seconds delay.
 * Maksymalnie 5 prób, więc index 0..4.
 */
const BACKOFF_SEC = [30, 120, 600, 3600, 21_600] as const; // 30s, 2min, 10min, 1h, 6h
const MAX_ATTEMPTS = 5;

function nextAttemptAtAfterFailure(attempts: number): string {
  const idx = Math.min(attempts, BACKOFF_SEC.length - 1);
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

  // Claim — atomic update pending|failed → processing
  const { data: claimed, error: claimErr } = await sb
    .from('webhook_jobs')
    .update({ status: 'processing' })
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
  const isDead = attempts >= MAX_ATTEMPTS;
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

/**
 * Pobiera batch (max `limit`) job'ów gotowych do dispatchu i wysyła równolegle.
 * Wołane z cron endpoint'u (/api/internal/process-webhook-jobs).
 */
export async function processBatch(limit = 25): Promise<{
  picked: number;
  results: { id: string; result: DispatchResult }[];
}> {
  const sb = createAdminClient();

  const { data, error } = await sb
    .from('webhook_jobs')
    .select('id')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`processBatch list failed: ${error.message}`);
  if (!data || data.length === 0) return { picked: 0, results: [] };

  const results = await Promise.all(
    data.map(async (j) => ({ id: j.id, result: await dispatchJob(j.id) })),
  );

  return { picked: data.length, results };
}

/**
 * Helper exportowany dla tests — sprawdza krzywą backoff.
 */
export function _backoffSecondsForAttempt(attempts: number): number {
  const idx = Math.min(attempts, BACKOFF_SEC.length - 1);
  return BACKOFF_SEC[idx];
}

export const _MAX_ATTEMPTS = MAX_ATTEMPTS;
export const _BACKOFF_SEC = BACKOFF_SEC;

export type { Json };
