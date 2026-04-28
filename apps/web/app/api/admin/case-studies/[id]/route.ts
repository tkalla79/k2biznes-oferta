/**
 * /api/admin/case-studies/[id] — PATCH (sekcja 5.2 + 3.2.5).
 *
 * Soft-disable przez `is_active=false` (FK z offers ON DELETE SET NULL,
 * ale chcemy zachować referencję dla audytu).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { CaseStudyUpdate } from '@/lib/validation/catalog';
import type { Database } from '@k2/database/types';

type CaseStudyDbUpdate = Database['public']['Tables']['case_studies']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    if (!SLUG_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny slug w URL.', 422);
    }
    const patch = CaseStudyUpdate.parse(await req.json());

    const sb = createAdminClient();
    const update: CaseStudyDbUpdate = {};
    if (patch.client !== undefined) update.client = patch.client;
    if (patch.tag !== undefined) update.tag = patch.tag;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.paragraph_1 !== undefined) update.paragraph_1 = patch.paragraph_1;
    if (patch.paragraph_2 !== undefined) update.paragraph_2 = patch.paragraph_2;
    if (patch.industries !== undefined) update.industries = patch.industries;
    if (patch.program_tags !== undefined) update.program_tags = patch.program_tags;
    if (patch.logo_big !== undefined) update.logo_big = patch.logo_big;
    if (patch.logo_sm !== undefined) update.logo_sm = patch.logo_sm;
    if (patch.display_order !== undefined) update.display_order = patch.display_order;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;

    if (Object.keys(update).length === 0) {
      throw new ApiError('VALIDATION_ERROR', 'Brak pól do aktualizacji.', 422);
    }

    const { data, error } = await sb
      .from('case_studies')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw Errors.notFound('Case study nie istnieje.');
      throw new ApiError('INTERNAL_ERROR', error.message, 500);
    }
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}
