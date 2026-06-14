/**
 * /api/admin/settings/company-stats — globalne statystyki firmowe (uwaga PDF #1).
 * GET: odczyt. PUT: zapis (super_admin). Render w hero + sekcji "Dlaczego K2".
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, ApiError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CompanyStatsInput = z.object({
  funding: z.string().min(1).max(40),
  projects: z.string().min(1).max(40),
  since: z.string().min(1).max(40),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'company_stats')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data?.value ?? {} });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = CompanyStatsInput.parse(await req.json());

    const sb = createAdminClient();
    const { error } = await sb
      .from('app_settings')
      .upsert({ key: 'company_stats', value: body as unknown as Json, updated_at: new Date().toISOString() });
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

    await logAudit({
      action: 'settings.update',
      resourceType: 'app_setting',
      resourceId: 'company_stats',
      actorId: session.userId,
      actorEmail: session.email,
      after: body,
    });
    return NextResponse.json({ data: body });
  } catch (e) {
    return handleError(e);
  }
}
