import { z } from 'zod';
import { Collection, SingleFile, newId, withLock } from './store.js';
import { supabase, assertNoError } from '../db/supabase.js';
import { getAuthor, listAuthors, publicAuthor } from './authors.js';
import { getCategory, getCategoryBySlug, listCategories } from './categories.js';
import { approvedCount, pendingCount, removeCommentsForArticle } from './comments.js';
import { bus } from './events.js';
import { imageObject, mediaCanBeUsedAsImage } from './media.js';
import { isStaff } from './roles.js';
import { dropArticleReferences, getSettings } from './settings.js';
import { getCounts, removeArticleStats } from './stats.js';
import { HttpError, forbidden, notFound } from '../utils/http.js';
import { renderArticleHtml, sanitizeArticleHtml } from '../utils/sanitize.js';
import { cleanText, htmlToText, isoNow, makeExcerpt, readingTimeMinutes, uniqueSlug, slugify } from '../utils/text.js';

export const TYPE_FOLDERS = { berita: 'news', opini: 'opinions', kritik: 'criticisms', artikel: 'articles' };
export const TYPES = Object.keys(TYPE_FOLDERS);
export const STATUSES = ['draft', 'review', 'published', 'archived'];

const MAX_REVISIONS = 20;

const articleSchema = z.looseObject({
  id: z.string(),
  type: z.enum(TYPES),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300),
  slug: z.string().min(1).max(100),
  slug_history: z.array(z.string()),
  excerpt: z.string().max(400),
  content: z.string().max(600_000),
  featured_image_id: z.string().nullable(),
  featured_caption: z.string().max(300),
  featured_alt: z.string().max(200),
  thumbnail_id: z.string().nullable(),
  category_id: z.string().nullable(),
  tags: z.array(z.string().max(40)).max(12),
  author_id: z.string().nullable(),
  guest: z.object({ name: z.string(), email: z.string() }).nullable(),
  created_by: z.string().nullable(),
  status: z.enum(STATUSES),
  published_at: z.string().nullable(),
  comments_enabled: z.boolean(),
  seo: z.object({ title: z.string().max(120), description: z.string().max(300) }),
  reading_time: z.number().int().min(1),
  revision: z.number().int().min(1),
  source: z.enum(['cms', 'public']),
  demo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const nullableId = z.string().max(64).nullable();
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'tanggal tidak valid');

/** Input dari CMS. Sengaja tanpa nilai default agar pembaruan sebagian tidak menimpa kolom lain. */
export const articleInputSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(3).max(200),
  subtitle: z.string().trim().max(300),
  slug: z.string().trim().max(100),
  excerpt: z.string().trim().max(400),
  content: z.string().max(600_000),
  featured_image_id: nullableId,
  featured_caption: z.string().trim().max(300),
  featured_alt: z.string().trim().max(200),
  thumbnail_id: nullableId,
  category_id: nullableId,
  tags: z.array(z.string().max(60)).max(20),
  author_id: nullableId,
  status: z.enum(STATUSES),
  published_at: isoDate.nullable(),
  comments_enabled: z.boolean(),
  seo: z.object({ title: z.string().trim().max(120), description: z.string().trim().max(300) }).partial(),
  expected_revision: z.number().int().min(1),
}).partial();

const collections = Object.fromEntries(
  Object.entries(TYPE_FOLDERS).map(([type, folder]) => [type, new Collection(folder, { schema: articleSchema })]),
);

/** Riwayat revisi tiap tulisan, disimpan sebagai dokumen tersendiri (bukan di dalam dokumen artikel)
 * supaya artikel yang sering diedit tidak membengkak. id = "<articleId>__<timestamp>-r<revisi>". */
const revisionCollection = new Collection('revisions');

/* ---------- Indeks katalog (cache di memori, dibangun ulang dari Supabase saat boot) ---------- */

const index = new Map();
const slugToId = new Map();

const norm = (value) => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

function authorNameOf(entry) {
  return getAuthor(entry.author_id)?.name ?? entry.guest_name ?? '';
}

