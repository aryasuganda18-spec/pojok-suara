import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import {
  STATUSES, TYPES, adminList, articleInputSchema, createArticle, deleteArticle, getArticleForEditor,
  getEntry, getRevision, listRevisions, previewArticle, updateArticle,
} from '../../services/articles.js';
import { deleteDraft, getDraft, listDrafts, saveDraft } from '../../services/drafts.js';
import { logActivity } from '../../services/logger.js';
import { setFeatured } from '../../services/settings.js';
import { clampInt, notFound, parse } from '../../utils/http.js';

export const articlesRouter = Router();

const pick = (value, allowed) => (allowed.includes(value) ? value : undefined);

articlesRouter.get('/articles', (req, res) => {
  const { category, author, q, sort } = req.query;
  res.json(
    adminList(req.user, {
      type: pick(req.query.type, TYPES),
      status: pick(req.query.status, STATUSES),
      category: typeof category === 'string' ? category : undefined,
      author: typeof author === 'string' ? author : undefined,
      q: typeof q === 'string' ? q.slice(0, 120) : undefined,
      sort: sort === 'title' ? 'title' : 'updated',
      page: clampInt(req.query.page, 1, 1000, 1),
      limit: clampInt(req.query.limit, 1, 100, 20),
    }),
  );
});

articlesRouter.get('/articles/:id', async (req, res) => {
  res.json(await getArticleForEditor(req.params.id, req.user));
});

articlesRouter.get('/articles/:id/preview', async (req, res) => {
  res.json(await previewArticle(req.params.id, req.user));
});

articlesRouter.post('/articles', async (req, res) => {
  const article = await createArticle(parse(articleInputSchema, req.body), req.user);
  await logActivity({ user: req.user, action: 'article.create', target: article.id, detail: article.title, ip: req.ip });
  res.status(201).json(await getArticleForEditor(article.id, req.user));
});

articlesRouter.put('/articles/:id', async (req, res) => {
  const before = getEntry(req.params.id);
  const article = await updateArticle(req.params.id, parse(articleInputSchema, req.body), req.user);
  const action = before && before.status !== article.status ? `article.status.${article.status}` : 'article.update';
  await logActivity({ user: req.user, action, target: article.id, detail: article.title, ip: req.ip });
  res.json(await getArticleForEditor(article.id, req.user));
});

articlesRouter.delete('/articles/:id', async (req, res) => {
  const removed = await deleteArticle(req.params.id, req.user);
  await logActivity({ user: req.user, action: 'article.delete', target: removed.id, detail: removed.title, ip: req.ip });
  res.json({ ok: true });
});

articlesRouter.post('/articles/:id/feature', requirePermission('articles:feature'), async (req, res) => {
  if (!getEntry(req.params.id)) throw notFound('Tulisan tidak ditemukan');
  const body = parse(z.object({ hero: z.boolean(), pick: z.boolean() }).partial(), req.body);
  await setFeatured(req.params.id, body);
  await logActivity({ user: req.user, action: 'article.feature', target: req.params.id, detail: JSON.stringify(body), ip: req.ip });
  res.json(await getArticleForEditor(req.params.id, req.user));
});

articlesRouter.get('/articles/:id/revisions', async (req, res) => {
  res.json({ items: await listRevisions(req.params.id, req.user) });
});

articlesRouter.get('/articles/:id/revisions/:revisionId', async (req, res) => {
  res.json(await getRevision(req.params.id, req.params.revisionId, req.user));
});

/* Draft otomatis dari editor (disimpan di server per pengguna) */

articlesRouter.get('/drafts', async (req, res) => res.json({ items: await listDrafts(req.user) }));
articlesRouter.get('/drafts/:key', async (req, res) => res.json({ draft: await getDraft(req.user, req.params.key) }));
articlesRouter.put('/drafts/:key', async (req, res) => res.json(await saveDraft(req.user, req.params.key, req.body)));
articlesRouter.delete('/drafts/:key', async (req, res) => {
  await deleteDraft(req.user, req.params.key);
  res.json({ ok: true });
});
