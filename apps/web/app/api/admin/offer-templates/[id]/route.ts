/**
 * /api/admin/offer-templates/[id] — GET (pełny template_data do pre-fill),
 * PATCH (rename), DELETE. Feature #1.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { TemplateRenameInput } from '@/lib/validation/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('offer_templates')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!data) throw Errors.notFound('Szablon nie istnieje.');
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const body = TemplateRenameInput.parse(await req.json());
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('offer_templates')
      .update({ name: body.name })
      .eq('id', params.id)
      .select('id, name, created_by, created_at')
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Szablon nie istnieje.');
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const sb = createAdminClient();
    const { error, count } = await sb
      .from('offer_templates')
      .delete({ count: 'exact' })
      .eq('id', params.id);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!count) throw Errors.notFound('Szablon nie istnieje.');
    await logAudit({
      action: 'offer_template.delete',
      resourceType: 'offer_template',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      before: { id: params.id },
    });
    return NextResponse.json({ data: { ok: true, id: params.id } });
  } catch (e) {
    return handleError(e);
  }
}
