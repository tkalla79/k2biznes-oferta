/**
 * Testy `computeForecast` (pure function — bez DB).
 */
import { describe, it, expect } from 'vitest';
import { computeForecast } from './forecast';
import type { MonthlyPipeline, OverviewStats } from './types';

const overviewBase: OverviewStats = {
  counts: { sent: 5, viewed: 3, accepted: 4 },
  totals: { all: 12, active: 8, closed_won: 4, closed_lost: 0 },
  revenue: {
    accepted_fee_total: 600_000,
    accepted_fee_last_30d: 200_000,
    pipeline_sf_var1_sum: 300_000, // pending offers SF var1 sum
  },
  conversion: { sent_to_viewed: 0.6, viewed_to_accepted: 0.5 },
  avg_time_hours: { sent_to_viewed: 24, viewed_to_accepted: 72 },
  computed_at: new Date().toISOString(),
};

describe('computeForecast', () => {
  it('produkuje 12 miesięcy w przyszłości', () => {
    const r = computeForecast([], overviewBase);
    expect(r.forecast).toHaveLength(12);
  });

  it('baseline z empty history → 0', () => {
    const r = computeForecast([], overviewBase);
    expect(r.baseline.avg_monthly_accepted).toBe(0);
    expect(r.baseline.avg_monthly_revenue).toBe(0);
  });

  it('baseline wylicza średnią z historii', () => {
    const history: MonthlyPipeline[] = [
      { month_start: '2026-01', accepted: 2, revenue: 100_000 },
      { month_start: '2026-02', accepted: 4, revenue: 200_000 },
      { month_start: '2026-03', accepted: 6, revenue: 300_000 },
    ];
    const r = computeForecast(history, { ...overviewBase, revenue: { ...overviewBase.revenue, pipeline_sf_var1_sum: 0 } });
    expect(r.baseline.avg_monthly_accepted).toBe(4);
    expect(r.baseline.avg_monthly_revenue).toBe(200_000);
    expect(r.baseline.months_used).toBe(3);
  });

  it('pending uplift rozłożony na pierwsze 3 miesiące', () => {
    const r = computeForecast([], overviewBase);
    // pipeline_sf_var1_sum = 300_000, conversion viewed_to_accepted = 0.5
    // pending uplift total = 150_000, podzielone /3 = 50_000 na każdy z pierwszych 3 mies.
    expect(r.forecast[0].pipeline_pending_revenue).toBe(50_000);
    expect(r.forecast[1].pipeline_pending_revenue).toBe(50_000);
    expect(r.forecast[2].pipeline_pending_revenue).toBe(50_000);
    expect(r.forecast[3].pipeline_pending_revenue).toBe(0);
    expect(r.forecast[11].pipeline_pending_revenue).toBe(0);
  });

  it('expected_revenue = baseline + pending uplift', () => {
    const history: MonthlyPipeline[] = [
      { month_start: '2026-01', accepted: 1, revenue: 100_000 },
      { month_start: '2026-02', accepted: 1, revenue: 100_000 },
    ];
    const r = computeForecast(history, overviewBase);
    // baseline avg = 100_000; pending uplift /3 = 50_000
    expect(r.forecast[0].expected_revenue).toBe(150_000);
    expect(r.forecast[3].expected_revenue).toBe(100_000); // tylko baseline po 3 mies.
  });

  it('miesiące w forecaście są kolejne (YYYY-MM)', () => {
    const r = computeForecast([], overviewBase);
    const months = r.forecast.map((f) => f.month);
    // każdy następny miesiąc > poprzedni leksykograficznie
    for (let i = 1; i < months.length; i++) {
      expect(months[i] > months[i - 1]).toBe(true);
    }
    // format YYYY-MM
    for (const m of months) {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('zerowa konwersja → tylko baseline (no uplift)', () => {
    const overview = { ...overviewBase, conversion: { sent_to_viewed: 0, viewed_to_accepted: 0 } };
    const r = computeForecast([], overview);
    expect(r.forecast[0].pipeline_pending_revenue).toBe(0);
  });

  it('exclude current partial month z baseline (PR #6 review fix)', () => {
    // Bieżący miesiąc ma niepełną liczbę dni — wcześniej był wliczany do
    // baseline'u i zaniżał średnią. Teraz filtrujemy go out.
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const history: MonthlyPipeline[] = [
      { month_start: prevKey, accepted: 10, revenue: 1_000_000 },
      { month_start: currentKey, accepted: 1, revenue: 100_000 }, // partial — should be excluded
    ];
    const r = computeForecast(history, overviewBase);
    // baseline = avg z prevKey only (current excluded)
    expect(r.baseline.months_used).toBe(1);
    expect(r.baseline.avg_monthly_revenue).toBe(1_000_000);
    expect(r.baseline.avg_monthly_accepted).toBe(10);
  });
});
