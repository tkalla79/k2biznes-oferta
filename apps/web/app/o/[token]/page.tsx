/**
 * Public offer view (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Server component — fetch przez service role z DB, brak auth klienta.
 * Skeleton MVP. Pełny render branded'owy (OFERTA_INTERAKTYWNA) w osobnym PR.
 */
import { notFound } from 'next/navigation';
import { fetchPublicOffer } from '@/lib/offers/public';
import { toPublicOfferDto } from '@/lib/offers/mapper';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import ViewTracker from './ViewTracker';
import AcceptForm from './AcceptForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: { token: string }; searchParams: { print?: string } };

export default async function OfferPage({ params, searchParams }: Props) {
  let offer;
  let isActive: boolean;
  try {
    const ctx = await fetchPublicOffer(params.token);
    offer = ctx.offer;
    isActive = ctx.isActive;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 410)) {
      notFound();
    }
    throw e;
  }

  const sb = createAdminClient();
  const [contactRes, caseRes, gdprRes] = await Promise.all([
    offer.contact_person_id
      ? sb.from('contact_persons').select('*').eq('id', offer.contact_person_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    offer.case_study_id
      ? sb.from('case_studies').select('*').eq('id', offer.case_study_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.from('gdpr_clauses').select('version, text').eq('is_current', true).maybeSingle(),
  ]);

  const dto = toPublicOfferDto(offer, contactRes.data ?? null, caseRes.data ?? null);
  const gdpr = gdprRes.data ?? null;
  const isPrint = searchParams.print === 'true';

  const fmt = (n: number) =>
    n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: isPrint ? 24 : '48px 24px' }}>
      {!isPrint && <ViewTracker token={params.token} />}

      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#6b7a92', letterSpacing: 1 }}>
          OFERTA · {dto.offerNumber}
        </div>
        <h1
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontSize: 44,
            fontWeight: 500,
            margin: '8px 0 4px',
            lineHeight: 1.05,
          }}
        >
          {dto.clientName}
        </h1>
        <div style={{ fontSize: 18, color: '#2a3a5c' }}>{dto.programLabel}</div>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Założenia</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Row label="Wartość projektu" value={fmt(dto.projectValue)} />
            <Row label="Intensywność dofinansowania" value={`${(dto.fundingRate * 100).toFixed(0)}%`} />
            <Row label="Kwota dofinansowania" value={fmt(dto.pricingSnapshot.funding)} />
            <Row label="Segment cenowy" value={dto.pricingSnapshot.segment.label} />
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Warianty wynagrodzenia</h2>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr' }}>
          {dto.pricingSnapshot.variants
            .filter((v) => dto.offeredVariants.includes(v.id))
            .map((v) => (
              <article
                key={v.id}
                style={{
                  border: '1px solid #e4e9f2',
                  borderRadius: 8,
                  padding: 20,
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 13, color: '#6b7a92' }}>{v.tag}</div>
                <h3 style={{ margin: '4px 0 12px', fontSize: 22 }}>{v.name}</h3>
                <table style={{ width: '100%', fontSize: 15 }}>
                  <tbody>
                    <Row label="Opłata wstępna" value={fmt(v.base)} />
                    <Row label={`Sukces fee (${(v.sfPct * 100).toFixed(2)}%)`} value={fmt(v.sfAmount)} />
                    {v.monthly > 0 && <Row label="Opłata miesięczna" value={fmt(v.monthly)} />}
                    <Row label="Razem" value={fmt(v.total)} bold />
                  </tbody>
                </table>
              </article>
            ))}
        </div>
      </section>

      {dto.caseStudy && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Referencja</h2>
          <article
            style={{ border: '1px solid #e4e9f2', borderRadius: 8, padding: 20, background: '#fff' }}
          >
            <div style={{ fontSize: 13, color: '#c92b3a', marginBottom: 4 }}>
              {dto.caseStudy.tag}
            </div>
            <h3 style={{ margin: '0 0 8px' }}>{dto.caseStudy.client}</h3>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{dto.caseStudy.paragraph1}</p>
          </article>
        </section>
      )}

      {dto.contactPerson && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Kontakt</h2>
          <div style={{ fontSize: 15 }}>
            <strong>{dto.contactPerson.name}</strong> · {dto.contactPerson.role}
            {dto.contactPerson.email && <div style={{ color: '#6b7a92' }}>{dto.contactPerson.email}</div>}
            {dto.contactPerson.phone && <div style={{ color: '#6b7a92' }}>{dto.contactPerson.phone}</div>}
          </div>
        </section>
      )}

      {!isPrint && isActive && gdpr && (
        <AcceptForm
          token={params.token}
          offeredVariants={dto.offeredVariants}
          defaultVariant={dto.selectedVariant}
          gdprClauseVersion={gdpr.version}
          gdprText={gdpr.text}
        />
      )}

      {!isActive && (
        <div
          style={{
            background: '#dff3e8',
            border: '1px solid #1f7a4c',
            borderRadius: 8,
            padding: 16,
            marginTop: 24,
            color: '#1f7a4c',
          }}
        >
          {dto.status === 'accepted' && 'Oferta została zaakceptowana. Dziękujemy.'}
          {dto.status === 'rejected' && 'Oferta została odrzucona.'}
          {dto.status === 'expired' && 'Oferta wygasła.'}
        </div>
      )}
    </main>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', color: '#6b7a92', borderBottom: '1px solid #eef1f7' }}>{label}</td>
      <td
        style={{
          padding: '6px 0',
          textAlign: 'right',
          fontWeight: bold ? 600 : 400,
          borderBottom: '1px solid #eef1f7',
        }}
      >
        {value}
      </td>
    </tr>
  );
}
