/**
 * Helper dla Supabase Storage bucket 'public-uploads'.
 *
 * Zwraca publiczny URL do pliku ze storage lub fallback do legacy URL kolumny.
 */

export function publicStorageUrl(
  storageKey: string | null | undefined,
  fallbackUrl: string | null | undefined,
): string | null {
  if (storageKey) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return fallbackUrl ?? null;
    return `${supabaseUrl}/storage/v1/object/public/public-uploads/${storageKey}`;
  }
  return fallbackUrl ?? null;
}
