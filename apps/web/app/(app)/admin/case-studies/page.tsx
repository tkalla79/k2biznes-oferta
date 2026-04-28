/**
 * Katalog case studies (BACKEND_SPEC.md v1.1.1, sekcja 3.2.5 + 5.2).
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import CaseStudiesManager from './CaseStudiesManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CaseStudiesPage() {
  await requireAdmin();
  const sb = createAdminClient();
  const { data } = await sb
    .from('case_studies')
    .select('*')
    .order('display_order')
    .order('client');

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Katalog case studies</h1>
        <Link href="/admin" style={linkBack}>
          ← Dashboard
        </Link>
      </header>
      <p style={lead}>
        Case studies wybierane w edytorze ofert (sekcja &quot;Załączniki&quot;). Logo i zdjęcia
        jako URL — upload do Storage w późniejszym PR.
      </p>
      <CaseStudiesManager initial={data ?? []} />
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
