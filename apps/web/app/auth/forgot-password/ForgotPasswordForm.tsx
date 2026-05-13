'use client';

import { useState } from 'react';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Błąd.');
        return;
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={success}>
        Jeśli konto z adresem <strong>{email}</strong> istnieje, wysłaliśmy na nie link do
        zresetowania hasła. Sprawdź skrzynkę (sprawdź też spam).
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <label style={{ display: 'block' }}>
        <div style={labelText}>Email konta</div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          autoComplete="email"
          maxLength={200}
          placeholder="t.kalla@k2biznes.pl"
        />
      </label>

      <button type="submit" disabled={submitting} style={btn}>
        {submitting ? 'Wysyłam…' : 'Wyślij link resetujący'}
      </button>

      {error && <div style={errorBox}>{error}</div>}

      <p style={hint}>
        Wyślemy email z linkiem do strony, gdzie ustawisz nowe hasło. Link jest ważny 1h.
      </p>
    </form>
  );
}

const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 4 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  padding: '12px 20px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
const errorBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};
const success: React.CSSProperties = {
  padding: 16,
  background: '#dff3e8',
  border: '1px solid #1f7a4c',
  borderRadius: 6,
  color: '#1f7a4c',
  fontSize: 14,
  lineHeight: 1.5,
};
const hint: React.CSSProperties = { fontSize: 12, color: '#6b7a92', margin: 0, lineHeight: 1.4 };
