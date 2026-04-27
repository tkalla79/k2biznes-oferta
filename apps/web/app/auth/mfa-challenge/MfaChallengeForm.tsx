'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function MfaChallengeForm({
  factorId,
  next,
}: {
  factorId: string;
  next: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        const res = await fetch('/api/auth/mfa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factorId, code }),
        });
        setBusy(false);
        if (!res.ok) {
          const j = await res.json();
          setError(j?.error?.message ?? 'Niepoprawny kod.');
          setCode('');
          return;
        }
        startTransition(() => {
          router.push(next);
          router.refresh();
        });
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{6,8}"
        required
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        style={input}
        placeholder="000000"
        autoComplete="one-time-code"
        autoFocus
      />
      <button type="submit" disabled={busy || pending || code.length < 6} style={btn}>
        {busy ? 'Sprawdzam…' : pending ? 'Przekierowuję…' : 'Zweryfikuj'}
      </button>
      {error && <div style={errorBox}>{error}</div>}
      <a href="/api/auth/signout" style={link}>
        Wyloguj się
      </a>
    </form>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '14px 12px',
  fontSize: 24,
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  textAlign: 'center',
  letterSpacing: 4,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
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
const link: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7a92',
  textAlign: 'center',
  textDecoration: 'none',
};
