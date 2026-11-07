import { config } from '../config.js';
import { getEntry, queryPublic, resolveSlug, isPublic, sitemapEntries, getPublicArticle, TYPES } from './articles.js';
import { getAuthorByUsername } from './authors.js';
import { getCategoryBySlug, listCategories } from './categories.js';
import { imageObject } from './media.js';
import { getPage, getSettings } from './settings.js';
import { escapeHtml, makeExcerpt } from '../utils/text.js';

export function baseUrl(req) {
  if (config.siteUrl) return config.siteUrl;
  return `${req.protocol}://${req.get('host')}`;
}

const xml = escapeHtml;

export function buildRobots(req) {
  return ['User-agent: *', 'Disallow: /admin', 'Disallow: /api/', 'Allow: /', '', `Sitemap: ${baseUrl(req)}/sitemap.xml`, ''].join('\n');
}

export function buildSitemap(req) {
  const base = baseUrl(req);
  const urls = [{ loc: `${base}/`, priority: '1.0' }];
  for (const type of ['berita', 'opini', 'kritik']) urls.push({ loc: `${base}/${type}`, priority: '0.8' });
  for (const c of listCategories()) urls.push({ loc: `${base}/kategori/${c.slug}`, priority: '0.6' });
  for (const e of sitemapEntries()) urls.push({ loc: `${base}${e.url}`, lastmod: e.lastmod.slice(0, 10), priority: '0.7' });
  const body = urls
    .map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRss(req) {
  const base = baseUrl(req);
  const settings = getSettings();
  const { items } = queryPublic({ limit: 30 });
  const entries = items
    .map(
      (a) => `    <item>
      <title>${xml(a.title)}</title>
      <link>${xml(base + a.url)}</link>
      <guid isPermaLink="true">${xml(base + a.url)}</guid>
      <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
      ${a.category ? `<category>${xml(a.category.name)}</category>` : ''}
      ${a.author ? `<dc:creator>${xml(a.author.name)}</dc:creator>` : ''}
      <description>${xml(a.excerpt)}</description>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(settings.site_name)}</title>
    <link>${xml(base)}/</link>
    <description>${xml(settings.description)}</description>
    <language>id-ID</language>
    <atom:link href="${xml(base)}/rss.xml" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;
}

const json = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

async function metaFor(pathname, base) {
  const settings = getSettings();
  const suffix = settings.seo.title_suffix || settings.site_name;
  const fallback = { title: `${settings.site_name} — ${settings.tagline}`, description: settings.seo.description || settings.description, type: 'website', image: null, ld: [], status: 200 };
  const segments = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  const [first, second] = segments;

  if (segments.length === 0) return fallback;

  if (segments.length === 2 && TYPES.includes(first)) {
    const entry = resolveSlug(second);
    if (!entry || !isPublic(entry) || entry.type !== first) return { ...fallback, title: `Tidak ditemukan — ${suffix}`, status: 404, noindex: true };
    const article = await getPublicArticle(second);
    const url = `${base}/${article.type}/${article.slug}`;
    const image = article.featured_image ? base + article.featured_image.medium : null;
    const description = article.seo?.description || article.excerpt || makeExcerpt(article.subtitle, 160);
    const ld = [
      {
        '@context': 'https://schema.org',
        '@type': article.type === 'berita' ? 'NewsArticle' : 'Article',
        headline: article.title.slice(0, 110),
        description,
        image: image ? [image] : undefined,
        datePublished: article.published_at,
        dateModified: article.updated_at,
        author: article.author ? { '@type': 'Person', name: article.author.name } : undefined,
        publisher: { '@type': 'Organization', name: settings.site_name },
        mainEntityOfPage: url,
        articleSection: article.category?.name,
        keywords: article.tags.join(', ') || undefined,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: `${base}/` },
          ...(article.category ? [{ '@type': 'ListItem', position: 2, name: article.category.name, item: `${base}/kategori/${article.category.slug}` }] : []),
          { '@type': 'ListItem', position: article.category ? 3 : 2, name: article.title, item: url },
        ],
      },
    ];
    return { title: `${article.seo?.title || article.title} — ${suffix}`, description, type: 'article', image, canonical: url, ld, published: article.published_at, section: article.category?.name, status: 200 };
  }

  if (first === 'kategori' && second) {
    const category = getCategoryBySlug(second);
    if (!category) return { ...fallback, title: `Tidak ditemukan — ${suffix}`, status: 404, noindex: true };
    return { ...fallback, title: `${category.name} — ${suffix}`, description: category.description || fallback.description, canonical: `${base}/kategori/${category.slug}` };
  }

  if (first === 'penulis' && second) {
    const author = getAuthorByUsername(second);
    if (!author) return { ...fallback, title: `Tidak ditemukan — ${suffix}`, status: 404, noindex: true };
    return { ...fallback, title: `${author.name} — ${suffix}`, description: author.bio || fallback.description, canonical: `${base}/penulis/${author.username}` };
  }

  if (first === 'halaman' && second) {
    const page = await getPage(second);
    if (!page) return { ...fallback, title: `Tidak ditemukan — ${suffix}`, status: 404, noindex: true };
    return { ...fallback, title: `${page.title} — ${suffix}`, canonical: `${base}/halaman/${page.slug}` };
  }

  const labels = { berita: 'Berita', opini: 'Opini', kritik: 'Kritik Sosial', cari: 'Pencarian', 'kirim-tulisan': 'Kirim Tulisan', penulis: 'Penulis' };
  if (labels[first] && segments.length === 1) return { ...fallback, title: `${labels[first]} — ${suffix}`, canonical: `${base}/${first}`, noindex: first === 'cari' };

  if (first === 'admin') return { ...fallback, title: `Dashboard — ${suffix}`, noindex: true };
  return fallback;
}

/** Menyisipkan <title>, meta, Open Graph, Twitter Card, canonical, dan JSON-LD ke dalam HTML shell. */
export async function renderHead(pathname, req) {
  const base = baseUrl(req);
  const settings = getSettings();
  const meta = await metaFor(pathname, base);
  const canonical = meta.canonical ?? `${base}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`;
  const defaultImage = imageObject(settings.seo.og_image_id) ?? imageObject(settings.logo_id);
  const image = meta.image ?? (defaultImage ? base + defaultImage.medium : `${base}/icons/icon-512.png`);
  const favicon = imageObject(settings.favicon_id);

  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(makeExcerpt(meta.description, 300))}">`,
    meta.noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">',
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:site_name" content="${escapeHtml(settings.site_name)}">`,
    `<meta property="og:locale" content="id_ID">`,
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(makeExcerpt(meta.description, 200))}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    meta.published ? `<meta property="article:published_time" content="${escapeHtml(meta.published)}">` : '',
    meta.section ? `<meta property="article:section" content="${escapeHtml(meta.section)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(makeExcerpt(meta.description, 200))}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
    favicon
      ? `<link rel="icon" href="${escapeHtml(favicon.thumb)}">`
      : '<link rel="icon" href="/icons/favicon-48.png" type="image/png" sizes="48x48"><link rel="icon" href="/icons/favicon.ico" sizes="any">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.webmanifest">',
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(settings.site_name)}" href="${escapeHtml(base)}/rss.xml">`,
    ...[
      pathname === '/'
        ? { '@context': 'https://schema.org', '@type': 'WebSite', name: settings.site_name, url: `${base}/`, potentialAction: { '@type': 'SearchAction', target: `${base}/cari?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }
        : null,
      ...meta.ld,
    ]
      .filter(Boolean)
      .map((data) => `<script type="application/ld+json">${json(data)}</script>`),
  ];
  return { head: tags.filter(Boolean).join('\n    '), status: meta.status };
}
