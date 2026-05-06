/**
 * Sanitizacja HTML z RichTextEditor (Tiptap StarterKit) przed renderem na
 * publicznej ofercie. Whitelist tagow pasuje do StarterKit'a (bold/italic/
 * heading/list/quote/paragraph). Zabezpiecza przed XSS — np. wkleja klient
 * <script> w editorze, nie dotrze do `/o/[token]`.
 *
 * isomorphic-dompurify dziala zarowno na serwerze (jsdom) jak i na kliencie.
 */
import DOMPurify from 'isomorphic-dompurify';

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

const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
  });
}
