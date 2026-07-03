/**
 * /admin/ustawienia — globalne ustawienia firmowe (uwaga PDF #1).
 * Na start: statystyki firmowe (hero + sekcja "Dlaczego K2"). super_admin only.
 */
import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import CompanyStatsForm from './CompanyStatsForm';
import TestEmailForm from './TestEmailForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function SettingsPage() {
  const session = await requireSuperAdmin();

  const sb = createAdminClient();
  const { data } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'company_stats')
    .maybeSingle();

  const cs = (data?.value ?? {}) as { funding?: string; projects?: string; since?: string };
  const initial = {
    funding: cs.funding ?? '475 mln zł',
    projects: cs.projects ?? '288',
    since: cs.since ?? 'od 2015',
  };

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Ustawienia firmowe</h1>
        <Link href="/admin" style={linkBack}>← Dashboard</Link>
      </header>
      <p style={lead}>
        Statystyki wyświetlane w nagłówku każdej oferty (hero) oraz w sekcji „Dlaczego K2Biznes”.
        Zmiana propaguje na wszystkie oferty — to dane firmowe, nie per-klient.
      </p>
      <CompanyStatsForm initial={initial} />
      <TestEmailForm defaultTo={session.email ?? ''} />
    </main>
  );
}

const main: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' };
const topbar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 };
const h1: React.CSSProperties = { fontSize: 28, margin: 0 };
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const lead: React.CSSProperties = { color: '#6b7a92', fontSize: 13, marginTop: 0, marginBottom: 24 };
