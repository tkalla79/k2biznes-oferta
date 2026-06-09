/**
 * /api/admin/offer-templates — szablony oferty (feature #1).
 * GET: lista (lekka, bez template_data). POST: zapis nowego szablonu.
 * Globalne — każdy zalogowany konsultant (nie tylko admin).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { TemplateCreateInput } from '@/lib/validation/templates';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireSession();
    const sb = createAdminClient();
    // Lekka lista — bez template_data (pełne dane przez GET [id] przy wyborze).
    const { data, error } = await sb
      .from('offer_templates')
      .select('id, name, created_by, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = TemplateCreateInput.parse(await req.json());

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('offer_templates')
      .insert({
        name: body.name,
        template_data: body.template_data as Json,
        created_by: session.userId,
      })
      .select('id, name, created_by, created_at')
      .single();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

    await logAudit({
      action: 'offer_template.create',
      resourceType: 'offer_template',
      resourceId: data.id,
      actorId: session.userId,
      actorEmail: session.email,
      after: { name: data.name },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
