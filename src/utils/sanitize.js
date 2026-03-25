import DOMPurify from 'dompurify';

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'em',
      'code',
      'pre',
      'div',
      'span',
      'br',
      'blockquote',
      'img',
      'a',
      'table',
      'tr',
      'td',
      'th',
      'thead',
      'tbody',
      'ul',
      'ol',
      'li',
      'p',
      'hr',
    ],
    ALLOWED_ATTR: ['style', 'src', 'alt', 'href', 'target', 'class', 'data-id'],
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeSvg(svg) {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
