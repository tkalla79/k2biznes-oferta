/**
 * /admin/offers/[id]/activity — dashboard aktywności klienta (audyt 2026-07 pkt 6).
 *
 * Pokazuje konsultantowi, co klient robił z ofertą przed follow-upem:
 * otwarcia, doczytane sekcje (scroll_depth), zainteresowanie wariantami
 * (variant_hovered/selected), pobrania PDF, timeline zdarzeń.
 *
 * Auth jak edit page: requireSession + ownership check dla konsultanta
 * (defense in depth — RLS też to egzekwuje).
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sekcje oferty w kolejności czytania — id === id sekcji na /o/[token]. */
const SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'intro', label: '01 · Wprowadzenie' },
  { id: 'program', label: '02 · Proponowane rozwiązanie' },
  { id: 'zakres', label: '03 · Zakres usługi' },
  { id: 'cennik', label: '04 · Model wynagrodzenia' },
  { id: 'proces', label: '05 · Schemat procesu' },
  { id: 'onas', label: '06 · Dlaczego K2Biznes' },
  { id: 'case', label: '07 · Case study' },
  { id: 'faq', label: '08 · FAQ' },
  { id: 'akcept', label: '09 · Akceptacja' },
];

const EVENT_LABELS: Record<string, string> = {
  created: 'Utworzenie oferty',
  updated: 'Edycja oferty',
  sent: 'Wysłanie do klienta',
  viewed: 'Otwarcie oferty',
  scroll_depth: 'Doczytanie sekcji',
  variant_hovered: 'Najechanie na wariant',
  variant_selected: 'Podświetlenie wariantu',
  accepted: 'Akceptacja oferty',
  rejected: 'Odrzucenie oferty',
  pdf_downloaded: 'Pobranie PDF',
  link_shared: 'Udostępnienie linku',
  email_sent: 'Wysłanie e-maila',
};

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

type EventRow = {
  type: string;
  payload: Record<string, unknown> | null;
  actor_type: string | null;
  created_at: string;
};

