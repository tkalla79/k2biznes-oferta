'use client';

import { useEffect } from 'react';

/**
 * Aktywuje IntersectionObserver dla wszystkich `.reveal`, `.reveal-left`,
 * `.reveal-scale` i `.stagger-children` (port z OFERTA_INTERAKTYWNA app.js
 * sekcja 6 — scroll-reveal).
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const els = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-scale, .stagger-children',
    );
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
