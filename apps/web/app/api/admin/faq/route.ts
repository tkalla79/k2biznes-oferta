/**
 * /api/admin/faq — globalna FAQ na publicznej ofercie (PR-D / uwaga 19).
 * Admin/super_admin only. Public render w /o/[token] przez RLS public select.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { FaqItemInput } from '@/lib/validation/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('faq_items')
      .select('*')
      .is('deleted_at', null)
      .order('display_order')
      .order('created_at');
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = FaqItemInput.parse(await req.json());
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('faq_items')
      .insert({
        question: body.question,
        answer: body.answer,
        display_order: body.display_order,
        is_active: body.is_active,
      })
      .select()
      .single();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    await logAudit({
      action: 'faq.create',
      resourceType: 'faq_item',
      resourceId: data.id,
      actorId: session.userId,
      actorEmail: session.email,
      after: { question: data.question, is_active: data.is_active },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
