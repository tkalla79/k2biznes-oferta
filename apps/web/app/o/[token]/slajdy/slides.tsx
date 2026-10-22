import Slide, { SlideHead } from './Slide';
import { formatSfPct } from '@/lib/format/percent';
import type { PricingVariant } from '@/lib/pricing';

// Ten sam format co w PricingVariants.tsx (kwoty z grupowaniem tysięcy zawsze).
export const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
    useGrouping: 'always',
  }).format(Math.round(n));

type Footer = { no: string; footer: string };

export type CoverData = {
  offerNumber: string;
  dateLabel: string;
  clientName: string;
  programLabel: string;
  validUntil: string | null;
  /** Oferta łączona: przygotowanie wniosku oraz obsługa i rozliczanie w cenie. */
  execIncluded: boolean;
};

export function CoverSlide({ d }: { d: CoverData }) {
  return (
    <Slide>
      <div className="sl-ring-wrap" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sl-ring" src="/branding-v2/ring-gap.webp" alt="" />
      </div>
      <div className="sl-cover">
        <div className="sl-cover-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sl-cover-logo" src="/branding-v2/k2-logo.png" alt="K2 Biznes" />
          <div className="sl-pill">
            <span className="sl-dot" />
            {d.offerNumber} · {d.dateLabel}
          </div>
        </div>
        <div>
          <h1 className="sl-cover-title">
            Wsparcie doradcze
            <br />
            {d.execIncluded ? (
              <>
                w zakresie przygotowania projektu
                <br />
                <em>oraz jego obsługi i rozliczania</em>
              </>
            ) : (
              <>
                w zakresie przygotowania
                <br />
                <em>dokumentacji projektu</em>
              </>
            )}
          </h1>
          <div className="sl-for">
            Oferta przygotowana dla
            <strong>{d.clientName}</strong>
          </div>
        </div>
        <div className="sl-chips">
          <div className="sl-chip">
            <span>PROGRAM:</span>
            <strong>{d.programLabel}</strong>
          </div>
          {d.validUntil && (
            <div className="sl-chip">
              <span>OFERTA WAŻNA DO:</span>
              <strong>{d.validUntil}</strong>
            </div>
          )}
        </div>
      </div>
    </Slide>
  );
}

export type ProgramData = {
  programLabel: string;
  /** Pozycja z biblioteki programów oznaczona jako rekomendowana (może nie być). */
  reco: { program?: string; name: string; nabor?: string; desc?: string } | null;
  /** Opis programu z edytora, już po sanitizeRichText. */
  descriptionHtml: string;
};

export function ProgramSlide({ no, footer, d }: Footer & { d: ProgramData }) {
  const r = d.reco;
  return (
    <Slide no={no} footerLabel={footer}>
      <div className="sl-cols">
        <div className="sl-col-left">
          <SlideHead kicker="02 · PROPONOWANE ROZWIĄZANIE" big>
            Rekomendujemy
          </SlideHead>
          <div className="sl-prog">{d.programLabel}</div>
          {d.descriptionHtml && (
            <div className="sl-prose" dangerouslySetInnerHTML={{ __html: d.descriptionHtml }} />
          )}
        </div>
        <div className="sl-col-right">
          {r && (
            <article className="sl-card">
              <div className="sl-card-top">
                <span className="sl-badge">REKOMENDOWANY</span>
                {r.program && <span className="sl-card-prog">{r.program}</span>}
              </div>
              <h3>{r.name}</h3>
              {r.nabor && (
                <p className="sl-nabor">
                  Nabór: <strong>{r.nabor}</strong>
                </p>
              )}
              {r.desc && <p className="sl-desc">{r.desc}</p>}
            </article>
          )}
        </div>
      </div>
    </Slide>
  );
}

export type PricingData = {
  variants: PricingVariant[];
  selectedId: string;
  projectValue: number;
  fundingRate: number;
  funding: number;
  /** Opłata wykonawcza pod wariantami; null = ukryta (np. program Kultura). */
  execFee: { label: string; monthly: number | null } | null;
};

