/**
 * Public offer view (BACKEND_SPEC.md v1.1.1, sekcja 7.4).
 *
 * Server component z brandingiem K2 (port `OFERTA_INTERAKTYWNA/index.html`).
 * 8 sekcji: cover, intro, scope, optional, pricing, process, why, contact +
 * floating nav-dots + CTA bar.
 *
 * Dane z DB (`offers.pricing_snapshot`, embedded contact_person + case_study);
 * statyczna treść doradcza z OFERTA_INTERAKTYWNA (kroki, timeline, why-K2).
 */
import { notFound } from 'next/navigation';
import { fetchPublicOffer } from '@/lib/offers/public';
import { toPublicOfferDto } from '@/lib/offers/mapper';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/error';
import RevealOnScroll from './RevealOnScroll';
import NavDots from './NavDots';
import CtaBar from './CtaBar';
import ViewTracker from './ViewTracker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: { token: string }; searchParams: { print?: string } };

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pl-PL');

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

  const variants = dto.pricingSnapshot.variants.filter((v) => dto.offeredVariants.includes(v.id));
  const dateLabel = fmtDate(offer.sent_at ?? offer.created_at);
  const offerDate = isActive ? dateLabel : fmtDate(offer.created_at);

  // Status banner (po accept/reject/expired)
  const statusBanner =
    !isActive &&
    (dto.status === 'accepted' || dto.status === 'rejected' || dto.status === 'expired') ? (
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          padding: '10px 20px',
          background: dto.status === 'accepted' ? '#dff3e8' : '#fbf0d8',
          color: dto.status === 'accepted' ? '#1f7a4c' : '#8a5a00',
          border: `1px solid ${dto.status === 'accepted' ? '#1f7a4c' : '#8a5a00'}`,
          borderRadius: 6,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        {dto.status === 'accepted' && 'Oferta zaakceptowana — dziękujemy.'}
        {dto.status === 'rejected' && 'Oferta odrzucona.'}
        {dto.status === 'expired' && 'Oferta wygasła.'}
      </div>
    ) : null;

  return (
    <>
      {!isPrint && <ViewTracker token={params.token} />}
      {!isPrint && <RevealOnScroll />}
      {!isPrint && <NavDots />}
      {statusBanner}

      {/* ==================== 0. COVER ==================== */}
      <section
        id="s-cover"
        className="section section--cover section--no-sidebar"
        data-section="0"
      >
        <div className="cover__watermark" aria-hidden="true">K2</div>
        <div className="section__inner">
          <div className="cover__redline" />
          <h1 className="cover__title">
            Oferta cenowa<br />na wsparcie doradcze
          </h1>
          <p className="cover__subtitle">w zakresie przygotowania projektu</p>
          <div className="cover__meta">
            <div className="cover__field">
              <div className="cover__field-label">Data oferty</div>
              <div>{offerDate}</div>
            </div>
            <div className="cover__field">
              <div className="cover__field-label">Oferta sporządzona dla</div>
              <div>{dto.clientName}</div>
            </div>
            <div className="cover__field">
              <div className="cover__field-label">Numer oferty</div>
              <div>{dto.offerNumber}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 1. INTRODUCTION ==================== */}
      <section
        id="s-intro"
        className="section section--intro section--bg"
        data-section="1"
        style={{ '--section-bg': "url('/branding/section-bg-3.jpg')" } as React.CSSProperties}
      >
        <div className="sidebar"><span className="sidebar__text">k2biznes.pl</span></div>
        <div className="section__inner">
          <span className="section-num reveal">01 — Wprowadzenie</span>
          <h2 className="section-title reveal">Wsparcie<br />Doradcze</h2>
          <div className="intro__cols reveal">
            <div className="intro__desc">
              Dziękujemy za rozmowę i zainteresowanie współpracą z K2Biznes. Poniżej przedstawiamy
              ofertę wsparcia doradczego w zakresie przygotowania projektu w ramach{' '}
              <strong>{dto.programLabel}</strong>.
            </div>
            <div className="intro__desc">
              <strong>{dto.clientName}</strong>
              {dto.clientIndustry && <> — działa w branży <em>{dto.clientIndustry}</em></>}
              {dto.clientVoivodeship && <> ({dto.clientVoivodeship})</>}.
              Wartość projektu: <strong>{fmt(dto.projectValue)}</strong>, planowana intensywność
              dofinansowania: <strong>{(dto.fundingRate * 100).toFixed(0)}%</strong>{' '}
              (~ <strong>{fmt(dto.pricingSnapshot.funding)}</strong>).
            </div>
          </div>

          <h3 className="subsection-title reveal">Kluczowe potrzeby</h3>
          <ul className="needs-list stagger-children">
            <li>Wsparcie przedsiębiorstwa na etapie opracowywania dokumentacji aplikacyjnej</li>
            <li>Obsługa procesu składania i oceny wniosku</li>
            <li>Kontakt z instytucją dokonującą oceny projektu</li>
            <li>
              Wsparcie na etapie przygotowywania załączników do umowy o dofinansowanie w przypadku
              pozytywnego wyniku oceny
            </li>
          </ul>
        </div>
      </section>

      {/* ==================== 2. SERVICE SCOPE ==================== */}
      <section
        id="s-scope"
        className="section section--scope section--bg"
        data-section="2"
        style={{ '--section-bg': "url('/branding/section-bg-4.jpg')" } as React.CSSProperties}
      >
        <div className="sidebar"><span className="sidebar__text">k2biznes.pl</span></div>
        <div className="section__inner">
          <span className="section-num reveal">02 — Zakres</span>
          <h2 className="section-title reveal">Zakres usługi<br />doradczej</h2>
          <p className="reveal" style={{ color: 'var(--k2-gray-text)', marginBottom: '1.5rem' }}>
            Poniżej przedstawiamy szczegółowy zakres prac realizowanych na etapie przygotowania
            kompletnej dokumentacji aplikacyjnej dla Projektu.
          </p>
          <div className="scope__list stagger-children">
            {SCOPE_STEPS.map((step, i) => (
              <div className="scope__item" key={i}>
                <span className="scope__num">{String(i + 1).padStart(2, '0')}</span>
                <p className="scope__text" dangerouslySetInnerHTML={{ __html: step }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 3. OPTIONAL SCOPE ==================== */}
      <section
        id="s-optional"
        className="section section--optional section--bg"
        data-section="3"
        style={{ '--section-bg': "url('/branding/section-bg-5.jpg')" } as React.CSSProperties}
      >
        <div className="sidebar"><span className="sidebar__text">k2biznes.pl</span></div>
        <div className="section__inner">
          <span className="section-num reveal">03 — Zakres opcjonalny</span>
          <h2 className="section-title reveal">
            Obsługa i rozliczenie
            <br />
            <span style={{ color: 'var(--k2-gray-text)', fontSize: '0.5em', fontWeight: 500, letterSpacing: '0.04em' }}>
              MA CHARAKTER OPCJONALNY
            </span>
          </h2>
          <div className="optional-content" style={{ display: 'block' }}>
            <div className="optional__intro reveal">
              <p style={{ color: 'var(--k2-white-soft)' }}>
                Po otrzymaniu przez projekt dofinansowania kolejnym etapem współpracy z K2Biznes
                jest <strong>obsługa i rozliczenie dofinansowanego Projektu</strong>.
              </p>
            </div>
            <ul className="optional__list stagger-children">
              {OPTIONAL_ITEMS.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== 4. PRICING MODEL ==================== */}
      <section
        id="s-pricing"
        className="section section--pricing section--no-sidebar section--auto-height section--bg"
        data-section="4"
        style={{ '--section-bg': "url('/branding/section-bg-6.jpg')" } as React.CSSProperties}
      >
        <div className="section__inner">
          <span className="section-num reveal">04 — Warunki</span>
          <h2 className="section-title reveal">Model<br />wynagrodzenia</h2>

          <div
            className="reveal"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '2rem',
              color: 'var(--k2-white-soft)',
            }}
          >
            <p>
              Współpracę proponujemy w modelu opartym na połączeniu <strong>opłaty wstępnej</strong>{' '}
              oraz <strong>wynagrodzenia wynikowego (success fee)</strong>. Takie rozwiązanie
              zapewnia elastyczne podejście do płatności i umożliwia rozłożenie kosztów w czasie.
            </p>
            <p>
              Model gwarantuje transparentność i partnerskie podejście —{' '}
              <strong>nasz sukces zależy od sukcesu projektu Klienta</strong>.
            </p>
          </div>

          <div className="pricing__assumptions reveal">
            <h4>Założenia przyjęte do wyceny:</h4>
            <ul>
              <li>
                Projekt o wartości <strong>{fmt(dto.projectValue)}</strong> netto
                {dto.fundingRate > 0 && (
                  <>, z planowanym dofinansowaniem <strong>{fmt(dto.pricingSnapshot.funding)}</strong>{' '}
                  ({(dto.fundingRate * 100).toFixed(0)}%)</>
                )}
              </li>
              <li>Segment cenowy: <strong>{dto.pricingSnapshot.segment.label}</strong></li>
              <li>Oczekiwanie na kompleksowe wsparcie: od przygotowania dokumentacji po rozliczenia</li>
            </ul>
          </div>

          <p className="pricing__hint reveal">Wybierz wariant wynagrodzenia poniżej:</p>

          <div className="pricing__grid stagger-children">
            {variants.map((v) => (
              <article
                key={v.id}
                className={
                  'pricing-card pricing-card--selectable' +
                  (v.id === dto.selectedVariant ? ' is-selected' : '')
                }
                data-variant={v.id}
              >
                <div className="pricing-card__header">{v.name}</div>
                <div className="pricing-card__body">
                  <div className="pricing-card__fee-label">{v.tag}</div>

                  <div className="pricing-card__fee-label" style={{ marginTop: '0.8rem' }}>
                    Opłata wstępna
                  </div>
                  <div className="pricing-card__fee">{fmt(v.base)} netto</div>

                  <div className="pricing-card__fee-label">
                    Wynagrodzenie wynikowe ({(v.sfPct * 100).toFixed(2)}%)
                  </div>
                  <div className="pricing-card__fee">{fmt(v.sfAmount)}</div>

                  {v.payment.length > 0 && (
                    <>
                      <div className="pricing-card__fee-label" style={{ marginTop: '0.5rem' }}>
                        Płatność:
                      </div>
                      <ul className="pricing-card__details">
                        {v.payment.map((p, i) => (
                          <li key={i}>
                            {p.pct}% {p.when}: <strong>{fmt(v.sfAmount * (p.pct / 100))}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {v.monthly > 0 && (
                    <div className="pricing-card__fee-label" style={{ marginTop: '0.5rem' }}>
                      + obsługa: <strong>{fmt(v.monthly)}</strong>/mies.
                    </div>
                  )}

                  <div className="pricing-card__total">
                    <span className="pricing-card__total-label">Suma</span>
                    <span className="pricing-card__total-value">{fmt(v.total)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 5. PROCESS TIMELINE ==================== */}
      <section
        id="s-process"
        className="section section--process section--bg"
        data-section="5"
        style={{ '--section-bg': "url('/branding/section-bg-8.jpg')" } as React.CSSProperties}
      >
        <div className="sidebar"><span className="sidebar__text">k2biznes.pl</span></div>
        <div className="section__inner">
          <span className="section-num reveal">05 — Proces</span>
          <h2 className="section-title reveal">
            Schemat procesu<br />
            <span style={{ color: 'var(--k2-red)', fontSize: '0.55em', fontWeight: 500 }}>
              Od spotkania do umowy
            </span>
          </h2>
          <p
            className="reveal"
            style={{ color: 'var(--k2-gray-text)', marginBottom: '2rem', maxWidth: 600 }}
          >
            Współpracę z każdym klientem prowadzimy w oparciu o przejrzysty i uporządkowany proces.
          </p>
          <div className="timeline stagger-children">
            {TIMELINE.map((step, i) => (
              <div className="timeline__item" key={i}>
                <div className="timeline__dot" />
                <div className="timeline__num">KROK {String(i + 1).padStart(2, '0')}</div>
                <div className="timeline__title">{step.title}</div>
                <div className="timeline__desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 6. WHY K2BIZNES ==================== */}
      <section
        id="s-why"
        className="section section--why section--no-sidebar section--auto-height section--bg"
        data-section="6"
        style={{ '--section-bg': "url('/branding/section-bg-10.jpg')" } as React.CSSProperties}
      >
        <div className="section__inner" style={{ maxWidth: 'var(--content-max)', width: '100%' }}>
          <span className="section-num reveal" style={{ textAlign: 'center', display: 'block' }}>
            06 — O nas
          </span>
          <h2 className="section-title reveal" style={{ textAlign: 'center' }}>
            Dlaczego<br />K2Biznes?
          </h2>

          <div className="why__quote reveal">
            <blockquote>Pomagając tworzyć i rozwijając Twój biznes doskonalimy siebie</blockquote>
          </div>

          <div className="why__body reveal">
            <p>
              Misją K2Biznes jest wsparcie przedsiębiorstw w kluczowych dla nich projektach
              badawczych, rozwojowych i innowacyjnych. Fundusze unijne są dla nas tylko jednym z
              narzędzi, które pozwalają zainicjować lub przyspieszyć rozwój przedsiębiorstwa.
            </p>
          </div>

          <div className="why__stats reveal">
            <div className="stat">
              <div className="stat__number">400 mln+</div>
              <div className="stat__label">PLN pozyskanego dofinansowania</div>
            </div>
            <div className="stat">
              <div className="stat__number">265+</div>
              <div className="stat__label">skutecznie zrealizowanych projektów</div>
            </div>
          </div>

          {dto.caseStudy && (
            <div style={{ maxWidth: 'var(--content-max)', margin: '3rem auto 0', width: '100%' }}>
              <h3 className="subsection-title reveal">
                Nasz Klient <span style={{ color: 'var(--k2-red)' }}>{dto.caseStudy.client}</span>
              </h3>
              {dto.caseStudy.paragraph1 && (
                <div className="case__body reveal">
                  <p>{dto.caseStudy.paragraph1}</p>
                </div>
              )}
              {dto.caseStudy.paragraph2 && (
                <div className="case__highlight reveal-left">{dto.caseStudy.paragraph2}</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ==================== 7. CONTACT ==================== */}
      <section
        id="s-contact"
        className="section section--contact section--no-sidebar section--bg"
        data-section="7"
        style={{ '--section-bg': "url('/branding/section-bg-12.jpg')" } as React.CSSProperties}
      >
        <div className="section__inner">
          <div className="contact__pillars reveal">
            <span>projekty badawczo-rozwojowe</span>
            <span>projekty inwestycyjne</span>
            <span>ulga B+R oraz IP BOX</span>
          </div>

          {dto.contactPerson && (
            <div className="contact__card reveal">
              <div className="contact__name">{dto.contactPerson.name}</div>
              <div className="contact__role">{dto.contactPerson.role}</div>
              <div className="contact__info">
                {dto.contactPerson.phone && (
                  <span>
                    tel.{' '}
                    <a
                      href={`tel:${dto.contactPerson.phone.replace(/\s/g, '')}`}
                      style={{ color: 'var(--k2-white-soft)' }}
                    >
                      {dto.contactPerson.phone}
                    </a>
                  </span>
                )}
                {dto.contactPerson.email && (
                  <span>
                    e-mail:{' '}
                    <a
                      href={`mailto:${dto.contactPerson.email}`}
                      style={{ color: 'var(--k2-white-soft)' }}
                    >
                      {dto.contactPerson.email}
                    </a>
                  </span>
                )}
              </div>
            </div>
          )}

          <div
            style={{ width: 72, height: 2, background: 'var(--k2-red)', margin: '0 auto 1.5rem' }}
            className="reveal"
          />

          <div className="contact__company reveal">
            <strong>K2Biznes Sp. z o.o.</strong>
            <span>45-835 Opole, ul. Wrocławska 156a</span>
            <span>tel. +48 784 377 277</span>
            <span>e-mail: kontakt@k2biznes.pl</span>
            <span style={{ marginTop: '0.4rem' }}>
              NIP: 7543090519 &nbsp;|&nbsp; REGON: 360850700 &nbsp;|&nbsp; KRS: 0001008787
            </span>
            <span style={{ marginTop: '0.6rem', color: 'var(--k2-white-soft)', fontSize: 'var(--fs-body)' }}>
              www.k2biznes.pl
            </span>
          </div>
        </div>
      </section>

      {/* ==================== CTA FLOATING BAR ==================== */}
      {!isPrint && isActive && gdpr && (
        <CtaBar
          token={params.token}
          offeredVariants={dto.offeredVariants}
          defaultVariant={dto.selectedVariant}
          gdprClauseVersion={gdpr.version}
          gdprText={gdpr.text}
          contactEmail={dto.contactPerson?.email ?? null}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Statyczna treść (port z OFERTA_INTERAKTYWNA — copy-deck konsultantów K2)
// -----------------------------------------------------------------------------

const SCOPE_STEPS: string[] = [
  '<strong>Analiza potrzeb i potencjału pomysłu</strong> — czy projekt ma potencjał biznesowy, innowacyjny, ekologiczny?',
  'Weryfikujemy kondycję finansową przedsiębiorstwa i doradzamy, <strong>jak przygotować firmę do procesu aplikacyjnego</strong>, by zwiększyć wiarygodność i zdolność dofinansowania.',
  'Analizujemy Twój pomysł pod kątem kryteriów formalnych i merytorycznych, pomagając dobrać strukturę, zakres i wydatki tak, by <strong>zmaksymalizować wysokość dotacji i szanse na pozytywną ocenę</strong>.',
  'Koordynujemy i opracowujemy pełną dokumentację projektu — wniosek, załączniki, harmonogramy i oświadczenia — zapewniając, że całość jest <strong>spójna, zgodna z wytycznymi i gotowa do złożenia</strong>.',
  'Monitorujemy przebieg oceny wniosku, wprowadzamy niezbędne korekty i modyfikacje. Jeżeli procedura tego wymaga — <strong>przygotowujemy klienta do spotkania panelowego z ekspertami</strong>.',
  '<strong>Przygotowanie do podpisania umowy.</strong> Po pozytywnej ocenie projektu pomagamy opracować wszystkie załączniki niezbędne do zawarcia umowy o dofinansowanie.',
  '<strong>Wsparcie po negatywnej ocenie</strong> (jeśli dotyczy). W przypadku odrzucenia wniosku przeprowadzamy analizę i — jeśli istnieją realne szanse — przygotowujemy skuteczny protest.',
];

const OPTIONAL_ITEMS: string[] = [
  '<strong>Spotkanie doradcze wprowadzające</strong> do realizacji projektu, w tym przedstawienie zasad informacji i promocji Projektu, analiza zapisów umowy o dofinansowanie',
  '<strong>Monitorowanie harmonogramu</strong> rzeczowo-finansowego Projektu',
  '<strong>Przygotowywanie dokumentów</strong> związanych ze zmianami harmonogramu rzeczowo-finansowego Projektu',
  '<strong>Nadzór nad wyborem wykonawców/dostawców</strong> w ramach Projektu, w tym przygotowanie stosownej dokumentacji',
  '<strong>Przygotowywanie wniosków o płatność</strong> w formie zaliczki, refundacji, sprawozdania i płatności końcowej',
  '<strong>Konsultacje i doradztwo</strong> związane z prawidłową realizacją Projektu zgodnie z zapisami umowy',
  '<strong>Audyt dokumentacji Projektu</strong> w przypadku kontroli realizacji Projektu',
  '<strong>Czynny udział Managera Projektu</strong> podczas kontroli odbywającej się w okresie realizacji projektu',
  '<strong>Kontakt z Instytucją Pośredniczącą i/lub Zarządzającą</strong> — nadzorującymi realizację Projektu',
  '<strong>Obsługa systemu teleinformatycznego</strong> wskazanego w umowie o dofinansowanie',
];

const TIMELINE: Array<{ title: string; desc: string }> = [
  {
    title: 'Spotkanie z klientem',
    desc: 'Omówienie możliwości aplikowania, zakresu współpracy, szans projektu.',
  },
  {
    title: 'Wysłanie oferty',
    desc: 'Klient do 2 dni roboczych po spotkaniu otrzymuje spersonalizowaną ofertę.',
  },
  {
    title: 'Omówienie oferty',
    desc: 'Po 5 dniach roboczych kontakt pracownika K2Biznes w celu omówienia oferty.',
  },
  { title: 'Zaakceptowanie oferty', desc: 'Klient potwierdza gotowość do podpisania umowy.' },
  {
    title: 'Podpisana umowa — start prac',
    desc: 'Po obustronnym podpisaniu umowy przystępujemy do przygotowania dokumentacji aplikacyjnej.',
  },
];
