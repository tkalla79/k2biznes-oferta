import type { ReactNode } from 'react';

/**
 * Jeden slajd 1280x720. Wymiary są stałe i wspólne dla wszystkich slajdów:
 * ten sam rozmiar ma strona PDF (@page w slajdy.css). Treść, która się nie
 * mieści, jest przycinana, dlatego scripts/render-slides-pdf.mjs zgłasza
 * każdy przycięty slajd.
 */
type SlideProps = {
  /** Numer sekcji w stopce, np. '02'. Brak = slajd bez stopki (okładka). */
  no?: string;
  footerLabel?: string;
  children: ReactNode;
};

export default function Slide({ no, footerLabel, children }: SlideProps) {
  return (
    <section className="sl">
      {children}
      {no && (
        <footer className="sl-foot">
          <span className="sl-foot-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding-v2/k2-logo.png" alt="K2 Biznes" />
            <span>{footerLabel}</span>
          </span>
          <span>{no}</span>
        </footer>
      )}
    </section>
  );
}

/** Nagłówek slajdu: czerwona kreska + numer sekcji, pod spodem tytuł. */
export function SlideHead({
  kicker,
  big = false,
  children,
}: {
  kicker: string;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sl-head">
      <div className="sl-kicker">
        <span className="sl-rule" />
        {kicker}
      </div>
      <h2 className={big ? 'sl-title sl-title--xl' : 'sl-title'}>{children}</h2>
    </div>
  );
}