export default async function OfferActivityPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound();

  const session = await requireSession();
  const sb = createAdminClient();

  const [{ data: offer }, { data: eventsData }] = await Promise.all([
    sb
      .from('offers')
      .select(
        'id, offer_number, client_name, status, created_by, assigned_consultant_id, view_count, first_viewed_at, last_viewed_at, sent_at, expires_at',
      )
      .eq('id', params.id)
      .is('deleted_at', null)
      .maybeSingle(),
    sb
      .from('offer_events')
      .select('type, payload, actor_type, created_at')
      .eq('offer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (!offer) notFound();
  if (
    session.role === 'consultant' &&
    offer.created_by !== session.userId &&
    offer.assigned_consultant_id !== session.userId
  ) {
    notFound();
  }

  const events = (eventsData ?? []) as EventRow[];

  // Doczytane sekcje (scroll_depth → payload.section)
  const readSections = new Set(
    events
      .filter((e) => e.type === 'scroll_depth')
      .map((e) => String((e.payload as { section?: string } | null)?.section ?? '')),
  );
  const readCount = SECTIONS.filter((s) => readSections.has(s.id)).length;

  // Zainteresowanie wariantami
  const variantStats = new Map<string, { hovered: number; selected: number }>();
  for (const e of events) {
    if (e.type !== 'variant_hovered' && e.type !== 'variant_selected') continue;
    const v = String((e.payload as { variant?: string } | null)?.variant ?? '?');
    const s = variantStats.get(v) ?? { hovered: 0, selected: 0 };
    if (e.type === 'variant_hovered') s.hovered += 1;
    else s.selected += 1;
    variantStats.set(v, s);
  }

  const pdfCount = events.filter((e) => e.type === 'pdf_downloaded').length;
  const hasEngagement = readSections.size > 0 || variantStats.size > 0;

  return (
    <main style={main}>
      <header style={topbar}>
        <div>
          <h1 style={h1}>Aktywność klienta</h1>
          <p style={sub}>
            {offer.offer_number} · {offer.client_name} · status: <strong>{offer.status}</strong>
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 14 }}>
          <Link href={`/admin/offers/${offer.id}/edit`} style={linkNav}>Edytuj ofertę</Link>
          <Link href="/admin/offers" style={linkNav}>← Oferty</Link>
        </nav>
      </header>

      {/* KPI */}
      <section style={grid4}>
        <Card title="Otwarcia oferty" value={String(offer.view_count ?? 0)} />
        <Card
          title="Pierwsze otwarcie"
          value={offer.first_viewed_at ? fmtDT(offer.first_viewed_at) : '—'}
        />
        <Card
          title="Ostatnia aktywność"
          value={offer.last_viewed_at ? fmtDT(offer.last_viewed_at) : '—'}
        />
        <Card title="Pobrania PDF" value={String(pdfCount)} />
      </section>

      {/* Postęp czytania */}
      <section style={panel}>
        <h2 style={h2}>
          Postęp czytania{' '}
          <span style={badge}>
            {readCount}/{SECTIONS.length} sekcji
          </span>
        </h2>
        {!hasEngagement && (
          <p style={hint}>
            Brak danych o doczytaniu — śledzenie sekcji i wariantów zbiera dane od wdrożenia
            tej funkcji; wcześniejsze wizyty klienta rejestrowały tylko otwarcia.
          </p>
        )}
        <ul style={sectionList}>
          {SECTIONS.map((s) => {
            const read = readSections.has(s.id);
            return (
              <li key={s.id} style={sectionItem}>
                <span style={read ? dotRead : dotUnread} aria-hidden>
                  {read ? '✓' : '·'}
                </span>
                <span style={{ color: read ? '#1B2A4A' : '#9aa3b2' }}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Warianty */}
      <section style={panel}>
        <h2 style={h2}>Zainteresowanie wariantami</h2>
        {variantStats.size === 0 ? (
          <p style={hint}>Brak interakcji z wariantami cennika.</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Wariant</th>
                <th style={th}>Najechania</th>
                <th style={th}>Podświetlenia</th>
              </tr>
            </thead>
            <tbody>
              {[...variantStats.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([v, s]) => (
                  <tr key={v}>
                    <td style={td}>Wariant {v}</td>
                    <td style={td}>{s.hovered}</td>
                    <td style={td}>{s.selected}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Timeline */}
      <section style={panel}>
        <h2 style={h2}>Ostatnie zdarzenia</h2>
        {events.length === 0 ? (
          <p style={hint}>Brak zdarzeń.</p>
        ) : (
          <ul style={timeline}>
            {events.slice(0, 30).map((e, i) => {
              const p = (e.payload ?? {}) as { section?: string; variant?: string };
              const detail = p.section
                ? SECTIONS.find((s) => s.id === p.section)?.label ?? p.section
                : p.variant
                  ? `Wariant ${p.variant}`
                  : null;
              return (
                <li key={i} style={timelineItem}>
                  <span style={tlTime}>{fmtDT(e.created_at)}</span>
                  <span style={tlType}>{EVENT_LABELS[e.type] ?? e.type}</span>
                  {detail && <span style={tlDetail}>{detail}</span>}
                  <span style={tlActor}>{e.actor_type === 'client' ? 'klient' : 'K2'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      <div style={cardValue}>{value}</div>
    </div>
  );
}

// ---- style (inline, wzorzec pozostałych stron admina) ----
const main: React.CSSProperties = { maxWidth: 900, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' };
const topbar: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 };
const h1: React.CSSProperties = { fontSize: 26, margin: 0, color: '#1B2A4A' };
const sub: React.CSSProperties = { margin: '6px 0 0', fontSize: 13, color: '#6b7a92' };
const linkNav: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const grid4: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e4e9f2', borderRadius: 10, padding: '16px 18px' };
const cardTitle: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 6 };
const cardValue: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: '#1B2A4A' };
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #e4e9f2', borderRadius: 10, padding: 22, marginBottom: 20 };
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 14px', color: '#1B2A4A' };
const badge: React.CSSProperties = { marginLeft: 8, fontSize: 12, fontWeight: 600, color: '#c92b3a', background: '#fdf0ef', borderRadius: 999, padding: '3px 10px' };
const hint: React.CSSProperties = { fontSize: 13, color: '#9aa3b2', margin: '0 0 10px' };
const sectionList: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 20px' };
const sectionItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 };
const dotRead: React.CSSProperties = { width: 20, height: 20, borderRadius: '50%', background: '#1f7a4c', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 };
const dotUnread: React.CSSProperties = { width: 20, height: 20, borderRadius: '50%', background: '#eef1f6', color: '#9aa3b2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e4e9f2', color: '#6b7a92', fontSize: 12 };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #eef1f6', color: '#1B2A4A' };
const timeline: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const timelineItem: React.CSSProperties = { display: 'flex', gap: 14, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid #f2f4f8', fontSize: 13 };
const tlTime: React.CSSProperties = { color: '#9aa3b2', minWidth: 120, fontVariantNumeric: 'tabular-nums' };
const tlType: React.CSSProperties = { color: '#1B2A4A', fontWeight: 500 };
const tlDetail: React.CSSProperties = { color: '#6b7a92' };
const tlActor: React.CSSProperties = { marginLeft: 'auto', fontSize: 11, color: '#9aa3b2', textTransform: 'uppercase', letterSpacing: '.06em' };
