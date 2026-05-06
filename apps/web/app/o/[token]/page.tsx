/**
 * Public offer view (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Design: Claude Design "Oferta K2Biznes" (corporate variant).
 * 11 sekcji: hero, intro, program, zakres, cennik, proces, after, onas
 * (zawiera logos), case, faq, akcept. Topnav + footer.
 *
 * Server-side rendering. Małe interaktywne komponenty client-side:
 * CountUp, FaqAccordion, ScopeAccordion, ProcessTimeline, AcceptForm.
 */
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { fetchPublicOffer } from '@/lib/offers/public';
import { toPublicOfferDto } from '@/lib/offers/mapper';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import RevealOnScroll from './RevealOnScroll';
import ViewTracker from './ViewTracker';
import CountUp from './CountUp';
import FaqAccordion from './FaqAccordion';
import ScopeAccordion from './ScopeAccordion';
import ProcessTimeline from './ProcessTimeline';
import AcceptForm from './AcceptForm';
import { sanitizeRichText } from '@/lib/richtext';
import {
  NEEDS,
  PROGRAM_BULLETS,
  ALT_PROGRAMS,
  SCOPE_PREP,
  SCOPE_EXEC,
  PROCESS,
  FAQ_ITEMS,
} from './staticContent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = {
  params: { token: string };
  searchParams: { print?: string; __preview?: string };
};

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pl-PL');

/**
 * Auth gate dla preview draftu (sesja konsultanta lub admin).
 */
async function isAuthorizedPreview(offerCreatedBy: string | null): Promise<boolean> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (_n: string, _v: string, _o: CookieOptions) => {},
        remove: (_n: string, _o: CookieOptions) => {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const role = (user.app_metadata as { role?: string } | undefined)?.role;
  return role === 'admin' || role === 'super_admin' || user.id === offerCreatedBy;
}

