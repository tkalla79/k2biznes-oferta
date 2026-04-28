/**
 * /api/admin/contact-persons (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 3.2.4).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContactPersonInput, slugify } from '@/lib/validation/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('contact_persons')
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
    await requireAdmin();
    const body = ContactPersonInput.parse(await req.json());
    const id = body.id ?? slugify(body.name);
    if (!id) throw new ApiError('VALIDATION_ERROR', 'Nie udało się wygenerować slug.', 422);

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('contact_persons')
      .insert({
        id,
        name: body.name,
        role: body.role,
        phone: body.phone ?? null,
        email: body.email ?? null,
        photo_url: body.photo_url ?? null,
        display_order: body.display_order,
        is_active: body.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError('CONFLICT', `Osoba kontaktowa "${id}" już istnieje.`, 409);
      }
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
