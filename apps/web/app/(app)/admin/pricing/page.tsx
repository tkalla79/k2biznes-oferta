/**
 * Cennik — edycja segmentów i parametrów globalnych (super_admin).
 *
 * `lib/pricing/load.ts` od początku zakładał, że stawki zmienia się z panelu
 * ("segmenty zmieniają się rzadko — super_admin przez admin UI"), ale ekranu
 * nikt nie zbudował i jedyną drogą był SQL w Supabase. To ten ekran.
 */
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import PricingForm from './PricingForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PricingAdminPage() {
  // Admin (non-super) → redirect zamiast rzuconego 403 (wzorzec z /admin/users).
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof ApiError && e.code === 'FORBIDDEN') {
      redirect('/admin');
    }
    throw e;
  }

  const sb = createAdminClient();
  const [segRes, cfgRes] = await Promise.all([
    sb.from('pricing_segments').select('*').order('display_order'),
    sb.from('pricing_config').select('*').eq('id', 'global').single(),
  ]);

  if (segRes.error || cfgRes.error || !cfgRes.data) {
    return (
      <main style={main}>
        <h1 style={h1}>Cennik</h1>
        <div style={errorBox}>
          Nie udało się wczytać cennika: {segRes.error?.message ?? cfgRes.error?.message}
        </div>
      </main>
    );
  }

  return (
    <main style={main}>
      <h1 style={h1}>Cennik</h1>
      <p style={lead}>
        Stawki, na których silnik liczy wyceny ofert dotacyjnych. Zmiana wchodzi od razu dla
        nowych ofert. Oferty pożyczkowe mają własny model (opłata wstępna + procent od kwoty
        pożyczki) ustawiany per oferta i nie korzystają z tych segmentów.
      </p>
      <PricingForm segments={segRes.data ?? []} config={cfgRes.data} />
    </main>
  );
}

const main: React.CSSProperties = { padding: '28px 32px', maxWidth: 1200, margin: '0 auto' };
const h1: React.CSSProperties = { margin: '0 0 6px', fontSize: 26, color: '#1B2A4A' };
const lead: React.CSSProperties = {
  margin: '0 0 22px',
  fontSize: 13.5,
  color: '#6b7a92',
  lineHeight: 1.6,
  maxWidth: 760,
};
const errorBox: React.CSSProperties = {
  padding: '12px 16px',
  background: '#fdecee',
  border: '1px solid #f3c4ca',
  borderRadius: 8,
  fontSize: 13,
  color: '#a3202b',
};
