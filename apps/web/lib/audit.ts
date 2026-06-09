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
  | 'auth.mfa.enroll'
  | 'auth.mfa.verify'
  | 'auth.mfa.unenroll'
  | 'gdpr.request.created'
  | 'gdpr.request.approved'
  | 'gdpr.request.rejected'
  | 'gdpr.request.executed'
  // H12 audit: lookup mutations. Wcześniej super_admin mógł usunąć/zmienić
  // program, case study, osobę kontaktową czy FAQ bez śladu w audit_log.
  | 'program.create'
  | 'program.update'
  | 'program.delete'
  | 'case_study.create'
  | 'case_study.update'
  | 'case_study.delete'
  | 'contact_person.create'
  | 'contact_person.update'
  | 'contact_person.delete'
  | 'faq.create'
  | 'faq.update'
  | 'faq.delete'
  | 'alt_program.create'
  | 'alt_program.update'
  | 'alt_program.delete';

export type AuditEntry = {
  action: AuditAction;
  resourceType:
    | 'offer'
    | 'profile'
    | 'data_deletion_request'
    | 'program'
    | 'case_study'
    | 'contact_person'
    | 'faq_item'
    | 'alt_program';
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
