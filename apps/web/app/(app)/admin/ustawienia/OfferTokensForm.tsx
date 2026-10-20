'use client';

/**
 * Wartości podstawiane w treści ofert. PUT /api/admin/settings/offer-tokens.
 *
 * Formularz jest tu po to, żeby zmiana przepisu była jednym wpisem, a nie
 * przeglądaniem wszystkich szablonów w poszukiwaniu starej kwoty.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  OFFER_TOKEN_KEYS,
  OFFER_TOKEN_LABELS,
  OFFER_TOKEN_HINTS,
  type OfferTokens,
} from '@/lib/offers/tokens';

export default function OfferTokensForm({ initial }: { initial: OfferTokens }) {
  const router = useRouter();
  const [form, setForm] = useState<OfferTokens>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings/offer-tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Zapis nie powiódł się.');
      setMsg({ ok: true, text: 'Zapisano — zmiana widoczna we wszystkich ofertach z tym tokenem.' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <h2 style={h2}>Wartości podstawiane w treści oferty</h2>
      <p style={lead}>
        W treści oferty albo szablonu wpisz token w podwójnych klamrach, a oferta pokaże
        aktualną wartość stąd. Dzięki temu zmiana przepisu to jeden wpis, a nie przeglądanie
        wszystkich szablonów. Nieznany token zostaje w tekście widoczny — żeby literówki nie
        robiły dziury w zdaniu.
      </p>

      {OFFER_TOKEN_KEYS.map((k) => (
        <label key={k} style={{ display: 'block', marginBottom: 16 }}>
          <span style={labelText}>
            {OFFER_TOKEN_LABELS[k]} <code style={code}>{`{{${k}}}`}</code>
          </span>
          <span style={hintText}>{OFFER_TOKEN_HINTS[k]}</span>
          <input
            style={input}
            value={form[k]}
            maxLength={80}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          />
        </label>
      ))}

      {msg && <div style={msg.ok ? okBox : errBox}>{msg.text}</div>}

      <button onClick={save} disabled={busy} style={btnPrimary}>
        {busy ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 10,
  padding: 24,
  marginTop: 24,
};
const h2: React.CSSProperties = { fontSize: 18, margin: '0 0 6px' };
const lead: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7a92',
  lineHeight: 1.6,
  margin: '0 0 20px',
};
const labelText: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  color: '#3a4254',
  marginBottom: 4,
};
const hintText: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#9aa3b2',
  marginBottom: 6,
};
const code: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
  background: '#f1f3f7',
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  padding: '1px 6px',
  color: '#1B2A4A',
  fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d4dae6',
  borderRadius: 6,
  fontSize: 15,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  padding: '12px 24px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 4,
};
const okBox: React.CSSProperties = {
  marginBottom: 14,
  padding: 10,
  background: '#e6f4ea',
  border: '1px solid #b7dfc4',
  color: '#1f7a4c',
  borderRadius: 6,
  fontSize: 13,
};
const errBox: React.CSSProperties = {
  marginBottom: 14,
  padding: 10,
  background: '#fce8e6',
  border: '1px solid #f5c6c2',
  color: '#A8140F',
  borderRadius: 6,
  fontSize: 13,
};
