/**
 * Sanitizacja HTML z RichTextEditor (Tiptap StarterKit) przed renderem na
 * publicznej ofercie. Whitelist tagow pasuje do StarterKit'a (bold/italic/
 * heading/list/quote/paragraph). Zabezpiecza przed XSS — np. wkleja klient
 * <script> w editorze, nie dotrze do `/o/[token]`.
 *
 * Wczesniej uzywalismy isomorphic-dompurify, ale jsdom dependency wywalalo
 * SSR na Vercel serverless (module load fail → 500 na calej route /o/[token]).
 * sanitize-html jest pure-JS, bez jsdom, dziala perfekcyjnie server-side.
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'code',
  'pre',
];

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    // Auto-add rel="noopener noreferrer" for external links (XSS hardening)
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    // Disallow inline styles + classes (no CSS injection)
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
  });
}
