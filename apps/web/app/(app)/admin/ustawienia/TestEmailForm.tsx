'use client';

/**
 * Test wysyłki email (email-reliability 2026-07) — POST /api/admin/settings/test-email.
 * Weryfikacja produkcyjnej konfiguracji Resend w 10 sekund (np. po podmianie
 * klucza w Vercel). Pokazuje surowy błąd Resend przy niepowodzeniu.
 */
import { useState } from 'react';

type Result =
  | { state: 'idle' }
  | { state: 'ok'; id: string; mode: string }
  | { state: 'err'; message: string };

export default function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>({ state: 'idle' });

  async function send() {
    setBusy(true);
    setResult({ state: 'idle' });
    try {
      const res = await fetch('/api/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Żądanie nie powiodło się.');
      const r = json.data as { ok: boolean; id?: string; mode?: string; error?: string };
      if (r.ok) {
        setResult({ state: 'ok', id: r.id ?? '?', mode: r.mode ?? '?' });
      } else {
        setResult({ state: 'err', message: r.error ?? 'Nieznany błąd wysyłki.' });
      }
    } catch (e) {
      setResult({ state: 'err', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <h2 style={h2}>Test wysyłki email</h2>
      <p style={hint}>
        Wysyła wiadomość testową tą samą ścieżką co oferty (Resend). Użyj po każdej zmianie
        konfiguracji email, zanim wyślesz ofertę do klienta.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="adres@domena.pl"
          style={input}
        />
        <button onClick={send} disabled={busy || !/.+@.+\..+/.test(to)} style={btn}>
          {busy ? 'Wysyłam…' : 'Wyślij test'}
        </button>
      </div>
      {result.state === 'ok' && (
        <div style={okBox}>
          ✓ Wysyłka przyjęta (tryb: {result.mode}, id: {result.id}). Sprawdź skrzynkę odbiorcy.
        </div>
      )}
      {result.state === 'err' && (
        <div style={errBox}>
          ✗ Wysyłka nie powiodła się: {result.message}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e4e9f2', borderRadius: 10, padding: 24, marginTop: 20 };
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 8px', color: '#1B2A4A' };
const hint: React.CSSProperties = { fontSize: 13, color: '#6b7a92', margin: '0 0 14px', lineHeight: 1.5 };
const input: React.CSSProperties = { flex: 1, padding: '10px 12px', border: '1px solid #d4dae6', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' };
const btn: React.CSSProperties = { padding: '10px 18px', background: '#1B2A4A', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
const okBox: React.CSSProperties = { marginTop: 12, padding: 10, background: '#e6f4ea', border: '1px solid #b7dfc4', color: '#1f7a4c', borderRadius: 6, fontSize: 13 };
const errBox: React.CSSProperties = { marginTop: 12, padding: 10, background: '#fce8e6', border: '1px solid #f5c6c2', color: '#A8140F', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' };
