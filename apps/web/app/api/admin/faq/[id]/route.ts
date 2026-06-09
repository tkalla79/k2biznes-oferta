/**
 * /api/admin/faq/[id] — PATCH + DELETE (PR-D / uwaga 19).
 * Soft delete (deleted_at) — RLS public select juz to filtruje.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { FaqItemUpdate } from '@/lib/validation/catalog';
import type { Database } from '@k2/database/types';

type FaqUpdate = Database['public']['Tables']['faq_items']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const patch = FaqItemUpdate.parse(await req.json());
    const sb = createAdminClient();
    const update: FaqUpdate = {};
    if (patch.question !== undefined) update.question = patch.question;
    if (patch.answer !== undefined) update.answer = patch.answer;
    if (patch.display_order !== undefined) update.display_order = patch.display_order;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;
    if (Object.keys(update).length === 0) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pól do aktualizacji.', 422);
    }
    const { data, error } = await sb
      .from('faq_items')
      .update(update)
      .eq('id', params.id)
      .is('deleted_at', null)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Pytanie FAQ nie istnieje.');
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    await logAudit({
      action: 'faq.update',
      resourceType: 'faq_item',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      after: { fields: Object.keys(update) },
    });
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const sb = createAdminClient();
    const { error, count } = await sb
      .from('faq_items')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', params.id)
      .is('deleted_at', null);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!count) throw Errors.notFound('Pytanie FAQ nie istnieje.');
    await logAudit({
      action: 'faq.delete',
      resourceType: 'faq_item',
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
