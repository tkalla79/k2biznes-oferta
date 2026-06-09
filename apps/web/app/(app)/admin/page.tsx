/**
 * Admin dashboard — overview + per-consultant + forecast (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Server component — fetch przez service role z gating'iem na auth.is_admin()
 * (RLS blokuje gdy ktoś trafi z anon). UI minimal, bez chart libs.
 */
import Link from 'next/link';
import { fetchOverview, fetchConsultantBreakdown } from '@/lib/stats/overview';
import { fetchForecast } from '@/lib/stats/forecast';
import { requireAdmin } from '@/lib/auth/session';
import SimulatorPanel from './SimulatorPanel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';
const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default async function AdminDashboard() {
  await requireAdmin();
  const [overview, byConsultant, forecast] = await Promise.all([
    fetchOverview(),
    fetchConsultantBreakdown(),
    fetchForecast(),
  ]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: '#6b7a92', fontSize: 13, marginTop: 0 }}>
        Computed at {new Date(overview.computed_at).toLocaleString('pl-PL')}
      </p>

      <nav style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, flexWrap: 'wrap' }}>
        <Link href="/admin/offers" style={{ color: '#c92b3a', textDecoration: 'none', fontWeight: 600 }}>
          → Oferty
        </Link>
        <Link href="/admin/programs" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          Programy
        </Link>
        <Link href="/admin/case-studies" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          Case studies
        </Link>
        <Link href="/admin/contact-persons" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          Osoby kontaktowe
        </Link>
        <Link href="/admin/alt-programs" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          Inne możliwości wsparcia
        </Link>
        <Link href="/admin/faq" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          FAQ
        </Link>
        <Link href="/admin/users" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          Użytkownicy
        </Link>
        <Link href="/admin/gdpr" style={{ color: '#6b7a92', textDecoration: 'none' }}>
          RODO
        </Link>
      </nav>

      {/* KPI cards */}
      <section style={grid4}>
        <Card title="Aktywne oferty" value={String(overview.totals.active)} />
        <Card title="Zaakceptowane" value={String(overview.totals.closed_won)} accent="#1f7a4c" />
        <Card title="Pipeline (SF Wariant I)" value={fmtPLN(overview.revenue.pipeline_sf_var1_sum)} accent="#c92b3a" />
        <Card title="Revenue 30d" value={fmtPLN(overview.revenue.accepted_fee_last_30d)} />
      </section>

      {/* Konwersja */}
      <section style={panel}>
        <h2 style={h2}>Konwersja</h2>
        <table style={table}>
          <tbody>
            <Row label="sent → viewed" value={fmtPct(overview.conversion.sent_to_viewed)} />
            <Row label="viewed → accepted" value={fmtPct(overview.conversion.viewed_to_accepted)} />
            <Row label="ø czas sent → viewed (h)" value={String(overview.avg_time_hours.sent_to_viewed)} />
            <Row label="ø czas viewed → accepted (h)" value={String(overview.avg_time_hours.viewed_to_accepted)} />
          </tbody>
        </table>
      </section>

      {/* Per-consultant */}
      <section style={panel}>
        <h2 style={h2}>Konsultanci</h2>
        {byConsultant.length === 0 ? (
          <p style={{ color: '#6b7a92' }}>Brak danych.</p>
        ) : (
          <table style={tableFull}>
            <thead>
              <tr style={th}>
                <th style={thCell}>Imię</th>
                <th style={thCell}>Email</th>
                <th style={thCellRight}>Ofert</th>
                <th style={thCellRight}>Aktywne</th>
                <th style={thCellRight}>Accepted</th>
                <th style={thCellRight}>Rejected</th>
                <th style={thCellRight}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {byConsultant.map((c) => (
                <tr key={c.consultant_id}>
                  <td style={td}>{c.full_name ?? '—'}</td>
                  <td style={tdMuted}>{c.email ?? '—'}</td>
                  <td style={tdRight}>{c.total}</td>
                  <td style={tdRight}>{c.active}</td>
                  <td style={{ ...tdRight, color: '#1f7a4c' }}>{c.accepted}</td>
                  <td style={{ ...tdRight, color: '#8a5a00' }}>{c.rejected}</td>
                  <td style={tdRight}>{fmtPLN(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Forecast */}
      <section style={panel}>
        <h2 style={h2}>Prognoza 12 miesięcy</h2>
        <p style={{ fontSize: 13, color: '#6b7a92', marginTop: 0 }}>
          Baseline: ø {forecast.baseline.avg_monthly_accepted} accepted/mies., {fmtPLN(forecast.baseline.avg_monthly_revenue)}
          /mies. (z {forecast.baseline.months_used} miesięcy historii). Pending uplift rozłożony na 3 najbliższe miesiące.
        </p>
        <table style={tableFull}>
          <thead>
            <tr style={th}>
              <th style={thCell}>Miesiąc</th>
              <th style={thCellRight}>Expected accepted</th>
              <th style={thCellRight}>Expected revenue</th>
              <th style={thCellRight}>z czego pending uplift</th>
            </tr>
          </thead>
          <tbody>
            {forecast.forecast.map((f) => (
              <tr key={f.month}>
                <td style={td}>{f.month}</td>
                <td style={tdRight}>{f.expected_accepted}</td>
                <td style={tdRight}>{fmtPLN(f.expected_revenue)}</td>
                <td style={{ ...tdRight, color: '#6b7a92' }}>
                  {f.pipeline_pending_revenue > 0 ? fmtPLN(f.pipeline_pending_revenue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Simulator */}
      <section style={panel}>
        <h2 style={h2}>Symulator EV</h2>
        <SimulatorPanel />
      </section>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Helpery / styles
// -----------------------------------------------------------------------------

function Card({ title, value, accent }: { title: string; value: string; accent?: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: '#6b7a92', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: accent ?? '#1B2A4A', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', color: '#6b7a92', borderBottom: '1px solid #eef1f7', width: 280 }}>{label}</td>
      <td style={{ padding: '6px 0', textAlign: 'right', borderBottom: '1px solid #eef1f7', fontWeight: 500 }}>{value}</td>
    </tr>
  );
}

const grid4: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  margin: '24px 0',
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: '16px 20px',
};
const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 20,
  marginTop: 24,
};
const h2: React.CSSProperties = { fontSize: 18, marginTop: 0, marginBottom: 12 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const tableFull: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th: React.CSSProperties = { borderBottom: '2px solid #e4e9f2' };
const thCell: React.CSSProperties = { textAlign: 'left', padding: '8px 0', fontWeight: 600, fontSize: 12, color: '#6b7a92', textTransform: 'uppercase' };
const thCellRight: React.CSSProperties = { ...thCell, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid #eef1f7' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
