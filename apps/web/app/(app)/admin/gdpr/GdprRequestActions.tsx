'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  id: string;
  status: 'requested' | 'approved' | 'executed' | 'rejected';
  idDisplay: string;
};

export default function GdprRequestActions({ id, status, idDisplay }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'reject' | 'execute') {
    if (decision === 'reject') {
      const reason = window.prompt('Powód odrzucenia:');
      if (reason === null) return;
      await call(decision, { rejectReason: reason });
    } else if (decision === 'execute') {
      const ok = window.confirm(
        `EXECUTE — anonimizuje wszystkie dane dla ${idDisplay}. Operacji nie można cofnąć. Kontynuować?`,
      );
      if (!ok) return;
      await call(decision);
    } else {
      await call(decision);
    }
  }

  async function call(decision: string, extra: Record<string, unknown> = {}) {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/data-deletion-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {status === 'requested' && (
        <>
          <button onClick={() => decide('approve')} disabled={!!submitting} style={btnGreen}>
            {submitting === 'approve' ? '...' : 'Approve'}
          </button>
          <button onClick={() => decide('reject')} disabled={!!submitting} style={btnRed}>
            {submitting === 'reject' ? '...' : 'Reject'}
          </button>
        </>
      )}
      {status === 'approved' && (
        <button onClick={() => decide('execute')} disabled={!!submitting} style={btnRedSolid}>
          {submitting === 'execute' ? '...' : 'EXECUTE — anonimizuj'}
        </button>
      )}
      {(status === 'executed' || status === 'rejected') && (
        <span style={{ fontSize: 12, color: '#6b7a92' }}>Brak dalszych akcji.</span>
      )}
      {error && (
        <span style={{ color: '#c92b3a', fontSize: 13, marginLeft: 8 }}>{error}</span>
      )}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid',
  borderRadius: 4,
  cursor: 'pointer',
};
const btnGreen: React.CSSProperties = {
  ...btnBase,
  background: '#dff3e8',
  borderColor: '#1f7a4c',
  color: '#1f7a4c',
};
const btnRed: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  borderColor: '#c92b3a',
  color: '#c92b3a',
};
const btnRedSolid: React.CSSProperties = {
  ...btnBase,
  background: '#c92b3a',
  borderColor: '#c92b3a',
  color: '#fff',
};