function derive(entry) {
  entry._title = norm(entry.title);
  entry._sub = norm(`${entry.subtitle} ${entry.excerpt}`);
  entry._body = norm(entry.body_text);
  entry._meta = norm([...entry.tags, authorNameOf(entry), getCategory(entry.category_id)?.name ?? ''].join(' '));
  entry._ts = Date.parse(entry.published_at) || 0;
  return entry;
}

function toEntry(article) {
  return {
    id: article.id,
    type: article.type,
    title: article.title,
    subtitle: article.subtitle,
    slug: article.slug,
    slug_history: article.slug_history ?? [],
    excerpt: article.excerpt,
    category_id: article.category_id,
    tags: article.tags,
    author_id: article.author_id,
    guest_name: article.guest?.name ?? '',
    created_by: article.created_by,
    status: article.status,
    published_at: article.published_at,
    featured_image_id: article.featured_image_id,
    thumbnail_id: article.thumbnail_id,
    featured_alt: article.featured_alt,
    reading_time: article.reading_time,
    comments_enabled: article.comments_enabled,
    source: article.source,
    demo: article.demo,
    created_at: article.created_at,
    updated_at: article.updated_at,
    body_text: htmlToText(article.content).slice(0, 20_000),
  };
}

function rebuildSlugMap() {
  slugToId.clear();
  for (const entry of index.values()) {
    for (const old of entry.slug_history) if (!slugToId.has(old)) slugToId.set(old, entry.id);
  }
  for (const entry of index.values()) slugToId.set(entry.slug, entry.id);
}

/** Data sebenarnya ada di Supabase; fungsi ini hanya membangun ulang cache pencarian di memori
 * saat server dimulai. Tidak ada lagi file indeks yang perlu ditulis atau disinkronkan. */
export async function flushIndex() {
  // Dipertahankan sebagai no-op supaya pemanggil lama (boot.js) tidak perlu berubah.
}

export async function initArticles() {
  // Baca semuanya dulu, baru tukar indeks sekaligus (tanpa await di tengah) supaya request yang
  // masuk saat memuat ulang tidak pernah melihat daftar artikel yang kosong.
  const loaded = [];
  for (const [type, collection] of Object.entries(collections)) {
    for (const article of await collection.list()) {
      if (article.type !== type) continue; // jaga-jaga bila tipe berubah tapi masih tersimpan di koleksi lama
      loaded.push(article);
    }
  }
  index.clear();
  for (const article of loaded) index.set(article.id, derive(toEntry(article)));
  rebuildSlugMap();
}

bus.on('taxonomy', () => {
  for (const entry of index.values()) derive(entry);
});

function indexAfterWrite(article) {
  index.set(article.id, derive(toEntry(article)));
  rebuildSlugMap();
}

/* ---------- Hak akses ---------- */

export function canEdit(actor, entry) {
  if (isStaff(actor)) return true;
  const owns = entry.created_by === actor.id;
  if (!owns) return false;
  if (actor.role === 'penulis') return entry.status !== 'archived';
  return ['draft', 'review'].includes(entry.status);
}

export function canDelete(actor, entry) {
  if (isStaff(actor)) return true;
  return entry.created_by === actor.id && entry.status === 'draft';
}

const canSee = (actor, entry) => isStaff(actor) || entry.created_by === actor.id;

/* ---------- Pembuatan dan pembaruan ---------- */

function normalizeTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const tag = cleanText(String(raw).replace(/^#+/, ''), 40).toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out.slice(0, 12);
}

const slugTaken = (slug, selfId) => slugToId.has(slug) && slugToId.get(slug) !== selfId;

function assertMedia(id, label) {
  if (id && !mediaCanBeUsedAsImage(id)) throw new HttpError(400, `${label} tidak ditemukan di Media Library`);
}

function applyInput(doc, input, { actor, isNew }) {
  const staff = actor ? isStaff(actor) : false;

  if (input.type !== undefined) doc.type = input.type;
  if (input.title !== undefined) doc.title = cleanText(input.title, 200);
  if (input.subtitle !== undefined) doc.subtitle = cleanText(input.subtitle, 300);
  if (input.excerpt !== undefined) doc.excerpt = cleanText(input.excerpt, 400);
  if (input.content !== undefined) doc.content = sanitizeArticleHtml(input.content);
  if (input.tags !== undefined) doc.tags = normalizeTags(input.tags);
  if (input.featured_caption !== undefined) doc.featured_caption = cleanText(input.featured_caption, 300);
  if (input.featured_alt !== undefined) doc.featured_alt = cleanText(input.featured_alt, 200);
  if (input.comments_enabled !== undefined) doc.comments_enabled = input.comments_enabled;
  if (input.seo) {
    if (input.seo.title !== undefined) doc.seo.title = cleanText(input.seo.title, 120);
    if (input.seo.description !== undefined) doc.seo.description = cleanText(input.seo.description, 300);
  }

  for (const [key, label] of [['featured_image_id', 'Gambar utama'], ['thumbnail_id', 'Thumbnail']]) {
    if (input[key] !== undefined) {
      assertMedia(input[key], label);
      doc[key] = input[key];
    }
  }

  if (input.category_id !== undefined) {
    if (input.category_id && !getCategory(input.category_id)) throw new HttpError(400, 'Kategori tidak ditemukan');
    doc.category_id = input.category_id;
  }

  if (actor) {
    if (staff && input.author_id !== undefined) {
      if (input.author_id && !getAuthor(input.author_id)) throw new HttpError(400, 'Penulis tidak ditemukan');
      doc.author_id = input.author_id;
    } else if (isNew || !staff) {
      doc.author_id = doc.author_id ?? actor.author_id ?? null;
    }
  }

  if (staff && input.published_at !== undefined) doc.published_at = input.published_at;

  if (input.status !== undefined) {
    if (staff) {
      doc.status = input.status;
    } else if (doc.status === 'published') {
      // Penulis/kontributor tidak dapat mencabut atau mengubah status artikel yang sudah terbit.
    } else if (['draft', 'review'].includes(input.status)) {
      doc.status = input.status;
    } else {
      throw forbidden('Hanya editor yang dapat menerbitkan atau mengarsipkan tulisan');
    }
  }
}

function finalizeDoc(doc, { previousStatus }) {
  const text = htmlToText(doc.content);
  doc.reading_time = readingTimeMinutes(text);
  if (!doc.excerpt) doc.excerpt = makeExcerpt(text, 200);

  if (doc.status === 'published') {
    if (!text) throw new HttpError(400, 'Isi tulisan masih kosong, tidak dapat diterbitkan');
    if (!doc.category_id) throw new HttpError(400, 'Pilih kategori sebelum menerbitkan');
    if (!doc.published_at && previousStatus !== 'published') doc.published_at = isoNow();
    doc.published_at ??= isoNow();
  }
}

async function snapshotRevision(previous, actor) {
  const revisionId = `${previous.id}__${Date.now()}-r${previous.revision}`;
  await revisionCollection.create(
    {
      article_id: previous.id,
      revision: previous.revision,
      saved_at: isoNow(),
      saved_by: actor?.username ?? 'sistem',
      title: previous.title,
      subtitle: previous.subtitle,
      excerpt: previous.excerpt,
      content: previous.content,
      status: previous.status,
    },
    { id: revisionId },
  );
  const { data, error } = await supabase()
    .from('kv_documents')
    .select('id')
    .eq('collection', 'revisions')
    .like('id', `${previous.id}__%`)
    .order('id', { ascending: true });
  assertNoError(error, 'revisions.prune');
  const extra = (data ?? []).slice(0, Math.max(0, data.length - MAX_REVISIONS));
  if (extra.length) {
    const { error: delError } = await supabase()
      .from('kv_documents')
      .delete()
      .eq('collection', 'revisions')
      .in('id', extra.map((r) => r.id));
    assertNoError(delError, 'revisions.prune.delete');
  }
}

export async function createArticle(input, actor) {
  const id = newId();
  const doc = {
    id,
    type: input.type ?? 'artikel',
    title: '',
    subtitle: '',
    slug: '',
    slug_history: [],
    excerpt: '',
    content: '',
    featured_image_id: null,
    featured_caption: '',
    featured_alt: '',
    thumbnail_id: null,
    category_id: null,
    tags: [],
    author_id: null,
    guest: null,
    created_by: actor?.id ?? null,
    status: 'draft',
    published_at: null,
    comments_enabled: true,
    seo: { title: '', description: '' },
    reading_time: 1,
    revision: 1,
    source: 'cms',
    demo: false,
  };

  return withLock('articles:slugs', async () => {
    applyInput(doc, input, { actor, isNew: true });
    if (!doc.title) throw new HttpError(400, 'Judul wajib diisi');
    doc.slug = uniqueSlug(input.slug || doc.title, (s) => slugTaken(s, id));
    finalizeDoc(doc, { previousStatus: null });
    const saved = await collections[doc.type].create(doc, { id });
    await indexAfterWrite(saved);
    return saved;
  });
}

export async function updateArticle(id, input, actor) {
  const entry = index.get(id);
  if (!entry || !canSee(actor, entry)) throw notFound('Tulisan tidak ditemukan');
  if (!canEdit(actor, entry)) throw forbidden('Anda tidak dapat mengedit tulisan ini');

  return withLock('articles:slugs', async () => {
    const oldType = entry.type;
    let previous = null;

    const saved = await collections[oldType].update(id, (doc) => {
      if (input.expected_revision !== undefined && input.expected_revision !== doc.revision) {
        throw new HttpError(409, 'Tulisan ini sudah diubah oleh pengguna lain. Muat ulang halaman untuk melihat versi terbaru.');
      }
      previous = structuredClone(doc);
      if (input.type !== undefined && input.type !== doc.type && !isStaff(actor)) {
        throw forbidden('Hanya editor yang dapat mengubah jenis tulisan');
      }
      applyInput(doc, input, { actor, isNew: false });

      if (input.slug !== undefined || (input.title && !doc.slug)) {
        const wanted = slugify(input.slug || doc.title);
        if (wanted !== doc.slug) {
          const next = slugTaken(wanted, id) ? uniqueSlug(wanted, (s) => slugTaken(s, id)) : wanted;
          if (doc.slug && !doc.slug_history.includes(doc.slug)) doc.slug_history.push(doc.slug);
          doc.slug_history = doc.slug_history.filter((s) => s !== next).slice(-10);
          doc.slug = next;
        }
      }
      finalizeDoc(doc, { previousStatus: previous.status });
      doc.revision = previous.revision + 1;
      return doc;
    });

    const changedText = ['title', 'subtitle', 'excerpt', 'content'].some((k) => previous[k] !== saved[k]);
    if (changedText) await snapshotRevision(previous, actor).catch((err) => console.error('[revisi]', err.message));

    if (saved.type !== oldType) {
      await collections[saved.type].replace(id, saved);
      await collections[oldType].remove(id);
    }
    await indexAfterWrite(saved);
    return saved;
  });
}

async function removeRevisionsForArticle(articleId) {
  const { error } = await supabase().from('kv_documents').delete().eq('collection', 'revisions').like('id', `${articleId}__%`);
  assertNoError(error, 'revisions.removeForArticle');
}

export async function deleteArticle(id, actor) {
  const entry = index.get(id);
  if (!entry || (actor && !canSee(actor, entry))) throw notFound('Tulisan tidak ditemukan');
  if (actor && !canDelete(actor, entry)) throw forbidden('Anda tidak dapat menghapus tulisan ini');
  await collections[entry.type].remove(id);
  await removeRevisionsForArticle(id);
  await removeCommentsForArticle(id);
  removeArticleStats(id);
  await dropArticleReferences(id);
  index.delete(id);
  rebuildSlugMap();
  return entry;
}

export async function listRevisions(id, actor) {
  const entry = index.get(id);
  if (!entry || !canSee(actor, entry)) throw notFound('Tulisan tidak ditemukan');
  const { data, error } = await supabase()
    .from('kv_documents')
    .select('id, data')
    .eq('collection', 'revisions')
    .like('id', `${id}__%`)
    .order('id', { ascending: false });
  assertNoError(error, 'revisions.list');
  return (data ?? []).map((row) => ({
    id: row.id.slice(`${id}__`.length),
    revision: row.data.revision,
    saved_at: row.data.saved_at,
    saved_by: row.data.saved_by,
    title: row.data.title,
  }));
}

export async function getRevision(id, revisionId, actor) {
  const entry = index.get(id);
  if (!entry || !canSee(actor, entry)) throw notFound('Tulisan tidak ditemukan');
  if (!/^\d+-r\d+$/.test(revisionId)) throw new HttpError(400, 'ID revisi tidak valid');
  const data = await revisionCollection.get(`${id}__${revisionId}`);
  if (!data) throw notFound('Revisi tidak ditemukan');
  return data;
}

export async function createSubmission({ name, email, title, type, category_id, content, image_id }) {
  const id = newId();
  const doc = {
    id,
    type,
    title: cleanText(title, 200),
    subtitle: '',
    slug: '',
    slug_history: [],
    excerpt: '',
    content: sanitizeArticleHtml(content),
    featured_image_id: image_id ?? null,
    featured_caption: '',
    featured_alt: '',
    thumbnail_id: null,
    category_id: category_id && getCategory(category_id) ? category_id : null,
    tags: [],
    author_id: null,
    guest: { name: cleanText(name, 80), email: cleanText(email, 200).toLowerCase() },
    created_by: null,
    status: 'review',
    published_at: null,
    comments_enabled: true,
    seo: { title: '', description: '' },
    reading_time: 1,
    revision: 1,
    source: 'public',
    demo: false,
  };
  return withLock('articles:slugs', async () => {
    doc.slug = uniqueSlug(doc.title, (s) => slugTaken(s, id));
    finalizeDoc(doc, { previousStatus: null });
    const saved = await collections[type].create(doc, { id });
    await indexAfterWrite(saved);
    return saved;
  });
}

/** Dipakai oleh data contoh: menulis artikel lengkap apa adanya (sudah dibersihkan oleh pemanggil). */
export async function importArticle(doc) {
  return withLock('articles:slugs', async () => {
    const id = doc.id ?? newId();
    const full = {
      slug_history: [],
      excerpt: '',
      featured_image_id: null,
      category_id: null,
      author_id: null,
      status: 'draft',
      published_at: null,
      subtitle: '',
      featured_caption: '',
      featured_alt: '',
      thumbnail_id: null,
      guest: null,
      created_by: null,
      comments_enabled: true,
      seo: { title: '', description: '' },
      revision: 1,
      source: 'cms',
      demo: false,
      tags: [],
      ...doc,
      id,
    };
    full.content = sanitizeArticleHtml(full.content);
    full.slug = uniqueSlug(full.slug || full.title, (s) => slugTaken(s, id));
    finalizeDoc(full, { previousStatus: null });
    const saved = await collections[full.type].create(full, { id });
    await indexAfterWrite(saved);
    return saved;
  });
}

/* ---------- Pembacaan ---------- */

export const getEntry = (id) => index.get(id) ?? null;
export const countByCategory = (categoryId) => [...index.values()].filter((e) => e.category_id === categoryId).length;
export const countByAuthor = (authorId, { publicOnly = true } = {}) => {
  const now = Date.now();
  return [...index.values()].filter((e) => e.author_id === authorId && (!publicOnly || isPublic(e, now))).length;
};
export const demoIds = () => [...index.values()].filter((e) => e.demo).map((e) => e.id);

export const isPublic = (entry, now = Date.now()) =>
  entry.status === 'published' && Boolean(entry.published_at) && Date.parse(entry.published_at) <= now;

const isScheduled = (entry, now = Date.now()) => entry.status === 'published' && Date.parse(entry.published_at) > now;

function shapeAuthor(entry) {
  const author = getAuthor(entry.author_id);
  if (author) {
    return { id: author.id, name: author.name, username: author.username, avatar: author.avatar_id ? imageObject(author.avatar_id)?.thumb ?? null : null };
  }
  return entry.guest_name ? { id: null, name: entry.guest_name, username: null, avatar: null } : null;
}

function shapeCategory(categoryId) {
  const category = getCategory(categoryId);
  return category ? { id: category.id, name: category.name, slug: category.slug } : null;
}

export function toCard(entry) {
  const counts = getCounts(entry.id);
  return {
    id: entry.id,
    type: entry.type,
    slug: entry.slug,
    url: `/${entry.type}/${entry.slug}`,
    title: entry.title,
    subtitle: entry.subtitle,
    excerpt: entry.excerpt,
    image: imageObject(entry.thumbnail_id || entry.featured_image_id, { alt: entry.featured_alt || entry.title }),
    category: shapeCategory(entry.category_id),
    author: shapeAuthor(entry),
    tags: entry.tags,
    published_at: entry.published_at,
    reading_time: entry.reading_time,
    views: counts.views,
    likes: counts.likes,
    comments: approvedCount(entry.id),
  };
}

const tokenize = (q) => norm(q).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 6);

