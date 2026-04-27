/**
 * POST /api/admin/users/invite (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 7.3).
 *
 * Super admin zaprasza nowego usera (consultant/admin/super_admin).
 * Supabase wysyła email z magic link → user klika → /auth/callback →
 * `handle_new_auth_user` trigger tworzy `profiles` row z domyślną rolą
 * 'consultant'. Jeśli invite ma role inną niż 'consultant', natychmiast
 * po insercie aktualizujemy `profiles.role` i `auth.users.raw_app_meta_data.role`.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { InviteUserInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = InviteUserInput.parse(await req.json());

    const sb = createAdminClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const { data: invited, error: inviteErr } = await sb.auth.admin.inviteUserByEmail(
      body.email,
      {
        redirectTo: `${baseUrl}/auth/callback?next=/admin`,
        data: { full_name: body.fullName, role: body.role },
      },
    );

    if (inviteErr) {
      // Najczęstszy case: email już istnieje w auth.users.
      throw new ApiError(
        'VALIDATION_ERROR',
        `Nie udało się zaprosić: ${inviteErr.message}`,
        422,
      );
    }
    if (!invited?.user) {
      throw new ApiError('INTERNAL_ERROR', 'Invite zwrócił pustego usera.', 500);
    }

    // Trigger `handle_new_auth_user` ustawia role z `raw_app_meta_data.role` —
    // ale `inviteUserByEmail` nie wstawia tam role automatycznie (`data` idzie
    // do `raw_user_meta_data`, nie `raw_app_meta_data`). Dlatego promujemy
    // ręcznie + propagujemy do app_metadata żeby JWT claim był zsynchronizowany.
    if (body.role !== 'consultant') {
      const { error: roleErr } = await sb
        .from('profiles')
        .update({ role: body.role, full_name: body.fullName })
        .eq('id', invited.user.id);
      if (roleErr) {
        console.error('[invite] role update failed:', roleErr.message);
      }
      const { error: appMetaErr } = await sb.auth.admin.updateUserById(invited.user.id, {
        app_metadata: { role: body.role },
      });
      if (appMetaErr) console.error('[invite] app_metadata update failed:', appMetaErr.message);
    } else {
      // Konsultant — tylko full_name (rola domyślna już jest w profiles).
      await sb.from('profiles').update({ full_name: body.fullName }).eq('id', invited.user.id);
    }

    await logAudit({
      action: 'profile.role.update',
      resourceType: 'profile',
      resourceId: invited.user.id,
      actorId: session.userId,
      actorEmail: session.email,
      after: { email: body.email, role: body.role, full_name: body.fullName },
    });

    return NextResponse.json(
      {
        data: {
          ok: true,
          userId: invited.user.id,
          email: body.email,
          role: body.role,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
