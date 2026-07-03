/**
 * POST /api/admin/settings/test-email — diagnostyka produkcyjnej wysyłki
 * (email-reliability 2026-07).
 *
 * Wysyła prosty email testowy przez DOKŁADNIE tę samą ścieżkę co oferty
 * (lib/email/send: SMTP dev / Resend prod) i zwraca surowy wynik — w tym
 * pełną treść błędu Resend (np. sandbox-owy klucz bez zweryfikowanej domeny).
 * Po każdej zmianie RESEND_API_KEY/EMAIL_FROM w Vercel: 10-sekundowa
 * weryfikacja zamiast odkrywania awarii na wysyłce do klienta.
 *
 * super_admin only. Bez audytu — czysta diagnostyka, bez skutków w danych.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { sendEmail } from '@/lib/email/send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TestEmailInput = z.object({
  to: z.string().email().max(200),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = TestEmailInput.parse(await req.json());

    const result = await sendEmail({
      to: body.to,
      subject: 'K2Biznes Oferta — test wysyłki email',
      html: `<p>Test techniczny systemu wysyłki ofert K2Biznes.</p>
<p>Jeśli czytasz tę wiadomość, konfiguracja email na produkcji działa poprawnie.</p>
<p style="color:#6b7a92;font-size:12px">Wywołane przez: ${session.email ?? 'admin'} · ${new Date().toISOString()}</p>`,
      text: 'Test techniczny systemu wysyłki ofert K2Biznes. Jeśli czytasz tę wiadomość, konfiguracja email działa poprawnie.',
      tags: [{ name: 'event', value: 'test_email' }],
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    return handleError(e);
  }
}
