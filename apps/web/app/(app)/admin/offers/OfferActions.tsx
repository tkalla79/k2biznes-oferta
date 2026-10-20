'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@k2/database/types';
import { defaultOfferSubject } from '@/lib/email/subject';

type OfferStatus = Database['public']['Enums']['offer_status'];

/**
 * Osoba wskazana w ofercie do kontaktu — dostaje kopię (CC) maila z ofertą.
 * `null` = w ofercie nie wybrano nikogo; `email: null` = wybrano osobę, która
 * nie ma maila w katalogu (wtedy kopia nie poleci i UI to mówi wprost).
 */
type CcRecipient = { name: string; email: string | null } | null;

type Props = {
  offerId: string;
  offerNumber: string;
  clientToken: string;
  clientName: string;
  status: OfferStatus;
  canDelete: boolean;
  ccRecipient: CcRecipient;
  /** Do podpowiedzi tematu — dialog pokazuje dokładnie to, co pójdzie w mailu. */
  programLabel: string;
  /**
   * Wewnętrzna akceptacja: `null` = niezatwierdzona, czyli wysyłka zablokowana.
   * `name` to osoba, która zatwierdziła (albo jej e-mail, gdy brak nazwiska).
   */
  approval: { name: string; at: string } | null;
  /** Zatwierdza admin+; konsultant widzi stan, ale nie ma przycisku. */
  canApprove: boolean;
  /** Typ oferty — tylko dotacja ma warianty do wyboru przy akceptacji. */
  offerKind: 'grant' | 'loan' | 'exec';
  /** Warianty zaproponowane klientowi — z nich wybiera decyzja. */
  offeredVariants: Array<'I' | 'II' | 'III' | 'IV'>;
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
  ccRecipient,
  programLabel,
  approval,
  canApprove,
  offerKind,
  offeredVariants,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'recalc' | 'delete' | 'approve' | 'publish' | 'revert'>(
    null,
  );
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

  async function setApproval(approve: boolean) {
    if (
      !approve &&
      !confirm(
        'Cofnąć zatwierdzenie? Oferty nie będzie można wysłać, dopóki ktoś nie ' +
          'zatwierdzi jej ponownie.',
      )
    ) {
      return;
    }
    setBusy('approve');
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}/approve`, {
        method: approve ? 'POST' : 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Operacja nie udała się.');
      setMsg({
        kind: 'ok',
        text: approve
          ? 'Oferta zatwierdzona do wysyłki.'
          : 'Zatwierdzenie cofnięte — wysyłka zablokowana.',
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Cofnięcie decyzji wpisanej z panelu. Serwer odmówi, jeśli decyzję podjął
   * klient w formularzu — stąd przycisk widoczny zawsze przy statusie
   * terminalnym, a rozstrzygnięcie po stronie API (jedno źródło prawdy).
   */
  async function revertDecision() {
    if (
      !confirm(
        'Cofnąć zapisaną decyzję i wrócić do statusu sprzed niej?\n\n' +
          'Działa tylko dla decyzji wpisanej z panelu. Kwota, wariant i notatka ' +
          'zostaną wyczyszczone.',
      )
    ) {
      return;
    }
    setBusy('revert');
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}/decision`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Cofnięcie nie powiodło się.');
      setMsg({ kind: 'ok', text: `Decyzja cofnięta — status: ${json?.data?.status ?? '—'}.` });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function clientUrl() {
    return `${window.location.origin}/o/${clientToken}`;
  }

  /**
   * Otwiera link klienta bez wysyłki maila — dla wysyłki własnym kanałem.
   * Zatwierdzenie samo w sobie statusu nie zmienia, a dopóki oferta jest
   * robocza, klient dostaje pod tym linkiem 404.
   */
  async function publishLink() {
    if (
      !confirm(
        'Otworzyć link dla klienta bez wysyłania maila?\n\n' +
          'Oferta dostanie status „wysłana", a link zacznie działać publicznie. ' +
          'Maila z systemu NIE wyślemy — link przekazujesz sam.',
      )
    ) {
      return;
    }
    setBusy('publish');
    setMsg(null);
    try {
      const res = await fetch(`/api/offers/${offerId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Publikacja nie udała się.');
      const url = clientUrl();
      // Adres pokazujemy w komunikacie niezależnie od schowka — zapis do schowka
      // po await bywa blokowany (wymóg gestu użytkownika), a link nie może zniknąć.
      void navigator.clipboard?.writeText(url).catch(() => {});
      setMsg({ kind: 'ok', text: `Link otwarty i skopiowany: ${url}` });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally {
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
              ? 'Skopiowano link PODGLĄDU — działa tylko dla Ciebie, zalogowanego. ' +
                'Klient zobaczy pod nim „nie znaleziono". Żeby dać działający link, ' +
                'wyślij ofertę albo użyj „Otwórz link bez maila".'
              : 'Link klienta skopiowany.',
        }),
      () => setMsg({ kind: 'err', text: 'Nie udało się skopiować.' }),
    );
  }

  return (
    <div style={wrap}>
      {/* Stan akceptacji nad paskiem akcji — to on decyduje, czy „Wyślij" działa. */}
      {!isTerminal && (
        <div style={approval ? approvalOk : approvalPending}>
          <div>
            {approval ? (
              <>
                <strong>Zatwierdzona do wysyłki</strong> — {approval.name},{' '}
                {new Date(approval.at).toLocaleString('pl-PL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                .{' '}
                <span style={{ opacity: 0.85 }}>
                  Każda zmiana treści albo cennika cofnie zatwierdzenie.
                </span>
              </>
            ) : (
              <>
                <strong>Niezatwierdzona</strong> — wysyłka jest zablokowana.{' '}
                {canApprove
                  ? 'Przejrzyj treść i cennik, potem zatwierdź.'
                  : 'Poproś admina o zatwierdzenie treści.'}
              </>
            )}
          </div>
          {canApprove && (
            <button
              type="button"
              onClick={() => setApproval(!approval)}
              disabled={busy !== null}
              style={approval ? btnSecondary : btnApprove}
            >
              {busy === 'approve'
                ? '…'
                : approval
                  ? 'Cofnij zatwierdzenie'
                  : 'Zatwierdź do wysyłki'}
            </button>
          )}
        </div>
      )}

      <div style={toolbar}>
        <button
          type="button"
          onClick={() => setSendOpen(true)}
          style={
            isTerminal || !approval
              ? btnDisabled
              : status === 'draft'
                ? btnPrimary
                : btnSecondary
          }
          disabled={isTerminal || !approval}
          title={
            isTerminal
              ? `Oferta ${status} — nie wysyłamy`
              : !approval
                ? 'Oferta nie została zatwierdzona do wysyłki'
                : undefined
          }
        >
          {status === 'sent' || status === 'viewed' ? 'Wyślij ponownie' : 'Wyślij ofertę'}
        </button>

        <button type="button" onClick={recalc} style={btnSecondary} disabled={busy !== null}>
          {busy === 'recalc' ? 'Liczę…' : 'Przelicz pricing'}
        </button>

        <button type="button" onClick={copyLink} style={btnSecondary}>
          Skopiuj link
        </button>

        {/* Klienci częściej potwierdzają wybór mailem albo telefonicznie niż
            formularzem na ofercie. Bez tego taka oferta zostawała na zawsze
            jako „wysłana", a `accepted_fee` nie powstawał w ogóle. */}
        {(status === 'sent' || status === 'viewed') && (
          <button
            type="button"
            onClick={() => setDecisionOpen(true)}
            style={btnSecondary}
            disabled={busy !== null}
            title="Klient potwierdził decyzję mailem, telefonicznie lub na spotkaniu"
          >
            Zapisz decyzję klienta
          </button>
        )}

        {/* Tylko dla oferty roboczej — wysłana ma już działający link. */}
        {status === 'draft' && (
          <button
            type="button"
            onClick={publishLink}
            style={approval ? btnSecondary : btnDisabled}
            disabled={busy !== null || !approval}
            title={
              approval
                ? 'Otwiera link dla klienta bez wysyłania maila z systemu'
                : 'Najpierw zatwierdź ofertę'
            }
          >
            {busy === 'publish' ? 'Otwieram…' : 'Otwórz link bez maila'}
          </button>
        )}

        {(status === 'accepted' || status === 'rejected') && (
          <button
            type="button"
            onClick={revertDecision}
            style={btnSecondary}
            disabled={busy !== null}
            title="Cofa decyzję wpisaną z panelu (nie cofa decyzji klienta z formularza)"
          >
            {busy === 'revert' ? 'Cofam…' : 'Cofnij decyzję'}
          </button>
        )}

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

      {decisionOpen && (
        <DecisionDialog
          offerId={offerId}
          offerNumber={offerNumber}
          clientName={clientName}
          offerKind={offerKind}
          offeredVariants={offeredVariants}
          onClose={() => setDecisionOpen(false)}
          onSaved={(text) => {
            setDecisionOpen(false);
            setMsg({ kind: 'ok', text });
            startTransition(() => router.refresh());
          }}
        />
      )}

      {sendOpen && (
        <SendDialog
          offerId={offerId}
          offerNumber={offerNumber}
          clientName={clientName}
          isReSend={status === 'sent' || status === 'viewed'}
          ccRecipient={ccRecipient}
          programLabel={programLabel}
          onClose={() => setSendOpen(false)}
          onSent={(email) => {
            setSendOpen(false);
            // Email-reliability 2026-07: awaria wysyłki widoczna OD RAZU, nie
            // dopiero markerem na liście. Status oferty = sent mimo faila.
            setMsg(
              email.delivered
                ? {
                    kind: 'ok',
                    text:
                      'Oferta wysłana — email dostarczony do wysyłki.' +
                      (email.cc.length ? ` Kopia: ${email.cc.join(', ')}.` : ''),
                  }
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
// DecisionDialog — decyzja klienta przekazana poza systemem
// -----------------------------------------------------------------------------

const CHANNELS = [
  { v: 'email', label: 'E-mail' },
  { v: 'phone', label: 'Telefon' },
  { v: 'meeting', label: 'Spotkanie' },
  { v: 'other', label: 'Inny' },
] as const;

function DecisionDialog({
  offerId,
  offerNumber,
  clientName,
  offerKind,
  offeredVariants,
  onClose,
  onSaved,
}: {
  offerId: string;
  offerNumber: string;
  clientName: string;
  offerKind: 'grant' | 'loan' | 'exec';
  offeredVariants: Array<'I' | 'II' | 'III' | 'IV'>;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const needsVariant = offerKind === 'grant';
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['v']>('email');
  const [confirmedBy, setConfirmedBy] = useState(clientName);
  const [variant, setVariant] = useState<'I' | 'II' | 'III' | 'IV' | ''>(
    offeredVariants.length === 1 ? offeredVariants[0] : '',
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!confirmedBy.trim()) {
      setError('Podaj, kto po stronie klienta przekazał decyzję.');
      return;
    }
    if (decision === 'accepted' && needsVariant && !variant) {
      setError('Wskaż wariant, który klient wybrał.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        decision,
        channel,
        confirmedBy: confirmedBy.trim(),
      };
      if (decision === 'accepted' && needsVariant) body.variant = variant;
      if (note.trim()) body.note = note.trim();

      const res = await fetch(`/api/offers/${offerId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Zapis decyzji nie powiódł się.');
      onSaved(
        decision === 'accepted'
          ? `Oferta ${offerNumber} oznaczona jako zaakceptowana${
              json?.data?.variant ? ` (wariant ${json.data.variant})` : ''
            }.`
          : `Oferta ${offerNumber} oznaczona jako odrzucona.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Decyzja klienta — {offerNumber}</h3>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Zamknij">
            ×
          </button>
        </header>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#6b7a92', margin: 0 }}>
            Dla decyzji przekazanej poza ofertą — mailem, telefonicznie albo na spotkaniu.
            Zapis ustawia status, wariant i kwotę wynagrodzenia dokładnie tak, jak zrobiłby to
            formularz klienta.
          </p>

          <Field label="Decyzja">
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as 'accepted' | 'rejected')}
              style={input}
            >
              <option value="accepted">Zaakceptowana</option>
              <option value="rejected">Odrzucona</option>
            </select>
          </Field>

          {decision === 'accepted' && needsVariant && (
            <Field label="Wybrany wariant *">
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as typeof variant)}
                style={input}
              >
                <option value="">— wybierz —</option>
                {offeredVariants.map((v) => (
                  <option key={v} value={v}>
                    Wariant {v}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Kanał">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
              style={input}
            >
              {CHANNELS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kto przekazał decyzję *">
            <input
              type="text"
              maxLength={200}
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              placeholder="Imię i nazwisko albo rola osoby po stronie klienta"
              style={input}
            />
          </Field>

          <Field label={decision === 'accepted' ? 'Notatka' : 'Powód odmowy'}>
            <textarea
              maxLength={2000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. cytat z maila, data i godzina rozmowy"
              style={{ ...input, lineHeight: 1.5, resize: 'vertical' }}
            />
          </Field>

          <p style={{ fontSize: 12, color: '#8a6d1f', background: '#fff8e6', border: '1px solid #f0e0b0', borderRadius: 6, padding: '8px 10px', margin: 0, lineHeight: 1.5 }}>
            Zgoda RODO zostaje pusta — klient nie zaakceptował klauzuli w systemie i nie wpisujemy
            jej za niego. Jeśli zgoda jest potrzebna, zbierz ją osobno.
          </p>

          {error && <div style={errBox}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary} disabled={busy}>
              Anuluj
            </button>
            <button type="submit" style={btnPrimary} disabled={busy}>
              {busy ? 'Zapisuję…' : 'Zapisz decyzję'}
            </button>
          </div>
        </form>
      </div>
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
  ccRecipient,
  programLabel,
  onClose,
  onSent,
}: {
  offerId: string;
  offerNumber: string;
  clientName: string;
  isReSend: boolean;
  ccRecipient: CcRecipient;
  programLabel: string;
  onClose: () => void;
  onSent: (email: { delivered: boolean; error?: string; cc: string[] }) => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  // Podpowiadamy dokładnie ten temat, który wyśle serwer przy pustym polu —
  // wcześniej pole pokazywało co innego, niż dostawał klient.
  const [subject, setSubject] = useState(defaultOfferSubject({ clientName, programLabel }));
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
        cc: Array.isArray(json?.data?.emailCc) ? (json.data.emailCc as string[]) : [],
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

          <div style={ccHint}>
            {ccRecipient?.email ? (
              <>
                Kopia (CC) pójdzie do osoby kontaktowej z oferty:{' '}
                <strong>{ccRecipient.name}</strong> — {ccRecipient.email}
              </>
            ) : ccRecipient ? (
              <>
                Osoba kontaktowa w ofercie (<strong>{ccRecipient.name}</strong>) nie ma adresu
                email w katalogu, więc <strong>kopia nie zostanie wysłana</strong>. Uzupełnij go
                w Osobach kontaktowych.
              </>
            ) : (
              <>
                W ofercie nie wybrano osoby kontaktowej, więc mail pójdzie bez kopii.
              </>
            )}
          </div>

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

          <Field label="Temat (puste = domyślny temat z szablonu)">
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
const btnApprove: React.CSSProperties = {
  ...btnBase,
  background: '#1f7a4c',
  color: '#fff',
  whiteSpace: 'nowrap',
};
const btnDisabled: React.CSSProperties = {
  ...btnBase,
  background: '#f1f3f7',
  color: '#9aa7bb',
  border: '1px solid #e4e9f2',
  cursor: 'not-allowed',
};
const approvalBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.55,
  flexWrap: 'wrap',
};
const approvalOk: React.CSSProperties = {
  ...approvalBar,
  background: '#eaf7f0',
  border: '1px solid #bfe0cd',
  color: '#1f7a4c',
};
const approvalPending: React.CSSProperties = {
  ...approvalBar,
  background: '#fdf6e3',
  border: '1px solid #e8dcb5',
  color: '#6b5a1f',
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
const ccHint: React.CSSProperties = {
  padding: '9px 12px',
  background: '#f4f7fc',
  border: '1px solid #e0e7f3',
  borderRadius: 6,
  fontSize: 12.5,
  color: '#3a4254',
  lineHeight: 1.55,
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
