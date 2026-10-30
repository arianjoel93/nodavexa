import sanitizeHtml from 'sanitize-html'

const allowedTags = [
  'a', 'blockquote', 'br', 'code', 'em', 'h2', 'h3', 'hr', 'li', 'ol', 'p', 'pre', 'strong', 'u', 'ul',
]

export function sanitizeRichText(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          href: attributes.href || '#',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
    },
  })
}