function searchScore(entry, terms) {
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (entry._title.includes(term)) termScore += entry._title.startsWith(term) || entry._title.includes(` ${term}`) ? 15 : 10;
    if (entry._sub.includes(term)) termScore += 4;
    if (entry._meta.includes(term)) termScore += 3;
    if (entry._body.includes(term)) termScore += 1 + Math.min(4, entry._body.split(term).length - 1);
    if (termScore === 0) return 0;
    score += termScore;
  }
  return score;
}

export function queryPublic({ type, category, author, tag, q, from, to, sort = 'latest', page = 1, limit = 12 } = {}) {
  const now = Date.now();
  let list = [...index.values()].filter((e) => isPublic(e, now));

  if (type) list = list.filter((e) => e.type === type);
  if (category) {
    const found = getCategoryBySlug(category);
    list = found ? list.filter((e) => e.category_id === found.id) : [];
  }
  if (author) {
    const found = listAuthors().find((a) => a.username === author);
    list = found ? list.filter((e) => e.author_id === found.id) : [];
  }
  if (tag) {
    const wanted = norm(tag).trim();
    list = list.filter((e) => e.tags.some((t) => norm(t) === wanted));
  }
  if (from && !Number.isNaN(Date.parse(from))) list = list.filter((e) => e._ts >= Date.parse(from));
  if (to && !Number.isNaN(Date.parse(to))) list = list.filter((e) => e._ts <= Date.parse(to) + 86_399_999);

  const terms = q ? tokenize(q) : [];
  const scores = new Map();
  if (terms.length) {
    list = list.filter((e) => {
      const score = searchScore(e, terms);
      scores.set(e.id, score);
      return score > 0;
    });
  }

  if (sort === 'popular') {
    list.sort((a, b) => getCounts(b.id).views - getCounts(a.id).views || b._ts - a._ts);
  } else if (sort === 'relevance' && terms.length) {
    list.sort((a, b) => scores.get(b.id) - scores.get(a.id) || b._ts - a._ts);
  } else {
    list.sort((a, b) => b._ts - a._ts);
  }

  const total = list.length;
  const start = (page - 1) * limit;
  return { items: list.slice(start, start + limit).map(toCard), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export function suggest(q) {
  const terms = tokenize(q);
  if (!terms.length || norm(q).trim().length < 2) return [];
  const articles = queryPublic({ q, sort: 'relevance', limit: 5 }).items.map((a) => ({ kind: 'tulisan', title: a.title, hint: a.category?.name ?? a.type, url: a.url }));

  const now = Date.now();
  const tagCounts = new Map();
  for (const entry of index.values()) {
    if (!isPublic(entry, now)) continue;
    for (const t of entry.tags) if (norm(t).includes(terms[0])) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => ({ kind: 'tag', title: `#${t}`, hint: 'Tag', url: `/tag/${encodeURIComponent(t)}` }));
  const authors = listAuthors().filter((a) => terms.every((t) => norm(a.name).includes(t))).slice(0, 2).map((a) => ({ kind: 'penulis', title: a.name, hint: 'Penulis', url: `/penulis/${a.username}` }));
  const categories = listCategories().filter((c) => terms.every((t) => norm(c.name).includes(t))).slice(0, 2).map((c) => ({ kind: 'kategori', title: c.name, hint: 'Kategori', url: `/kategori/${c.slug}` }));
  return [...articles, ...categories, ...authors, ...tags];
}

export function resolveSlug(slug) {
  const id = slugToId.get(slug);
  return id ? index.get(id) : null;
}

async function buildDetail(entry) {
  const article = await collections[entry.type].get(entry.id);
  if (!article) throw notFound('Tulisan tidak ditemukan');
  const card = toCard(entry);
  const now = Date.now();
  const sameType = [...index.values()].filter((e) => isPublic(e, now) && e.type === entry.type).sort((a, b) => b._ts - a._ts);
  const position = sameType.findIndex((e) => e.id === entry.id);
  const neighbor = (e) => (e ? { title: e.title, url: `/${e.type}/${e.slug}` } : null);

  const tags = new Set(entry.tags);
  const related = [...index.values()]
    .filter((e) => e.id !== entry.id && isPublic(e, now))
    .map((e) => ({ e, score: e.tags.filter((t) => tags.has(t)).length * 3 + (e.category_id && e.category_id === entry.category_id ? 2 : 0) + (e.type === entry.type ? 1 : 0) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.e._ts - a.e._ts)
    .slice(0, 4)
    .map((r) => toCard(r.e));

  const authorRecord = getAuthor(entry.author_id);
  return {
    ...card,
    content_html: renderArticleHtml(article.content),
    featured_image: imageObject(article.featured_image_id, { caption: article.featured_caption, alt: article.featured_alt || article.title }),
    comments_enabled: article.comments_enabled,
    updated_at: article.updated_at,
    seo: article.seo,
    status: article.status,
    scheduled: isScheduled(entry, now),
    author_profile: authorRecord ? publicAuthor(authorRecord, countByAuthor(authorRecord.id)) : null,
    related,
    previous: neighbor(sameType[position + 1]),
    next: neighbor(position > 0 ? sameType[position - 1] : null),
  };
}

export async function getPublicArticle(slug) {
  const entry = resolveSlug(slug);
  if (!entry || !isPublic(entry)) throw notFound('Tulisan tidak ditemukan');
  return buildDetail(entry);
}

export async function previewArticle(id, actor) {
  const entry = index.get(id);
  if (!entry || !canSee(actor, entry)) throw notFound('Tulisan tidak ditemukan');
  return buildDetail(entry);
}

export async function getArticleForEditor(id, actor) {
  const entry = index.get(id);
  if (!entry || !canSee(actor, entry)) throw notFound('Tulisan tidak ditemukan');
  const article = await collections[entry.type].get(id);
  const settings = getSettings();
  return {
    ...article,
    featured_image: imageObject(article.featured_image_id, { caption: article.featured_caption }),
    thumbnail: imageObject(article.thumbnail_id),
    is_hero: settings.home.hero_article_id === id,
    is_pick: settings.home.editors_pick_ids.includes(id),
    permissions: { can_edit: canEdit(actor, entry), can_delete: canDelete(actor, entry), can_publish: isStaff(actor) },
  };
}

export function adminList(actor, { type, status, category, author, q, sort = 'updated', page = 1, limit = 20 } = {}) {
  const now = Date.now();
  let list = [...index.values()].filter((e) => canSee(actor, e));
  if (type) list = list.filter((e) => e.type === type);
  if (category) list = list.filter((e) => e.category_id === category);
  if (author) list = list.filter((e) => e.author_id === author);

  const needle = norm(q ?? '').trim();
  if (needle) list = list.filter((e) => e._title.includes(needle) || e._meta.includes(needle));

  const counts = { all: list.length, draft: 0, review: 0, published: 0, archived: 0 };
  for (const e of list) counts[e.status] += 1;

  if (status) list = list.filter((e) => e.status === status);
  list.sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title, 'id') : (a, b) => b.updated_at.localeCompare(a.updated_at));

  const settings = getSettings();
  const total = list.length;
  const items = list.slice((page - 1) * limit, page * limit).map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    slug: e.slug,
    url: `/${e.type}/${e.slug}`,
    status: e.status,
    scheduled: isScheduled(e, now),
    published_at: e.published_at,
    created_at: e.created_at,
    updated_at: e.updated_at,
    category: getCategory(e.category_id)?.name ?? null,
    author: authorNameOf(e) || null,
    source: e.source,
    views: getCounts(e.id).views,
    thumb: imageObject(e.thumbnail_id || e.featured_image_id)?.thumb ?? null,
    demo: e.demo,
    is_hero: settings.home.hero_article_id === e.id,
    is_pick: settings.home.editors_pick_ids.includes(e.id),
    permissions: { can_edit: canEdit(actor, e), can_delete: canDelete(actor, e) },
  }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts };
}

