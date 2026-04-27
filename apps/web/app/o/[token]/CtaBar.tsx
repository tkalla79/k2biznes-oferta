'use client';

import { useState } from 'react';
import AcceptForm from './AcceptForm';

type Props = {
  token: string;
  offeredVariants: Array<'I' | 'II' | 'III' | 'IV'>;
  defaultVariant: 'I' | 'II' | 'III' | 'IV';
  gdprClauseVersion: string;
  gdprText: string;
  contactEmail: string | null;
};

export default function CtaBar(props: Props) {
  const [acceptOpen, setAcceptOpen] = useState(false);

  function logEvent(type: 'pdf_downloaded' | 'link_shared') {
    fetch(`/api/public/offers/${encodeURIComponent(props.token)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <>
      <div className="cta-bar" id="cta-bar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setAcceptOpen(true)}
        >
          Akceptuję ofertę
        </button>
        {props.contactEmail && (
          <a
            className="btn btn--outline"
            href={`mailto:${props.contactEmail}?subject=Spotkanie - oferta K2Biznes`}
          >
            Umów spotkanie
          </a>
        )}
        <a
          className="btn btn--ghost"
          href={`/api/public/offers/${encodeURIComponent(props.token)}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logEvent('pdf_downloaded')}
        >
          Pobierz PDF
        </a>
      </div>

      {acceptOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Akceptacja oferty"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAcceptOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 26, 47, 0.7)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              fontFamily: 'system-ui, sans-serif',
              color: '#1B2A4A',
            }}
          >
            <button
              type="button"
              onClick={() => setAcceptOpen(false)}
              aria-label="Zamknij"
              style={{
                float: 'right',
                background: 'transparent',
                border: 'none',
                fontSize: 24,
                lineHeight: 1,
                cursor: 'pointer',
                color: '#6b7a92',
              }}
            >
              ×
            </button>
            <AcceptForm
              token={props.token}
              offeredVariants={props.offeredVariants}
              defaultVariant={props.defaultVariant}
              gdprClauseVersion={props.gdprClauseVersion}
              gdprText={props.gdprText}
            />
          </div>
        </div>
      )}
    </>
  );
}
