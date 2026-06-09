/**
 * Users admin — invite + role management (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Server component — fetch profiles przez service role, RLS już blokuje
 * non-super_admin (sekcja 4.1.1).
 */
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import UsersTable from './UsersTable';
import InviteForm from './InviteForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function UsersAdminPage() {
  // Admin (non-super) probujacy wejsc → clean redirect zamiast unhandled throw.
  // Wczesniej (2026-06-09): kazdy admin click na link „/admin/users" w nav
  // wysylal email z Sentry („ApiError: Wymagana rola super_admin"). Teraz:
  // 403 → redirect na /admin (panel dostepny dla admina), bez Sentry capture.
  let session;
  try {
    session = await requireSuperAdmin();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'FORBIDDEN') {
      redirect('/admin');
    }
    throw e;
  }

  const sb = createAdminClient();
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, email, full_name, role, is_active, deleted_at, created_at')
    .order('created_at', { ascending: false });

  const active = (profiles ?? []).filter((p) => p.is_active && !p.deleted_at);

  return (
    <main style={main}>
      <h1 style={h1}>Użytkownicy</h1>
      <p style={lead}>
        Lista wszystkich aktywnych userów. Tylko super_admin może zapraszać i zmieniać role
        (sekcja 7.3 + 7.5 spec).
      </p>

      <section style={panel}>
        <h2 style={h2}>Zaproś nowego użytkownika</h2>
        <InviteForm />
      </section>

      <section style={panel}>
        <h2 style={h2}>Aktywni ({active.length})</h2>
        <UsersTable users={active} currentUserId={session.userId} />
      </section>
    </main>
  );
}

const main: React.CSSProperties = {
  maxWidth: 1000,
  margin: '0 auto',
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};
const h1: React.CSSProperties = { fontSize: 28, marginBottom: 8 };
const h2: React.CSSProperties = { fontSize: 18, marginTop: 0, marginBottom: 16 };
const lead: React.CSSProperties = { fontSize: 14, color: '#6b7a92', marginBottom: 24 };
const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 24,
  marginBottom: 20,
};
