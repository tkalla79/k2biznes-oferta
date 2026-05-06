/**
 * /admin/faq — globalna lista FAQ na publicznych ofertach (PR-D / uwaga 19).
 * Admin/super_admin only.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import FaqManager from './FaqManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function FaqPage() {
  await requireAdmin();

  const sb = createAdminClient();
  const { data: items } = await sb
    .from('faq_items')
    .select('*')
    .is('deleted_at', null)
    .order('display_order')
    .order('created_at');

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>FAQ — pytania na ofercie</h1>
        <Link href="/admin" style={linkBack}>
          ← Dashboard
        </Link>
      </header>
      <p style={lead}>
        Globalna lista FAQ pojawiająca się w sekcji „08 · FAQ” na każdej publicznej ofercie
        (po cenniku). Edycja jest natychmiastowa — kolejne pobranie oferty pokaże nową wersję.
      </p>
      <FaqManager initial={items ?? []} />
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
