/**
 * GET /api/admin/data-deletion-requests — lista żądań RODO (super_admin).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const status = req.nextUrl.searchParams.get('status');

    const sb = createAdminClient();
    let q = sb
      .from('data_deletion_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (status) q = q.eq('status', status as 'requested' | 'approved' | 'executed' | 'rejected');

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (e) {
    return handleError(e);
  }
}
