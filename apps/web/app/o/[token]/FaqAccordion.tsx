'use client';

import { useState } from 'react';

type Item = { q: string; a: string };

export default function FaqAccordion({ items, print = false }: { items: Item[]; print?: boolean }) {
  const [open, setOpen] = useState<number>(0);
  // Tryb PDF/print: wszystkie odpowiedzi rozwinięte (klient dostaje pełen FAQ).
  return (
    <ul className={print ? 'faq-list is-print' : 'faq-list'}>
      {items.map((f, i) => (
        <li key={i} className={print || open === i ? 'open' : ''}>
          <button
            type="button"
            className="faq-q"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
          >
            <span>{f.q}</span>
            <span className="faq-icn" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path
                  d="M3 5l4 4 4-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <div className="faq-a">
            <p>{f.a}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
