/**
 * /api/admin/case-studies (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 3.2.5).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { CaseStudyInput, slugify } from '@/lib/validation/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('case_studies')
      .select('*')
      .order('display_order')
      .order('client');
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = CaseStudyInput.parse(await req.json());
    const id = body.id ?? slugify(`${body.client}-${body.title}`);
    if (!id) throw new ApiError('VALIDATION_ERROR', 'Nie udało się wygenerować slug.', 422);

    const sb = createAdminClient();
    const { data, error } = await sb
      .from('case_studies')
      .insert({
        id,
        client: body.client,
        tag: body.tag ?? null,
        title: body.title,
        paragraph_1: body.paragraph_1 ?? null,
        paragraph_2: body.paragraph_2 ?? null,
        industries: body.industries,
        program_tags: body.program_tags,
        logo_big: body.logo_big ?? null,
        logo_sm: body.logo_sm ?? null,
        logo_storage_key: body.logo_storage_key ?? null,
        display_order: body.display_order,
        is_active: body.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError('CONFLICT', `Case study o id "${id}" już istnieje.`, 409);
      }
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
