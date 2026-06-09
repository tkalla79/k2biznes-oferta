'use client';

/**
 * CRUD biblioteki alt-programów (feature #2). Lista + inline add/edit + delete.
 * Wywołuje /api/admin/alt-programs. Wzorzec wizualny jak ProgramsManager,
 * zwarty (6 prostych pól).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@k2/database/types';

type AltProgram = Database['public']['Tables']['alt_programs']['Row'];

type FormState = {
  name: string;
  program: string;
  nabor: string;
  desc: string;
  url: string;
  display_order: number;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: '',
  program: '',
  nabor: '',
  desc: '',
  url: '',
  display_order: 100,
  is_active: true,
};

export default function AltProgramsManager({ initial }: { initial: AltProgram[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null); // null=brak, ''=nowy
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setForm(EMPTY);
    setEditingId('');
    setError(null);
  }

  function startEdit(p: AltProgram) {
    setForm({
      name: p.name,
      program: p.program,
      nabor: p.nabor ?? '',
      desc: p.desc ?? '',
      url: p.url ?? '',
      display_order: p.display_order,
      is_active: p.is_active,
    });
    setEditingId(p.id);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.program.trim()) {
      setError('Nazwa i program są wymagane.');
      return;
    }
    setBusy(true);
    try {
      const isNew = editingId === '';
      const url = isNew ? '/api/admin/alt-programs' : `/api/admin/alt-programs/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          program: form.program.trim(),
          nabor: form.nabor.trim() || null,
          desc: form.desc.trim() || null,
          url: form.url.trim() || null,
          display_order: form.display_order,
          is_active: form.is_active,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Zapis nie powiódł się.');
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Usunąć "${name}" z biblioteki? Istniejące oferty pozostaną bez zmian.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/alt-programs/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message ?? 'Usuwanie nie powiodło się.');
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {editingId === null && (
        <button onClick={startNew} style={btnPrimary}>
          + Nowy program
        </button>
      )}

      {editingId !== null && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>{editingId === '' ? 'Nowy program' : 'Edycja programu'}</h3>
          <div style={grid2}>
            <Field label="Nazwa *">
              <input style={input} value={form.name} maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Program / etykieta *">
              <input style={input} value={form.program} maxLength={120}
                onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </Field>
            <Field label="Nabór">
              <input style={input} value={form.nabor} maxLength={80}
                onChange={(e) => setForm({ ...form, nabor: e.target.value })} />
            </Field>
            <Field label="URL">
              <input style={input} value={form.url} maxLength={500} placeholder="https://…"
                onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </Field>
          </div>
          <Field label="Opis">
            <textarea style={{ ...input, minHeight: 64, resize: 'vertical' }} value={form.desc} maxLength={2000}
              onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          </Field>
          <div style={grid2}>
            <Field label="Kolejność">
              <input type="number" style={input} value={form.display_order}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Aktywny (widoczny w wyborze oferty)
            </label>
          </div>
          {error && <div style={errBox}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy} style={btnPrimary}>
              {busy ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button onClick={() => setEditingId(null)} disabled={busy} style={btnGhost}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Nazwa / Program</th>
            <th style={th}>Nabór</th>
            <th style={thCenter}>Kolejność</th>
            <th style={thCenter}>Aktywny</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {initial.map((p) => (
            <tr key={p.id}>
              <td style={td}>
                <strong>{p.name}</strong>
                <div style={{ color: '#6b7a92', fontSize: 13 }}>{p.program}</div>
              </td>
              <td style={tdMuted}>{p.nabor ?? '—'}</td>
              <td style={tdCenter}>{p.display_order}</td>
              <td style={tdCenter}>{p.is_active ? '✓' : '—'}</td>
              <td style={tdRight}>
                <button onClick={() => startEdit(p)} style={btnSmall}>Edytuj</button>
                <button onClick={() => remove(p.id, p.name)} style={btnSmallDanger}>Usuń</button>
              </td>
            </tr>
          ))}
          {initial.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdMuted, textAlign: 'center', padding: 24 }}>
              Brak programów. Dodaj pierwszy.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 13, color: '#3a4254', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: '#D91E18', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: '#3a4254', border: '1px solid #e4e9f2', borderRadius: 8, cursor: 'pointer' };
const btnSmall: React.CSSProperties = { padding: '4px 10px', marginRight: 6, fontSize: 13, background: '#f2f5fa', border: '1px solid #e4e9f2', borderRadius: 6, cursor: 'pointer' };
const btnSmallDanger: React.CSSProperties = { ...btnSmall, marginRight: 0, color: '#A8140F', background: '#fce8e6', borderColor: '#f5c6c2' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e4e9f2', borderRadius: 10, padding: 20, marginBottom: 20 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d4dae6', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' };
const errBox: React.CSSProperties = { marginTop: 10, padding: 10, background: '#fce8e6', border: '1px solid #f5c6c2', color: '#A8140F', borderRadius: 6, fontSize: 13 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 8 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e4e9f2', fontSize: 12, textTransform: 'uppercase', color: '#6b7a92' };
const thCenter: React.CSSProperties = { ...th, textAlign: 'center' };
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid #f0f3f8', fontSize: 14 };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
