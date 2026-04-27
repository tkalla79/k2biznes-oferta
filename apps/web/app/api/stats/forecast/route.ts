/**
 * GET /api/stats/forecast (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { fetchForecast } from '@/lib/stats/forecast';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const monthsBack = Math.max(
      1,
      Math.min(60, Number(req.nextUrl.searchParams.get('monthsBack') ?? 12)),
    );
    const data = await fetchForecast(monthsBack);
    return NextResponse.json({ data });
  } catch (e) {
    return handleError(e);
  }
}
