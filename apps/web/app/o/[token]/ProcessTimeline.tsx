'use client';

import { useState } from 'react';

type Step = { t: string; d: string };

/**
 * Klikalna oś czasu procesu — dot'y na rail'u + szczegół wybranego kroku.
 */
export default function ProcessTimeline({ steps, print = false }: { steps: Step[]; print?: boolean }) {
  const [active, setActive] = useState<number>(0);
  const last = steps.length - 1;

  // Tryb PDF/print: wszystkie kroki rozwinięte (oś interaktywna pokazałaby tylko
  // aktywny krok + przyciski nawigacji, których w PDF kliknąć nie można).
  if (print) {
    return (
      <ol className="process-print">
        {steps.map((s, i) => (
          <li key={i} className="process-print-step">
            <span className="pp-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="pp-body">
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <>
      <div className="timeline">
        <div className="timeline-rail">
          <div
            className="timeline-fill"
            style={{ width: `${(active / Math.max(1, last)) * 100}%` }}
          />
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`timeline-dot ${i <= active ? 'done' : ''} ${i === active ? 'current' : ''}`}
              onClick={() => setActive(i)}
              style={{ left: `${(i / Math.max(1, last)) * 100}%` }}
              aria-label={`Krok ${i + 1}`}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="timeline-labels">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`timeline-label ${i === active ? 'current' : ''}`}
              onClick={() => setActive(i)}
              style={{ left: `${(i / Math.max(1, last)) * 100}%` }}
            >
              <span className="lab-i">Krok {String(i + 1).padStart(2, '0')}</span>
              <span className="lab-t">{s.t}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="process-detail">
        <div className="pd-step">
          Krok {String(active + 1).padStart(2, '0')} / {steps.length}
        </div>
        <h3>{steps[active].t}</h3>
        <p>{steps[active].d}</p>
        <div className="pd-nav">
          <button
            type="button"
            onClick={() => setActive(Math.max(0, active - 1))}
            disabled={active === 0}
          >
            ← Poprzedni
          </button>
          <button
            type="button"
            onClick={() => setActive(Math.min(last, active + 1))}
            disabled={active === last}
          >
            Następny →
          </button>
        </div>
      </div>
    </>
  );
}
