/**
 * HMAC SHA256 sygnatura webhook'a (BACKEND_SPEC.md v1.1.1, sekcja 10.3).
 *
 * Header `X-K2-Signature: sha256=<hex>` pozwala CRM-om zweryfikować, że
 * payload faktycznie pochodzi od nas (a nie od atakującego replay'ującego
 * adres webhooka).
 *
 * Inny secret per target — jeśli HubSpot się komuś kompromituje, Pipedrive
 * pozostaje bezpieczny.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookTarget } from './types';

function getSecret(target: WebhookTarget): string {
  // Mapowanie: WEBHOOK_SECRET_HUBSPOT, WEBHOOK_SECRET_PIPEDRIVE, WEBHOOK_SECRET_CUSTOM
  const envName = `WEBHOOK_SECRET_${target.toUpperCase()}`;
  const secret = process.env[envName];
  if (!secret) {
    throw new Error(`${envName} not set — webhook signing requires per-target secret.`);
  }
  return secret;
}

/**
 * Podpisz body. Zwraca formatkę gotową do wstawienia w nagłówek.
 */
export function signWebhookBody(target: WebhookTarget, body: string): string {
  const secret = getSecret(target);
  const hmac = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hmac}`;
}

/**
 * Weryfikuj nagłówek. Używane gdyby CRM odsyłał callback do nas — niewykorzystane
 * w PR #7, ale gotowe na future use.
 */
export function verifyWebhookSignature(
  target: WebhookTarget,
  body: string,
  header: string | null | undefined,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = signWebhookBody(target, body);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
