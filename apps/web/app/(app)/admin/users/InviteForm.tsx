'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'consultant' | 'admin' | 'super_admin'>('consultant');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { state: 'idle' }
    | { state: 'success'; email: string }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ state: 'error', message: json?.error?.message ?? 'Błąd.' });
      } else {
        setResult({ state: 'success', email: json.data.email });
        setEmail('');
        setFullName('');
        setRole('consultant');
        router.refresh();
      }
    } catch (err) {
      setResult({ state: 'error', message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
            maxLength={200}
          />
        </Field>
        <Field label="Imię i nazwisko">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={input}
            maxLength={200}
          />
        </Field>
      </div>
      <Field label="Rola">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          style={input}
        >
          <option value="consultant">Konsultant</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super admin</option>
        </select>
      </Field>
      <button type="submit" disabled={submitting} style={btn}>
        {submitting ? 'Wysyłam...' : 'Wyślij zaproszenie'}
      </button>

      {result.state === 'success' && (
        <div style={successBox}>
          ✓ Zaproszenie wysłane na <strong>{result.email}</strong>. Nowy user dostał link
          aktywacyjny.
        </div>
      )}
      {result.state === 'error' && <div style={errorBox}>{result.message}</div>}
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

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  padding: '10px 16px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  width: 'fit-content',
};
const successBox: React.CSSProperties = {
  padding: 12,
  background: '#dff3e8',
  border: '1px solid #1f7a4c',
  borderRadius: 6,
  color: '#1f7a4c',
  fontSize: 13,
};
const errorBox: React.CSSProperties = {
  padding: 12,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};
