/**
 * IP hashing z wersjonowanym saltem (BACKEND_SPEC.md v1.1.1, sekcja 11.7).
 *
 * Zachowujemy `ip_hash` + `ip_salt_version` w `offer_events`. Salt rotujemy co 90
 * dni przez insert do `ip_hash_salts` — nowe eventy używają nowego salta. Stare
 * eventy są skorelowane tylko w obrębie tej samej wersji salta.
 */
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type Cache = { version: number; salt: string; expiresAt: number };
let cached: Cache | null = null;
const TTL_MS = 5 * 60 * 1000;

async function loadCurrentSalt(): Promise<{ version: number; salt: string }> {
  if (cached && cached.expiresAt > Date.now()) {
    return { version: cached.version, salt: cached.salt };
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('ip_hash_salts')
    .select('version, salt')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`ip_hash_salts load failed: ${error.message}`);
  if (!data) throw new Error('ip_hash_salts empty — uruchom seed.sql (sekcja 11.7)');

  cached = { version: data.version, salt: data.salt, expiresAt: Date.now() + TTL_MS };
  return { version: data.version, salt: data.salt };
}

/**
 * Zwraca `{ hash, version }` dla given IP. `null` gdy IP brak (np. dev).
 */
export async function hashIp(ip: string | null | undefined): Promise<{
  hash: string | null;
  version: number | null;
}> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { hash: null, version: null };
  }
  const { version, salt } = await loadCurrentSalt();
  const hash = createHash('sha256').update(`${ip}:${salt}`).digest('hex');
  return { hash, version };
}

/**
 * Wyciąga IP z Next.js request headers (Vercel / standardowy proxy).
 * Pierwszy IP z `x-forwarded-for` to client (reszta to proxy chain).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? '127.0.0.1';
}

/**
 * Invaliduje cache — wołane po rotacji salta przez super_admina.
 */
export function invalidateIpHashCache() {
  cached = null;
}
