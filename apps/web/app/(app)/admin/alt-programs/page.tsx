/**
 * Biblioteka "Inne możliwości wsparcia" (feature #2, spec 2026-06-09).
 *
 * Server component — admin requirement, fetch wszystkich alt-programów.
 * UI w `AltProgramsManager` (client). Wybierane potem w OfferForm (multi-select).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import AltProgramsManager from './AltProgramsManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AltProgramsPage() {
  await requireAdmin();

  const sb = createAdminClient();
  const { data: items } = await sb
    .from('alt_programs')
    .select('*')
    .order('display_order')
    .order('name');

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Inne możliwości wsparcia</h1>
        <Link href="/admin" style={linkBack}>
          ← Dashboard
        </Link>
      </header>
      <p style={lead}>
        Biblioteka programów alternatywnych. Konsultant wybiera je z listy w edytorze
        oferty (sekcja „Alternatywne programy”). Edycja wpływa na nowe oferty — istniejące
        zachowują kopię z momentu wystawienia.
      </p>
      <AltProgramsManager initial={items ?? []} />
    </main>
  );
}

const main: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};
const topbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 8,
};
const h1: React.CSSProperties = { fontSize: 28, margin: 0 };
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const lead: React.CSSProperties = { color: '#6b7a92', fontSize: 13, marginTop: 0, marginBottom: 24 };
