/**
 * Lista ofert (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Server component — fetch przez service role + scoping po roli (consultant
 * widzi swoje, admin/super_admin widzi wszystkie). Filtry/sort/page w URL.
 *
 * Linkujemy do `/o/[token]` (publiczny URL klienta) i do `/admin/offers/[id]`
 * (edytor — PR #16). Dopóki edytor nie istnieje, link prowadzi do publicznej
 * strony oferty (read-only).
 */
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import OffersFilters from './OffersFilters';
import type { Database } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OfferStatus = Database['public']['Enums']['offer_status'];
const ALL_STATUSES: OfferStatus[] = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];

const PAGE_SIZE = 25;

export default async function OffersListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireSession();

  // Parsowanie searchParams (string | string[]). Tylko whitelist'owane wartości.
  const status = parseStatus(searchParams.status);
  const clientName = parseStr(searchParams.clientName, 200);
  const programId = parseStr(searchParams.programId, 80);
  const page = Math.max(1, Number.parseInt(parseStr(searchParams.page, 10) ?? '1', 10) || 1);
  const sort = parseSort(searchParams.sort);

  const sb = createAdminClient();

  // Programs lookup dla filtra
  const { data: programs } = await sb
    .from('programs')
    .select('id, label, group_name')
    .eq('is_active', true)
    .order('display_order');

  // Bazowe query — select w jednym stringu, żeby typegen Supabase się zatypował
  let q = sb
    .from('offers')
    .select(
      'id, offer_number, status, client_name, program_label, project_value, funding_rate, accepted_fee, accepted_variant, sent_at, accepted_at, created_at, view_count, client_token, created_by',
      { count: 'exact' },
    )
    .is('deleted_at', null);

  if (session.role === 'consultant') {
    q = q.or(`created_by.eq.${session.userId},assigned_consultant_id.eq.${session.userId}`);
  }

  if (status.length > 0) q = q.in('status', status);
  if (clientName) q = q.ilike('client_name', `%${clientName}%`);
  if (programId) q = q.eq('program_id', programId);

  q = q.order(sort.column, { ascending: sort.dir === 'asc' });
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  q = q.range(from, to);

  const { data: offers, count, error } = await q;
  if (error) {
    return (
      <main style={main}>
        <h1 style={h1}>Oferty</h1>
        <div style={errorBox}>Błąd ładowania: {error.message}</div>
      </main>
    );
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Oferty</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <Link href="/admin/offers/new" style={btnNewOffer}>
            + Nowa oferta
          </Link>
          <Link href="/admin" style={linkBack}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <p style={lead}>
        {session.role === 'consultant'
          ? 'Twoje oferty (utworzone lub przypisane).'
          : 'Wszystkie oferty w systemie.'}{' '}
        Razem: <strong>{total}</strong>.
      </p>

      <OffersFilters
        programs={programs ?? []}
        initial={{
          status,
          clientName: clientName ?? '',
          programId: programId ?? '',
          sort: searchParams.sort
            ? Array.isArray(searchParams.sort)
              ? searchParams.sort[0]
              : searchParams.sort
            : 'createdAt:desc',
        }}
      />

      <section style={panel}>
        {offers && offers.length > 0 ? (
          <table style={table}>
            <thead>
              <tr style={th}>
                <th style={thCell}>Nr / Klient</th>
                <th style={thCell}>Program</th>
                <th style={thCellRight}>Wartość</th>
                <th style={thCellCenter}>Status</th>
                <th style={thCellRight}>Fee</th>
                <th style={thCellCenter}>Views</th>
                <th style={thCell}>Daty</th>
                <th style={thCellRight}></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id}>
                  <td style={td}>
                    <div style={offerNumber}>{o.offer_number}</div>
                    <div style={clientNameStyle}>{o.client_name}</div>
                  </td>
                  <td style={tdMuted}>{o.program_label}</td>
                  <td style={tdRight}>{fmtPLN(Number(o.project_value))}</td>
                  <td style={tdCenter}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={tdRight}>
                    {o.accepted_fee != null
                      ? fmtPLN(Number(o.accepted_fee))
                      : <span style={mutedDash}>—</span>}
                  </td>
                  <td style={tdCenter}>{o.view_count}</td>
                  <td style={tdMuted}>
                    <div style={dateLine}>utw. {fmtDate(o.created_at)}</div>
                    {o.sent_at && <div style={dateLine}>wys. {fmtDate(o.sent_at)}</div>}
                    {o.accepted_at && (
                      <div style={{ ...dateLine, color: '#1f7a4c' }}>
                        akc. {fmtDate(o.accepted_at)}
                      </div>
                    )}
                  </td>
                  <td style={tdRight}>
                    <Link href={`/admin/offers/${o.id}/edit`} style={btnEdit}>
                      Edytuj
                    </Link>
                    <a
                      href={`/o/${o.client_token}`}
                      style={btnLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Podgląd ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={empty}>Brak ofert spełniających filtry.</p>
        )}
      </section>

      {lastPage > 1 && (
        <Pagination page={page} lastPage={lastPage} searchParams={searchParams} />
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// Helpers — parsing searchParams
// -----------------------------------------------------------------------------

function parseStr(v: string | string[] | undefined, max: number): string | undefined {
  if (Array.isArray(v)) v = v[0];
  if (!v || typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s || s.length > max) return undefined;
  return s;
}

function parseStatus(v: string | string[] | undefined): OfferStatus[] {
  if (Array.isArray(v)) v = v[0];
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is OfferStatus => ALL_STATUSES.includes(s as OfferStatus));
}

const SORT_MAP: Record<string, { column: string; dir: 'asc' | 'desc' }> = {
  'createdAt:desc': { column: 'created_at', dir: 'desc' },
  'createdAt:asc': { column: 'created_at', dir: 'asc' },
  'updatedAt:desc': { column: 'updated_at', dir: 'desc' },
  'projectValue:desc': { column: 'project_value', dir: 'desc' },
  'projectValue:asc': { column: 'project_value', dir: 'asc' },
  'clientName:asc': { column: 'client_name', dir: 'asc' },
  'sentAt:desc': { column: 'sent_at', dir: 'desc' },
  'acceptedAt:desc': { column: 'accepted_at', dir: 'desc' },
};

function parseSort(v: string | string[] | undefined): { column: string; dir: 'asc' | 'desc' } {
  if (Array.isArray(v)) v = v[0];
  if (v && SORT_MAP[v]) return SORT_MAP[v];
  return SORT_MAP['createdAt:desc'];
}

// -----------------------------------------------------------------------------
// Helpers — formatting
// -----------------------------------------------------------------------------

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// -----------------------------------------------------------------------------
// Sub-komponenty
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: OfferStatus }) {
  const colors: Record<OfferStatus, { bg: string; fg: string }> = {
    draft: { bg: '#eef1f7', fg: '#6b7a92' },
    sent: { bg: '#dbe8ff', fg: '#1d4ed8' },
    viewed: { bg: '#fef3c7', fg: '#92400e' },
    accepted: { bg: '#dff3e8', fg: '#1f7a4c' },
    rejected: { bg: '#fae8ea', fg: '#c92b3a' },
    expired: { bg: '#f5f5f5', fg: '#737373' },
  };
  const c = colors[status];
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {status}
    </span>
  );
}

