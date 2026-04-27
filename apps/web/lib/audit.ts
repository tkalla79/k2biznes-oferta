/**
 * Audit log helper (BACKEND_SPEC.md v1.1.1, sekcja 3.2.9).
 *
 * Wpisy idą zawsze przez service role — RLS na `audit_log` to
 * `admin reads` (sekcja 4.5), zapis tylko z service.
 *
 * Best-effort: błąd zapisu logujemy ale nie rzucamy — audit nie powinien
 * blokować właściwej operacji. (Decyzja: jeśli kiedyś biznes wymaga "no
 * audit no commit", podpinamy do transakcji w funkcji SQL.)
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@k2/database/types';

export type AuditAction =
  | 'offer.create'
  | 'offer.update'
  | 'offer.soft_delete'
  | 'offer.send'
  | 'offer.recalculate'
  | 'offer.accept'
  | 'offer.reject'
  | 'profile.role.update'
  | 'gdpr.request.approved'
  | 'gdpr.request.rejected'
  | 'gdpr.request.executed';

export type AuditEntry = {
  action: AuditAction;
  resourceType: 'offer' | 'profile' | 'data_deletion_request';
  resourceId: string;
  actorId: string | null;
  actorEmail: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipHash?: string | null;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from('audit_log').insert({
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    before: (entry.before ?? null) as Json | null,
    after: (entry.after ?? null) as Json | null,
    ip_hash: entry.ipHash ?? null,
  });
  if (error) {
    console.error('[audit] insert failed:', error.message, entry);
  }
}