export default async function OfferPage({ params, searchParams }: Props) {
  const wantsPreview = searchParams.__preview === '1';
  let offer;
  let isActive: boolean;
  let isPreview = false;
  try {
    const ctx = await fetchPublicOffer(params.token, { allowDraft: wantsPreview });
    offer = ctx.offer;
    isActive = ctx.isActive;
    if (offer.status === 'draft') {
      const ok = await isAuthorizedPreview(offer.created_by);
      if (!ok) notFound();
      isPreview = true;
    }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 410)) notFound();
    throw e;
  }

  const sb = createAdminClient();
  const [contactRes, caseRes, gdprRes, faqRes] = await Promise.all([
    offer.contact_person_id
      ? sb.from('contact_persons').select('*').eq('id', offer.contact_person_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    offer.case_study_id
      ? sb.from('case_studies').select('*').eq('id', offer.case_study_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.from('gdpr_clauses').select('version, text').eq('is_current', true).maybeSingle(),
    sb
      .from('faq_items')
      .select('id, question, answer')
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('display_order'),
  ]);

  const dto = toPublicOfferDto(offer, contactRes.data ?? null, caseRes.data ?? null);
  const faqRows = (faqRes.data ?? []) as Array<{ id: string; question: string; answer: string }>;
  const isPrint = searchParams.print === 'true';

  // Variants — z pricing_snapshot, filtrowane przez offered_variants. Wybrany na końcu.
  const variants = dto.pricingSnapshot.variants.filter((v) =>
    dto.offeredVariants.includes(v.id),
  );
  const selectedVariant =
    variants.find((v) => v.id === dto.selectedVariant) ?? variants[0] ?? null;
  const funding = dto.pricingSnapshot.funding;

  // Treść z offer.content (intro/footer textareas z OfferForm) lub default.
  const content = (dto.content ?? {}) as {
    intro?: string;
    footer?: string;
    programDescription?: string;
    altPrograms?: Array<{ name: string; program: string; nabor: string; desc: string; url: string }>;
  };
  const programDescriptionHtml = sanitizeRichText(content.programDescription);
  const altPrograms =
    Array.isArray(content.altPrograms) && content.altPrograms.length > 0
      ? content.altPrograms
      : ALT_PROGRAMS;

  // Status / preview banners
  const previewBanner = isPreview ? (
    <div className="fixed-banner banner-preview">
      Podgląd wersji roboczej — klient nie widzi tej oferty dopóki nie zostanie wysłana.
    </div>
  ) : null;
  const statusBanner =
    !isActive &&
    (dto.status === 'accepted' || dto.status === 'rejected' || dto.status === 'expired') ? (
      <div className={`fixed-banner banner-${dto.status}`}>
        {dto.status === 'accepted' && 'Oferta zaakceptowana — dziękujemy.'}
        {dto.status === 'rejected' && 'Oferta odrzucona.'}
        {dto.status === 'expired' && 'Oferta wygasła.'}
      </div>
    ) : null;

  return (
    <>
      {!isPrint && !isPreview && isActive && <ViewTracker token={params.token} />}
      {!isPrint && <RevealOnScroll />}
      {previewBanner}
      {statusBanner}

      {/* ==================== TOP NAV ==================== */}
      {!isPrint && (
        <nav className="topnav">
          <div className="topnav-inner">
            <a href="#hero" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding-v2/k2-logo.png" alt="K2 Biznes" />
            </a>
            <ul>
              <li><a href="#intro">Wprowadzenie</a></li>
              <li><a href="#program">Program</a></li>
              <li><a href="#zakres">Zakres</a></li>
              <li><a href="#cennik">Wycena</a></li>
              <li><a href="#proces">Proces</a></li>
              <li><a href="#onas">O nas</a></li>
              <li><a href="#case">Referencje</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <a
                href={`/api/public/offers/${params.token}/pdf`}
                className="pdf-download"
                title="Pobierz ofertę jako PDF"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 1v9m0 0l-3-3m3 3l3-3M2 13v1a1 1 0 001 1h10a1 1 0 001-1v-1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                PDF
              </a>
              {isActive && (
                <a href="#akcept" className="cta-mini">
                  Akceptuję ofertę →
                </a>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className="app">
        {/* ==================== 01. HERO ==================== */}
        <section id="hero" className="hero">
          <div className="hero-bg">
            <div className="hero-rings float-1" aria-hidden>
              <img src="/branding-v2/ring-gap.png" alt="" />
            </div>
          </div>
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="dot" /> {dto.offerNumber} ·{' '}
              {fmtDate(offer.sent_at ?? offer.created_at)}
            </div>
            <h1 className="hero-title">
              Wsparcie doradcze<br />
              w zakresie przygotowania<br />
              <em>projektu</em>
            </h1>
            <div className="hero-for">
              Oferta przygotowana dla
              <span className="hero-client">{dto.clientName}</span>
            </div>
            <div className="hero-program">
              <span>Program:</span>
              <strong>{dto.programLabel}</strong>
            </div>
            <div className="hero-foot">
              <div className="hero-foot-item">
                <strong>475 mln zł</strong>
                <span>pozyskanego dofinansowania</span>
              </div>
              <div className="divider" />
              <div className="hero-foot-item">
                <strong>288</strong>
                <span>zrealizowanych projektów</span>
              </div>
              <div className="divider" />
              <div className="hero-foot-item">
                <strong>od 2015</strong>
                <span>doradztwo i projekty UE</span>
              </div>
            </div>
            {!isPrint && (
              <a href="#intro" className="hero-scroll">
                <span>Przewiń ofertę</span>
                <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
                  <rect x="1" y="1" width="12" height="20" rx="6" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="7" cy="7" r="1.5" fill="currentColor">
                    <animate attributeName="cy" values="6;14;6" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </a>
            )}
          </div>
        </section>

        {/* ==================== 02. INTRO ==================== */}
        <section id="intro" className="section intro reveal">
          <div className="section-head">
            <div className="section-kicker">01 · Wprowadzenie</div>
            <h2>
              Wsparcie doradcze szyte na miarę <em>{dto.clientName}</em>
            </h2>
          </div>
          <div className="intro-grid">
            <div className="intro-copy">
              <p className="lead">
                {content.intro ??
                  'Dziękujemy za rozmowę i zainteresowanie współpracą z K2Biznes. Poniżej przedstawiamy ofertę wsparcia doradczego w zakresie przygotowania projektu w ramach programu Fundusze Europejskie dla Nowoczesnej Gospodarki 2021–2027.'}
              </p>
              <p>
                Na podstawie przeprowadzonych rozmów oraz przekazanych materiałów zidentyfikowaliśmy
                kluczowe potrzeby Państwa przedsiębiorstwa.
              </p>
              {/* Kafelek "Klient + numer oferty" usunięty — duplikuje info z hero (PR #27 feedback) */}
            </div>
            <ul className="needs-list">
              {NEEDS.map((n, i) => (
                <li key={i} style={{ ['--i' as string]: i } as React.CSSProperties}>
                  <div className="need-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="need-body">
                    <h4>{n.k}</h4>
                    <p>{n.v}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ==================== 03. PROGRAM ==================== */}
        <section id="program" className="section program reveal">
          <div className="section-head">
            <div className="section-kicker">02 · Proponowane rozwiązanie</div>
            <h2>Rekomendujemy</h2>
            <h2 style={{ marginTop: 16 }}>
              <em>{dto.programLabel}</em>
            </h2>
          </div>
          <div className="program-hero">
            <div className="program-top">
              <p className="program-reason">
                Nabór jest najbardziej odpowiedni ze względu na charakter inwestycji, dopasowanie do
                kryteriów formalnych i merytorycznych oraz strategiczne cele firmy.
              </p>
            </div>
            <div className="program-separator" />
            {programDescriptionHtml ? (
              <div
                className="program-description"
                dangerouslySetInnerHTML={{ __html: programDescriptionHtml }}
              />
            ) : (
              <div className="program-points">
                {PROGRAM_BULLETS.map((b, i) => (
                  <div className="bullet" key={i}>
                    <span className="marker">›</span>
                    <span className="text">{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="alt-header">
            <h3>Inne możliwości wsparcia</h3>
            <p>Alternatywne programy, które możemy rozważyć równolegle lub jako backup.</p>
          </div>
          <div className="alt-grid">
            {altPrograms.map((p, i) => (
              <article key={i} className="alt-card">
                <div className="alt-program">{p.program}</div>
                <h4>{p.name}</h4>
                <p className="alt-nabor">
                  Nabór: <strong>{p.nabor}</strong>
                </p>
                <p className="alt-desc">{p.desc}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="alt-link">
                    Dowiedz się więcej →
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ==================== 04. ZAKRES ==================== */}
        <section id="zakres" className="section zakres reveal">
          <div className="section-head">
            <div className="section-kicker">03 · Zakres usługi doradczej</div>
            <h2>
              Co dokładnie robimy <em>dla Państwa projektu</em>
            </h2>
          </div>
          <ScopeAccordion prep={SCOPE_PREP} exec={SCOPE_EXEC} />
        </section>

        {/* ==================== 05. CENNIK ==================== */}
        <section id="cennik" className="section cennik reveal">
          <div className="section-head">
            <div className="section-kicker">04 · Model wynagrodzenia</div>
            <h2>
              Partnerski model: <em>success fee</em>
            </h2>
            <p className="section-lead">
              Współpracę proponujemy w modelu opartym na opłacie wstępnej oraz wynagrodzeniu
              wynikowym. Nasz sukces zależy od sukcesu Państwa projektu.
            </p>
          </div>

          <div className="calc">
            <div className="calc-head">
              <div>
                <div className="calc-kicker">Założenia oferty</div>
                <h3>Wartości przyjęte w tej ofercie</h3>
              </div>
              <div className="calc-chip">
                Wartość dofinansowania: <strong>{fmt(funding)}</strong>
              </div>
            </div>
            <div className="calc-readonly">
              <div className="cr-item">
                <div className="cr-label">Wartość projektu (netto)</div>
                <div className="cr-val">{fmt(dto.projectValue)}</div>
              </div>
              <div className="cr-item">
                <div className="cr-label">Intensywność dofinansowania</div>
                <div className="cr-val">{Math.round(dto.fundingRate * 100)}%</div>
              </div>
              <div className="cr-item">
                <div className="cr-label">Szacowana wartość dofinansowania</div>
                <div className="cr-val">{fmt(funding)}</div>
              </div>
            </div>
          </div>

          <div className="variants">
            {variants.map((v) => {
              const selected = dto.selectedVariant === v.id;
              return (
                <article key={v.id} className={`variant ${selected ? 'selected' : ''}`}>
                  <header>
                    <div className="v-id">{v.name}</div>
                    <div className="v-tag">{v.tag}</div>
                    {selected && <div className="v-selected">✓ Wybrany</div>}
                  </header>
                  <div className="v-rate">
                    <strong>{(v.sfPct * 100).toFixed(1)}%</strong>
                    <span>wartości dofinansowania</span>
                  </div>
                  <div className="v-stack">
                    <div className="v-row">
                      <span>Opłata wstępna</span>
                      <strong>{fmt(v.base)}</strong>
                    </div>
                    <div className="v-row big">
                      <span>Wynagrodzenie wynikowe</span>
                      <strong>{fmt(v.sfAmount)}</strong>
                    </div>
                    <div className="v-divider" />
                    <div className="v-row total">
                      <span>Razem (szacunkowo)</span>
                      <strong>{fmt(v.total)}</strong>
                    </div>
                  </div>
                  <div className="v-schedule">
                    <div className="v-sched-label">Harmonogram płatności</div>
                    {(v.payment ?? []).map((p, i) => (
                      <div key={i} className="v-sched-row">
                        <div className="v-sched-bar" style={{ width: `${p.pct}%` }} />
                        <div className="v-sched-text">
                          <strong>{p.pct}%</strong> <span>{p.when}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          {selectedVariant && (
            <div className="exec-fee">
              <div>
                <div className="ef-kicker">{dto.execFee.kicker}</div>
                <h4>{dto.execFee.title}</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>{dto.execFee.desc}</p>
              </div>
              <div className="ef-price">
                <strong>{fmt(dto.execFee.monthly ?? selectedVariant.monthly)}</strong>
                <span>netto / miesiąc</span>
              </div>
            </div>
          )}

          {/* Podsumowanie (content.footer z OfferForm) — pojawia się pod pricingiem
              jeśli konsultant wpisał. Plain text z line-breaks. */}
          {content.footer && (
            <div className="cennik-footer">
              <p style={{ whiteSpace: 'pre-wrap' }}>{content.footer}</p>
            </div>
          )}
        </section>

        {/* ==================== 06. PROCES ==================== */}
        <section id="proces" className="section proces reveal">
          <div className="section-head">
            <div className="section-kicker">05 · Schemat procesu</div>
            <h2>
              Od spotkania <em>do umowy</em>
            </h2>
            <p className="section-lead">
              Przejrzysty proces współpracy — od pierwszego kontaktu po podpisanie umowy.
            </p>
          </div>
          <ProcessTimeline steps={PROCESS} />
        </section>

        {/* ==================== 07. ONAS ==================== */}
        {/* Sekcja 06 (after — oś czasu po podpisaniu) usunięta na życzenie biznesu. */}
        <section id="onas" className="section onas reveal">
          <div className="section-head">
            <div className="section-kicker">06 · Dlaczego K2Biznes</div>
            <h2>
              Dwie energie, <em>jedna misja</em>
            </h2>
          </div>
          <div className="onas-quote">
            <span className="q-open" aria-hidden>„</span>
            <p>Pomagając tworzyć i rozwijając Twój biznes, doskonalimy siebie.</p>
            <span className="q-close" aria-hidden>”</span>
          </div>
          <div className="energies">
            <div className="energy e-navy">
              <div className="e-label">Niebieska</div>
              <div className="e-desc">Zaufanie, planowanie i wieloletnie doświadczenie.</div>
            </div>
            <div className="energy-plus">+</div>
            <div className="energy e-red">
              <div className="e-label">Czerwona</div>
              <div className="e-desc">Pasja i nowa energia dla projektów naszych klientów.</div>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="stat-num">
                <CountUp to={475} /> mln zł
              </div>
              <div className="stat-lbl">pozyskanego dofinansowania dla klientów</div>
            </div>
            <div className="stat">
              <div className="stat-num">
                ponad <CountUp to={288} />
              </div>
              <div className="stat-lbl">skutecznie zrealizowanych projektów</div>
            </div>
            <div className="stat">
              <div className="stat-num">
                <CountUp to={15} />+ lat
              </div>
              <div className="stat-lbl">doświadczenia w pozyskiwaniu środków UE</div>
            </div>
          </div>
          {/* Logos-bar usunięta — sekcja Case Study (poniżej) jest miejscem
              prezentacji wybranego przez admina szablonu projektu klienta. */}
        </section>

        {/* ==================== 08. CASE STUDY (Zaufali nam) ====================
            Zawsze renderowane — sekcja jest "miejscem" prezentacji szablonu
            projektu klienta wybranego przez admina (sekcja Załączniki w
            edytorze oferty). Bez wybranego case'a pokazujemy placeholder. */}
        <section id="case" className="section case reveal">
          <div className="section-head">
            <div className="section-kicker">07 · Zaufali nam</div>
            <h2>
              {dto.caseStudy ? (
                <>Case study: <em>{dto.caseStudy.client}</em></>
              ) : (
                <>Wybrany <em>projekt klienta</em></>
              )}
            </h2>
          </div>
          <div className="case-wrap">
            <div className="case-story">
              {dto.caseStudy ? (
                <>
                  {dto.caseStudy.tag && <div className="case-tag">{dto.caseStudy.tag}</div>}
                  <h3>{dto.caseStudy.title}</h3>
                  {dto.caseStudy.paragraph1 && <p>{dto.caseStudy.paragraph1}</p>}
                  {dto.caseStudy.paragraph2 && <p>{dto.caseStudy.paragraph2}</p>}
                  {dto.caseStudy.industries.length > 0 && (
                    <div className="case-stats">
                      {dto.caseStudy.industries.map((ind, i) => (
                        <div key={i}>
                          <strong>{ind}</strong>
                          <span>branża</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="case-placeholder">
                  <p>
                    Tutaj zaprezentujemy jeden z naszych zrealizowanych projektów,
                    najbardziej dopasowany do branży i charakteru przedsięwzięcia
                    klienta. Konsultant wybiera szablon w panelu administratora.
                  </p>
                </div>
              )}
            </div>
            <div className="case-visual">
              <div className="case-frame">
                <div className="case-img-overlay" />
                <svg className="case-rings" viewBox="0 0 400 400" aria-hidden>
                  <defs>
                    <mask id="crgap">
                      <rect width="400" height="400" fill="white" />
                      <rect x="195" y="0" width="10" height="200" fill="black" />
                    </mask>
                  </defs>
                  <g mask="url(#crgap)">
                    <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="20" />
                  </g>
                  <g mask="url(#crgap)" transform="translate(50 50)">
                    <circle cx="150" cy="150" r="120" fill="none" stroke="currentColor" strokeWidth="14" opacity=".55" />
                  </g>
                </svg>
                <div className="case-logo">
                  {dto.caseStudy?.logoBig ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dto.caseStudy.logoBig}
                      alt={dto.caseStudy.client}
                      style={{ maxWidth: '160px', maxHeight: '120px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="case-logo-big">{dto.caseStudy?.client ?? '— wybierz w panelu —'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 10. FAQ ==================== */}
        <section id="faq" className="section faq reveal">
          <div className="section-head">
            <div className="section-kicker">08 · FAQ</div>
            <h2>
              Najczęstsze <em>pytania</em>
            </h2>
          </div>
          <FaqAccordion
            items={
              faqRows.length > 0
                ? faqRows.map((f) => ({ q: f.question, a: f.answer }))
                : FAQ_ITEMS
            }
          />
        </section>

        {/* ==================== 11. AKCEPT ==================== */}
        {selectedVariant && (
          <section id="akcept" className="section akcept reveal">
            <div className="section-head">
              <div className="section-kicker">09 · Akceptacja oferty</div>
              <h2>
                Gotowi, by <em>zacząć</em>?
              </h2>
              <p className="section-lead">
                {isActive
                  ? 'Wybierz wariant i potwierdź. Skontaktujemy się w ciągu 1 dnia roboczego.'
                  : isPreview
                    ? 'Podsumowanie wybranego wariantu. W trybie klienta będzie tu formularz akceptacji.'
                    : `Status: ${dto.status}. Akceptacja niedostępna.`}
              </p>
            </div>

            <div className="accept-grid">
              {(isActive || isPreview) && gdprRes.data ? (
                <AcceptForm
                  token={params.token}
                  offeredVariants={dto.offeredVariants}
                  defaultVariant={dto.selectedVariant}
                  variants={variants.map((v) => ({
                    id: v.id,
                    base: v.base,
                    sfAmount: v.sfAmount,
                    total: v.total,
                  }))}
                  summary={{
                    clientName: dto.clientName,
                    offerNumber: dto.offerNumber,
                    projectValue: dto.projectValue,
                    fundingRate: dto.fundingRate,
                    funding,
                  }}
                  gdprClauseVersion={gdprRes.data.version}
                  gdprText={gdprRes.data.text}
                  previewOnly={!isActive && isPreview}
                />
              ) : (
                <div className="accept-card">
                  <h3>Podsumowanie</h3>
                  <dl>
                    <div>
                      <dt>Klient</dt>
                      <dd>{dto.clientName}</dd>
                    </div>
                    <div>
                      <dt>Numer oferty</dt>
                      <dd>{dto.offerNumber}</dd>
                    </div>
                    <div>
                      <dt>Wybrany wariant</dt>
                      <dd>Wariant {selectedVariant.id}</dd>
                    </div>
                    <div className="total">
                      <dt>Razem (szacunkowo)</dt>
                      <dd>{fmt(selectedVariant.total)}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            {/* Contact card pod akcept-grid */}
            {dto.contactPerson && (
              <div className="contact-card">
                <div className="contact-portrait">
                  {dto.contactPerson.photoUrl ? (
                    <img src={dto.contactPerson.photoUrl} alt={dto.contactPerson.name} />
                  ) : (
                    <div className="contact-placeholder">{dto.contactPerson.name.charAt(0)}</div>
                  )}
                </div>
                <div className="contact-info">
                  <div className="ck">Twoja osoba kontaktowa</div>
                  <div className="cname">{dto.contactPerson.name}</div>
                  <div className="crole">{dto.contactPerson.role}</div>
                  <div className="cmethods">
                    {dto.contactPerson.phone && (
                      <a href={`tel:${dto.contactPerson.phone}`}>{dto.contactPerson.phone}</a>
                    )}
                    {dto.contactPerson.email && (
                      <a href={`mailto:${dto.contactPerson.email}`}>{dto.contactPerson.email}</a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        <div className="f-top">
          <div>
            <img src="/branding-v2/k2-logo.png" alt="K2" className="f-logo" />
            <p className="f-tag">
              Projekty badawczo-rozwojowe · Projekty inwestycyjne · Ulga B+R i&nbsp;IP BOX
            </p>
          </div>
          <div className="f-cols">
            <div>
              <div className="f-h">Siedziba</div>
              <p>
                45-835 Opole
                <br />
                ul. Wrocławska 156a/319
              </p>
            </div>
            <div>
              <div className="f-h">Kontakt</div>
              <p>
                <a href="tel:+48784377277">+48 784 377 277</a>
                <br />
                <a href="mailto:kontakt@k2biznes.pl">kontakt@k2biznes.pl</a>
              </p>
            </div>
            <div>
              <div className="f-h">Spółka</div>
              <p>
                NIP 7543090519
                <br />
                REGON 360850700
                <br />
                KRS 0001008787
              </p>
            </div>
          </div>
        </div>
        <div className="f-bot">
          <span>© K2Biznes Sp. z&nbsp;o.o.</span>
          <a href="https://www.k2biznes.pl" target="_blank" rel="noopener noreferrer">
            www.k2biznes.pl
          </a>
        </div>
      </footer>
    </>
  );
}
