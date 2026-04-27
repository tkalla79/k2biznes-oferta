'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ProgramOpt = { id: string; label: string; group_name: string };
type Status = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'draft', label: 'Robocze' },
  { value: 'sent', label: 'Wysłane' },
  { value: 'viewed', label: 'Otwarte' },
  { value: 'accepted', label: 'Zaakceptowane' },
  { value: 'rejected', label: 'Odrzucone' },
  { value: 'expired', label: 'Wygasłe' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Najnowsze' },
  { value: 'createdAt:asc', label: 'Najstarsze' },
  { value: 'projectValue:desc', label: 'Wartość ↓' },
  { value: 'projectValue:asc', label: 'Wartość ↑' },
  { value: 'clientName:asc', label: 'Klient A→Z' },
  { value: 'sentAt:desc', label: 'Ostatnio wysłane' },
  { value: 'acceptedAt:desc', label: 'Ostatnio zaakceptowane' },
];

export default function OffersFilters({
  programs,
  initial,
}: {
  programs: ProgramOpt[];
  initial: { status: Status[]; clientName: string; programId: string; sort: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statuses, setStatuses] = useState<Set<Status>>(new Set(initial.status));
  const [clientName, setClientName] = useState(initial.clientName);
  const [programId, setProgramId] = useState(initial.programId);
  const [sort, setSort] = useState(initial.sort);

  function applyFilters(updates?: Partial<{
    statuses: Set<Status>;
    clientName: string;
    programId: string;
    sort: string;
  }>) {
    const sp = new URLSearchParams();
    const finalStatuses = updates?.statuses ?? statuses;
    const finalClient = updates?.clientName ?? clientName;
    const finalProgram = updates?.programId ?? programId;
    const finalSort = updates?.sort ?? sort;

    if (finalStatuses.size > 0) sp.set('status', Array.from(finalStatuses).join(','));
    if (finalClient.trim()) sp.set('clientName', finalClient.trim());
    if (finalProgram) sp.set('programId', finalProgram);
    if (finalSort !== 'createdAt:desc') sp.set('sort', finalSort);

    startTransition(() => {
      const qs = sp.toString();
      router.push(qs ? `/admin/offers?${qs}` : '/admin/offers');
    });
  }

  function toggleStatus(s: Status) {
    const next = new Set(statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatuses(next);
    applyFilters({ statuses: next });
  }

  function clearAll() {
    setStatuses(new Set());
    setClientName('');
    setProgramId('');
    setSort('createdAt:desc');
    startTransition(() => router.push('/admin/offers'));
  }

  // Grupowanie programów po group_name dla lepszego UX w <select>.
  const grouped = new Map<string, ProgramOpt[]>();
  for (const p of programs) {
    const list = grouped.get(p.group_name) ?? [];
    list.push(p);
    grouped.set(p.group_name, list);
  }

  const hasFilters =
    statuses.size > 0 || clientName.trim() || programId || sort !== 'createdAt:desc';

  return (
    <section style={panel}>
      <div style={row}>
        <div style={chipsRow}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              style={statuses.has(opt.value) ? chipActive : chip}
              disabled={pending}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={row}>
        <input
          type="search"
          placeholder="Szukaj po nazwie klienta…"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          onBlur={() => applyFilters()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyFilters();
            }
          }}
          style={input}
          maxLength={200}
        />

        <select
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            applyFilters({ programId: e.target.value });
          }}
          style={select}
          disabled={pending}
        >
          <option value="">Wszystkie programy</option>
          {Array.from(grouped.entries()).map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            applyFilters({ sort: e.target.value });
          }}
          style={select}
          disabled={pending}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button type="button" onClick={clearAll} style={clearBtn} disabled={pending}>
            Wyczyść
          </button>
        )}
      </div>
    </section>
  );
}

const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 8,
  padding: 16,
  display: 'grid',
  gap: 12,
};
const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const chipsRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};
const chip: React.CSSProperties = {
  padding: '6px 12px',
  background: '#f5f3ee',
  border: '1px solid transparent',
  borderRadius: 16,
  fontSize: 12,
  color: '#6b7a92',
  cursor: 'pointer',
  fontWeight: 500,
};
const chipActive: React.CSSProperties = {
  ...chip,
  background: '#1B2A4A',
  color: '#fff',
};
const input: React.CSSProperties = {
  flex: '1 1 240px',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const select: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 6,
  fontFamily: 'inherit',
  background: '#fff',
  cursor: 'pointer',
};
const clearBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  color: '#c92b3a',
  fontSize: 13,
  cursor: 'pointer',
  fontWeight: 500,
};
