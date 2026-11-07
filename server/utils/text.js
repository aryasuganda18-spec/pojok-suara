import sanitizeHtml from 'sanitize-html';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripTags(value) {
  return sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} });
}

/** Teks satu baris: tanpa tag HTML, tanpa karakter kontrol, spasi dirapikan. */
export function cleanText(value, max = 200) {
  return decodeEntities(stripTags(value))
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Teks beberapa baris (komentar, bio): baris baru dipertahankan. */
export function cleanMultiline(value, max = 2000) {
  return decodeEntities(stripTags(value))
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(value, max = 80) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'tulisan';
}

/** Membuat slug unik; `taken(slug)` mengembalikan true bila sudah dipakai. */
export function uniqueSlug(base, taken) {
  let slug = slugify(base);
  if (!taken(slug)) return slug;
  for (let i = 2; i < 500; i += 1) {
    const candidate = `${slug.slice(0, 74)}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  return `${slug.slice(0, 60)}-${Date.now().toString(36)}`;
}

export function htmlToText(html) {
  return decodeEntities(
    sanitizeHtml(String(html ?? '').replace(/<\/(p|h[1-6]|li|blockquote|tr|div)>/gi, '$& '), {
      allowedTags: [],
      allowedAttributes: {},
    }),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function readingTimeMinutes(text) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function makeExcerpt(text, max = 220) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trim() + '…';
}

export function isoNow() {
  return new Date().toISOString();
}
