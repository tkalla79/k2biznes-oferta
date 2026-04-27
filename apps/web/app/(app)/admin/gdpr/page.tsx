/**
 * Admin GDPR queue — żądania RODO (BACKEND_SPEC.md v1.1.1, sekcja 11.4).
 *
 * Tylko super_admin (sprawdzane w SQL przez RLS na `data_deletion_requests`
 * + handler API `requireSuperAdmin`).
 */
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import GdprRequestActions from './GdprRequestActions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function GdprQueuePage() {
  await requireSuperAdmin();

  const sb = createAdminClient();
  const { data: requests } = await sb
    .from('data_deletion_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  return (
    <main style={main}>
      <h1 style={h1}>RODO — żądania usunięcia</h1>
      <p style={lead}>
        Sekcja 11.4 spec&apos;a. Workflow: <code>requested → approved → executed</code> lub{' '}
        <code>rejected</code>. Każda decyzja loguje się do <code>audit_log</code>.
      </p>

      {!requests || requests.length === 0 ? (
        <p style={empty}>Brak żądań.</p>
      ) : (
        <div style={list}>
          {requests.map((r) => (
            <article key={r.id} style={card}>
              <header style={cardHeader}>
                <span style={statusBadge(r.status)}>{r.status}</span>
                <span style={{ fontSize: 13, color: '#6b7a92' }}>
                  {new Date(r.requested_at).toLocaleString('pl-PL')}
                </span>
              </header>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                <strong>{r.email}</strong>
              </div>
              {r.reason && (
                <div style={reason}>
                  <em>&ldquo;{r.reason}&rdquo;</em>
                </div>
              )}
              {r.notes && (
                <div style={{ fontSize: 13, color: '#6b7a92', marginTop: 8 }}>
                  Notatki: {r.notes}
                </div>
              )}
              {r.reject_reason && (
                <div style={{ fontSize: 13, color: '#8a5a00', marginTop: 8 }}>
                  Odrzucono: {r.reject_reason}
                </div>
              )}
              {r.executed_at && (
                <div style={{ fontSize: 13, color: '#1f7a4c', marginTop: 8 }}>
                  Wykonano: {new Date(r.executed_at).toLocaleString('pl-PL')}
                </div>
              )}
              <GdprRequestActions
                id={r.id}
                status={r.status}
                idDisplay={r.id.slice(0, 8)}
              />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

const main: React.CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};
const h1: React.CSSProperties = { fontSize: 28, marginBottom: 8 };
const lead: React.CSSProperties = { fontSize: 14, color: '#6b7a92', marginBottom: 24 };
const empty: React.CSSProperties = {
  padding: 24,
  background: '#f5f3ee',
  textAlign: 'center',
  borderRadius: 6,
  color: '#6b7a92',
};
const list: React.CSSProperties = { display: 'grid', gap: 12 };
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 20,
};
const cardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};
const reason: React.CSSProperties = {
  background: '#f5f3ee',
  padding: 8,
  borderRadius: 4,
  fontSize: 14,
  borderLeft: '3px solid #c92b3a',
};

function statusBadge(status: string): React.CSSProperties {
  const styles: Record<string, { bg: string; fg: string }> = {
    requested: { bg: '#fbf0d8', fg: '#8a5a00' },
    approved: { bg: '#dff3e8', fg: '#1f7a4c' },
    executed: { bg: '#e3f2fd', fg: '#1565c0' },
    rejected: { bg: '#fae8ea', fg: '#c92b3a' },
  };
  const s = styles[status] ?? { bg: '#eef1f7', fg: '#6b7a92' };
  return {
    backgroundColor: s.bg,
    color: s.fg,
    padding: '4px 10px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
  };
}
