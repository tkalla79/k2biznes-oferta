/**
 * DTO dla `/api/stats/*` (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 */

export type OverviewStats = {
  counts: Partial<Record<'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired', number>>;
  totals: {
    all: number;
    active: number;
    closed_won: number;
    closed_lost: number;
  };
  revenue: {
    accepted_fee_total: number;
    accepted_fee_last_30d: number;
    pipeline_sf_var1_sum: number;
  };
  conversion: {
    sent_to_viewed: number; // 0..1
    viewed_to_accepted: number;
  };
  avg_time_hours: {
    sent_to_viewed: number;
    viewed_to_accepted: number;
  };
  computed_at: string;
};

export type ConsultantStats = {
  consultant_id: string;
  full_name: string | null;
  email: string | null;
  total: number;
  accepted: number;
  rejected: number;
  active: number;
  revenue: number;
};

export type MonthlyPipeline = {
  month_start: string; // 'YYYY-MM'
  accepted: number;
  revenue: number;
};

export type ForecastMonth = {
  month: string; // 'YYYY-MM'
  expected_accepted: number;
  expected_revenue: number;
  /** Z bazowych ofert pending (sent/viewed) — assumption that conversion will hit. */
  pipeline_pending_revenue: number;
};

export type ForecastResult = {
  history: MonthlyPipeline[];
  baseline: {
    avg_monthly_accepted: number;
    avg_monthly_revenue: number;
    months_used: number;
  };
  forecast: ForecastMonth[];
  computed_at: string;
};
