/**
 * Katalog programów (BACKEND_SPEC.md v1.1.1, sekcja 3.2.6 + 5.2).
 *
 * Server component — admin requirement, fetch wszystkich programów
 * (active+inactive). UI w `ProgramsManager` (client).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import ProgramsManager from './ProgramsManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ProgramsPage() {
  await requireAdmin();

  const sb = createAdminClient();
  const { data: programs } = await sb
    .from('programs')
    .select('*')
    .order('display_order')
    .order('label');

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Katalog programów</h1>
        <Link href="/admin" style={linkBack}>
          ← Dashboard
        </Link>
      </header>
      <p style={lead}>
        Programy dotacyjne wybierane w edytorze ofert. Edycja wpływa na nowe oferty i list
        wyboru. Istniejące oferty zachowują `program_label` jako kopię z momentu wystawienia.
      </p>
      <ProgramsManager initial={programs ?? []} />
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
