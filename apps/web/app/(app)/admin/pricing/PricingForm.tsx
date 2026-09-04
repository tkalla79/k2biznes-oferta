'use client';

/**
 * Edytor cennika: segmenty + parametry globalne.
 *
 * Procenty pokazujemy jako 4,5 (a nie 0,045) — konsultant myśli w procentach,
 * a przeliczenie na ułamek robimy przy zapisie. Widełki i stawki w złotych.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type SegmentRow = {
  id: string;
  label: string;
  funding_min: number | string;
  funding_max: number | string | null;
  base_fee: number | string;
  sf_variant_1: number | string;
  sf_variant_2: number | string;
  sf_variant_3: number | string;
  monthly_fee: number | string;
  display_order: number;
};

type ConfigRow = {
  loyalty_discount: number | string;
  multi_discount: number | string;
  min_sf_amount: number | string;
  min_base_fee: number | string;
};

type SegmentState = {
  id: string;
  label: string;
  fundingMin: string;
  fundingMax: string;
  baseFee: string;
  sf1: string;
  sf2: string;
  sf3: string;
  monthlyFee: string;
  displayOrder: number;
};

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
/** Ułamek -> procent do wyświetlenia (0.045 -> "4.5"). */
const toPct = (v: number | string) => String(Math.round(num(v) * 100000) / 1000);
/** Procent z pola -> ułamek (4.5 -> 0.045). Puste = 0. */
const fromPct = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')) / 100);
const toMoney = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/\s/g, '').replace(',', '.')));

const fmtPLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 })
    .format(v);

