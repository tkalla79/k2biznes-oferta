'use client';

/**
 * Formularz statystyk firmowych (uwaga PDF #1). PUT /api/admin/settings/company-stats.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Stats = { funding: string; projects: string; since: string };

export default function CompanyStatsForm({ initial }: { initial: Stats }) {
  const router = useRouter();
  const [form, setForm] = useState<Stats>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings/company-stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Zapis nie powiódł się.');
      setMsg({ ok: true, text: 'Zapisano — zmiana widoczna na wszystkich ofertach.' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={card}>
      <Field label="Pozyskane dofinansowanie" hint="np. „475 mln zł”">
        <input style={input} value={form.funding} maxLength={40}
          onChange={(e) => setForm({ ...form, funding: e.target.value })} />
      </Field>
      <Field label="Zrealizowane projekty" hint="np. „288”">
        <input style={input} value={form.projects} maxLength={40}
          onChange={(e) => setForm({ ...form, projects: e.target.value })} />
      </Field>
      <Field label="Doświadczenie / rok" hint="np. „od 2015”">
        <input style={input} value={form.since} maxLength={40}
          onChange={(e) => setForm({ ...form, since: e.target.value })} />
      </Field>

      {msg && (
        <div style={msg.ok ? okBox : errBox}>{msg.text}</div>
      )}

      <button onClick={save} disabled={busy} style={btnPrimary}>
        {busy ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#3a4254', marginBottom: 4 }}>{label}</span>
      {hint && <span style={{ display: 'block', fontSize: 12, color: '#9aa3b2', marginBottom: 6 }}>{hint}</span>}
      {children}
    </label>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #e4e9f2', borderRadius: 10, padding: 24 };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #d4dae6', borderRadius: 6, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '12px 24px', background: '#c92b3a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 };
const okBox: React.CSSProperties = { marginBottom: 14, padding: 10, background: '#e6f4ea', border: '1px solid #b7dfc4', color: '#1f7a4c', borderRadius: 6, fontSize: 13 };
const errBox: React.CSSProperties = { marginBottom: 14, padding: 10, background: '#fce8e6', border: '1px solid #f5c6c2', color: '#A8140F', borderRadius: 6, fontSize: 13 };
