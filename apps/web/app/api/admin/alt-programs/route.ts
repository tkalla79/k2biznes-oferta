/**
 * /api/admin/alt-programs — biblioteka "Inne możliwości wsparcia" (feature #2).
 * Lista + tworzenie. Admin/super_admin only. Wzorzec: /api/admin/programs.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { AltProgramInput, slugify } from '@/lib/validation/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('alt_programs')
      .select('*')
      .order('display_order')
      .order('name');
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = AltProgramInput.parse(await req.json());
    const id = body.id ?? slugify(body.name);
    if (!id) throw new ApiError('VALIDATION_ERROR', 'Nie udało się wygenerować slug.', 422);

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('alt_programs')
      .insert({
        id,
        name: body.name,
        program: body.program,
        nabor: body.nabor ?? null,
        desc: body.desc ?? null,
        url: body.url || null,
        display_order: body.display_order,
        is_active: body.is_active,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError('CONFLICT', `Program o id "${id}" już istnieje.`, 409);
      }
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    await logAudit({
      action: 'alt_program.create',
      resourceType: 'alt_program',
      resourceId: id,
      actorId: session.userId,
      actorEmail: session.email,
      after: { name: data.name, program: data.program, is_active: data.is_active },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
