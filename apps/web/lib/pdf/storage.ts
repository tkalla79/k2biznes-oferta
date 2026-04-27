/**
 * Supabase Storage helpers dla bucket'u `offer-pdfs` (BACKEND_SPEC.md v1.1.1, sekcja 9.1 + 11.8).
 *
 * Bucket: private (RLS deny anon). Dostęp tylko przez signed URL z TTL 5 min.
 * Klucz: `{offerNumber}_{pricingSnapshotHash}.pdf` — niezmienny dla danego
 * snapshotu, więc cache'owanie jest bezpieczne.
 */
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'offer-pdfs';
const SIGNED_URL_TTL_SEC = 300; // 5 min (sekcja 11.8)

export type CachedPdf = { exists: true; bytes: ArrayBuffer; size: number } | { exists: false };

/**
 * Sprawdź cache + pobierz bytes jeśli jest. Brak → `{exists: false}`.
 */
export async function getCachedPdf(key: string): Promise<CachedPdf> {
  const sb = createAdminClient();
  const { data, error } = await sb.storage.from(BUCKET).download(key);
  if (error) {
    // Storage zwraca 404 jako error — to "miss", nie failure.
    if ('statusCode' in error && (error as { statusCode?: number }).statusCode === 404) {
      return { exists: false };
    }
    // Inne błędy (np. 403, 500) traktujemy jako miss + log.
    console.warn(`[pdf.storage] download ${key} failed:`, error.message);
    return { exists: false };
  }
  const bytes = await data.arrayBuffer();
  return { exists: true, bytes, size: bytes.byteLength };
}

/**
 * Wstaw do cache. Idempotent — `upsert: true` żeby retry nie failował.
 */
export async function putCachedPdf(key: string, bytes: Uint8Array | ArrayBuffer): Promise<void> {
  const sb = createAdminClient();
  const blob = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { error } = await sb.storage.from(BUCKET).upload(key, blob, {
    contentType: 'application/pdf',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(`pdf.storage.put ${key} failed: ${error.message}`);
  }
}

/**
 * Usuń wszystkie PDFy oferty (po zmianie snapshotu/content).
 *
 * Code review PR #4: Supabase Storage `list({ search })` używa SQL `ILIKE %s%`
 * — `_` w `search` to wildcard pasujący do dowolnego znaku, więc dla
 * `offerNumber='K2/2026/04/001'` (po replace = `K2_2026_04_001`) match'owałby
 * też `K2X2026Y04Z001Wxyz.pdf`. Idziemy bez search, listujemy wszystko (bucket
 * jest mały — kilka tysięcy plików max) i filtrujemy po stronie JS regex'em.
 */
export async function deletePdfsForOffer(offerNumber: string): Promise<number> {
  const sb = createAdminClient();
  const safe = offerNumber.replace(/[/\\?#]/g, '_');
  // Escape regex special chars w prefix'ie (offerNumber po sanitization to A-Z/0-9/_/-)
  const prefix = `${safe}_`;
  const { data, error } = await sb.storage
    .from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.warn(`[pdf.storage] list for ${offerNumber} failed:`, error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;
  // Filter exact prefix match (string startsWith — bezpieczniejsze niż regex LIKE).
  const paths = data
    .map((f) => f.name)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.pdf'));
  if (paths.length === 0) return 0;
  const { error: delErr } = await sb.storage.from(BUCKET).remove(paths);
  if (delErr) {
    console.warn(`[pdf.storage] remove failed:`, delErr.message);
    return 0;
  }
  return paths.length;
}

/**
 * Signed URL dla bezpośredniego pobrania (np. link w mailu zamiast streaming bytes).
 */
export async function createSignedPdfUrl(key: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(key, SIGNED_URL_TTL_SEC);
  if (error || !data) return null;
  return data.signedUrl;
}
