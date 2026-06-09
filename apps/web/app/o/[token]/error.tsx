'use client';

/**
 * Error boundary dla /o/[token] (H7 audit).
 *
 * Gdy Supabase się wywali (timeout, pause, crash) podczas renderu oferty,
 * bez tego klient widzi default Next 500 i NIE zaakceptuje oferty. Tu: friendly
 * komunikat PL + retry + kontakt. Sentry łapie error (useEffect capture).
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function OfferError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#fbfaf7',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: 'center',
          background: '#fff',
          border: '1px solid #e4e6ec',
          borderRadius: 14,
          padding: '48px 40px',
          boxShadow: '0 8px 28px rgba(18,26,40,.06)',
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#D91E18',
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          K2BIZNES
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 400,
            fontSize: 28,
            color: '#2a324b',
            margin: '0 0 12px',
          }}
        >
          Nie udało się załadować oferty
        </h1>
        <p style={{ color: '#6B7385', fontSize: 15, lineHeight: 1.55, margin: '0 0 28px' }}>
          Przepraszamy za utrudnienie. Spróbuj odświeżyć stronę — jeśli problem
          się powtarza, prosimy o kontakt z osobą prowadzącą Państwa ofertę.
        </p>
        <button
          onClick={reset}
          style={{
            display: 'inline-block',
            padding: '14px 32px',
            background: '#D91E18',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          Spróbuj ponownie
        </button>
        <div style={{ fontSize: 13, color: '#6B7385', paddingTop: 20, borderTop: '1px solid #e4e6ec' }}>
          <a href="mailto:kontakt@k2biznes.pl" style={{ color: '#6B7385' }}>
            kontakt@k2biznes.pl
          </a>
        </div>
      </div>
    </div>
  );
}
