/**
 * Session helpers dla route handlerów (BACKEND_SPEC.md v1.1.1, sekcja 7.2).
 *
 * RLS w DB jest naszą drugą linią obrony. Te helpery to pierwsza —
 * sprawdzamy sesję przed dotknięciem DB, żeby zwracać 401/403 z czytelnym
 * payload zamiast pustego 0-rows wyniku przez RLS.
 */
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, Errors } from '@/lib/api/error';
import type { User } from '@supabase/supabase-js';

export type Role = 'super_admin' | 'admin' | 'consultant';

export type Session = {
  user: User;
  userId: string;
  email: string;
  role: Role;
};

/**
 * Wymaga zalogowanego usera + zwraca jego rolę z `profiles`.
 *
 * Czemu z DB a nie z JWT claim: po promocji roli claim jest stale do
 * relogin (sekcja 7.5). Sprawdzanie z DB per-request gwarantuje świeżość.
 * Cache 30s żeby nie obciążać DB.
 */
export async function requireSession(): Promise<Session> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw Errors.unauthorized();
  }

  const role = await fetchUserRole(user.id);
  if (!role) {
    // Auth user istnieje, ale brak profilu (trigger się nie wykonał?)
    throw new ApiError('FORBIDDEN', 'Brak profilu użytkownika.', 403);
  }

  return {
    user,
    userId: user.id,
    email: user.email ?? '',
    role,
  };
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== 'admin' && s.role !== 'super_admin') {
    throw Errors.forbidden('Wymagana rola admin lub super_admin.');
  }
  return s;
}

export async function requireSuperAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== 'super_admin') {
    throw Errors.forbidden('Wymagana rola super_admin.');
  }
  return s;
}

// -----------------------------------------------------------------------------
// internal: cache roli per userId (30s) — mała oszczędność DB
// -----------------------------------------------------------------------------

const roleCache = new Map<string, { role: Role; expiresAt: number }>();
const ROLE_TTL_MS = 30_000;

async function fetchUserRole(userId: string): Promise<Role | null> {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.role;

  // Service role omija RLS — `profiles` widoczny dla admina i super, ale
  // nie chcemy wpadać w pułapkę "własny profil read" przy pierwszym requeście.
  const sb = createAdminClient();
  const { data, error } = await sb
    .from('profiles')
    .select('role, is_active, deleted_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth.session] fetchUserRole failed:', error);
    return null;
  }
  if (!data || !data.is_active || data.deleted_at) return null;

  const role = data.role as Role;
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_TTL_MS });
  return role;
}

/**
 * Wywoływane po `update profiles.role` żeby unieważnić cache (sekcja 7.5).
 */
export function invalidateRoleCache(userId?: string) {
  if (userId) roleCache.delete(userId);
  else roleCache.clear();
}
