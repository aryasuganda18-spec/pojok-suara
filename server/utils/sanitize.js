import sanitizeHtml from 'sanitize-html';

const textAlign = { 'text-align': [/^(left|right|center|justify)$/] };

const options = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'hr', 'pre', 'code', 'table', 'thead', 'tbody', 'tr',
    'th', 'td', 'colgroup', 'col', 'div', 'iframe',
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['style', 'span'],
    div: ['data-youtube-video', 'style'],
    code: ['class'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'allow', 'title', 'frameborder'],
  },
  allowedStyles: { '*': textAlign },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
  allowIframeRelativeUrls: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
      },
    }),
  },
};

/** Membersihkan HTML dari editor: hanya tag, atribut, dan skema URL yang aman yang lolos. */
export function sanitizeArticleHtml(html) {
  return sanitizeHtml(String(html ?? ''), options);
}

/**
 * Untuk tampilan publik: gambar bertitle diubah menjadi <figure> dengan <figcaption>.
 * Penyimpanan tetap memakai atribut title agar editor bisa memuat ulang tulisan tanpa kehilangan caption.
 */
export function renderArticleHtml(html) {
  return String(html ?? '').replace(/<img\b([^>]*?)>/g, (_match, attrs) => {
    const clean = attrs.replace(/\s*\/\s*$/, '');
    const title = /\btitle="([^"]*)"/.exec(clean)?.[1];
    const withoutTitle = clean.replace(/\s*\btitle="[^"]*"/, '');
    const img = `<img${withoutTitle} loading="lazy" decoding="async" />`;
    return title ? `<figure>${img}<figcaption>${title}</figcaption></figure>` : img;
  });
}