export default function PricingForm({
  segments: initialSegments,
  config: initialConfig,
}: {
  segments: SegmentRow[];
  config: ConfigRow;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [segments, setSegments] = useState<SegmentState[]>(
    initialSegments.map((s) => ({
      id: s.id,
      label: s.label,
      fundingMin: String(num(s.funding_min)),
      fundingMax: s.funding_max == null ? '' : String(num(s.funding_max)),
      baseFee: String(num(s.base_fee)),
      sf1: toPct(s.sf_variant_1),
      sf2: toPct(s.sf_variant_2),
      sf3: toPct(s.sf_variant_3),
      monthlyFee: String(num(s.monthly_fee)),
      displayOrder: s.display_order,
    })),
  );

  const [config, setConfig] = useState({
    loyaltyDiscount: toPct(initialConfig.loyalty_discount),
    multiDiscount: toPct(initialConfig.multi_discount),
    minSfAmount: String(num(initialConfig.min_sf_amount)),
    minBaseFee: String(num(initialConfig.min_base_fee)),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateSegment(id: string, patch: Partial<SegmentState>) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setSuccess(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segments.map((s) => ({
            id: s.id,
            label: s.label,
            fundingMin: toMoney(s.fundingMin),
            fundingMax: s.fundingMax.trim() === '' ? null : toMoney(s.fundingMax),
            baseFee: toMoney(s.baseFee),
            sfVariant1: fromPct(s.sf1),
            sfVariant2: fromPct(s.sf2),
            sfVariant3: fromPct(s.sf3),
            monthlyFee: toMoney(s.monthlyFee),
            displayOrder: s.displayOrder,
          })),
          config: {
            loyaltyDiscount: fromPct(config.loyaltyDiscount),
            multiDiscount: fromPct(config.multiDiscount),
            minSfAmount: toMoney(config.minSfAmount),
            minBaseFee: toMoney(config.minBaseFee),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Walidacja widelek zwraca liste konkretnych problemow — pokazujemy je
        // wszystkie, zamiast samego "Nieprawidlowe dane wejsciowe".
        const issues = json?.error?.details?.issues as { message?: string }[] | undefined;
        throw new Error(
          issues?.length
            ? issues.map((i) => i.message).filter(Boolean).join(' • ')
            : (json?.error?.message ?? 'Zapis nie udał się.'),
        );
      }
      setSuccess('Cennik zapisany. Nowe oferty liczą się już na tych stawkach.');
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={warnBox}>
        <strong>Zmiana dotyczy tylko nowych wycen.</strong> Oferty już utworzone mają
        zamrożony <code>pricing_snapshot</code> i nie przeliczą się same — to celowe, żeby
        klient nie zobaczył innej ceny niż w mailu. Przeliczenie istniejącej oferty wymaga
        świadomego <code>POST /api/offers/:id/recalculate</code>.
      </div>

      <section style={panel}>
        <h2 style={h2}>Segmenty</h2>
        <p style={hint}>
          Segment dobierany jest po <strong>kwocie dofinansowania</strong>, nie po wartości
          projektu. Widełki muszą się stykać: koniec jednego segmentu to początek następnego,
          pierwszy zaczyna się od 0, ostatni ma puste {'„do”'}. Procenty wpisuj jak 4,5 — nie 0,045.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Nazwa</th>
                <th style={thNum}>Od (zł)</th>
                <th style={thNum}>Do (zł)</th>
                <th style={thNum}>Opłata wstępna</th>
                <th style={thNum}>SF I (%)</th>
                <th style={thNum}>SF II (%)</th>
                <th style={thNum}>SF III (%)</th>
                <th style={thNum}>Rozliczanie/mies.</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <tr key={s.id}>
                  <td style={td}>
                    <input
                      value={s.label}
                      onChange={(e) => updateSegment(s.id, { label: e.target.value })}
                      style={{ ...input, minWidth: 170 }}
                      maxLength={120}
                    />
                    <div style={idHint}>{s.id}</div>
                  </td>
                  <td style={td}>
                    <input
                      value={s.fundingMin}
                      onChange={(e) => updateSegment(s.id, { fundingMin: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.fundingMax}
                      onChange={(e) => updateSegment(s.id, { fundingMax: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                      placeholder="bez limitu"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.baseFee}
                      onChange={(e) => updateSegment(s.id, { baseFee: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.sf1}
                      onChange={(e) => updateSegment(s.id, { sf1: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.sf2}
                      onChange={(e) => updateSegment(s.id, { sf2: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.sf3}
                      onChange={(e) => updateSegment(s.id, { sf3: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={td}>
                    <input
                      value={s.monthlyFee}
                      onChange={(e) => updateSegment(s.id, { monthlyFee: e.target.value })}
                      style={inputNum}
                      inputMode="decimal"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panel}>
        <h2 style={h2}>Parametry globalne</h2>
        <div style={grid}>
          <label style={field}>
            <div style={labelText}>Rabat dla klienta powracającego (%)</div>
            <input
              value={config.loyaltyDiscount}
              onChange={(e) => setConfig({ ...config, loyaltyDiscount: e.target.value })}
              style={input}
              inputMode="decimal"
            />
          </label>
          <label style={field}>
            <div style={labelText}>Rabat za kolejne projekty (%)</div>
            <input
              value={config.multiDiscount}
              onChange={(e) => setConfig({ ...config, multiDiscount: e.target.value })}
              style={input}
              inputMode="decimal"
            />
          </label>
          <label style={field}>
            <div style={labelText}>Minimalne wynagrodzenie wynikowe (zł)</div>
            <input
              value={config.minSfAmount}
              onChange={(e) => setConfig({ ...config, minSfAmount: e.target.value })}
              style={input}
              inputMode="decimal"
            />
          </label>
          <label style={field}>
            <div style={labelText}>Minimalna opłata wstępna (zł)</div>
            <input
              value={config.minBaseFee}
              onChange={(e) => setConfig({ ...config, minBaseFee: e.target.value })}
              style={input}
              inputMode="decimal"
            />
          </label>
        </div>
        <p style={hint}>
          Rabaty są mnożnikami opłaty wstępnej, a minima podłogą — po rabatach opłata nie
          zejdzie niżej niż {fmtPLN(toMoney(config.minBaseFee))}.
        </p>
      </section>

      {error && <div style={errorBox}>{error}</div>}
      {success && <div style={successBox}>{success}</div>}

      <div style={actions}>
        <button type="button" onClick={save} disabled={busy} style={btnPrimary}>
          {busy ? 'Zapisuję…' : 'Zapisz cennik'}
        </button>
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          disabled={busy}
          style={btnSecondary}
        >
          Odrzuć zmiany
        </button>
      </div>
    </>
  );
}

// --- styles -----------------------------------------------------------------

const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e9f2',
  borderRadius: 10,
  padding: 20,
  marginBottom: 20,
};
const h2: React.CSSProperties = { margin: '0 0 6px', fontSize: 17, color: '#1B2A4A' };
const hint: React.CSSProperties = { margin: '6px 0 14px', fontSize: 12.5, color: '#6b7a92', lineHeight: 1.55 };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: '#6b7a92',
  borderBottom: '2px solid #e4e9f2',
};
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #f0f3f8', verticalAlign: 'top' };
const input: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  fontSize: 13,
  border: '1px solid #d6dded',
  borderRadius: 6,
  boxSizing: 'border-box',
};
const inputNum: React.CSSProperties = { ...input, textAlign: 'right', minWidth: 92 };
const idHint: React.CSSProperties = { marginTop: 3, fontSize: 10.5, color: '#9aa7bb', fontFamily: 'monospace' };
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};
const field: React.CSSProperties = { display: 'block' };
const labelText: React.CSSProperties = { fontSize: 12.5, color: '#3a4254', marginBottom: 5, fontWeight: 600 };
const actions: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center' };
const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: '#c92b3a',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 14,
  color: '#3a4254',
  background: '#fff',
  border: '1px solid #d6dded',
  borderRadius: 8,
  cursor: 'pointer',
};
const warnBox: React.CSSProperties = {
  padding: '12px 16px',
  marginBottom: 20,
  background: '#fdf6e3',
  border: '1px solid #e8dcb5',
  borderRadius: 8,
  fontSize: 13,
  color: '#6b5a1f',
  lineHeight: 1.6,
};
const errorBox: React.CSSProperties = {
  padding: '12px 16px',
  marginBottom: 14,
  background: '#fdecee',
  border: '1px solid #f3c4ca',
  borderRadius: 8,
  fontSize: 13,
  color: '#a3202b',
  lineHeight: 1.6,
};
const successBox: React.CSSProperties = {
  padding: '12px 16px',
  marginBottom: 14,
  background: '#eaf7f0',
  border: '1px solid #bfe0cd',
  borderRadius: 8,
  fontSize: 13,
  color: '#1f7a4c',
};
