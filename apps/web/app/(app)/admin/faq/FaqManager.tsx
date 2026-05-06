'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type Props = { initial: FaqItem[] };

type Draft = {
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
};

const blankDraft: Draft = { question: '', answer: '', display_order: 100, is_active: true };

export default function FaqManager({ initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setDraft(blankDraft);
    setError(null);
  }

  function startEdit(item: FaqItem) {
    setEditingId(item.id);
    setCreating(false);
    setDraft({
      question: item.question,
      answer: item.answer,
      display_order: item.display_order,
      is_active: item.is_active,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setCreating(false);
    setDraft(blankDraft);
    setError(null);
  }

  async function save() {
    if (!draft.question.trim() || !draft.answer.trim()) {
      setError('Pytanie i odpowiedź są wymagane.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (creating) {
        const res = await fetch('/api/admin/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? 'POST failed.');
        setItems((prev) =>
          [...prev, json.data].sort(
            (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at),
          ),
        );
        setCreating(false);
      } else if (editingId) {
        const res = await fetch(`/api/admin/faq/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? 'PATCH failed.');
        setItems((prev) =>
          prev
            .map((x) => (x.id === editingId ? json.data : x))
            .sort(
              (a, b) =>
                a.display_order - b.display_order || a.created_at.localeCompare(b.created_at),
            ),
        );
        setEditingId(null);
      }
      setDraft(blankDraft);
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Usunąć to pytanie? Zniknie z wszystkich ofert.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'DELETE failed.');
      setItems((prev) => prev.filter((x) => x.id !== id));
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!creating && !editingId && (
        <button type="button" onClick={startCreate} style={btnPrimary}>
          + Dodaj pytanie
        </button>
      )}

      {(creating || editingId) && (
        <div style={card}>
          <h3 style={h3}>{creating ? 'Nowe pytanie' : 'Edycja'}</h3>
          <Field label="Pytanie *">
            <input
              type="text"
              maxLength={500}
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Odpowiedź *">
            <textarea
              maxLength={4000}
              rows={4}
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              style={textarea}
            />
          </Field>
          <div style={row2}>
            <Field label="Kolejność">
              <input
                type="number"
                min={0}
                max={9999}
                value={draft.display_order}
                onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
                style={input}
              />
            </Field>
            <Field label="Aktywne">
              <label style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                <span>Pojawia się na ofercie</span>
              </label>
            </Field>
          </div>
          <div style={actions}>
            <button type="button" onClick={save} disabled={busy} style={btnPrimary}>
              {busy ? 'Zapisuję…' : 'Zapisz'}
            </button>
            <button type="button" onClick={cancelEdit} disabled={busy} style={btnGhost}>
              Anuluj
            </button>
            {error && <span style={err}>{error}</span>}
          </div>
        </div>
      )}

      <table style={table}>
        <thead>
          <tr>
            <th style={thLeft}>#</th>
            <th style={thLeft}>Pytanie</th>
            <th style={thLeft}>Odpowiedź</th>
            <th style={thRight}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={4} style={empty}>
                Brak pytań — kliknij „+ Dodaj pytanie”, by zacząć.
              </td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.id} style={item.is_active ? undefined : { opacity: 0.55 }}>
              <td style={td}>{item.display_order}</td>
              <td style={td}>
                <strong>{item.question}</strong>
                {!item.is_active && <span style={inactiveBadge}> ukryte</span>}
              </td>
              <td style={tdMuted}>
                {item.answer.length > 160 ? `${item.answer.slice(0, 160)}…` : item.answer}
              </td>
              <td style={tdRight}>
                <button type="button" onClick={() => startEdit(item)} style={btnSmall}>
                  Edytuj
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  style={btnSmallDanger}
                  disabled={busy}
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={labelText}>{label}</div>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 20,
  margin: '12px 0 16px',
};
const h3: React.CSSProperties = { fontSize: 16, marginTop: 0, marginBottom: 12 };
const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 4 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const textarea: React.CSSProperties = { ...input, lineHeight: 1.5, resize: 'vertical', padding: 10 };
const row2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
};
const checkboxRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 14,
  paddingTop: 6,
};
const actions: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 };
const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '10px 16px',
  background: '#fff',
  color: '#6b7a92',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
};
const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  marginRight: 6,
  background: '#fff',
  border: '1px solid #1B2A4A',
  color: '#1B2A4A',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
};
const btnSmallDanger: React.CSSProperties = { ...btnSmall, borderColor: '#c92b3a', color: '#c92b3a' };
const err: React.CSSProperties = { color: '#c92b3a', fontSize: 13 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 16 };
const thLeft: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 11,
  color: '#6b7a92',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  borderBottom: '2px solid #e4e9f2',
};
const thRight: React.CSSProperties = { ...thLeft, textAlign: 'right' };
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #eef1f7' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
const empty: React.CSSProperties = { padding: 20, textAlign: 'center', color: '#6b7a92' };
const inactiveBadge: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '1px 6px',
  fontSize: 10,
  fontWeight: 600,
  background: '#fef3c7',
  color: '#92400e',
  borderRadius: 3,
  textTransform: 'uppercase',
};
