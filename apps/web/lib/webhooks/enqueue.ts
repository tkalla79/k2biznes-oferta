/**
 * Wpis do kolejki `webhook_jobs` (BACKEND_SPEC.md v1.1.1, sekcja 10).
 *
 * Konfiguracja:
 * - Włączenie/wyłączenie target'u: `pricing_config.crm_enabled_targets[]` (DB,
 *   żeby super_admin mógł ratować się przed wadliwym integratorem bez deploya).
 * - URL targetu: env (`HUBSPOT_WEBHOOK_URL`, `PIPEDRIVE_WEBHOOK_URL`,
 *   `CUSTOM_WEBHOOK_URL`).
 * - Auth bearer token: env (`HUBSPOT_ACCESS_TOKEN`, `PIPEDRIVE_API_TOKEN`,
 *   `CUSTOM_WEBHOOK_TOKEN`).
 *
 * UWAGA (PR #5 code review): kolumny `pricing_config.crm_*_token` istnieją w
 * schemie ale NIE są używane — chcemy uniknąć trzymania sekretów w DB. Wszystkie
 * sekrety idą przez env (rotowalne bez SQL UPDATE'a).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { OfferRow } from '@/lib/offers/mapper';
import type { PricingResult } from '@/lib/pricing';
import type { WebhookEvent, WebhookOfferPayload, WebhookTarget } from './types';
import type { Json } from '@k2/database/types';

type CrmConfig = {
  enabled: WebhookTarget[];
  hubspotUrl: string | null;
  pipedriveUrl: string | null;
  customUrl: string | null;
};

let cachedConfig: { value: CrmConfig; expiresAt: number } | null = null;
const CONFIG_TTL_MS = 60_000;

async function loadCrmConfig(): Promise<CrmConfig> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('pricing_config')
    .select('crm_enabled_targets')
    .eq('id', 'global')
    .maybeSingle();

  if (error) throw new Error(`pricing_config load failed: ${error.message}`);

  // URL + bearer token targetów — env-only (sekrety rotowalne bez SQL UPDATE'a).
  const value: CrmConfig = {
    enabled: ((data?.crm_enabled_targets ?? []) as WebhookTarget[]).filter((t): t is WebhookTarget =>
      ['hubspot', 'pipedrive', 'custom'].includes(t),
    ),
    hubspotUrl: process.env.HUBSPOT_WEBHOOK_URL ?? null,
    pipedriveUrl: process.env.PIPEDRIVE_WEBHOOK_URL ?? null,
    customUrl: process.env.CUSTOM_WEBHOOK_URL ?? null,
  };
  cachedConfig = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
  return value;
}

export function invalidateCrmConfigCache() {
  cachedConfig = null;
}

function urlFor(target: WebhookTarget, cfg: CrmConfig): string | null {
  switch (target) {
    case 'hubspot':
      return cfg.hubspotUrl;
    case 'pipedrive':
      return cfg.pipedriveUrl;
    case 'custom':
      return cfg.customUrl;
  }
}

function tokenEnvFor(target: WebhookTarget): string | undefined {
  switch (target) {
    case 'hubspot':
      return process.env.HUBSPOT_ACCESS_TOKEN;
    case 'pipedrive':
      return process.env.PIPEDRIVE_API_TOKEN;
    case 'custom':
      return process.env.CUSTOM_WEBHOOK_TOKEN;
  }
}

/**
 * Buduje payload z OfferRow + opcjonalnym `consultant`. Best-effort — pobiera
 * email konsultanta z `profiles` (jeden round-trip do DB).
 */
async function buildPayload(args: {
  event: WebhookEvent;
  offer: OfferRow;
  idempotencyKey: string;
}): Promise<WebhookOfferPayload> {
  const { event, offer, idempotencyKey } = args;
  const sb = createAdminClient();

  const consultantId = offer.assigned_consultant_id ?? offer.created_by;
  const { data: consultant } = await sb
    .from('profiles')
    .select('id, email')
    .eq('id', consultantId)
    .maybeSingle();

  const snapshot = offer.pricing_snapshot as unknown as PricingResult;

  const payload: WebhookOfferPayload = {
    idempotencyKey,
    event,
    timestamp: new Date().toISOString(),
    offer: {
      id: offer.id,
      offerNumber: offer.offer_number,
      status: offer.status,
      clientName: offer.client_name,
      clientNip: offer.client_nip,
      clientIndustry: offer.client_industry,
      programLabel: offer.program_label,
      projectValue: Number(offer.project_value),
      fundingRate: Number(offer.funding_rate),
      funding: snapshot.funding,
      selectedVariant: offer.selected_variant,
      acceptedVariant: offer.accepted_variant,
      acceptedFee: offer.accepted_fee == null ? null : Number(offer.accepted_fee),
    },
    consultant: {
      id: consultantId,
      email: consultant?.email ?? null,
    },
  };

  // Klient: tylko gdy mamy dane (po accept/reject).
  if (offer.accepted_by_name || offer.accepted_by_email) {
    payload.client = {
      name: offer.accepted_by_name ?? '—',
      email: offer.accepted_by_email,
    };
  }

  return payload;
}

/**
 * Tworzy job per włączony target. Idempotency key = `webhook_jobs.id` (UUID
 * generowany przy insert) — ten sam payload retry'owany ma stały klucz.
 *
 * Zwraca tablicę utworzonych job IDs (puste gdy żaden target nie włączony).
 */
export async function enqueueOfferWebhook(args: {
  event: WebhookEvent;
  offer: OfferRow;
}): Promise<string[]> {
  const cfg = await loadCrmConfig();
  if (cfg.enabled.length === 0) return [];

  const sb = createAdminClient();
  const ids: string[] = [];

  for (const target of cfg.enabled) {
    const url = urlFor(target, cfg);
    if (!url) {
      console.warn(`[webhooks] target=${target} enabled but URL not set in env`);
      continue;
    }

    // Pre-generuj UUID, użyj jako idempotencyKey + jako webhook_jobs.id
    const idempotencyKey = crypto.randomUUID();
    const payload = await buildPayload({
      event: args.event,
      offer: args.offer,
      idempotencyKey,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = tokenEnvFor(target);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const { data, error } = await sb
      .from('webhook_jobs')
      .insert({
        id: idempotencyKey,
        target,
        event: args.event,
        url,
        payload: payload as unknown as Json,
        headers: headers as unknown as Json,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error(`[webhooks] enqueue ${target}/${args.event} failed:`, error?.message);
      continue;
    }
    ids.push(data.id);
  }

  return ids;
}
