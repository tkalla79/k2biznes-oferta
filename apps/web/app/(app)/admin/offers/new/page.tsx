/**
 * Nowa oferta (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Server component — pobiera lookupy (programy, case studies, contact persons)
 * i renderuje współdzielony `OfferForm` w trybie "create". Submit hits
 * POST /api/offers, redirect do `/admin/offers/[id]/edit`.
 */
import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import OfferForm from '../OfferForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewOfferPage() {
  const session = await requireSession();
  const isAdmin = session.role === 'admin' || session.role === 'super_admin';

  const sb = createAdminClient();
  const [
    { data: programs },
    { data: caseStudies },
    { data: contactPersons },
    { data: altProgramLibrary },
    { data: templates },
    profilesRes,
  ] = await Promise.all([
    sb.from('programs').select('id, label, group_name').eq('is_active', true).order('display_order'),
    sb.from('case_studies').select('id, client, title').eq('is_active', true).order('display_order'),
    sb
      .from('contact_persons')
      .select('id, name, role')
      .eq('is_active', true)
      .order('display_order'),
    sb
      .from('alt_programs')
      .select('id, name, program, nabor, desc, url')
      .eq('is_active', true)
      .order('display_order'),
    sb.from('offer_templates').select('id, name').order('created_at', { ascending: false }),
    isAdmin
      ? sb
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string; role: string }[] }),
  ]);

  return (
    <main style={main}>
      <header style={topbar}>
        <h1 style={h1}>Nowa oferta</h1>
        <Link href="/admin/offers" style={linkBack}>
          ← Lista ofert
        </Link>
      </header>

      <OfferForm
        mode="create"
        programs={programs ?? []}
        caseStudies={caseStudies ?? []}
        contactPersons={contactPersons ?? []}
        profiles={profilesRes.data ?? []}
        canAssignConsultant={isAdmin}
        altProgramLibrary={altProgramLibrary ?? []}
        templates={templates ?? []}
      />
    </main>
  );
}

const main: React.CSSProperties = {
  maxWidth: 980,
  margin: '0 auto',
  padding: 32,
  fontFamily: 'system-ui, sans-serif',
};
const topbar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 24,
};
const h1: React.CSSProperties = { fontSize: 28, margin: 0 };
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
