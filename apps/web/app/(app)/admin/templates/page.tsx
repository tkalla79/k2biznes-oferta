/**
 * Lista szablonów oferty (feature #1). Server component — każdy zalogowany
 * (globalne). UI rename/delete w TemplatesManager (client).
 */
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import TemplatesManager from './TemplatesManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function TemplatesPage() {
  await requireSession();

  const sb = createAdminClient();
  const { data: rows } = await sb
    .from('offer_templates')
    .select('id, name, created_at, created_by')
    .order('created_at', { ascending: false });

  // Autorzy (do wyświetlenia kto utworzył).
  const authorIds = [...new Set((rows ?? []).map((r) => r.created_by).filter(Boolean))] as string[];
  const authors = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profs } = await sb
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);
    for (const p of profs ?? []) authors.set(p.id, p.full_name ?? p.email);
  }

  const items = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    author: r.created_by ? (authors.get(r.created_by) ?? '—') : '—',
  }));

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Szablony ofert</h1>
        <Link href="/admin" style={linkBack}>← Dashboard</Link>
      </header>
      <p style={lead}>
        Gotowe rozpiski oferty (program, warianty, treści, alternatywne programy) bez danych
        klienta. Wybierasz je przy tworzeniu nowej oferty („Zacznij od szablonu”). Zapis nowego
        szablonu: przycisk „Zapisz jako szablon” w edytorze oferty.
      </p>
      <TemplatesManager items={items} />
    </main>
  );
}

const main: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' };
const topbar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 };
const h1: React.CSSProperties = { fontSize: 28, margin: 0 };
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const lead: React.CSSProperties = { color: '#6b7a92', fontSize: 13, marginTop: 0, marginBottom: 24 };
