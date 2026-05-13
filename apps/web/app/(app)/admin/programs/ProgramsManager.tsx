'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FileUploadInput from '@/components/FileUploadInput';
import { publicStorageUrl } from '@/lib/storage';

type Program = {
  id: string;
  group_name: string;
  label: string;
  description: string | null;
  cover_storage_key: string | null;
  is_custom: boolean;
  display_order: number;
  is_active: boolean;
};

type SortKey = 'order' | 'label' | 'group';
type ActiveFilter = 'all' | 'active' | 'inactive';

export default function ProgramsManager({ initial }: { initial: Program[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<Program[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtry + sort
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('order');

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) set.add(p.group_name);
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(() => {
    let arr = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.group_name.toLowerCase().includes(q),
      );
    }
    if (groupFilter) arr = arr.filter((p) => p.group_name === groupFilter);
    if (activeFilter === 'active') arr = arr.filter((p) => p.is_active);
    if (activeFilter === 'inactive') arr = arr.filter((p) => !p.is_active);
    const sorted = [...arr];
    sorted.sort((a, b) => {
      if (sortKey === 'order') return a.display_order - b.display_order;
      if (sortKey === 'label') return a.label.localeCompare(b.label, 'pl');
      return a.group_name.localeCompare(b.group_name, 'pl') || a.display_order - b.display_order;
    });
    return sorted;
  }, [items, search, groupFilter, activeFilter, sortKey]);

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

  async function remove(id: string, label: string) {
    if (!confirm(`Usunąć program "${label}"? Operacja nieodwracalna. Oferty które go używały zachowają zapisaną nazwę programu, ale stracą referencję na ten rekord.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/programs/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd usuwania.');
      setItems((arr) => arr.filter((p) => p.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={onboardingBox}>
        <strong>💡 Jak edytować program?</strong> Kliknij <kbd style={kbd}>Edytuj</kbd> w wierszu —
        otworzy się formularz z polami <em>Label</em> (nazwa widoczna klientowi),{' '}
        <em>Grupa</em> (nagłówek listy w ofercie), <em>Opis</em>, <em>Display order</em>{' '}
        (kolejność w dropdownie — mniejsze = wyżej). Aby trwale usunąć — przycisk{' '}
        <kbd style={kbd}>Usuń</kbd>.
      </div>

      {/* Filtry */}
      <div style={filtersRow}>
        <input
          type="search"
          placeholder="Szukaj po nazwie / slug / grupie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...input, maxWidth: 280 }}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          style={input}
        >
          <option value="">Wszystkie grupy</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          style={input}
        >
          <option value="all">Aktywne + nieaktywne</option>
          <option value="active">Tylko aktywne</option>
          <option value="inactive">Tylko nieaktywne</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={input}
        >
          <option value="order">Sortuj: kolejność</option>
          <option value="label">Sortuj: nazwa A→Z</option>
          <option value="group">Sortuj: grupa</option>
        </select>
        <button type="button" onClick={() => setCreating(true)} style={btnPrimary} disabled={creating}>
          + Nowy program
        </button>
      </div>

      <div style={countLine}>
        Wyświetlam {visible.length} z {items.length} programów
      </div>

      {creating && <ProgramForm onSubmit={create} onCancel={() => setCreating(false)} busy={busy} />}

      {error && <div style={errBox}>{error}</div>}

      <table style={table}>
        <thead>
          <tr style={th}>
            <th style={thCell}>Slug / Label</th>
            <th style={thCell}>Grupa</th>
            <th style={thCellRight} title="Kolejność w dropdown'ie ofert (mniejsze = wyżej)">
              Order ⓘ
            </th>
            <th style={thCellCenter}>Aktywny</th>
            <th style={thCellRight}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <RowOrEdit
              key={p.id}
              program={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => update(p.id, patch)}
              onToggle={() => update(p.id, { is_active: !p.is_active })}
              onDelete={() => remove(p.id, p.label)}
              busy={busy}
            />
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} style={emptyRow}>
                Brak wyników dla obecnych filtrów.
              </td>
            </tr>
          )}
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
  onDelete,
  busy,
}: {
  program: Program;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Program>) => void;
  onToggle: () => void;
  onDelete: () => void;
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
      <td style={tdActions}>
        <button type="button" onClick={onEdit} style={btnEdit} disabled={busy}>
          Edytuj
        </button>
        <button type="button" onClick={onDelete} style={btnDelete} disabled={busy}>
          Usuń
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
  const [labelValue, setLabelValue] = useState(initial?.label ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [coverStorageKey, setCoverStorageKey] = useState<string | null>(initial?.cover_storage_key ?? null);
  const [displayOrder, setDisplayOrder] = useState(initial?.display_order ?? 100);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [customId, setCustomId] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: Partial<Program> & { id?: string } = {
      group_name: groupName.trim(),
      label: labelValue.trim(),
      description: description.trim() || null,
      cover_storage_key: coverStorageKey,
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
          <Field
            label="Slug (opcjonalnie)"
            help="Techniczny identyfikator (np. feng-smart). Zostawiasz puste — wygeneruje z labela."
          >
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
        <Field
          label="Grupa *"
          help="Nagłówek pod którym program pojawi się w dropdown'ie i sekcji 'Inne możliwości wsparcia' (np. FENG · Fundusze Europejskie...)."
        >
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
        <Field
          label="Label * (nazwa widoczna klientowi)"
          help="Wyświetlana w sekcji 'Proponowane rozwiązanie' i dropdown'ie programów."
        >
          <input
            type="text"
            required
            maxLength={200}
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            style={input}
          />
        </Field>
        <Field
          label="Display order"
          help="Kolejność w dropdown'ie. Mniejsze = wyżej. Programy w tej samej grupie sortowane razem."
        >
          <input
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="Opis" help="Opcjonalny, długi opis. Może być wykorzystany w przyszłej wersji oferty.">
          <textarea
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={textarea}
          />
        </Field>
        <div>
          <FileUploadInput
            value={coverStorageKey}
            onChange={setCoverStorageKey}
            folder="programs"
            label="Cover (upload)"
            previewUrl={publicStorageUrl(coverStorageKey, null)}
          />
        </div>
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Aktywny (ukrycie zamiast usuwania)</span>
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

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={labelText}>{label}</div>
      {children}
      {help && <div style={helpText}>{help}</div>}
    </label>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const onboardingBox: React.CSSProperties = {
  padding: 14,
  background: '#fef9c3',
  border: '1px solid #facc15',
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1.55,
  color: '#713f12',
};
const kbd: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #d4a72c',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
};
const filtersRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const countLine: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7a92',
};
const emptyRow: React.CSSProperties = {
  textAlign: 'center',
  padding: 32,
  color: '#6b7a92',
  fontSize: 13,
};

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
const tdActions: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
};
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
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};
const formActions: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const labelText: React.CSSProperties = { fontSize: 12, color: '#6b7a92', marginBottom: 4, fontWeight: 600 };
const helpText: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginTop: 4,
  lineHeight: 1.45,
};
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
const btnEdit: React.CSSProperties = {
  padding: '6px 14px',
  background: '#1B2A4A',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDelete: React.CSSProperties = {
  padding: '6px 14px',
  background: '#fff',
  color: '#c92b3a',
  border: '1px solid #c92b3a',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const errBox: React.CSSProperties = {
  padding: 10,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 6,
  color: '#c92b3a',
  fontSize: 13,
};
