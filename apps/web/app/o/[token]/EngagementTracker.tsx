'use client';

import { useEffect } from 'react';

/**
 * Śledzi, jak daleko klient doczytał ofertę (audyt 2026-07, pkt 6).
 *
 * IntersectionObserver na sekcjach oferty — przy pierwszym pojawieniu się
 * sekcji w viewport wysyła event `scroll_depth` z payload `{section}`.
 * Typ eventu istnieje w backendzie od MVP (PublicEventType), ale frontend
 * nigdy go nie emitował — dashboard aktywności był ślepy poniżej `viewed`.
 *
 * Dedup: sessionStorage per token+sekcja (jak ViewTracker — F5 nie dubluje),
 * dodatkowo unobserve po pierwszym strzale. Max ~9 eventów na sesję,
 * rate-limit 100/min/IP ma ogromny zapas.
 *
 * Montowany tylko dla klienta (page.tsx: !isPrint && !isPreview && isActive)
 * — podgląd konsultanta i render PDF nie zaśmiecają statystyk.
 */
const TRACKED_SECTIONS = [
  'intro',
  'program',
  'zakres',
  'cennik',
  'proces',
  'onas',
  'case',
  'faq',
  'akcept',
];

export default function EngagementTracker({ token }: { token: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const send = (section: string) => {
      fetch(`/api/public/offers/${encodeURIComponent(token)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'scroll_depth', payload: { section } }),
        keepalive: true,
      }).catch(() => {
        // Fail silently — UX nie zależy od trackingu.
      });
    };

    // threshold 0.1: sekcje bywają wyższe niż viewport, więc wysokie progi
    // (np. 0.4) nigdy by nie odpaliły (intersectionRatio max = vh/sectionH).
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          io.unobserve(entry.target);
          const key = `k2_sd_${token}_${id}`;
          try {
            if (sessionStorage.getItem(key)) continue;
            sessionStorage.setItem(key, '1');
          } catch {
            // sessionStorage niedostępny (tryb prywatny) — wysyłamy bez dedupu.
          }
          send(id);
        }
      },
      { threshold: 0.1 },
    );

    for (const id of TRACKED_SECTIONS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [token]);

  return null;
}
