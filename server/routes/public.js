import { Router } from 'express';
import { z } from 'zod';
import { commentLimiter, interactionLimiter, newsletterLimiter, submissionLimiter } from '../middleware/security.js';
import { publicImageUpload, removeTempFiles } from '../middleware/upload.js';
import { authorArticleCounts, countByAuthor, getEntry, getPublicArticle, isPublic, queryPublic, suggest } from '../services/articles.js';
import { getAuthorByUsername, listAuthors, publicAuthor } from '../services/authors.js';
import { listCategories } from '../services/categories.js';
import { approvedCount, createComment, listApproved } from '../services/comments.js';
import { hashIp, logActivity } from '../services/logger.js';
import { createSubmission, TYPES } from '../services/articles.js';
import { imageObject, saveUpload } from '../services/media.js';
import { subscribe } from '../services/newsletter.js';
import { getPage, getSettings } from '../services/settings.js';
import { getCounts, recordHit, recordView, setLike } from '../services/stats.js';
import { HttpError, clampInt, notFound, parse } from '../utils/http.js';
import { escapeHtml, cleanText } from '../utils/text.js';
import { publicHome } from '../services/articles.js';

export const publicRouter = Router();

publicRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

const BOT = /bot|crawler|spider|crawling|preview|facebookexternalhit|slurp|headless/i;
const fingerprint = (req) => hashIp(`${req.ip}|${req.get('user-agent') ?? ''}`);

export function publicSettings() {
  const s = getSettings();
  const logo = imageObject(s.logo_id);
  const favicon = imageObject(s.favicon_id);
  return {
    site_name: s.site_name,
    tagline: s.tagline,
    description: s.description,
    logo: logo ? { url: logo.url, thumb: logo.thumb, width: logo.width, height: logo.height } : null,
    favicon: favicon ? favicon.thumb : null,
    theme: s.theme,
    nav: s.nav,
    footer: s.footer,
    social: s.social,
    email_redaksi: s.email_redaksi,
    per_page: s.home.per_page,
    breaking: s.breaking.enabled && s.breaking.text ? { text: s.breaking.text, url: s.breaking.url } : null,
    comments_enabled: s.comments.enabled,
    newsletter_enabled: s.newsletter_enabled,
    submissions_enabled: s.submissions_enabled,
    categories: listCategories().map(({ id, name, slug, description }) => ({ id, name, slug, description })),
  };
}

publicRouter.get('/site', (_req, res) => res.json(publicSettings()));
publicRouter.get('/home', (_req, res) => res.json(publicHome()));

publicRouter.get('/articles', (req, res) => {
  const { type, category, author, tag, q, from, to, sort } = req.query;
  res.json(
    queryPublic({
      type: TYPES.includes(type) ? type : undefined,
      category: typeof category === 'string' ? category : undefined,
      author: typeof author === 'string' ? author : undefined,
      tag: typeof tag === 'string' ? tag.slice(0, 60) : undefined,
      q: typeof q === 'string' ? q.slice(0, 120) : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      sort: ['latest', 'popular', 'relevance'].includes(sort) ? sort : 'latest',
      page: clampInt(req.query.page, 1, 1000, 1),
      limit: clampInt(req.query.limit, 1, 48, getSettings().home.per_page),
    }),
  );
});

publicRouter.get('/articles/:slug', async (req, res) => {
  const article = await getPublicArticle(req.params.slug);
  res.json(article);
});

publicRouter.get('/search/suggest', (req, res) => {
  res.json({ items: suggest(typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '') });
});

publicRouter.post('/hit', interactionLimiter, (req, res) => {
  if (!BOT.test(req.get('user-agent') ?? '')) recordHit();
  res.status(204).end();
});

function publicEntryOr404(id) {
  const entry = getEntry(id);
  if (!entry || !isPublic(entry)) throw notFound('Tulisan tidak ditemukan');
  return entry;
}

publicRouter.post('/articles/:id/view', interactionLimiter, (req, res) => {
  const entry = publicEntryOr404(req.params.id);
  if (!BOT.test(req.get('user-agent') ?? '')) recordView(entry.id, fingerprint(req));
  res.json({ views: getCounts(entry.id).views });
});

publicRouter.post('/articles/:id/like', interactionLimiter, (req, res) => {
  const entry = publicEntryOr404(req.params.id);
  const { liked } = parse(z.object({ liked: z.boolean() }), req.body);
  res.json({ likes: setLike(entry.id, fingerprint(req), liked) });
});

publicRouter.get('/articles/:id/comments', async (req, res) => {
  const entry = publicEntryOr404(req.params.id);
  res.json({ items: await listApproved(entry.id), count: approvedCount(entry.id), enabled: getSettings().comments.enabled && entry.comments_enabled });
});

const commentInput = z.object({
  name: z.string().max(80),
  email: z.string().max(200).optional(),
  body: z.string().max(4000),
  parent_id: z.string().max(64).nullable().optional(),
  website: z.string().optional(),
  elapsed: z.number().optional(),
});

