'use client';

import { useEffect, useRef } from 'react';

/**
 * Loguje event `viewed` raz na sesję (dedup w sessionStorage żeby F5 nie liczył).
 * Backend dodatkowo dedupuje przez `first_viewed_at` (sekcja 5.3).
 */
export default function ViewTracker({ token }: { token: string }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    if (typeof window === 'undefined') return;
    const key = `k2_view_${token}`;
    if (sessionStorage.getItem(key)) return;
    sentRef.current = true;
    sessionStorage.setItem(key, '1');

    fetch(`/api/public/offers/${encodeURIComponent(token)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'viewed' }),
      keepalive: true,
    }).catch(() => {
      // Fail silently — UX nie zależy od trackingu.
    });
  }, [token]);

  return null;
}
