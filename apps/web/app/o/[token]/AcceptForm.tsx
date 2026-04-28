'use client';

import { useState } from 'react';

type Variant = 'I' | 'II' | 'III' | 'IV';

type Props = {
  token: string;
  offeredVariants: Variant[];
  defaultVariant: Variant;
  gdprClauseVersion: string;
  gdprText: string;
  /** Disabled-mode: pokazujemy formularz w trybie podglądu (preview konsultanta). */
  previewOnly?: boolean;
};

/**
 * Formularz akceptacji oferty — pasuje do `.accept-form` w nowym designie
 * (Claude Design — corporate variant).
 *
 * Klasy CSS pochodzą ze styles.css — żadnego inline'a, żeby spójność była
 * sterowana z arkusza stylów.
 */
export default function AcceptForm({
  token,
  offeredVariants,
  defaultVariant,
  gdprClauseVersion,
  gdprText,
  previewOnly = false,
}: Props) {
  const [variant, setVariant] = useState<Variant>(defaultVariant);
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
    if (previewOnly) {
      alert('Tryb podglądu — akceptacja niedostępna. Wyślij ofertę klientowi linkiem.');
      return;
    }
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
        setResult({ state: 'error', message: json?.error?.message ?? 'Nie udało się zaakceptować.' });
      } else {
        setResult({ state: 'success', offerNumber: json.data.offerNumber, variant: json.data.variant });
      }
    } catch (err) {
      setResult({ state: 'error', message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (result.state === 'success') {
    return (
      <div className="accept-success">
        <div className="ok-ring" aria-hidden>
          <svg viewBox="0 0 80 80" width="80" height="80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" />
            <path
              d="M25 42l10 10 20-22"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2>Oferta zaakceptowana</h2>
        <p>
          Dziękujemy za zaufanie. Skontaktujemy się w&nbsp;ciągu <strong>1 dnia roboczego</strong>,
          aby umówić podpisanie umowy. Numer oferty: <strong>{result.offerNumber}</strong>, wariant{' '}
          <strong>{result.variant}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form className="accept-form" onSubmit={submit}>
      <h3>{previewOnly ? 'Formularz (podgląd)' : 'Twoje dane'}</h3>

      {offeredVariants.length > 1 && (
        <label>
          <span>Wybrany wariant</span>
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as Variant)}
            disabled={previewOnly}
          >
            {offeredVariants.map((v) => (
              <option key={v} value={v}>
                Wariant {v}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span>Imię i nazwisko osoby akceptującej</span>
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jan Kowalski"
          disabled={previewOnly}
          maxLength={200}
        />
      </label>

      <label>
        <span>E-mail</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jan@firma.pl"
          disabled={previewOnly}
          maxLength={200}
        />
      </label>

      <label>
        <span>Komentarz / uwagi (opcjonalnie)</span>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Np. preferowana godzina kontaktu lub uwagi do wariantu"
          disabled={previewOnly}
          maxLength={2000}
        />
      </label>

      {!previewOnly && (
        <label className="accept-gdpr">
          <input
            type="checkbox"
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
            required
          />
          <span>{gdprText}</span>
        </label>
      )}

      <button
        type="submit"
        className="accept-btn"
        disabled={previewOnly ? false : !gdpr || submitting || !name || !email}
      >
        {previewOnly ? 'Akceptacja w trybie klienta' : `Akceptuję ofertę · Wariant ${variant}`}
        <em>→</em>
      </button>

      <p className="accept-note">
        Akceptacja nie stanowi zawarcia umowy. Po potwierdzeniu prześlemy projekt umowy do podpisu.
      </p>

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
