/**
 * /api/admin/alt-programs/[id] — PATCH + DELETE (feature #2).
 * Hard-delete (jak programs). Wzorzec: /api/admin/programs/[id].
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { AltProgramUpdate } from '@/lib/validation/catalog';
import type { Database } from '@k2/database/types';

type AltProgramDbUpdate = Database['public']['Tables']['alt_programs']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const patch = AltProgramUpdate.parse(await req.json());

    const sb = createAdminClient();
    const update: AltProgramDbUpdate = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.program !== undefined) update.program = patch.program;
    if (patch.nabor !== undefined) update.nabor = patch.nabor;
    if (patch.desc !== undefined) update.desc = patch.desc;
    if (patch.url !== undefined) update.url = patch.url || null;
    if (patch.display_order !== undefined) update.display_order = patch.display_order;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;

    if (Object.keys(update).length === 0) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pól do aktualizacji.', 422);
    }

    const { data, error } = await sb
      .from('alt_programs')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Program nie istnieje.');
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    await logAudit({
      action: 'alt_program.update',
      resourceType: 'alt_program',
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
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const sb = createAdminClient();
    const { error, count } = await sb
      .from('alt_programs')
      .delete({ count: 'exact' })
      .eq('id', params.id);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!count) throw Errors.notFound('Program nie istnieje.');
    await logAudit({
      action: 'alt_program.delete',
      resourceType: 'alt_program',
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
