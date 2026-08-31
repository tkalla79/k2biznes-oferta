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

const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Blok prozy w widoku klienta: HTML z RichTextEditor albo zwykly tekst.
 *
 * Pola tekstowe oferty byly historycznie plain textem renderowanym jednym
 * <p> z `white-space: pre-wrap` — bez akapitow i bez mozliwosci wyroznien.
 * Po przejsciu na edytor tekstu nowe oferty niosa HTML, ale starsze (i te
 * uzupelnione przez AI z transkrypcji) nadal maja czysty tekst, wiec obie
 * postacie musza renderowac sie poprawnie:
 *
 * - jest znacznik HTML -> sanitizacja jak dla RichTextEditor,
 * - czysty tekst -> puste linie dziela akapity, pojedynczy enter to <br>,
 *   a tresc jest escapowana (nigdy nie trafia do DOM jako markup).
 */
export function sanitizeProse(value: string | null | undefined): string {
  if (!value) return '';
  if (HTML_TAG_RE.test(value)) return sanitizeRichText(value);
  return value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}
