'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Program = {
  id: string;
  group_name: string;
  label: string;
  description: string | null;
  is_custom: boolean;
  display_order: number;
  is_active: boolean;
};

export default function ProgramsManager({ initial }: { initial: Program[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<Program[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(data: Partial<Program> & { id?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd tworzenia.');
      setItems((arr) => [...arr, json.data].sort((a, b) => a.display_order - b.display_order));
      setCreating(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, data: Partial<Program>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd zapisu.');
      setItems((arr) => arr.map((p) => (p.id === id ? json.data : p)));
      setEditingId(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <button type="button" onClick={() => setCreating(true)} style={btnPrimary} disabled={creating}>
          + Nowy program
        </button>
      </div>

      {creating && <ProgramForm onSubmit={create} onCancel={() => setCreating(false)} busy={busy} />}

      {error && <div style={errBox}>{error}</div>}

      <table style={table}>
        <thead>
          <tr style={th}>
            <th style={thCell}>Slug / Label</th>
            <th style={thCell}>Grupa</th>
            <th style={thCellRight}>Order</th>
            <th style={thCellCenter}>Aktywny</th>
            <th style={thCellRight}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <RowOrEdit
              key={p.id}
              program={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => update(p.id, patch)}
              onToggle={() => update(p.id, { is_active: !p.is_active })}
              busy={busy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowOrEdit({
  program,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onToggle,
  busy,
}: {
  program: Program;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Program>) => void;
  onToggle: () => void;
  busy: boolean;
}) {
  if (isEditing) {
    return (
      <tr>
        <td colSpan={5} style={editCell}>
          <ProgramForm
            initial={program}
            onSubmit={(d) => onSave(d)}
            onCancel={onCancel}
            busy={busy}
            isEdit
          />
        </td>
      </tr>
    );
  }
  return (
    <tr style={program.is_active ? undefined : rowMuted}>
      <td style={td}>
        <div style={slug}>{program.id}</div>
        <div style={label}>{program.label}</div>
      </td>
      <td style={tdMuted}>{program.group_name}</td>
      <td style={tdRight}>{program.display_order}</td>
      <td style={tdCenter}>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={program.is_active}
            onChange={onToggle}
            disabled={busy}
          />
        </label>
      </td>
      <td style={tdRight}>
        <button type="button" onClick={onEdit} style={btnLink} disabled={busy}>
          Edytuj
        </button>
      </td>
    </tr>
  );
}

function ProgramForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  isEdit,
}: {
  initial?: Partial<Program>;
  onSubmit: (data: Partial<Program> & { id?: string }) => void;
  onCancel: () => void;
  busy: boolean;
  isEdit?: boolean;
}) {
  const [groupName, setGroupName] = useState(initial?.group_name ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [displayOrder, setDisplayOrder] = useState(initial?.display_order ?? 100);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [customId, setCustomId] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: Partial<Program> & { id?: string } = {
      group_name: groupName.trim(),
      label: label.trim(),
      description: description.trim() || null,
      display_order: Number(displayOrder),
      is_active: isActive,
    };
    if (!isEdit && customId.trim()) data.id = customId.trim();
    onSubmit(data);
  }

  return (
    <form onSubmit={submit} style={formBox}>
      <div style={formGrid}>
        {!isEdit && (
          <Field label="Slug (opcjonalnie — auto z label)">
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              style={input}
              maxLength={80}
              placeholder="feng-smart"
            />
          </Field>
        )}
        <Field label="Grupa *">
          <input
            type="text"
            required
            maxLength={200}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={input}
            placeholder="FENG · Fundusze Europejskie..."
          />
        </Field>
        <Field label="Label *">
          <input
            type="text"
            required
            maxLength={200}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={input}
          />
        </Field>
        <Field label="Display order">
          <input
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="Opis">
          <textarea
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={textarea}
          />
        </Field>
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Aktywny</span>
        </label>
      </div>
      <div style={formActions}>
        <button type="button" onClick={onCancel} style={btnSecondary} disabled={busy}>
          Anuluj
        </button>
        <button type="submit" style={btnPrimary} disabled={busy}>
          {busy ? 'Zapisuję…' : isEdit ? 'Zapisz' : 'Stwórz'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={labelText}>{label}</div>
      {children}
    </label>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  overflow: 'hidden',
};
const th: React.CSSProperties = { background: '#f9fafc', borderBottom: '2px solid #e4e9f2' };
const thCell: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: 11,
  color: '#6b7a92',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
const thCellRight: React.CSSProperties = { ...thCell, textAlign: 'right' };
const thCellCenter: React.CSSProperties = { ...thCell, textAlign: 'center' };
const td: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #eef1f7',
  verticalAlign: 'top',
};
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92' };
const rowMuted: React.CSSProperties = { opacity: 0.5 };
const slug: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
  color: '#6b7a92',
};
const label: React.CSSProperties = { fontWeight: 500 };

const editCell: React.CSSProperties = {
  padding: 16,
  background: '#f9fafc',
  borderBottom: '1px solid #eef1f7',
};
const formBox: React.CSSProperties = { display: 'grid', gap: 12 };
const formGrid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
};
const formActions: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 4 };
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
};
const textarea: React.CSSProperties = { ...input, resize: 'vertical', lineHeight: 1.5, padding: 10 };
const checkboxRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  fontSize: 14,
  alignSelf: 'end',
  paddingBottom: 6,
};
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px',
  background: '#fff',
  color: '#1B2A4A',
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const btnLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  color: '#1B2A4A',
  cursor: 'pointer',
  fontWeight: 500,
  padding: 0,
};
const errBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};
