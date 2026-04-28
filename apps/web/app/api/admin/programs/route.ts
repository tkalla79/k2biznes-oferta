/**
 * /api/admin/programs (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 3.2.6).
 *
 * Lista i tworzenie programów dotacyjnych. Admin/super_admin only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProgramInput, slugify } from '@/lib/validation/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('programs')
      .select('*')
      .order('display_order')
      .order('label');
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = ProgramInput.parse(await req.json());
    const id = body.id ?? slugify(body.label);
    if (!id) throw new ApiError('VALIDATION_ERROR', 'Nie udało się wygenerować slug.', 422);

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('programs')
      .insert({
        id,
        group_name: body.group_name,
        label: body.label,
        description: body.description ?? null,
        is_custom: body.is_custom,
        display_order: body.display_order,
        is_active: body.is_active,
      })
      .select()
      .single();
    if (error) {
      // 23505 = unique_violation (PK conflict)
      if (error.code === '23505') {
        throw new ApiError('CONFLICT', `Program o id "${id}" już istnieje.`, 409);
      }
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
