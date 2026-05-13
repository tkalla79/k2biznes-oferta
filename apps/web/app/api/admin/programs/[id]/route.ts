/**
 * /api/admin/programs/[id] — PATCH (update) + DELETE (sekcja 5.2 + 3.2.6).
 *
 * DELETE jest hard-delete: `offers.program_id` ma `ON DELETE SET NULL`,
 * więc historyczne oferty zachowują `program_label` (denormalizowana kopia
 * z momentu wystawienia) i tracą tylko referencję na nieistniejący program.
 *
 * Soft-delete (is_active=false) wciąż dostępny przez PATCH — wybór po stronie
 * UI: programu zostawić "ukryty" czy fizycznie usunąć.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProgramUpdate } from '@/lib/validation/catalog';
import type { Database } from '@k2/database/types';

type ProgramsUpdate = Database['public']['Tables']['programs']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const patch = ProgramUpdate.parse(await req.json());

    const sb = createAdminClient();
    const update: ProgramsUpdate = {};
    if (patch.group_name !== undefined) update.group_name = patch.group_name;
    if (patch.label !== undefined) update.label = patch.label;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.cover_storage_key !== undefined) update.cover_storage_key = patch.cover_storage_key;
    if (patch.is_custom !== undefined) update.is_custom = patch.is_custom;
    if (patch.display_order !== undefined) update.display_order = patch.display_order;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;

    if (Object.keys(update).length === 0) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pól do aktualizacji.', 422);
    }

    const { data, error } = await sb
      .from('programs')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Program nie istnieje.');
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const sb = createAdminClient();
    const { error, count } = await sb
      .from('programs')
      .delete({ count: 'exact' })
      .eq('id', params.id);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!count) throw Errors.notFound('Program nie istnieje.');
    return NextResponse.json({ data: { ok: true, id: params.id } });
  } catch (e) {
    return handleError(e);
  }
}
