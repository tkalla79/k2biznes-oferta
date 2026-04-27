'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ExistingFactor = { id: string; friendlyName: string } | null;
type EnrollData = { factorId: string; secret: string; qrCode: string; uri: string };

export default function MfaSetupForm({
  existingFactor,
  next,
}: {
  existingFactor: ExistingFactor;
  next?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState('');
  const [friendlyName, setFriendlyName] = useState('Aplikacja TOTP');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Stan 1: user już ma verified factor — opcja unenroll
  if (existingFactor) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={success}>
          MFA jest <strong>aktywne</strong> ({existingFactor.friendlyName}). Twoja sesja wymaga
          kodu z aplikacji TOTP przy każdym logowaniu.
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Wyłączyć MFA? To obniży poziom bezpieczeństwa konta.')) return;
            setBusy(true);
            setError(null);
            const res = await fetch('/api/auth/mfa/unenroll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ factorId: existingFactor.id }),
            });
            setBusy(false);
            if (!res.ok) {
              const j = await res.json();
              setError(j?.error?.message ?? 'Błąd.');
              return;
            }
            startTransition(() => router.refresh());
          }}
          style={btnSecondary}
        >
          {busy ? 'Wyłączam…' : 'Wyłącz MFA'}
        </button>
        {error && <div style={errorBox}>{error}</div>}
        <button
          type="button"
          onClick={() => router.push(next ?? '/admin')}
          style={btnLink}
        >
          ← Wróć do panelu
        </button>
      </div>
    );
  }

  // Stan 2: enroll w trakcie — pokazujemy QR + form na kod
  if (enroll) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          const res = await fetch('/api/auth/mfa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factorId: enroll.factorId, code }),
          });
          setBusy(false);
          if (!res.ok) {
            const j = await res.json();
            setError(j?.error?.message ?? 'Niepoprawny kod.');
            return;
          }
          startTransition(() => {
            router.push(next ?? '/admin');
            router.refresh();
          });
        }}
        style={{ display: 'grid', gap: 14 }}
      >
        <p style={hint}>
          1. Zeskanuj kod QR aplikacją TOTP (Google Authenticator, 1Password, Authy, …).
        </p>
        <div style={qrBox}>
          {/* qrCode to data:image/svg+xml;... — bezpieczny inline */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qrCode} alt="QR code do zeskanowania" style={qrImg} />
        </div>
        <details style={details}>
          <summary style={summary}>Nie mogę zeskanować — pokaż secret ręcznie</summary>
          <div style={secretBox}>
            <code style={secretCode}>{enroll.secret}</code>
          </div>
        </details>
        <p style={hint}>2. Wpisz 6-cyfrowy kod z aplikacji żeby aktywować MFA:</p>
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
        <button type="submit" disabled={busy || code.length < 6} style={btn}>
          {busy ? 'Sprawdzam…' : 'Aktywuj MFA'}
        </button>
        {error && <div style={errorBox}>{error}</div>}
        <button
          type="button"
          onClick={() => {
            setEnroll(null);
            setCode('');
            setError(null);
          }}
          style={btnLink}
        >
          ← Anuluj
        </button>
      </form>
    );
  }

  // Stan 3: start — przycisk "Włącz MFA"
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={hint}>
        MFA dodaje drugi krok logowania (kod z aplikacji TOTP). Wymagane dla kont admin
        i super_admin.
      </p>
      <label style={{ display: 'block' }}>
        <div style={labelText}>Nazwa urządzenia (opcjonalnie)</div>
        <input
          type="text"
          value={friendlyName}
          onChange={(e) => setFriendlyName(e.target.value)}
          style={input}
          maxLength={80}
          placeholder="iPhone, 1Password, …"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          const res = await fetch('/api/auth/mfa/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendlyName: friendlyName || 'TOTP' }),
          });
          setBusy(false);
          const j = await res.json();
          if (!res.ok) {
            setError(j?.error?.message ?? 'Błąd.');
            return;
          }
          setEnroll(j.data as EnrollData);
        }}
        style={btn}
      >
        {busy ? 'Generuję…' : 'Włącz MFA'}
      </button>
      {error && <div style={errorBox}>{error}</div>}
      {pending && <div style={hint}>Przekierowuję…</div>}
    </div>
  );
}

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
const btnSecondary: React.CSSProperties = {
  ...btn,
  background: '#fff',
  color: '#c92b3a',
  border: '1px solid #c92b3a',
};
const btnLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6b7a92',
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
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
  fontSize: 13,
  color: '#6b7a92',
  margin: 0,
  lineHeight: 1.5,
};
const labelText: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7a92',
  marginBottom: 4,
};
const qrBox: React.CSSProperties = {
  background: '#fff',
  padding: 12,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  display: 'grid',
  placeItems: 'center',
};
const qrImg: React.CSSProperties = {
  width: 200,
  height: 200,
  display: 'block',
};
const details: React.CSSProperties = {
  fontSize: 13,
};
const summary: React.CSSProperties = {
  cursor: 'pointer',
  color: '#6b7a92',
  padding: '4px 0',
};
const secretBox: React.CSSProperties = {
  background: '#f5f3ee',
  padding: 12,
  borderRadius: 4,
  marginTop: 8,
  wordBreak: 'break-all',
};
const secretCode: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 13,
  color: '#1B2A4A',
};
