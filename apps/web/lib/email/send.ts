/**
 * Email wrapper (BACKEND_SPEC.md v1.1.1, sekcja 8 + 13).
 *
 * Decyzja: jeden punkt wejścia `sendEmail()` dla wszystkich templatów. Trzy tryby:
 *   1. SMTP — gdy `SMTP_HOST` ustawione (lokalny dev z Mailpit, port 54325)
 *   2. Resend live — gdy `RESEND_API_KEY` ustawione (staging/prod)
 *   3. dev_log — log do stdout gdy żaden z powyższych
 *
 * SMTP ma pierwszeństwo nad Resend bo lokalny dev często ma OBA env vars
 * (Resend test key + lokalny Mailpit) i chcemy wtedy lokalny.
 */
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

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
  | { ok: true; id: string; mode: 'live' | 'smtp' | 'dev_log' }
  | { ok: false; error: string };

let cachedResend: Resend | null = null;
let cachedSmtp: Transporter | null = null;

function smtpClient(): Transporter | null {
  if (cachedSmtp) return cachedSmtp;
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number.parseInt(process.env.SMTP_PORT ?? '25', 10);
  cachedSmtp = nodemailer.createTransport({
    host,
    port,
    secure: false,
    // Mailpit/Inbucket nie wymagają auth w trybie lokalnym.
    ignoreTLS: true,
  });
  return cachedSmtp;
}

function resendClient(): Resend | null {
  if (cachedResend) return cachedResend;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    // Code review PR #3: pusty/whitespace `RESEND_API_KEY=""` wcześniej cicho
    // przechodził w dev_log mode w produkcji. Teraz głośno krzyczymy.
    if (process.env.NODE_ENV === 'production' && !process.env.SMTP_HOST) {
      console.error(
        '[email] RESEND_API_KEY missing/empty in production — emails will be dropped (dev_log mode).',
      );
    }
    return null;
  }
  cachedResend = new Resend(key);
  return cachedResend;
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'K2Biznes <oferty@k2biznes.pl>';
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'kontakt@k2biznes.pl';

/**
 * Code review PR #3: redact email dla dev_log/CI logs (lokalna część + 2 znaki
 * domeny dla debugu, reszta zamaskowana). Pełny adres trafia do offer_events
 * (audit), ale nie do stdout który może być persistowany w CI build logs.
 */
function redactEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMasked = local.length <= 2 ? '*'.repeat(local.length) : `${local[0]}***${local[local.length - 1]}`;
  const domainHead = domain.slice(0, 2);
  return `${localMasked}@${domainHead}***`;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  // 1. SMTP — lokalny dev z Mailpit (priorytet nad Resend)
  const smtp = smtpClient();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from: DEFAULT_FROM,
        to: msg.to,
        replyTo: msg.replyTo ?? DEFAULT_REPLY_TO,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      return { ok: true, id: info.messageId, mode: 'smtp' };
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error('[email] smtp failed:', m);
      return { ok: false, error: m };
    }
  }

  // 2. Resend live — staging/prod
  const c = resendClient();
  if (!c) {
    // 3. Dev/test bez SMTP/Resend — log do stdout (z PII redaction).
    console.log(
      `[email:dev_log] to=${redactEmail(msg.to)} subject="${msg.subject}" html_bytes=${msg.html.length}`,
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
