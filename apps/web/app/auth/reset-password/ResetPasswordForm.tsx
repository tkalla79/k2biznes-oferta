'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    if (password !== confirm) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Błąd resetu hasła.');
        return;
      }
      setDone(true);
      // Po 3s przekieruj na signin (sesja juz wylogowana po stronie serwera)
      setTimeout(() => {
        startTransition(() => {
          router.push('/auth/signin');
          router.refresh();
        });
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={success}>
        ✓ Hasło zostało zmienione. Za chwilę przekierujemy Cię na ekran logowania.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <label style={{ display: 'block' }}>
        <div style={labelText}>Nowe hasło (min 8 znaków)</div>
        <input
          type="password"
          required
          minLength={8}
          maxLength={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          autoComplete="new-password"
        />
      </label>

      <label style={{ display: 'block' }}>
        <div style={labelText}>Powtórz hasło</div>
        <input
          type="password"
          required
          minLength={8}
          maxLength={200}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={input}
          autoComplete="new-password"
        />
      </label>

      <button type="submit" disabled={submitting || pending} style={btn}>
        {submitting ? 'Zmieniam…' : 'Zmień hasło'}
      </button>

      {error && <div style={errorBox}>{error}</div>}

      <p style={hint}>
        Po zmianie hasła zostaniesz wylogowany ze wszystkich sesji — zaloguj się ponownie.
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
