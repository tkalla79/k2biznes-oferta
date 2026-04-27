/**
 * Email notifications dla flow RODO (sekcja 11).
 */
import { createElement } from 'react';
import { renderEmail } from './render';
import { sendEmail } from './send';
import DataDeletionConfirmation from './templates/DataDeletionConfirmation';
import DataDeletionExecuted from './templates/DataDeletionExecuted';

export async function notifyDeletionRequested(args: {
  email: string;
  requestId: string;
  reason: string | null;
}): Promise<void> {
  const { html, text } = await renderEmail(
    createElement(DataDeletionConfirmation, args),
  );
  await sendEmail({
    to: args.email,
    subject: 'Potwierdzenie żądania usunięcia danych — K2Biznes',
    html,
    text,
    tags: [{ name: 'event', value: 'gdpr_request' }],
  });
}

export async function notifyDeletionExecuted(args: {
  email: string;
  requestId: string;
  offersAnonymized: number;
  eventsAnonymized: number;
  profileAnonymized: boolean;
  executedAt: string;
}): Promise<void> {
  const { html, text } = await renderEmail(
    createElement(DataDeletionExecuted, args),
  );
  await sendEmail({
    to: args.email,
    subject: 'Twoje dane zostały usunięte — K2Biznes',
    html,
    text,
    tags: [{ name: 'event', value: 'gdpr_executed' }],
  });
}
