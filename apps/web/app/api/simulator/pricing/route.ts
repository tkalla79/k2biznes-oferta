/**
 * POST /api/simulator/pricing (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Konsultant + admin mogą używać symulatora (nie wymaga roli admin).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { SimulatorInput } from '@/lib/validation/simulator';
import { simulatePricing } from '@/lib/pricing/simulator';
import { loadPricing } from '@/lib/pricing/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = SimulatorInput.parse(await req.json());
    const { segments, config } = await loadPricing();
    const result = simulatePricing(body, segments, config);
    return NextResponse.json({ data: result });
  } catch (e) {
    return handleError(e);
  }
}
