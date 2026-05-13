/**
 * Sanitizacja HTML z RichTextEditor (Tiptap StarterKit) przed renderem na
 * publicznej ofercie. sanitize-html — pure JS, bez jsdom (jsdom wywala
 * Vercel serverless SSR).
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

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false, // belt-and-braces: blokuje //evil.com (resolved by browser do https://)
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
