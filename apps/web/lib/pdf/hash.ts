/**
 * Stable hash of pricing_snapshot + content (BACKEND_SPEC.md v1.1.1, sekcja 9.1.2 + B21).
 *
 * Używany jako klucz cache PDF (`{offerNumber}_{hash}.pdf`). Inwarianty:
 * - Klucze obiektu sortowane alfabetycznie (RFC 8785 JCS-light).
 * - `undefined` ignorowane (żeby zmiana z `undefined` na brak pola nie zmieniła hash'u).
 * - Liczby nie są normalizowane (zaufanie że Postgres zwraca konsystentnie).
 * - Output: SHA-256 hex, pierwsze 16 znaków (64 bity — wystarczające dla cache key).
 */
import { createHash } from 'node:crypto';

/**
 * Canonicalize: sortuje klucze obiektu rekursywnie. Tablice zachowują kolejność.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (obj[k] === undefined) continue;
    out[k] = canonicalize(obj[k]);
  }
  return out;
}

export function pricingSnapshotHash(snapshot: unknown, content: unknown): string {
  const canonical = canonicalize({ s: snapshot, c: content });
  const json = JSON.stringify(canonical);
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Klucz w bucket'cie. `offerNumber` ma `/`, więc enkodujemy do `_`.
 */
export function pdfStorageKey(offerNumber: string, hash: string): string {
  const safe = offerNumber.replace(/[/\\?#]/g, '_');
  return `${safe}_${hash}.pdf`;
}
