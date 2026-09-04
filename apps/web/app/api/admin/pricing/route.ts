/**
 * /api/admin/pricing — odczyt i zapis cennika (segmenty + config).
 *
 * Tylko super_admin: to jedyne miejsce w systemie, gdzie zmiana jednego pola
 * przestawia wycenę wszystkich nowych ofert. Dotąd stawki dało się zmienić
 * wyłącznie SQL-em, mimo że komentarz w `lib/pricing/load.ts` od początku
 * zakładał edycję z panelu.
 *
 * Zapis idzie jednym PATCH-em (cały cennik naraz), bo widełki segmentów muszą
 * pozostać spójne — zapisywanie wiersz po wierszu przepuszczałoby stany
 * przejściowe z dziurą w widełkach, na której silnik się wywala.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { invalidatePricingCache } from '@/lib/pricing/load';
import { logAudit } from '@/lib/audit';
import { UpdatePricingInput } from '@/lib/validation/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireSuperAdmin();
    const sb = createAdminClient();

    const [segRes, cfgRes] = await Promise.all([
      sb.from('pricing_segments').select('*').order('display_order'),
      sb.from('pricing_config').select('*').eq('id', 'global').single(),
    ]);
    if (segRes.error) throw new ApiError('INTERNAL_ERROR', segRes.error.message, 500);
    if (cfgRes.error) throw new ApiError('INTERNAL_ERROR', cfgRes.error.message, 500);

    return NextResponse.json({ data: { segments: segRes.data ?? [], config: cfgRes.data } });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = UpdatePricingInput.parse(await req.json());

    const sb = createAdminClient();

    // Stan przed — do audytu. Zmiana cennika bez sladu byla luka: dotychczasowe
    // SQL-e nie zostawialy nic w audit_log.
    const [beforeSeg, beforeCfg] = await Promise.all([
      sb.from('pricing_segments').select('*').order('display_order'),
      sb.from('pricing_config').select('*').eq('id', 'global').single(),
    ]);

    const known = new Set((beforeSeg.data ?? []).map((s) => s.id));
    const unknown = body.segments.filter((s) => !known.has(s.id));
    if (unknown.length > 0) {
      // Ekran edytuje istniejace segmenty; dodawanie nowych to osobna decyzja
      // biznesowa (zmienia sie caly uklad widelek).
      throw new ApiError(
        'VALIDATION_ERROR',
        `Nieznane segmenty: ${unknown.map((s) => s.id).join(', ')}. ` +
          'Ekran edytuje istniejące segmenty, nie dodaje nowych.',
        422,
      );
    }

    for (const s of body.segments) {
      const { error } = await sb
        .from('pricing_segments')
        .update({
          label: s.label,
          funding_min: s.fundingMin,
          funding_max: s.fundingMax,
          base_fee: s.baseFee,
          sf_variant_1: s.sfVariant1,
          sf_variant_2: s.sfVariant2,
          sf_variant_3: s.sfVariant3,
          monthly_fee: s.monthlyFee,
          display_order: s.displayOrder,
        })
        .eq('id', s.id);
      if (error) throw new ApiError('INTERNAL_ERROR', `segment ${s.id}: ${error.message}`, 500);
    }

    const { error: cfgErr } = await sb
      .from('pricing_config')
      .update({
        loyalty_discount: body.config.loyaltyDiscount,
        multi_discount: body.config.multiDiscount,
        min_sf_amount: body.config.minSfAmount,
        min_base_fee: body.config.minBaseFee,
      })
      .eq('id', 'global');
    if (cfgErr) throw new ApiError('INTERNAL_ERROR', cfgErr.message, 500);

    // Loader trzyma segmenty w pamieci 5 minut — bez tego zmiana wchodzi
    // z opoznieniem i konsultant widzi stare liczby.
    invalidatePricingCache();

    await logAudit({
      action: 'pricing.update',
      resourceType: 'app_setting',
      resourceId: 'pricing',
      actorId: session.userId,
      actorEmail: session.email,
      before: { segments: beforeSeg.data ?? [], config: beforeCfg.data ?? null },
      after: { segments: body.segments, config: body.config },
    });

    return NextResponse.json({ data: { ok: true, updated: body.segments.length } });
  } catch (e) {
    return handleError(e);
  }
}