function Pagination({
  page,
  lastPage,
  searchParams,
}: {
  page: number;
  lastPage: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const buildHref = (target: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'page') continue;
      const val = Array.isArray(v) ? v[0] : v;
      if (val) sp.set(k, val);
    }
    sp.set('page', String(target));
    return `/admin/offers?${sp.toString()}`;
  };

  return (
    <nav style={pagination}>
      {page > 1 && (
        <Link href={buildHref(page - 1)} style={pageBtn}>
          ← Poprzednia
        </Link>
      )}
      <span style={pageInfo}>
        Strona {page} z {lastPage}
      </span>
      {page < lastPage && (
        <Link href={buildHref(page + 1)} style={pageBtn}>
          Następna →
        </Link>
      )}
    </nav>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const main: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};
const topbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
};
const h1: React.CSSProperties = { fontSize: 28, marginBottom: 4 };
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const btnNewOffer: React.CSSProperties = {
  padding: '8px 16px',
  background: '#c92b3a',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  borderRadius: 6,
};
const lead: React.CSSProperties = { color: '#6b7a92', fontSize: 13, marginTop: 0, marginBottom: 24 };

const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  marginTop: 16,
  overflow: 'hidden',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th: React.CSSProperties = { background: '#f9fafc', borderBottom: '2px solid #e4e9f2' };
const thCell: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: 11,
  color: '#6b7a92',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
const thCellRight: React.CSSProperties = { ...thCell, textAlign: 'right' };
const thCellCenter: React.CSSProperties = { ...thCell, textAlign: 'center' };

const td: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #eef1f7',
  verticalAlign: 'top',
};
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92', fontSize: 13 };

const offerNumber: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
  color: '#6b7a92',
};
const clientNameStyle: React.CSSProperties = { fontWeight: 500, marginTop: 2 };
const dateLine: React.CSSProperties = { fontSize: 12 };
const mutedDash: React.CSSProperties = { color: '#cbd5e1' };

const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: '#6b7a92' };

const errorBox: React.CSSProperties = {
  padding: 16,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 14,
};

const btnLink: React.CSSProperties = {
  fontSize: 12,
  color: '#c92b3a',
  textDecoration: 'none',
  fontWeight: 500,
  marginLeft: 12,
};
const btnEdit: React.CSSProperties = {
  fontSize: 12,
  color: '#1B2A4A',
  textDecoration: 'none',
  fontWeight: 500,
};

const pagination: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 16,
  marginTop: 24,
  fontSize: 14,
};
const pageBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  color: '#1B2A4A',
  textDecoration: 'none',
  fontWeight: 500,
};
const pageInfo: React.CSSProperties = { color: '#6b7a92' };
