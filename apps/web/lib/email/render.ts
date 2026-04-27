/**
 * Render React Email → HTML + plain text.
 *
 * Wrapper żeby trzymać `@react-email/render` w jednym miejscu (łatwiej
 * zmienić silnik render'u w przyszłości, np. mjml).
 */
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export async function renderEmail(template: ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);
  return { html, text };
}