export function dashboardStats(actor) {
  const now = Date.now();
  const mine = [...index.values()].filter((e) => canSee(actor, e));
  const byStatus = { draft: 0, review: 0, published: 0, archived: 0 };
  const byType = { berita: 0, opini: 0, kritik: 0, artikel: 0 };
  for (const e of mine) {
    byStatus[e.status] += 1;
    byType[e.type] += 1;
  }
  const recent = [...mine].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6).map((e) => ({
    id: e.id, title: e.title, type: e.type, status: e.status, updated_at: e.updated_at, url: `/${e.type}/${e.slug}`, scheduled: isScheduled(e, now),
  }));
  const top = mine.filter((e) => isPublic(e, now)).map((e) => ({ id: e.id, title: e.title, url: `/${e.type}/${e.slug}`, views: getCounts(e.id).views })).sort((a, b) => b.views - a.views).slice(0, 5);
  return {
    totals: { articles: mine.length, ...byType, draft: byStatus.draft, review: byStatus.review, published: byStatus.published, archived: byStatus.archived },
    authors: listAuthors().length,
    pending_comments: isStaff(actor) ? pendingCount() : 0,
    recent,
    top,
  };
}

/** Memindahkan semua tulisan dari satu kategori ke kategori lain (dipakai saat kategori dihapus). */
export async function reassignCategory(fromId, toId) {
  if (toId && !getCategory(toId)) throw new HttpError(400, 'Kategori tujuan tidak ditemukan');
  let moved = 0;
  for (const entry of [...index.values()].filter((e) => e.category_id === fromId)) {
    const saved = await collections[entry.type].update(entry.id, (doc) => {
      doc.category_id = toId ?? null;
    });
    await indexAfterWrite(saved);
    moved += 1;
  }
  return moved;
}

