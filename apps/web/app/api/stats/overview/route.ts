/**
 * GET /api/stats/overview (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 */
import { NextResponse } from 'next/server';
import { handleError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { fetchOverview, fetchConsultantBreakdown } from '@/lib/stats/overview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const [overview, byConsultant] = await Promise.all([
      fetchOverview(),
      fetchConsultantBreakdown(),
    ]);
    return NextResponse.json({
      data: { overview, byConsultant },
    });
  } catch (e) {
    return handleError(e);
  }
}
