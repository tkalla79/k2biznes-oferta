'use client';

import { useState } from 'react';

type SimulatorResult = {
  funding: number;
  segment: { id: string; label: string };
  variants: Array<{
    id: 'I' | 'II' | 'III' | 'IV';
    name: string;
    base: number;
    sfAmount: number;
    monthly: number;
    total: number;
    expectedValue: number;
    breakEvenProbability: number;
  }>;
  recommendedVariantId: string;
};

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

export default function SimulatorPanel() {
  const [projectValue, setProjectValue] = useState(4_000_000);
  const [fundingRate, setFundingRate] = useState(0.65);
  const [probability, setProbability] = useState(0.5);
  const [returningClient, setReturningClient] = useState(false);
  const [projectCount, setProjectCount] = useState(1);
  const [monthsExec, setMonthsExec] = useState(18);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/simulator/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectValue,
          fundingRate,
          probability,
          returningClient,
          projectCount,
          monthsExec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Błąd');
      setResult(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Field label="Wartość projektu (PLN)">
          <input
            type="number"
            value={projectValue}
            onChange={(e) => setProjectValue(Number(e.target.value))}
            min={1}
            max={1_000_000_000}
            style={input}
          />
        </Field>
        <Field label="Intensywność (0..0.95)">
          <input
            type="number"
            value={fundingRate}
            onChange={(e) => setFundingRate(Number(e.target.value))}
            min={0.1}
            max={0.95}
            step={0.05}
            style={input}
          />
        </Field>
        <Field label={`Prawdopodobieństwo: ${(probability * 100).toFixed(0)}%`}>
          <input
            type="range"
            value={probability}
            onChange={(e) => setProbability(Number(e.target.value))}
            min={0}
            max={1}
            step={0.05}
            style={{ width: '100%' }}
          />
        </Field>
        <Field label="Liczba projektów">
          <select
            value={projectCount}
            onChange={(e) => setProjectCount(Number(e.target.value))}
            style={input}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Klient wracający">
          <select
            value={returningClient ? 'true' : 'false'}
            onChange={(e) => setReturningClient(e.target.value === 'true')}
            style={input}
          >
            <option value="false">Nie</option>
            <option value="true">Tak (rabat 20%)</option>
          </select>
        </Field>
        <Field label="Miesięcy realizacji">
          <input
            type="number"
            value={monthsExec}
            onChange={(e) => setMonthsExec(Number(e.target.value))}
            min={1}
            max={60}
            style={input}
          />
        </Field>
        <div style={{ alignSelf: 'end' }}>
          <button type="submit" disabled={submitting} style={btn}>
            {submitting ? 'Liczę...' : 'Symuluj'}
          </button>
        </div>
      </form>

      {error && <div style={errorBox}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, color: '#6b7a92', margin: '0 0 8px' }}>
            Funding: <strong>{fmtPLN(result.funding)}</strong> · Segment: <strong>{result.segment.label}</strong>
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e4e9f2' }}>
                <th style={th}>Wariant</th>
                <th style={thRight}>Base</th>
                <th style={thRight}>SF</th>
                <th style={thRight}>Total</th>
                <th style={thRight}>EV</th>
                <th style={thRight}>Break-even P</th>
              </tr>
            </thead>
            <tbody>
              {result.variants.map((v) => (
                <tr key={v.id} style={v.id === result.recommendedVariantId ? rowReco : undefined}>
                  <td style={td}>
                    <strong>{v.id}</strong> — {v.name}
                    {v.id === result.recommendedVariantId && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#1f7a4c' }}>★ rekomendowany</span>
                    )}
                  </td>
                  <td style={tdRight}>{fmtPLN(v.base)}</td>
                  <td style={tdRight}>{fmtPLN(v.sfAmount)}</td>
                  <td style={tdRight}>{fmtPLN(v.total)}</td>
                  <td style={{ ...tdRight, fontWeight: 600 }}>{fmtPLN(v.expectedValue)}</td>
                  <td style={tdRight}>{(v.breakEvenProbability * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#6b7a92', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e4e9f2',
  borderRadius: 4,
  background: '#fff',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  padding: '10px 18px',
  background: '#c92b3a',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 0', fontSize: 12, color: '#6b7a92', textTransform: 'uppercase' };
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid #eef1f7' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const rowReco: React.CSSProperties = { background: '#dff3e8' };
const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  background: '#fae8ea',
  border: '1px solid #c92b3a',
  borderRadius: 4,
  color: '#c92b3a',
  fontSize: 13,
};
