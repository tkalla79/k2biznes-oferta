/**
 * 12-miesięczna prognoza akceptacji + revenue (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Model:
 * 1. Historyczna baseline = średnia miesięczna accepted/revenue z ostatnich N miesięcy
 *    (default 12; domyślnie używa wszystkich danych jakie są).
 * 2. Pending uplift = pending oferty (sent/viewed) razy historyczna konwersja
 *    (viewed_to_accepted z stats_overview).
 * 3. Forecast per miesiąc = baseline (stała) + pending uplift (rozłożony liniowo
 *    na pierwsze 3 miesiące — zakładamy że pending zamknie się w Q+1).
 *
 * Świadomie prosty model — zaawansowany (regresja, sezonowość) wymaga >12m danych
 * historycznych. Wracamy do tego w PR po pierwszym roku produkcji.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOverview } from './overview';
import { MonthlyPipelineArraySchema } from './schemas';
import type { ForecastMonth, ForecastResult, MonthlyPipeline, OverviewStats } from './types';

const FORECAST_HORIZON = 12;
const PENDING_UPLIFT_SPREAD_MONTHS = 3;

export async function fetchForecast(monthsBack = 12): Promise<ForecastResult> {
  const sb = createAdminClient();
  const [historyRes, overview] = await Promise.all([
    sb.rpc('stats_pipeline_by_month', { months_back: monthsBack }),
    fetchOverview(),
  ]);
  if (historyRes.error) throw new Error(`stats_pipeline_by_month failed: ${historyRes.error.message}`);

  const history = MonthlyPipelineArraySchema.parse(historyRes.data ?? []);
  return computeForecast(history, overview);
}

/** ISO YYYY-MM bieżącego miesiąca (lokalny czas). */
function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function computeForecast(history: MonthlyPipeline[], overview: OverviewStats): ForecastResult {
  // Code review PR #6: wyklucz partial current month z baseline. SQL function
  // zwraca też miesiąc bieżący ale z niepełną liczbą dni — średnia byłaby
  // systematycznie zaniżona o czynnik (days_elapsed / days_in_month).
  const currentKey = currentMonthKey();
  const finishedHistory = history.filter((h) => h.month_start !== currentKey);

  const monthsUsed = finishedHistory.length;
  const sumAccepted = finishedHistory.reduce((a, h) => a + h.accepted, 0);
  const sumRevenue = finishedHistory.reduce((a, h) => a + h.revenue, 0);
  const avgAccepted = monthsUsed > 0 ? sumAccepted / monthsUsed : 0;
  const avgRevenue = monthsUsed > 0 ? sumRevenue / monthsUsed : 0;

  const pendingRevenue =
    overview.revenue.pipeline_sf_var1_sum * (overview.conversion.viewed_to_accepted || 0);

  const forecast: ForecastMonth[] = [];
  const now = new Date();
  for (let i = 1; i <= FORECAST_HORIZON; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Pending uplift rozłożony tylko na pierwsze N miesięcy
    const pendingUpliftThisMonth =
      i <= PENDING_UPLIFT_SPREAD_MONTHS ? pendingRevenue / PENDING_UPLIFT_SPREAD_MONTHS : 0;

    forecast.push({
      month,
      expected_accepted: Math.round(avgAccepted),
      expected_revenue: Math.round(avgRevenue + pendingUpliftThisMonth),
      pipeline_pending_revenue: Math.round(pendingUpliftThisMonth),
    });
  }

  return {
    history,
    baseline: {
      avg_monthly_accepted: Math.round(avgAccepted * 10) / 10,
      avg_monthly_revenue: Math.round(avgRevenue),
      months_used: monthsUsed,
    },
    forecast,
    computed_at: new Date().toISOString(),
  };
}
