'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FileUploadInput from '@/components/FileUploadInput';
import { publicStorageUrl } from '@/lib/storage';

type CaseStudy = {
  id: string;
  client: string;
  tag: string | null;
  title: string;
  paragraph_1: string | null;
  paragraph_2: string | null;
  industries: string[];
  program_tags: string[];
  logo_big: string | null;
  logo_sm: string | null;
  logo_storage_key: string | null;
  display_order: number;
  is_active: boolean;
};

type FormData = {
  id?: string;
  client: string;
  tag?: string | null;
  title: string;
  paragraph_1?: string | null;
  paragraph_2?: string | null;
  industries: string[];
  program_tags: string[];
  logo_big?: string | null;
  logo_sm?: string | null;
  logo_storage_key?: string | null;
  display_order: number;
  is_active: boolean;
};

export default function CaseStudiesManager({ initial }: { initial: CaseStudy[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<CaseStudy[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(data: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/case-studies', {
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
      const res = await fetch(`/api/admin/case-studies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd zapisu.');
      setItems((arr) => arr.map((c) => (c.id === id ? json.data : c)));
      setEditingId(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, client: string) {
    if (!confirm(`Usunąć case study "${client}"? Operacja nieodwracalna. Oferty które go używały stracą referencję.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/case-studies/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd usuwania.');
      setItems((arr) => arr.filter((c) => c.id !== id));
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
        <strong>💡 Jak to działa?</strong> Case study, które zostanie wybrane w
        edytorze konkretnej oferty (sekcja &quot;Załączniki&quot;), pojawi się
        klientowi w sekcji <em>Zaufali nam</em>. Logo dodajesz jako URL w polu{' '}
        <em>Logo (URL, duże)</em> — pełny adres https://. Aby zmienić zawartość:{' '}
        <kbd style={kbd}>Edytuj</kbd>. Aby trwale usunąć: <kbd style={kbd}>Usuń</kbd>.
      </div>

      <div>
        <button type="button" onClick={() => setCreating(true)} style={btnPrimary} disabled={creating}>
          + Nowe case study
        </button>
      </div>

      {creating && <CaseStudyForm onSubmit={create} onCancel={() => setCreating(false)} busy={busy} />}

      {error && <div style={errBox}>{error}</div>}

      <table style={table}>
        <thead>
          <tr style={th}>
            <th style={thCell}>Klient / Tytuł</th>
            <th style={thCell}>Tag</th>
            <th style={thCell}>Branże</th>
            <th style={thCellRight}>Order</th>
            <th style={thCellCenter}>Aktywny</th>
            <th style={thCellRight}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <Row
              key={c.id}
              cs={c}
              isEditing={editingId === c.id}
              onEdit={() => setEditingId(c.id)}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => update(c.id, patch)}
              onToggle={() => update(c.id, { is_active: !c.is_active })}
              onDelete={() => remove(c.id, c.client)}
              busy={busy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  cs,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onToggle,
  onDelete,
  busy,
}: {
  cs: CaseStudy;
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
        <td colSpan={6} style={editCell}>
          <CaseStudyForm initial={cs} onSubmit={(d) => onSave(d)} onCancel={onCancel} busy={busy} isEdit />
        </td>
      </tr>
    );
  }
  const logoSrc = publicStorageUrl(cs.logo_storage_key, cs.logo_sm || cs.logo_big);
  return (
    <tr style={cs.is_active ? undefined : rowMuted}>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={cs.client}
              style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, background: '#f9fafc' }}
            />
          )}
          <div>
            <div style={slug}>{cs.id}</div>
            <div style={label}>
              <strong>{cs.client}</strong> — {cs.title}
            </div>
          </div>
        </div>
      </td>
      <td style={tdMuted}>{cs.tag ?? '—'}</td>
      <td style={tdMuted}>{cs.industries.join(', ') || '—'}</td>
      <td style={tdRight}>{cs.display_order}</td>
      <td style={tdCenter}>
        <input
          type="checkbox"
          checked={cs.is_active}
          onChange={onToggle}
          disabled={busy}
        />
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

function CaseStudyForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  isEdit,
}: {
  initial?: Partial<CaseStudy>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  busy: boolean;
  isEdit?: boolean;
}) {
  const [client, setClient] = useState(initial?.client ?? '');
  const [tag, setTag] = useState(initial?.tag ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [p1, setP1] = useState(initial?.paragraph_1 ?? '');
  const [p2, setP2] = useState(initial?.paragraph_2 ?? '');
  const [industries, setIndustries] = useState((initial?.industries ?? []).join(', '));
  const [programTags, setProgramTags] = useState((initial?.program_tags ?? []).join(', '));
  const [logoBig, setLogoBig] = useState(initial?.logo_big ?? '');
  const [logoSm, setLogoSm] = useState(initial?.logo_sm ?? '');
  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(initial?.logo_storage_key ?? null);
  const [order, setOrder] = useState(initial?.display_order ?? 100);
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [customId, setCustomId] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data: FormData = {
      client: client.trim(),
      tag: tag.trim() || null,
      title: title.trim(),
      paragraph_1: p1.trim() || null,
      paragraph_2: p2.trim() || null,
      industries: industries
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      program_tags: programTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      logo_big: logoBig.trim() || null,
      logo_sm: logoSm.trim() || null,
      logo_storage_key: logoStorageKey,
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
          <Field label="Slug (auto z client+title gdy puste)">
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              style={input}
              maxLength={80}
            />
          </Field>
        )}
        <Field label="Klient *">
          <input type="text" required value={client} onChange={(e) => setClient(e.target.value)} style={input} />
        </Field>
        <Field label="Tag (np. FENG · SMART)">
          <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} style={input} />
        </Field>
        <Field label="Tytuł *">
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
        </Field>
        <Field label="Branże (CSV)">
          <input
            type="text"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
            style={input}
            placeholder="produkcja, metalurgia"
          />
        </Field>
        <Field label="Program tagi (CSV)">
          <input
            type="text"
            value={programTags}
            onChange={(e) => setProgramTags(e.target.value)}
            style={input}
            placeholder="feng-smart"
          />
        </Field>
        <Field label="Display order">
          <input type="number" min={0} max={9999} value={order} onChange={(e) => setOrder(Number(e.target.value))} style={input} />
        </Field>
        <Field label="Logo (URL, duże) — legacy">
          <input type="url" value={logoBig} onChange={(e) => setLogoBig(e.target.value)} style={input} />
        </Field>
        <Field label="Logo (URL, małe) — legacy">
          <input type="url" value={logoSm} onChange={(e) => setLogoSm(e.target.value)} style={input} />
        </Field>
        <div>
          <FileUploadInput
            value={logoStorageKey}
            onChange={setLogoStorageKey}
            folder="case-studies"
            label="Logo (upload)"
            previewUrl={publicStorageUrl(logoStorageKey, null)}
          />
        </div>
        <label style={checkboxRow}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Aktywny</span>
        </label>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Field label="Paragraf 1">
          <textarea rows={3} value={p1} onChange={(e) => setP1(e.target.value)} style={textarea} maxLength={4000} />
        </Field>
        <Field label="Paragraf 2">
          <textarea rows={3} value={p2} onChange={(e) => setP2(e.target.value)} style={textarea} maxLength={4000} />
        </Field>
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
    <label style={{ display: 'block', marginBottom: 8 }}>
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
