'use client';

/**
 * Lista szablonów oferty — rename + delete (feature #1).
 * Tworzenie szablonu odbywa się w OfferForm ("Zapisz jako szablon").
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = { id: string; name: string; created_at: string; author: string };

export default function TemplatesManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename(id: string, current: string) {
    const name = window.prompt('Nowa nazwa szablonu:', current);
    if (!name || !name.trim() || name.trim() === current) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offer-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? 'Zmiana nazwy nie powiodła się.');
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Usunąć szablon „${name}"? Istniejące oferty pozostaną bez zmian.`)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/offer-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? 'Usuwanie nie powiodło się.');
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && <div style={errBox}>{error}</div>}
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Nazwa</th>
            <th style={th}>Autor</th>
            <th style={th}>Utworzono</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td style={td}><strong>{t.name}</strong></td>
              <td style={tdMuted}>{t.author}</td>
              <td style={tdMuted}>{new Date(t.created_at).toLocaleDateString('pl-PL')}</td>
              <td style={tdRight}>
                <button onClick={() => rename(t.id, t.name)} disabled={busy === t.id} style={btnSmall}>
                  Zmień nazwę
                </button>
                <button onClick={() => remove(t.id, t.name)} disabled={busy === t.id} style={btnSmallDanger}>
                  Usuń
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={4} style={{ ...tdMuted, textAlign: 'center', padding: 24 }}>
              Brak szablonów. Stwórz ofertę i kliknij „Zapisz jako szablon”.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const errBox: React.CSSProperties = { marginBottom: 12, padding: 10, background: '#fce8e6', border: '1px solid #f5c6c2', color: '#A8140F', borderRadius: 6, fontSize: 13 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e4e9f2', fontSize: 12, textTransform: 'uppercase', color: '#6b7a92' };
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid #f0f3f8', fontSize: 14 };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
const btnSmall: React.CSSProperties = { padding: '4px 10px', marginRight: 6, fontSize: 13, background: '#f2f5fa', border: '1px solid #e4e9f2', borderRadius: 6, cursor: 'pointer' };
const btnSmallDanger: React.CSSProperties = { ...btnSmall, marginRight: 0, color: '#A8140F', background: '#fce8e6', borderColor: '#f5c6c2' };
