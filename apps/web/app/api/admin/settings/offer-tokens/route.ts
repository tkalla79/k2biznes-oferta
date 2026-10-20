/**
 * /api/admin/settings/offer-tokens — wartości podstawiane w treści ofert
 * (`{{de_minimis}}`). GET: odczyt. PUT: zapis (super_admin).
 *
 * Osobny klucz `app_settings`, nie dopisek do `company_stats`: statystyki są
 * materiałem marketingowym w hero, a tu stoi liczba z przepisu, która wchodzi
 * w zdania o finansowaniu. Mylić ich uprawnieniami ani historią audytu nie ma
 * po co.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, ApiError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { resolveOfferTokens } from '@/lib/offers/tokens';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OfferTokensInput = z.object({
  de_minimis: z.string().min(1).max(80),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'offer_tokens')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    // Przez `resolveOfferTokens`, żeby panel pokazywał tę samą wartość, którą
    // zobaczy klient — także gdy w bazie jeszcze nic nie ma.
    return NextResponse.json({ data: resolveOfferTokens(data?.value) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = OfferTokensInput.parse(await req.json());

    const sb = createAdminClient();
    const { error } = await sb.from('app_settings').upsert({
      key: 'offer_tokens',
      value: body as unknown as Json,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

    await logAudit({
      action: 'settings.update',
      resourceType: 'app_setting',
      resourceId: 'offer_tokens',
      actorId: session.userId,
      actorEmail: session.email,
      after: body,
    });
    return NextResponse.json({ data: body });
  } catch (e) {
    return handleError(e);
  }
}
