/**
 * Resend wrapper (BACKEND_SPEC.md v1.1.1, sekcja 8 + 13).
 *
 * Decyzja: jeden punkt wejścia `sendEmail()` dla wszystkich templatów. Lokalnie
 * (brak `RESEND_API_KEY`) — log do stdout zamiast wysyłki, żeby dev działał
 * bez konta Resend.
 */
import { Resend } from 'resend';

export type EmailMessage = {
  to: string;
  subject: string;
  /** Pre-rendered HTML (z @react-email/render). */
  html: string;
  /** Plain-text fallback (też z @react-email/render). */
  text?: string;
  replyTo?: string;
  /** Headers do trackingu po stronie Resend (np. tag X-K2-Event). */
  tags?: Array<{ name: string; value: string }>;
};

export type SendResult =
  | { ok: true; id: string; mode: 'live' | 'dev_log' }
  | { ok: false; error: string };

let cached: Resend | null = null;

function client(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'K2Biznes <oferty@k2biznes.pl>';
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'kontakt@k2biznes.pl';

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const c = client();
  if (!c) {
    // Dev/test bez Resend — log do stdout.
    console.log(
      `[email:dev_log] to=${msg.to} subject="${msg.subject}" html_bytes=${msg.html.length}`,
    );
    return { ok: true, id: `dev_log_${Date.now()}`, mode: 'dev_log' };
  }

  const { data, error } = await c.emails.send({
    from: DEFAULT_FROM,
    to: msg.to,
    replyTo: msg.replyTo ?? DEFAULT_REPLY_TO,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    tags: msg.tags,
  });

  if (error) {
    console.error('[email] resend failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id ?? 'unknown', mode: 'live' };
}
