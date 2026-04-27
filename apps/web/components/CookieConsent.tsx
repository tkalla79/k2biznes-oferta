'use client';

import { useEffect, useState } from 'react';

/**
 * Cookie consent banner (BACKEND_SPEC.md v1.1.1, sekcja 11.1).
 *
 * Uproszczony model: necessary (zawsze) + analytics (opt-in). Plausible jest
 * cookieless — analytics jest tu dla future-proofing (Sentry sesyjne cookies).
 *
 * Decyzja: storage w localStorage. Brak persistencji w DB — consent jest per-device,
 * nie per-account (klienci końcowi nie mają konta).
 */
const STORAGE_KEY = 'k2_consent_v1';

type Consent = {
  necessary: true;
  analytics: boolean;
  decidedAt: string;
};

export default function CookieConsent() {
  const [decided, setDecided] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setDecided(stored !== null);
  }, []);

  if (decided === null || decided === true) return null;

  function save(analytics: boolean) {
    const value: Consent = {
      necessary: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setDecided(true);
  }

  return (
    <div style={banner} role="dialog" aria-label="Ustawienia plików cookie">
      <div style={inner}>
        <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>
          Używamy plików cookie niezbędnych do działania serwisu oraz — za Twoją zgodą —
          do analityki ruchu (cookieless Plausible). Szczegóły w{' '}
          <a href="/privacy-policy" style={link}>
            polityce prywatności
          </a>
          .
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => save(false)} style={btnSecondary}>
            Tylko niezbędne
          </button>
          <button onClick={() => save(true)} style={btnPrimary}>
            Akceptuj wszystkie
          </button>
        </div>
      </div>
    </div>
  );
}

const banner: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  background: '#1B2A4A',
  color: '#fff',
  padding: '14px 16px',
  boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
};
const inner: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
};
const link: React.CSSProperties = {
  color: '#fff',
  textDecoration: 'underline',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#fff',
  border: '1px solid #fff',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};
