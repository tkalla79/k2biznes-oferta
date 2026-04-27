'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Floating nav dots z PR brandingu (port OFERTA_INTERAKTYWNA app.js sekcja 4).
 * 8 sekcji, scroll spy + click-to-scroll, keyboard nav (arrows).
 */
const SECTIONS = [
  { id: 0, title: 'Okładka' },
  { id: 1, title: 'Wprowadzenie' },
  { id: 2, title: 'Zakres usługi' },
  { id: 3, title: 'Zakres opcjonalny' },
  { id: 4, title: 'Model cenowy' },
  { id: 5, title: 'Proces' },
  { id: 6, title: 'Dlaczego K2' },
  { id: 7, title: 'Kontakt' },
];

export default function NavDots() {
  const [active, setActive] = useState(0);
  const sectionsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sectionsRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('.section[data-section]'),
    );
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.section ?? -1);
            if (idx >= 0) setActive(idx);
          }
        }
      },
      { threshold: 0.5 },
    );
    sectionsRef.current.forEach((s) => io.observe(s));

    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        scrollTo(Math.min(active + 1, SECTIONS.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        scrollTo(Math.max(active - 1, 0));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      io.disconnect();
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  function scrollTo(idx: number) {
    sectionsRef.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="nav-dots" aria-label="Nawigacja sekcji">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={'nav-dot' + (active === s.id ? ' is-active' : '')}
          onClick={() => scrollTo(s.id)}
          title={s.title}
          aria-label={`Przejdź do sekcji: ${s.title}`}
        />
      ))}
    </nav>
  );
}
