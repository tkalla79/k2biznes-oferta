'use client';

import { useState } from 'react';

type ScopeItem = { t: string; d: string };

/**
 * Tabs (prep/exec) + accordion z otwartym pierwszym wpisem na zmianę tab'a.
 * Sekcja "Zakres usługi doradczej" — co dokładnie robimy.
 */
export default function ScopeAccordion({
  prep,
  exec,
  print = false,
}: {
  prep: ScopeItem[];
  exec: ScopeItem[];
  print?: boolean;
}) {
  const [tab, setTab] = useState<'prep' | 'exec'>('prep');
  const [open, setOpen] = useState<number>(0);
  const list = tab === 'prep' ? prep : exec;

  // Tryb PDF/print: oba zakresy (przygotowanie + obsługa) w całości rozwinięte —
  // klikalne taby/akordeon renderowałyby w DOM tylko aktywny tab.
  if (print) {
    return (
      <div className="scope-print">
        {[
          { title: 'Przygotowanie dokumentacji', tag: 'w cenie oferty', items: prep },
          { title: 'Obsługa i rozliczanie projektu', tag: 'opcjonalne', items: exec },
        ].map((block) => (
          <div className="scope-print-block" key={block.title}>
            <h3 className="scope-print-h">
              {block.title} <span className="tab-tag">{block.tag}</span>
            </h3>
            <ul className="scope-list is-print">
              {block.items.map((s, i) => (
                <li key={i} className="open">
                  <div className="scope-head">
                    <span className="scope-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="scope-title">{s.t}</span>
                  </div>
                  <div className="scope-body">
                    <p>{s.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'prep' ? 'on' : ''}
          onClick={() => {
            setTab('prep');
            setOpen(0);
          }}
        >
          <span className="tab-num">01</span>
          <span className="tab-label">Przygotowanie dokumentacji</span>
          <span className="tab-tag">w cenie oferty</span>
        </button>
        <button
          type="button"
          className={tab === 'exec' ? 'on' : ''}
          onClick={() => {
            setTab('exec');
            setOpen(0);
          }}
        >
          <span className="tab-num">02</span>
          <span className="tab-label">Obsługa i rozliczanie projektu</span>
          <span className="tab-tag opt">opcjonalne</span>
        </button>
      </div>
      <div className="scope-intro">
        {tab === 'prep' ? (
          <p>Szczegółowy zakres prac na etapie przygotowania kompletnej dokumentacji aplikacyjnej dla Projektu.</p>
        ) : (
          <p>
            Po pozytywnej decyzji o dofinansowaniu klient może kontynuować współpracę przy obsłudze
            i rozliczeniu dofinansowanego projektu.
          </p>
        )}
      </div>
      <ul className="scope-list">
        {list.map((s, i) => (
          <li key={`${tab}-${i}`} className={open === i ? 'open' : ''}>
            <button
              type="button"
              className="scope-head"
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
            >
              <span className="scope-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="scope-title">{s.t}</span>
              <span className="scope-icn" aria-hidden>
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
            <div className="scope-body">
              <p>{s.d}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
