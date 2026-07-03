'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@k2/database/types';

type OfferStatus = Database['public']['Enums']['offer_status'];

type Props = {
  offerId: string;
  offerNumber: string;
  clientToken: string;
  clientName: string;
  status: OfferStatus;
  canDelete: boolean;
};

/**
 * Toolbar akcji nad ofertą (sekcja 5.3):
 *  - Send: dialog z recipient/subject/message/expiresAt → POST /send
 *  - Recalculate: button (z confirm gdy status != draft) → POST /recalculate
 *  - Copy link: kopiuje publiczny URL klienta do schowka
 *  - Soft delete: button (z confirm) — admin only → DELETE /
 */
export default function OfferActions({
  offerId,
  offerNumber,
  clientToken,
  clientName,
  status,
  canDelete,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'recalc' | 'delete'>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const isTerminal = status === 'accepted' || status === 'rejected' || status === 'expired';

  async function recalc() {
    if (
      status !== 'draft' &&
      !confirm(`Oferta ma status "${status}". Rekalkulacja unieważni cache PDF. Kontynuować?`)
    ) {
      return;
    }
    setBusy('recalc');
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}/recalculate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Recalc failed');
      setMsg({ kind: 'ok', text: 'Pricing rekalkulowany.' });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function softDelete() {
    if (
      !confirm(
        `Soft-delete oferty ${offerNumber} (${clientName})?\n\n` +
          `Oferta zniknie z list, ale zostanie w bazie 7 lat dla audytu (RODO).`,
      )
    )
      return;
    setBusy('delete');
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Delete failed');
      // Po delete wracamy do listy.
      startTransition(() => {
        router.push('/admin/offers');
        router.refresh();
      });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
      setBusy(null);
    }
  }

  function copyLink() {
    // Draft: kopiujemy preview URL (działa tylko dla zalogowanego konsultanta).
    // Sent+: kopiujemy publiczny URL klienta.
    const base = `${window.location.origin}/o/${clientToken}`;
    const url = status === 'draft' ? `${base}?__preview=1` : base;
    void navigator.clipboard.writeText(url).then(
      () =>
        setMsg({
          kind: 'ok',
          text:
            status === 'draft'
              ? 'Link podglądu skopiowany (działa tylko dla zalogowanego konsultanta).'
              : 'Link klienta skopiowany.',
        }),
      () => setMsg({ kind: 'err', text: 'Nie udało się skopiować.' }),
    );
  }

  return (
    <div style={wrap}>
      <div style={toolbar}>
        <button
          type="button"
          onClick={() => setSendOpen(true)}
          style={status === 'draft' ? btnPrimary : btnSecondary}
          disabled={isTerminal}
          title={isTerminal ? `Oferta ${status} — nie wysyłamy` : undefined}
        >
          {status === 'sent' || status === 'viewed' ? 'Wyślij ponownie' : 'Wyślij ofertę'}
        </button>

        <button type="button" onClick={recalc} style={btnSecondary} disabled={busy !== null}>
          {busy === 'recalc' ? 'Liczę…' : 'Przelicz pricing'}
        </button>

        <button type="button" onClick={copyLink} style={btnSecondary}>
          Skopiuj link
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={softDelete}
            style={btnDanger}
            disabled={busy !== null}
          >
            {busy === 'delete' ? 'Usuwam…' : 'Soft-delete'}
          </button>
        )}
      </div>

      {msg && (
        <div style={msg.kind === 'ok' ? okBox : errBox}>
          {msg.text}
        </div>
      )}

      {sendOpen && (
        <SendDialog
          offerId={offerId}
          offerNumber={offerNumber}
          clientName={clientName}
          isReSend={status === 'sent' || status === 'viewed'}
          onClose={() => setSendOpen(false)}
          onSent={(email) => {
            setSendOpen(false);
            // Email-reliability 2026-07: awaria wysyłki widoczna OD RAZU, nie
            // dopiero markerem na liście. Status oferty = sent mimo faila.
            setMsg(
              email.delivered
                ? { kind: 'ok', text: 'Oferta wysłana — email dostarczony do wysyłki.' }
                : {
                    kind: 'err',
                    text: `Oferta oznaczona jako wysłana, ale EMAIL NIE DOTARŁ: ${email.error ?? 'nieznany błąd'}. Sprawdź konfigurację (Ustawienia → Test wysyłki email) i wyślij ponownie.`,
                  },
            );
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// SendDialog — modal z formularzem
// -----------------------------------------------------------------------------

function SendDialog({
  offerId,
  offerNumber,
  clientName,
  isReSend,
  onClose,
  onSent,
}: {
  offerId: string;
  offerNumber: string;
  clientName: string;
  isReSend: boolean;
  onClose: () => void;
  onSent: (email: { delivered: boolean; error?: string }) => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState(`Oferta K2Biznes — ${offerNumber}`);
  const [message, setMessage] = useState('');
  // expiresAt — sluzy walidacji UI; format `datetime-local` to "YYYY-MM-DDTHH:MM"
  // (lokalny czas bez timezony). Patrz nizej input z `min` zeby zablokowac przeszlosc.
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/.+@.+\..+/.test(recipientEmail)) {
      setError('Podaj poprawny adres email.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        recipientEmail: recipientEmail.trim(),
      };
      if (recipientName.trim()) body.recipientName = recipientName.trim();
      if (subject.trim()) body.subject = subject.trim();
      if (message.trim()) body.message = message.trim();
      if (expiresAt) {
        const iso = new Date(expiresAt).toISOString();
        const tMs = new Date(iso).getTime();
        const minMs = Date.now() + 60 * 60 * 1000; // +1h
        if (tMs < minMs) {
          setError('Data wygasniecia musi byc co najmniej 1h w przyszlosci.');
          setBusy(false);
          return;
        }
        body.expiresAt = iso;
      }
      const res = await fetch(`/api/offers/${offerId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Send failed');
      onSent({
        delivered: json?.data?.emailDelivered !== false,
        error: json?.data?.emailError,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            {isReSend ? 'Wyślij ponownie ofertę' : 'Wyślij ofertę'}
          </h3>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Zamknij">
            ×
          </button>
        </header>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#6b7a92', margin: 0 }}>
            Klient: <strong>{clientName}</strong> · oferta{' '}
            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              {offerNumber}
            </code>
          </p>

          <Field label="Email odbiorcy *">
            <input
              type="email"
              required
              maxLength={200}
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              style={input}
              autoFocus
            />
          </Field>

          <Field label="Imię i nazwisko (opcjonalne)">
            <input
              type="text"
              maxLength={200}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              style={input}
            />
          </Field>

          <Field label="Temat">
            <input
              type="text"
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={input}
            />
          </Field>

          <Field label="Wiadomość konsultanta (opcjonalna, max 2000 zn.)">
            <textarea
              rows={4}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ ...input, resize: 'vertical', padding: 10, lineHeight: 1.5 }}
              placeholder="Np. Pani Anno, w załączeniu oferta którą omawialiśmy w piątek…"
            />
          </Field>

          <Field label="Wygaśnie (opcjonalnie — domyślnie bez wygaśnięcia)">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              // min = teraz + 1h (zablokuj przeszlosc + zbyt bliska przyszlosc).
              // Local timezone format "YYYY-MM-DDTHH:MM" bez sekund/timezony.
              min={(() => {
                const t = new Date(Date.now() + 60 * 60 * 1000);
                const off = t.getTimezoneOffset() * 60 * 1000;
                return new Date(t.getTime() - off).toISOString().slice(0, 16);
              })()}
              style={input}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Min. 1h od teraz. Zostaw puste = oferta bezterminowa.
            </div>
          </Field>

          {error && <div style={errBox}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary} disabled={busy}>
              Anuluj
            </button>
            <button type="submit" disabled={busy} style={btnPrimary}>
              {busy ? 'Wysyłam…' : 'Wyślij'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const wrap: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
  display: 'grid',
  gap: 12,
};
const toolbar: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};
const btnBase: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: '#c92b3a',
  color: '#fff',
};
const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: '#fff',
  color: '#1B2A4A',
  border: '1px solid #e4e9f2',
};
const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: '#fff',
  color: '#c92b3a',
  border: '1px solid #c92b3a',
  marginLeft: 'auto',
};
const okBox: React.CSSProperties = {
  padding: 10,
  background: '#dff3e8',
  border: '1px solid #1f7a4c',
  borderRadius: 6,
  color: '#1f7a4c',
  fontSize: 13,
};
const errBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(27, 42, 74, 0.5)',
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: 24,
  width: '100%',
  maxWidth: 520,
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};
const modalHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
};
const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 28,
  cursor: 'pointer',
  color: '#6b7a92',
  lineHeight: 1,
  padding: 0,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
