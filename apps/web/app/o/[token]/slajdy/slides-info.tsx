import Slide, { SlideHead } from './Slide';

type Footer = { no: string; footer: string };

/** Pozycja z staticContent.ts (zakres, proces): t = tytuł, d = opis. */
export type TextItem = { t: string; d: string };

export type ScopeData = {
  /** Tytuł: zwykły początek i wyróżniona (czerwona, kursywa) końcówka. */
  headStart: string;
  headEm: string;
  lead: string;
  /** Oba zakresy jako kafelki po lewej; aktywny to ten, którego pozycje są na slajdzie. */
  tabs: Array<{ no: string; label: string; tag: string }>;
  active: number;
  items: TextItem[];
};

/**
 * Slajd zakresu usługi. Strona oferty pokazuje dwa zakresy w zakładkach
 * (ScopeAccordion), więc w PDF każdy dostaje własny slajd: 03 przygotowanie
 * dokumentacji, 03b obsługa i rozliczanie projektu.
 */
export function ScopeSlide({ no, footer, d }: Footer & { d: ScopeData }) {
  const half = Math.ceil(d.items.length / 2);
  const cols = [d.items.slice(0, half), d.items.slice(half)];
  return (
    <Slide no={no} footerLabel={footer}>
      <div className="sl-scope">
        <div className="sl-scope-aside">
          <SlideHead kicker="03 · ZAKRES USŁUGI">
            {d.headStart}
            <em>{d.headEm}</em>
          </SlideHead>
          <div className="sl-tabs">
            {d.tabs.map((t, i) => (
              <div key={t.no} className={i === d.active ? 'sl-tab sl-tab--on' : 'sl-tab'}>
                <div>
                  <span className="sl-tab-no">{t.no}</span>
                  <span className="sl-tab-name">{t.label}</span>
                </div>
                <span className="sl-tag">{t.tag.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <p className="sl-lead">{d.lead}</p>
        </div>
        <div className="sl-scope-cols">
          {cols.map((col, c) => (
            <div key={c} className="sl-scope-col">
              {col.map((s, i) => (
                <div key={i} className="sl-step">
                  <span className="sl-step-no">{String(c * half + i + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="sl-step-t">{s.t}</div>
                    <p className="sl-step-d">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/** Slajd procesu: wszystkie kroki naraz z opisami (w PDF strony też są rozwinięte). */
export function ProcessSlide({ no, footer, steps }: Footer & { steps: TextItem[] }) {
  const edge = `${50 / Math.max(steps.length, 1)}%`;
  return (
    <Slide no={no} footerLabel={footer}>
      <SlideHead kicker="05 · SCHEMAT PROCESU" big>
        Od spotkania <em>do umowy</em>
      </SlideHead>
      <p className="sl-lead sl-lead--wide">
        Przejrzysty proces współpracy, od pierwszego kontaktu po podpisanie umowy.
      </p>
      <div className="sl-process">
        <div className="sl-rail" style={{ left: edge, right: edge }} />
        <ol style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <li key={i}>
              <span className="sl-pnum">{i + 1}</span>
              <span className="sl-label">KROK {String(i + 1).padStart(2, '0')}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </Slide>
  );
}

/** Slajd FAQ: wszystkie odpowiedzi rozwinięte, pytania w dwóch kolumnach. */
export function FaqSlide({ no, footer, items }: Footer & { items: Array<{ q: string; a: string }> }) {
  const half = Math.ceil(items.length / 2);
  return (
    <Slide no={no} footerLabel={footer}>
      <SlideHead kicker="07 · FAQ">
        Najczęstsze <em>pytania</em>
      </SlideHead>
      <div className="sl-faq">
        {[items.slice(0, half), items.slice(half)].map((col, c) => (
          <div key={c}>
            {col.map((f, i) => (
              <div key={i}>
                <div className="sl-faq-q">{f.q}</div>
                <p className="sl-faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Slide>
  );
}
