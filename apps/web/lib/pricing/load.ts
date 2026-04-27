/**
 * Loader: pobiera SEGMENTS + CONFIG z Supabase (server-side only).
 *
 * Engine `calcPricing()` jest pure — ten loader to single point of contact z DB.
 * Cachowanie pamięcioweksze 5 minut żeby nie odpytywać DB przy każdej kalkulacji
 * (segmenty zmieniają się rzadko — super_admin przez admin UI).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { PricingConfig, PricingSegment } from './types';

type Cache = {
  segments: PricingSegment[];
  config: PricingConfig;
  loadedAt: number;
};

const TTL_MS = 5 * 60 * 1000;
let cache: Cache | null = null;

export async function loadPricing(opts: { forceRefresh?: boolean } = {}): Promise<{
  segments: PricingSegment[];
  config: PricingConfig;
}> {
  if (!opts.forceRefresh && cache && Date.now() - cache.loadedAt < TTL_MS) {
    return { segments: cache.segments, config: cache.config };
  }

  const sb = createAdminClient();
  const [segRes, cfgRes] = await Promise.all([
    sb.from('pricing_segments').select('*').order('display_order', { ascending: true }),
    sb.from('pricing_config').select('*').eq('id', 'global').single(),
  ]);

  if (segRes.error) throw new Error(`pricing_segments load failed: ${segRes.error.message}`);
  if (cfgRes.error) throw new Error(`pricing_config load failed: ${cfgRes.error.message}`);
  if (!segRes.data || segRes.data.length === 0) {
    throw new Error('pricing_segments empty — uruchom seed.sql (Appendix C)');
  }
  if (!cfgRes.data) {
    throw new Error("pricing_config 'global' not found — uruchom seed.sql");
  }

  const segments: PricingSegment[] = segRes.data.map((r) => ({
    id: r.id,
    label: r.label,
    fundingMin: Number(r.funding_min),
    fundingMax: r.funding_max == null ? null : Number(r.funding_max),
    baseFee: Number(r.base_fee),
    sfVariant1: Number(r.sf_variant_1),
    sfVariant2: Number(r.sf_variant_2),
    sfVariant3: Number(r.sf_variant_3),
    monthlyFee: Number(r.monthly_fee),
    displayOrder: r.display_order,
  }));

  const config: PricingConfig = {
    loyaltyDiscount: Number(cfgRes.data.loyalty_discount),
    multiDiscount: Number(cfgRes.data.multi_discount),
    minSfAmount: Number(cfgRes.data.min_sf_amount),
    minBaseFee: Number(cfgRes.data.min_base_fee),
  };

  cache = { segments, config, loadedAt: Date.now() };
  return { segments, config };
}

/**
 * Invaliduj cache — wołane po `update pricing_*` przez super_admina (sekcja 4.4).
 */
export function invalidatePricingCache() {
  cache = null;
}