export function PricingSlide({ no, footer, d }: Footer & { d: PricingData }) {
  const selected = d.variants.find((v) => v.id === d.selectedId) ?? d.variants[0] ?? null;
  return (
    <Slide no={no} footerLabel={footer}>
      <div className="sl-pricing">
        <div className="sl-aside">
          <div className="sl-kicker">
            <span className="sl-rule" />
            04 · MODEL WYNAGRODZENIA
          </div>
          <h2 className="sl-title">
            Partnerski model: <em>success fee</em>
          </h2>
          <p className="sl-lead">
            Współpracę proponujemy w modelu opartym na opłacie wstępnej oraz wynagrodzeniu
            wynikowym. Nasz sukces zależy od sukcesu Państwa projektu.
          </p>
          <div className="sl-assume">
            <span className="sl-label">ZAŁOŻENIA OFERTY</span>
            <div>
              <div>Wartość projektu (netto)</div>
              <div>{fmt(d.projectValue)}</div>
            </div>
            <div>
              <div>Intensywność dofinansowania</div>
              <div>{formatSfPct(d.fundingRate)}%</div>
            </div>
            <div>
              <div>Szacowana wartość dofinansowania</div>
              <div>{fmt(d.funding)}</div>
            </div>
          </div>
        </div>
        <div className="sl-main">
          <div
            className="sl-variants"
            style={{ gridTemplateColumns: `repeat(${Math.max(d.variants.length, 1)}, minmax(0, 1fr))` }}
          >
            {d.variants.map((v) => {
              const sel = v.id === selected?.id;
              return (
                <div key={v.id} className={sel ? 'sl-variant sl-variant--sel' : 'sl-variant'}>
                  <div className="sl-vhead">
                    <div>
                      <div className="sl-label">{v.name.toUpperCase()}</div>
                      <div className="sl-vname">{v.tag}</div>
                    </div>
                    {sel && (
                      <span className="sl-vsel">
                        <svg aria-hidden width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6.5l2.5 2.5L10 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Wybrany
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="sl-vpct">{formatSfPct(v.sfPct)}%</div>
                    <div className="sl-vpct-note">wartości dofinansowania</div>
                  </div>
                  <div className="sl-vrows">
                    <div>
                      <small>Opłata wstępna</small>
                      <b>{fmt(v.base)}</b>
                    </div>
                    <div>
                      <small>Wynagrodzenie wynikowe</small>
                      <b>{fmt(v.sfAmount)}</b>
                    </div>
                    <div>
                      <small>Razem (szacunkowo)</small>
                      <b className="sl-vtotal">{fmt(v.total)}</b>
                    </div>
                  </div>
                  <div className="sl-vsched">
                    <span className="sl-label">HARMONOGRAM PŁATNOŚCI</span>
                    {(v.payment ?? []).map((p, i) => (
                      <div key={i}>
                        <strong>{p.pct}%</strong>
                        <span>{p.when}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {d.execFee && selected && (
            <div className="sl-exec">
              <span>{d.execFee.label}</span>
              <strong>{fmt(d.execFee.monthly ?? selected.monthly)} netto / miesiąc</strong>
            </div>
          )}
          <p className="sl-vat">
            Wszystkie kwoty są kwotami netto, do faktur zostanie doliczony podatek VAT (23%).
          </p>
        </div>
      </div>
    </Slide>
  );
}

export type ClosingData = {
  contact: { name: string; role: string; email: string | null; phone: string | null; photoUrl: string | null } | null;
  validUntil: string | null;
};

/**
 * Zakończenie: sama karta kontaktowa. Produkcyjny PDF też pomija formularz
 * akceptacji, bo w druku nie znamy wyboru klienta (page.tsx, uwaga 2026-06-15).
 */
export function ClosingSlide({ no, footer, d }: Footer & { d: ClosingData }) {
  const c = d.contact;
  return (
    <Slide no={no} footerLabel={footer}>
      <div className="sl-closing">
        <SlideHead kicker="08 · KONTAKT">
          Gotowi, <em>by zacząć?</em>
        </SlideHead>
        {d.validUntil && (
          <p className="sl-valid">
            Oferta ważna do <strong>{d.validUntil}</strong>
          </p>
        )}
        {c && (
          <div className="sl-contact">
            {c.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photoUrl} alt={c.name} loading="eager" />
            ) : (
              <div className="sl-contact-ph">{c.name.charAt(0)}</div>
            )}
            <div>
              <span className="sl-label">TWOJA OSOBA KONTAKTOWA</span>
              <div className="sl-cname">{c.name}</div>
              <p className="sl-crole">{c.role}</p>
              <div className="sl-clinks">
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span>{c.email}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Slide>
  );
}
