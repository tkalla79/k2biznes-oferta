'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FileUploadInput from '@/components/FileUploadInput';
import { publicStorageUrl } from '@/lib/storage';

type ContactPerson = {
  id: string;
  profile_id: string | null;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  photo_storage_key: string | null;
  display_order: number;
  is_active: boolean;
};

type FormData = {
  id?: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  photo_storage_key?: string | null;
  display_order: number;
  is_active: boolean;
};

export default function ContactPersonsManager({ initial }: { initial: ContactPerson[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<ContactPerson[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(data: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/contact-persons', {
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

  async function update(id: string, data: Partial<FormData>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contact-persons/${id}`, {
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

  async function remove(id: string, name: string) {
    if (!confirm(`Usunąć osobę "${name}"? Operacja nieodwracalna. Oferty które ją używały stracą referencję.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contact-persons/${id}`, { method: 'DELETE' });
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
        <strong>💡 Jak to działa?</strong> Osoba kontaktowa wybrana w edytorze
        oferty (sekcja &quot;Załączniki&quot;) pojawi się klientowi w sekcji{' '}
        <em>Akceptacja oferty</em> ze zdjęciem, telefonem i emailem. Zdjęcie
        dodajesz jako URL w polu <em>URL zdjęcia</em>. Aby zmienić:{' '}
        <kbd style={kbd}>Edytuj</kbd>. Aby trwale usunąć: <kbd style={kbd}>Usuń</kbd>.
      </div>

      <div>
        <button type="button" onClick={() => setCreating(true)} style={btnPrimary} disabled={creating}>
          + Nowa osoba
        </button>
      </div>

      {creating && <PersonForm onSubmit={create} onCancel={() => setCreating(false)} busy={busy} />}

      {error && <div style={errBox}>{error}</div>}

      <table style={table}>
        <thead>
          <tr style={th}>
            <th style={thCell}>Imię i rola</th>
            <th style={thCell}>Email / Telefon</th>
            <th style={thCellRight}>Order</th>
            <th style={thCellCenter}>Aktywna</th>
            <th style={thCellRight}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <Row
              key={p.id}
              cp={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => update(p.id, patch)}
              onToggle={() => update(p.id, { is_active: !p.is_active })}
              onDelete={() => remove(p.id, p.name)}
              busy={busy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  cp,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onToggle,
  onDelete,
  busy,
}: {
  cp: ContactPerson;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<FormData>) => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  if (isEditing) {
    return (
      <tr>
        <td colSpan={5} style={editCell}>
          <PersonForm initial={cp} onSubmit={(d) => onSave(d)} onCancel={onCancel} busy={busy} isEdit />
        </td>
      </tr>
    );
  }
  const photoSrc = publicStorageUrl(cp.photo_storage_key, cp.photo_url);
  return (
    <tr style={cp.is_active ? undefined : rowMuted}>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt={cp.name}
              style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', objectPosition: 'top center', border: '1px solid #e4e9f2' }}
            />
          ) : (
            <div style={photoFallback}>{cp.name.charAt(0)}</div>
          )}
          <div>
            <div style={slug}>{cp.id}</div>
            <div style={label}>{cp.name}</div>
            <div style={tdMutedInline}>{cp.role}</div>
          </div>
        </div>
      </td>
      <td style={tdMuted}>
        <div>{cp.email ?? '—'}</div>
        <div>{cp.phone ?? '—'}</div>
      </td>
      <td style={tdRight}>{cp.display_order}</td>
      <td style={tdCenter}>
        <input type="checkbox" checked={cp.is_active} onChange={onToggle} disabled={busy} />
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

function PersonForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  isEdit,
}: {
  initial?: Partial<ContactPerson>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  busy: boolean;
  isEdit?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '');
  const [photoStorageKey, setPhotoStorageKey] = useState<string | null>(initial?.photo_storage_key ?? null);
  const [order, setOrder] = useState(initial?.display_order ?? 100);
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [customId, setCustomId] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: FormData = {
      name: name.trim(),
      role: role.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      photo_url: photoUrl.trim() || null,
      photo_storage_key: photoStorageKey,
      display_order: Number(order),
      is_active: active,
    };
    if (!isEdit && customId.trim()) data.id = customId.trim();
    onSubmit(data);
  }

  return (
    <form onSubmit={submit} style={formBox}>
      <div style={formGrid}>
        {!isEdit && (
          <Field label="Slug (auto z name)">
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              style={input}
              maxLength={80}
            />
          </Field>
        )}
        <Field label="Imię i nazwisko *">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={input} />
        </Field>
        <Field label="Rola *">
          <input
            type="text"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={input}
            placeholder="CEO, K2Biznes"
          />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        </Field>
        <Field label="Telefon">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
        </Field>
        <Field label="URL zdjęcia — legacy">
          <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} style={input} />
        </Field>
        <div>
          <FileUploadInput
            value={photoStorageKey}
            onChange={setPhotoStorageKey}
            folder="contact-persons"
            label="Zdjęcie (upload)"
            previewUrl={publicStorageUrl(photoStorageKey, null)}
          />
        </div>
        <Field label="Display order">
          <input
            type="number"
            min={0}
            max={9999}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            style={input}
          />
        </Field>
        <label style={checkboxRow}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Aktywna</span>
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
const td: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #eef1f7', verticalAlign: 'top' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdCenter: React.CSSProperties = { ...td, textAlign: 'center' };
const tdMuted: React.CSSProperties = { ...td, color: '#6b7a92', fontSize: 13 };
const tdMutedInline: React.CSSProperties = { color: '#6b7a92', fontSize: 12, marginTop: 2 };
const rowMuted: React.CSSProperties = { opacity: 0.5 };
const slug: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 12,
  color: '#6b7a92',
};
const label: React.CSSProperties = { fontWeight: 500 };

const editCell: React.CSSProperties = { padding: 16, background: '#f9fafc', borderBottom: '1px solid #eef1f7' };
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
const tdActions: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #eef1f7',
  textAlign: 'right',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
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
const photoFallback: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 22,
  background: '#1B2A4A',
  color: '#fff',
  fontSize: 18,
  fontWeight: 600,
  display: 'grid',
  placeItems: 'center',
};
