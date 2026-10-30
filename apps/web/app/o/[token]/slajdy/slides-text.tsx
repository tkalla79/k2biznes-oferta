import Slide, { SlideHead } from './Slide';
import { fmt } from './slides';
import { proseTier } from './prepare';

type Footer = { no: string; footer: string };

/**
 * Slajdy z tekstem pisanym przez konsultanta (offers.content) i ustawieniami
 * firmowymi. Długość tych tekstów jest zmienna, a slajd ma stały rozmiar, więc
 * to, co się nie zmieści, jest przycinane. scripts/render-slides-pdf.mjs
 * zgłasza taki slajd.
 */

/** 01: podstawa rekomendacji. `html` jest już po sanitizeProse. */
export function IntroSlide({ no, footer, clientName, html }: Footer & { clientName: string; html: string }) {
  return (
    <Slide no={no} footerLabel={footer}>
      <div className="sl-cols">
        <div className="sl-col-left">
          <SlideHead kicker="01 · WPROWADZENIE">
            Wsparcie doradcze szyte na miarę <em>{clientName}</em>
          </SlideHead>
        </div>
        <div className="sl-col-right">
          <div className={`sl-prose sl-prose--lg ${proseTier(html, true)}`} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </Slide>
  );
}

/**
 * Rozmiar punktorów wg łącznej długości: dłuższe założenia dostają mniejszą czcionkę i
 * mniejsze odstępy (pomiar na 11 ofertach: do ok. 3300 znaków mieści się, 4000 jeszcze nie).
 */
export const bulletsSize = (bullets: string[]) => {
  const n = bullets.reduce((sum, b) => sum + b.length, 0);
  return n > 3600 ? 'xxs' : n > 2700 ? 'xs' : n > 2000 ? 'sm' : 'md';
};

/**
 * 04b: założenia oferty, czyli punktory konsultanta (content.calcBullets).
 * Kolumny balansuje przeglądarka (CSS columns), bo punkty mają bardzo różną
 * długość i podział po liczbie wpychał najdłuższe do jednej kolumny.
 */
export function BulletsSlide({
  no,
  footer,
  bullets,
  offset = 0,
  cont = false,
}: Footer & { bullets: string[]; offset?: number; cont?: boolean }) {
  const size = bulletsSize(bullets);
  return (
    <Slide no={no} footerLabel={footer}>
      <SlideHead kicker="04 · MODEL WYNAGRODZENIA">
        Założenia <em>do wyceny</em>
        {cont ? ' (cd.)' : ''}
      </SlideHead>
      <div className={`sl-bullets sl-bullets--${size}`} style={{ columnCount: Math.min(Math.max(bullets.length, 1), 3) }}>
        {bullets.map((b, i) => (
          <div key={i} className="sl-bullet">
            <span>{String(offset + i + 1).padStart(2, '0')}</span>
            <p>{b}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

export type NotesData = {
  /** Opłata wykonawcza z opisem (execFee); null = ukryta (np. program Kultura). */
  exec: { kicker: string; monthly: number; desc: string } | null;
  /** Uwagi do oferty (content.notes), tekst z podziałem na wiersze. */
  notes: string;
};

/**
 * Opłata wykonawcza dla slajdu 04c. Jak na stronie (PricingVariants pokazuje ten
 * blok tylko przy wybranym wariancie): bez wariantu opłaty nie ma, zamiast
 * "0 zł netto / miesiąc". Program Kultura ukrywa ją zawsze.
 */
export function resolveNotesExec(a: {
  hidden: boolean;
  selected: { monthly: number } | null;
  execMonthly: number | null;
  kicker: string;
  desc: string;
}): NotesData['exec'] {
  if (a.hidden || !a.selected) return null;
  return { kicker: a.kicker, monthly: a.execMonthly ?? a.selected.monthly, desc: a.desc };
}

/** Rozmiar tekstu wg długości: dłuższe uwagi dostają mniejszą czcionkę, żeby zmieścić się na slajdzie. */
export const sizeFor = (s: string) => (s.length > 1500 ? 'xxs' : s.length > 1200 ? 'xs' : s.length > 700 ? 'sm' : 'md');

/** 04c: opis obsługi i rozliczania oraz uwagi do oferty. Slajd ma sens, gdy jest choć jedno z dwojga. */
export function NotesSlide({ no, footer, d }: Footer & { d: NotesData }) {
  const both = d.exec !== null && d.notes !== '';
  return (
    <Slide no={no} footerLabel={footer}>
      <SlideHead kicker="04 · MODEL WYNAGRODZENIA">
        {both ? (
          <>
            Obsługa projektu i <em>uwagi</em>
          </>
        ) : d.exec ? (
          <>
            Obsługa i <em>rozliczanie projektu</em>
          </>
        ) : (
          <>
            Uwagi <em>do oferty</em>
          </>
        )}
      </SlideHead>
      {/* Uwagi są zwykle dłuższe niż opis stawki, więc dostają szerszą kartę. */}
      <div className="sl-notes" style={{ gridTemplateColumns: both ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0, 1fr)' }}>
        {d.exec && (
          <div className="sl-note-card">
            <div className="sl-label">{d.exec.kicker.toUpperCase()}</div>
            <div className="sl-note-fig">
              <strong>{fmt(d.exec.monthly)}</strong>
              <span>netto / miesiąc</span>
            </div>
            <p className={`sl-note-text sl-note-text--${sizeFor(d.exec.desc)}`}>{d.exec.desc}</p>
          </div>
        )}
        {d.notes !== '' && (
          <div className="sl-note-card sl-note-card--navy">
            <div className="sl-label">UWAGI DO OFERTY</div>
            <p className={`sl-note-text sl-note-text--${sizeFor(d.notes)}`}>{d.notes}</p>
          </div>
        )}
      </div>
    </Slide>
  );
}

export type AboutData = { funding: string; projects: string; since: string };

/** 06: dlaczego K2. Teksty stałe jak na stronie, liczby z ustawień firmowych (company_stats). */
export function AboutSlide({ no, footer, stats }: Footer & { stats: AboutData }) {
  const energies = [
    { name: 'Niebieska', color: '#2a324b', text: 'Zaufanie, planowanie i wieloletnie doświadczenie.' },
    { name: 'Czerwona', color: '#d91e18', text: 'Pasja i nowa energia dla projektów naszych klientów.' },
  ];
  const nums = [
    { value: stats.funding, label: 'pozyskanego dofinansowania dla klientów' },
    { value: `ponad ${stats.projects}`, label: 'skutecznie zrealizowanych projektów' },
    { value: stats.since, label: 'doświadczenia w pozyskiwaniu środków UE' },
  ];
  return (
    <Slide no={no} footerLabel={footer}>
      <SlideHead kicker="06 · DLACZEGO K2BIZNES" big>
        Dwie energie, <em>jedna misja</em>
      </SlideHead>
      <p className="sl-lead sl-lead--wide">Pomagając tworzyć i rozwijając Twój biznes, doskonalimy siebie.</p>
      <div className="sl-energies">
        {energies.map((e) => (
          <div key={e.name} className="sl-energy">
            <div className="sl-energy-name">
              <span className="sl-energy-dot" style={{ background: e.color }} />
              {e.name}
            </div>
            <p>{e.text}</p>
          </div>
        ))}
      </div>
      <div className="sl-stats">
        {nums.map((n) => (
          <div key={n.label}>
            <div className="sl-stat-num">{n.value}</div>
            <p className="sl-stat-lbl">{n.label}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}
