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
}: {
  to: number;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: 0.25 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

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