publicRouter.post('/articles/:id/comments', commentLimiter, async (req, res) => {
  const entry = publicEntryOr404(req.params.id);
  const settings = getSettings();
  if (!settings.comments.enabled || !entry.comments_enabled) throw new HttpError(403, 'Komentar dinonaktifkan untuk tulisan ini');
  const input = parse(commentInput, req.body);

  const looksLikeBot = Boolean(input.website) || (typeof input.elapsed === 'number' && input.elapsed < 2500);
  if (looksLikeBot) return res.status(201).json({ status: 'pending', message: 'Komentar Anda menunggu moderasi.' });

  const result = await createComment({
    articleId: entry.id,
    parentId: input.parent_id ?? null,
    name: input.name,
    email: input.email ?? '',
    body: input.body,
    ipHash: hashIp(req.ip),
    moderation: settings.comments.moderation,
  });
  const approved = result.status === 'approved';
  res.status(201).json({
    status: approved ? 'approved' : 'pending',
    message: approved ? 'Komentar Anda sudah tampil.' : 'Komentar Anda menunggu moderasi redaksi.',
  });
});

publicRouter.get('/categories', (_req, res) => res.json({ items: listCategories() }));

publicRouter.get('/authors', (_req, res) => {
  const counts = authorArticleCounts();
  const items = listAuthors()
    .filter((a) => counts.has(a.id))
    .sort((a, b) => counts.get(b.id) - counts.get(a.id) || a.name.localeCompare(b.name, 'id'))
    .map((a) => publicAuthor(a, counts.get(a.id)));
  res.json({ items });
});

publicRouter.get('/authors/:username', (req, res) => {
  const author = getAuthorByUsername(req.params.username);
  if (!author) throw notFound('Penulis tidak ditemukan');
  res.json(publicAuthor(author, countByAuthor(author.id)));
});

publicRouter.get('/pages/:slug', async (req, res) => {
  const page = await getPage(req.params.slug);
  if (!page) throw notFound('Halaman tidak ditemukan');
  res.json({ slug: page.slug, title: page.title, content: page.content, updated_at: page.updated_at });
});

publicRouter.post('/newsletter', newsletterLimiter, async (req, res) => {
  if (!getSettings().newsletter_enabled) throw new HttpError(403, 'Newsletter sedang tidak menerima pelanggan baru');
  const { email, website } = parse(z.object({ email: z.string().max(200), website: z.string().optional() }), req.body);
  if (website) return res.status(201).json({ message: 'Terima kasih, Anda sudah berlangganan.' });
  const { alreadySubscribed } = await subscribe(email, { ipHash: hashIp(req.ip) });
  res.status(201).json({ message: alreadySubscribed ? 'Email ini sudah terdaftar. Terima kasih!' : 'Terima kasih, Anda sudah berlangganan.' });
});

const submissionInput = z.object({
  name: z.string().trim().min(2, 'nama minimal 2 karakter').max(80),
  email: z.email('format email tidak valid').max(200),
  title: z.string().trim().min(5, 'judul minimal 5 karakter').max(200),
  type: z.enum(['opini', 'kritik', 'artikel', 'berita']),
  category_id: z.string().max(64).optional().or(z.literal('')),
  content: z.string().trim().min(200, 'isi tulisan minimal 200 karakter').max(30_000, 'isi tulisan maksimal 30.000 karakter'),
  agree: z.literal('true', 'Anda harus menyetujui kebijakan publikasi'),
  website: z.string().optional(),
  elapsed: z.coerce.number().optional(),
});

function textToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

publicRouter.post('/submissions', submissionLimiter, publicImageUpload.single('image'), async (req, res) => {
  const files = req.file ? [req.file] : [];
  try {
    if (!getSettings().submissions_enabled) throw new HttpError(403, 'Pengiriman tulisan sedang ditutup');
    const input = parse(submissionInput, req.body);
    if (input.website || (input.elapsed !== undefined && input.elapsed < 5000)) {
      return res.status(201).json({ message: 'Tulisan Anda sudah masuk antrean peninjauan redaksi.' });
    }

    let imageId = null;
    if (req.file) {
      const media = await saveUpload({
        tmpPath: req.file.path,
        originalName: req.file.originalname,
        declaredMime: req.file.mimetype,
        allowKinds: ['image'],
        alt: input.title,
      });
      imageId = media.id;
    }

    const article = await createSubmission({
      name: input.name,
      email: input.email,
      title: input.title,
      type: input.type,
      category_id: input.category_id || null,
      content: textToHtml(input.content.replace(/\r\n?/g, '\n')),
      image_id: imageId,
    });
    await logActivity({ action: 'submission.received', target: article.id, detail: article.title, ip: req.ip });
    res.status(201).json({ message: 'Tulisan Anda sudah masuk antrean peninjauan redaksi. Terima kasih!' });
  } finally {
    await removeTempFiles(files);
  }
});
