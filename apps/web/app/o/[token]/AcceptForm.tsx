'use client';

import { useState } from 'react';

type Props = {
  token: string;
  offeredVariants: Array<'I' | 'II' | 'III' | 'IV'>;
  defaultVariant: 'I' | 'II' | 'III' | 'IV';
  gdprClauseVersion: string;
  gdprText: string;
};

export default function AcceptForm({
  token,
  offeredVariants,
  defaultVariant,
  gdprClauseVersion,
  gdprText,
}: Props) {
  const [variant, setVariant] = useState(defaultVariant);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [gdpr, setGdpr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { state: 'idle' }
    | { state: 'success'; offerNumber: string; variant: string }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gdpr) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/offers/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedVariant: variant,
          clientName: name,
          clientEmail: email,
          comment: comment || undefined,
          acceptedGdpr: true,
          gdprClauseVersion,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({
          state: 'error',
          message: json?.error?.message ?? 'Nie udało się zaakceptować.',
        });
      } else {
        setResult({
          state: 'success',
          offerNumber: json.data.offerNumber,
          variant: json.data.variant,
        });
      }
    } catch (err) {
      setResult({
        state: 'error',
        message: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (result.state === 'success') {
    return (
      <div
        style={{
          background: '#dff3e8',
          border: '1px solid #1f7a4c',
          borderRadius: 8,
          padding: 20,
          marginTop: 24,
          color: '#1f7a4c',
        }}
      >
        ✓ Oferta {result.offerNumber} zaakceptowana (Wariant {result.variant}). Konsultant skontaktuje się z Tobą.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        marginTop: 32,
        padding: 24,
        background: '#fff',
        border: '1px solid #e4e9f2',
        borderRadius: 8,
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 22 }}>Akceptacja oferty</h2>

      <Field label="Wybrany wariant">
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as typeof variant)}
          style={inputStyle}
        >
          {offeredVariants.map((v) => (
            <option key={v} value={v}>
              Wariant {v}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Imię i nazwisko">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          maxLength={200}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          maxLength={200}
        />
      </Field>

      <Field label="Komentarz (opcjonalny)">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          maxLength={2000}
        />
      </Field>

      <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#6b7a92', marginTop: 16 }}>
        <input
          type="checkbox"
          checked={gdpr}
          onChange={(e) => setGdpr(e.target.checked)}
          required
          style={{ marginTop: 3 }}
        />
        <span>{gdprText}</span>
      </label>

      <button
        type="submit"
        disabled={!gdpr || submitting || !name || !email}
        style={{
          marginTop: 20,
          background: '#c92b3a',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '12px 20px',
          fontSize: 15,
          fontWeight: 600,
          cursor: !gdpr || submitting || !name || !email ? 'not-allowed' : 'pointer',
          opacity: !gdpr || submitting || !name || !email ? 0.6 : 1,
        }}
      >
        {submitting ? 'Wysyłanie…' : `Akceptuję Wariant ${variant}`}
      </button>

      {result.state === 'error' && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#fae8ea',
            border: '1px solid #c92b3a',
            color: '#c92b3a',
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: '#6b7a92', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  background: '#fff',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
