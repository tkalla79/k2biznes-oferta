'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animowany licznik 0 → `to` po wejściu w viewport (IntersectionObserver).
 * Używany w sekcji "O nas" (Onas): 475 mln, 288, 15+ lat.
 */
export default function CountUp({
  to,
  duration = 1400,
  decimals = 0,
  immediate = false,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  /** Uwaga PDF (12.06): w wydruku puppeteer IntersectionObserver + animacja
   *  nie odpalają → licznik zostawał na 0. immediate (=isPrint) renderuje od
   *  razu wartość końcową bez animacji. */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(immediate ? to : 0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (immediate || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: 0.25 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [immediate]);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {n.toLocaleString('pl-PL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