export function sitemapEntries() {
  const now = Date.now();
  return [...index.values()]
    .filter((e) => isPublic(e, now))
    .sort((a, b) => b._ts - a._ts)
    .map((e) => ({ url: `/${e.type}/${e.slug}`, lastmod: e.updated_at, title: e.title, published_at: e.published_at, id: e.id }));
}

export function authorArticleCounts() {
  const now = Date.now();
  const counts = new Map();
  for (const e of index.values()) {
    if (e.author_id && isPublic(e, now)) counts.set(e.author_id, (counts.get(e.author_id) ?? 0) + 1);
  }
  return counts;
}

export function publicHome() {
  const settings = getSettings();
  const now = Date.now();
  const pool = [...index.values()].filter((e) => isPublic(e, now)).sort((a, b) => b._ts - a._ts);

  const heroEntry = pool.find((e) => e.id === settings.home.hero_article_id) ?? pool.find((e) => e.featured_image_id) ?? pool[0] ?? null;
  const rest = pool.filter((e) => e.id !== heroEntry?.id);
  const ofType = (type, n) => rest.filter((e) => e.type === type).slice(0, n).map(toCard);
  const picks = settings.home.editors_pick_ids.map((id) => pool.find((e) => e.id === id)).filter(Boolean).map(toCard);

  const counts = authorArticleCounts();
  const authors = listAuthors()
    .filter((a) => counts.has(a.id))
    .sort((a, b) => counts.get(b.id) - counts.get(a.id))
    .slice(0, 8)
    .map((a) => publicAuthor(a, counts.get(a.id)));

  const popular = [...pool].sort((a, b) => getCounts(b.id).views - getCounts(a.id).views || b._ts - a._ts).slice(0, 5).map(toCard);

  return {
    hero: heroEntry ? toCard(heroEntry) : null,
    latest: rest.slice(0, 9).map(toCard),
    news: ofType('berita', 6),
    opinions: ofType('opini', 4),
    criticisms: ofType('kritik', 4),
    editorial: ofType('artikel', 4),
    picks,
    popular,
    authors,
    total_published: pool.length,
  };
}
