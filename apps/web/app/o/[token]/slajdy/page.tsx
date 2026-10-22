/**
 * PROTOTYP: oferta jako slajdy 16:9 (PDF 1280x720).
 *
 * Osobna trasa obok /o/[token]. Nie zmienia strony oferty ani produkcyjnego
 * PDF (/api/public/offers/[token]/pdf, lib/pdf/render.ts). PDF lokalnie:
 * scripts/render-slides-pdf.mjs.
 *
 * Ograniczenia prototypu:
 * - tylko oferty dotacyjne (offer_kind='grant'); pożyczka i zakres 2 mają
 *   inną treść (staticContent.ts) i dostają komunikat,
 * - 12 slajdów (okładka, 01, 02, 03, 03b, 04, 04b, 04c, 05, 06, 07, 08); slajdy
 *   z tekstem konsultanta (01, 04b, 04c) są tylko wtedy, gdy oferta ma ten tekst,
 * - bez podglądu draftu i bez trackingu zdarzeń (nie ma ViewTracker),
 * - dane przygotowywane tu osobno od page.tsx. Gdy trasa wejdzie do
 *   produktu, wspólne przygotowanie danych trzeba wyciągnąć z page.tsx,
 *   żeby oba widoki się nie rozjechały.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicOffer } from '@/lib/offers/public';
import { toPublicOfferDto } from '@/lib/offers/mapper';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import { normalizeOfferKind } from '@/lib/offers/kind';
import { sanitizeRichText, sanitizeProse } from '@/lib/richtext';
import type { PricingVariant } from '@/lib/pricing';
import { SCOPE_PREP, CULTURE_SCOPE_PREP, SCOPE_EXEC, CULTURE_SCOPE_EXEC, PROCESS, FAQ_ITEMS } from '../staticContent';
import { CoverSlide, ProgramSlide, PricingSlide, ClosingSlide, statusBadge } from './slides';
import { ScopeSlide, ProcessSlide, FaqSlide } from './slides-info';
import { IntroSlide, BulletsSlide, NotesSlide, AboutSlide, resolveNotesExec } from './slides-text';
import './slajdy.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: { token: string } };

/**
 * Tytuł trafia do metadanych PDF (pole Title), więc zobaczy go klient w
 * czytniku. Jak na stronie oferty: nazwa klienta, a przy błędzie (zły token,
 * wygasła oferta) tytuł ogólny, bez żadnych danych.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const robots = { index: false, follow: false };
  try {
    const { offer } = await fetchPublicOffer(params.token);
    return { title: `Oferta K2Biznes · ${offer.client_name}`, robots };
  } catch {
    return { title: 'Oferta K2Biznes', robots };
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pl-PL');

export default async function SlidesPage({ params }: Props) {
  // Draft i wygasła oferta dają 404, tak jak na stronie klienta. Oferta zaakceptowana
  // lub odrzucona jest zwracana z isActive=false i dostaje oznaczenie na okładce.
  const { offer, isActive } = await fetchPublicOffer(params.token).catch((e) => {
    if (e instanceof ApiError && (e.status === 404 || e.status === 410)) notFound();
    throw e;
  });

  const sb = createAdminClient();
  const [contactRes, faqRes, statsRes] = await Promise.all([
    offer.contact_person_id
      ? sb.from('contact_persons').select('*').eq('id', offer.contact_person_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Jak w page.tsx: pytania z bazy (edytowalne w panelu), a bez nich stałe FAQ_ITEMS.
    sb
      .from('faq_items')
      .select('id, question, answer')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('display_order'),
    // Statystyki firmowe z ustawień (edytowalne w /admin/ustawienia), jak w page.tsx.
    sb.from('app_settings').select('value').eq('key', 'company_stats').maybeSingle(),
  ]);
  const dto = toPublicOfferDto(offer, contactRes.data ?? null, null);

  if (normalizeOfferKind(dto.offerKind) !== 'grant') {
    return <div className="slajdy-note">Prototyp slajdów obsługuje tylko oferty dotacyjne.</div>;
  }

  const content = (dto.content ?? {}) as {
    programDescription?: string;
    altPrograms?: Array<{ name: string; program?: string; nabor?: string; desc?: string; recommended?: boolean }>;
    execIncluded?: boolean;
    recommendationBasis?: string;
    calcBullets?: unknown;
    notes?: unknown;
  };
  const reco = (Array.isArray(content.altPrograms) ? content.altPrograms : []).find((p) => p.recommended) ?? null;
  // Program Kultura (EOG) ukrywa blok opłaty wykonawczej, jak w page.tsx.
  const isCulture = /\b(EOG|norwesk)/i.test(`${reco?.program ?? ''} ${reco?.name ?? ''}`);

  const rawVariants = (dto.pricingSnapshot as { variants?: unknown }).variants;
  const variants = (Array.isArray(rawVariants) ? (rawVariants as PricingVariant[]) : []).filter((v) =>
    dto.offeredVariants.includes(v.id),
  );
  const funding =
    (dto.pricingSnapshot as { funding?: number }).funding ?? dto.projectValue * dto.fundingRate;

  // Oferta łączona: obsługa i rozliczanie w cenie, nie jako opcja.
  const execIncluded = content.execIncluded === true;
  // Ten sam tekst co na stronie: w ofercie łączonej kicker bez dopisku „(opcjonalnie)".
  const execKicker = execIncluded
    ? dto.execFee.kicker.replace(/\s*\(opcjonalnie\)\s*$/i, '')
    : dto.execFee.kicker;

  // Zakres: dwa bloki jak w ScopeAccordion (przygotowanie + obsługa i rozliczanie).
  const prep = isCulture ? CULTURE_SCOPE_PREP : SCOPE_PREP;
  const exec = isCulture ? CULTURE_SCOPE_EXEC : SCOPE_EXEC;
  const tabs = [
    { no: '01', label: 'Przygotowanie dokumentacji', tag: 'w cenie oferty' },
    ...(exec.length > 0
      ? [{ no: '02', label: 'Obsługa i rozliczanie projektu', tag: execIncluded ? 'w cenie oferty' : 'opcjonalne' }]
      : []),
  ];
  const faqRows = (faqRes.data ?? []) as Array<{ id: string; question: string; answer: string }>;
  const faq = faqRows.length > 0 ? faqRows.map((f) => ({ q: f.question, a: f.answer })) : FAQ_ITEMS;
  // Teksty konsultanta: `content` to jsonb bez gwarancji typów, więc normalizujemy jak page.tsx.
  const recommendationBasisHtml = sanitizeProse(content.recommendationBasis);
  const calcBullets = Array.isArray(content.calcBullets)
    ? content.calcBullets.filter((b): b is string => typeof b === 'string' && b.trim() !== '')
    : [];
  const notes = typeof content.notes === 'string' ? content.notes.trim() : '';
  const selected = variants.find((v) => v.id === dto.selectedVariant) ?? variants[0] ?? null;
  const notesData = {
    exec: resolveNotesExec({
      hidden: isCulture,
      selected,
      execMonthly: dto.execFee.monthly,
      kicker: execKicker,
      desc: dto.execFee.desc,
    }),
    notes,
  };
  // Staty firmowe: te same wartości zapasowe co w page.tsx.
  const cs = (statsRes.data?.value ?? {}) as { funding?: string; projects?: string; since?: string };
  const companyStats = {
    funding: cs.funding || '475 mln zł',
    projects: cs.projects || '288',
    since: cs.since || 'od 2015',
  };
  const footer = `Oferta ${dto.offerNumber} · ${dto.clientName}`;
  const validUntil = offer.expires_at ? fmtDate(offer.expires_at) : null;

  return (
    <main className="slajdy">
      <CoverSlide
        d={{
          offerNumber: dto.offerNumber,
          dateLabel: fmtDate(offer.sent_at ?? offer.created_at),
          clientName: dto.clientName,
          programLabel: dto.programLabel,
          validUntil,
          execIncluded,
          status: statusBadge(dto.status, isActive),
        }}
      />
      {recommendationBasisHtml && (
        <IntroSlide no="01" footer={footer} clientName={dto.clientName} html={recommendationBasisHtml} />
      )}
      <ProgramSlide
        no="02"
        footer={footer}
        d={{
          programLabel: dto.programLabel,
          reco,
          descriptionHtml: sanitizeRichText(content.programDescription),
        }}
      />
      <ScopeSlide
        no="03"
        footer={footer}
        d={{
          headStart: 'Co dokładnie robimy ',
          headEm: 'dla Państwa projektu',
          lead: 'Szczegółowy zakres prac na etapie przygotowania kompletnej dokumentacji aplikacyjnej dla Projektu.',
          tabs,
          active: 0,
          items: prep,
        }}
      />
      {exec.length > 0 && (
        <ScopeSlide
          no="03b"
          footer={footer}
          d={{
            headStart: 'Obsługa i ',
            headEm: 'rozliczanie projektu',
            lead: 'Po pozytywnej decyzji o dofinansowaniu klient może kontynuować współpracę przy obsłudze i rozliczeniu dofinansowanego projektu.',
            tabs,
            active: 1,
            items: exec,
          }}
        />
      )}
      <PricingSlide
        no="04"
        footer={footer}
        d={{
          variants,
          selectedId: dto.selectedVariant,
          projectValue: dto.projectValue,
          fundingRate: dto.fundingRate,
          funding,
          execFee: isCulture
            ? null
            : { label: `${execKicker}: ${dto.execFee.title}`, monthly: dto.execFee.monthly },
        }}
      />
      {calcBullets.length > 0 && <BulletsSlide no="04b" footer={footer} bullets={calcBullets} />}
      {(notesData.exec || notesData.notes) && <NotesSlide no="04c" footer={footer} d={notesData} />}
      <ProcessSlide no="05" footer={footer} steps={PROCESS} />
      <AboutSlide no="06" footer={footer} stats={companyStats} />
      <FaqSlide no="07" footer={footer} items={faq} />
      <ClosingSlide no="08" footer={footer} d={{ contact: dto.contactPerson, validUntil }} />
    </main>
  );
}
