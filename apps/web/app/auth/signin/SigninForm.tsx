'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'password' | 'magic';

export default function SigninForm({
  initialError,
  next,
}: {
  initialError?: string;
  next?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [magicSent, setMagicSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'password') {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Błąd logowania.');
        return;
      }
      const dest = json?.data?.mfaRequired
        ? `/auth/mfa-challenge?next=${encodeURIComponent(next ?? '/admin')}`
        : (next ?? '/admin');
      startTransition(() => {
        router.push(dest);
        router.refresh();
      });
    } else {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: next ?? '/admin' }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message ?? 'Błąd.');
        return;
      }
      setMagicSent(true);
    }
  }

  if (magicSent) {
    return (
      <div style={success}>
        Wysłaliśmy link do logowania na <strong>{email}</strong>. Sprawdź skrzynkę i kliknij
        link żeby się zalogować.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div style={tabs}>
        <button
          type="button"
          onClick={() => setMode('password')}
          style={mode === 'password' ? tabActive : tab}
        >
          Hasło
        </button>
        <button
          type="button"
          onClick={() => setMode('magic')}
          style={mode === 'magic' ? tabActive : tab}
        >
          Magic link
        </button>
      </div>

      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          autoComplete="email"
          maxLength={200}
        />
      </Field>

      {mode === 'password' && (
        <Field label="Hasło">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
            autoComplete="current-password"
            maxLength={200}
          />
        </Field>
      )}

      <button type="submit" disabled={pending} style={btn}>
        {pending
          ? 'Loguję...'
          : mode === 'password'
            ? 'Zaloguj'
            : 'Wyślij link na email'}
      </button>

      {error && <div style={errorBox}>{error}</div>}

      {mode === 'password' && (
        <p style={hint}>
          Nie pamiętasz hasła?{' '}
          <a href="/auth/forgot-password" style={{ color: '#c92b3a', textDecoration: 'none' }}>
            Zresetuj hasło
          </a>{' '}
          lub użyj <strong>magic link</strong>.
        </p>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#6b7a92', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const tabs: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  background: '#f5f3ee',
  padding: 4,
  borderRadius: 6,
};
const tab: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  background: 'transparent',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  color: '#6b7a92',
  cursor: 'pointer',
  borderRadius: 4,
};
const tabActive: React.CSSProperties = {
  ...tab,
  background: '#fff',
  color: '#1B2A4A',
  fontWeight: 600,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
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
const hint: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7a92',
  margin: 0,
  lineHeight: 1.4,
};
