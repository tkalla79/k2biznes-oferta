/**
 * /api/admin/contact-persons/[id] — PATCH + DELETE (sekcja 5.2 + 3.2.4).
 *
 * DELETE jest hard-delete: `offers.contact_person_id` ON DELETE SET NULL.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContactPersonUpdate } from '@/lib/validation/catalog';
import type { Database } from '@k2/database/types';

type ContactPersonDbUpdate = Database['public']['Tables']['contact_persons']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const patch = ContactPersonUpdate.parse(await req.json());

    const sb = createAdminClient();
    const update: ContactPersonDbUpdate = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.role !== undefined) update.role = patch.role;
    if (patch.phone !== undefined) update.phone = patch.phone;
    if (patch.email !== undefined) update.email = patch.email;
    if (patch.photo_url !== undefined) update.photo_url = patch.photo_url;
    if (patch.photo_storage_key !== undefined) update.photo_storage_key = patch.photo_storage_key;
    if (patch.display_order !== undefined) update.display_order = patch.display_order;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;

    if (Object.keys(update).length === 0) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pól do aktualizacji.', 422);
    }

    const { data, error } = await sb
      .from('contact_persons')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Osoba kontaktowa nie istnieje.');
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
      .from('contact_persons')
      .delete({ count: 'exact' })
      .eq('id', params.id);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!count) throw Errors.notFound('Osoba kontaktowa nie istnieje.');
    return NextResponse.json({ data: { ok: true, id: params.id } });
  } catch (e) {
    return handleError(e);
  }
}
