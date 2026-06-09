/**
 * Edycja oferty (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Server component — pobiera ofertę + lookupy + walidu uprawnień (consultant
 * widzi tylko swoje, admin/super_admin wszystko). Render `OfferForm` w trybie
 * "edit". Submit hits PATCH /api/offers/[id].
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { toOfferDto } from '@/lib/offers/mapper';
import OfferForm from '../../OfferForm';
import OfferActions from '../../OfferActions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditOfferPage({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) notFound();

  const session = await requireSession();
  const sb = createAdminClient();
  const isAdmin = session.role === 'admin' || session.role === 'super_admin';

  const [
    { data: offer },
    { data: programs },
    { data: caseStudies },
    { data: contactPersons },
    { data: altProgramLibrary },
    profilesRes,
  ] = await Promise.all([
    sb.from('offers').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle(),
    sb.from('programs').select('id, label, group_name').eq('is_active', true).order('display_order'),
    sb.from('case_studies').select('id, client, title').eq('is_active', true).order('display_order'),
    sb.from('contact_persons').select('id, name, role').eq('is_active', true).order('display_order'),
    sb.from('alt_programs').select('id, name, program, nabor, desc, url').eq('is_active', true).order('display_order'),
    // assignedConsultantId select tylko dla admina; consultant nie może zmienić
    // właściciela. Pusta lista pomijana w UI.
    isAdmin
      ? sb
          .from('profiles')
          .select('id, full_name, email, role')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string; role: string }[] }),
  ]);
  const profiles = profilesRes.data ?? [];

  if (!offer) notFound();

  // Ownership check (defense in depth — RLS też to zrobi)
  if (
    session.role === 'consultant' &&
    offer.created_by !== session.userId &&
    offer.assigned_consultant_id !== session.userId
  ) {
    notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const dto = toOfferDto(offer, appUrl);

  return (
    <main style={main}>
      <header style={topbar}>
        <div>
          <h1 style={h1}>{offer.client_name}</h1>
          <p style={subtitle}>
            <span style={offerNumber}>{offer.offer_number}</span> · status{' '}
            <strong>{offer.status}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <a
            href={offer.status === 'draft' ? `${dto.clientUrl}?__preview=1` : dto.clientUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={linkPreview}
          >
            {offer.status === 'draft' ? 'Podgląd (draft) ↗' : 'Podgląd klienta ↗'}
          </a>
          <Link href="/admin/offers" style={linkBack}>
            ← Lista
          </Link>
        </div>
      </header>

      <OfferActions
        offerId={offer.id}
        offerNumber={offer.offer_number}
        clientToken={offer.client_token}
        clientName={offer.client_name}
        status={offer.status}
        canDelete={isAdmin}
      />

      <OfferForm
        mode="edit"
        offer={dto}
        programs={programs ?? []}
        caseStudies={caseStudies ?? []}
        contactPersons={contactPersons ?? []}
        profiles={profiles}
        canAssignConsultant={isAdmin}
        altProgramLibrary={altProgramLibrary ?? []}
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
const h1: React.CSSProperties = { fontSize: 24, margin: 0, marginBottom: 4 };
const subtitle: React.CSSProperties = { color: '#6b7a92', fontSize: 13, margin: 0 };
const offerNumber: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
};
const linkBack: React.CSSProperties = { fontSize: 13, color: '#6b7a92', textDecoration: 'none' };
const linkPreview: React.CSSProperties = {
  fontSize: 13,
  color: '#c92b3a',
  textDecoration: 'none',
  fontWeight: 500,
};
