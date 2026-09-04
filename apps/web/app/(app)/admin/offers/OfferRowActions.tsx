'use client';

/**
 * Usuwanie i przywracanie oferty wprost z listy (admin+).
 *
 * Dotąd soft delete istniał tylko w widoku edycji jednej oferty, więc
 * sprzątanie ofert testowych oznaczało wchodzenie w każdą po kolei. Tu ta sama
 * operacja jest jednym kliknięciem z listy, a filtr "Usunięte" pozwala cofnąć
 * pomyłkę.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function OfferRowActions({
  offerId,
  offerNumber,
  clientName,
  isDeleted,
}: {
  offerId: string;
  offerNumber: string;
  clientName: string;
  isDeleted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run(action: 'delete' | 'restore') {
    const question =
      action === 'delete'
        ? `Usunąć ofertę ${offerNumber} (${clientName})?\n\n` +
          'Zniknie z listy, ale zostaje w bazie dla audytu. Możesz ją przywrócić ' +
          'filtrem "Usunięte".'
        : `Przywrócić ofertę ${offerNumber} (${clientName})?`;
    if (!confirm(question)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        action === 'delete' ? `/api/offers/${offerId}` : `/api/offers/${offerId}/restore`,
        { method: action === 'delete' ? 'DELETE' : 'POST' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Operacja nie udała się.');
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => run(isDeleted ? 'restore' : 'delete')}
        disabled={busy}
        style={isDeleted ? btnRestore : btnDelete}
        title={
          isDeleted
            ? 'Przywróć ofertę na listę'
            : 'Usuń z list (odwracalne — wiersz zostaje w bazie)'
        }
      >
        {busy ? '…' : isDeleted ? 'Przywróć' : 'Usuń'}
      </button>
      {error && <div style={errorInline}>{error}</div>}
    </>
  );
}

const btnBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '5px 10px',
  marginLeft: 6,
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer',
  border: '1px solid transparent',
  background: '#fff',
};

const btnDelete: React.CSSProperties = {
  ...btnBase,
  color: '#a3202b',
  borderColor: '#e8c2c6',
};

const btnRestore: React.CSSProperties = {
  ...btnBase,
  color: '#1f7a4c',
  borderColor: '#bfe0cd',
};

const errorInline: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: '#a3202b',
  maxWidth: 220,
  whiteSpace: 'normal',
};
