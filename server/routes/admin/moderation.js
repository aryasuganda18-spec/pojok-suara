import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getEntry } from '../../services/articles.js';
import { deleteComment, listAllComments, setCommentStatus } from '../../services/comments.js';
import { logActivity } from '../../services/logger.js';
import { exportCsv, listSubscribers, removeSubscriber } from '../../services/newsletter.js';
import { clampInt, parse } from '../../utils/http.js';

export const moderationRouter = Router();

moderationRouter.get('/comments', requirePermission('comments:moderate'), async (req, res) => {
  const status = ['pending', 'approved', 'spam'].includes(req.query.status) ? req.query.status : '';
  const all = await listAllComments({ status, q: typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '' });
  const page = clampInt(req.query.page, 1, 1000, 1);
  const limit = clampInt(req.query.limit, 1, 100, 20);
  const items = all.slice((page - 1) * limit, page * limit).map((c) => {
    const entry = getEntry(c.article_id);
    const { ip_hash, ...safe } = c;
    return { ...safe, article_title: entry?.title ?? '(tulisan dihapus)', article_url: entry ? `/${entry.type}/${entry.slug}` : null };
  });
  res.json({ items, total: all.length, page, pages: Math.max(1, Math.ceil(all.length / limit)) });
});

moderationRouter.patch('/comments/:articleId/:commentId', requirePermission('comments:moderate'), async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['pending', 'approved', 'spam']) }), req.body);
  await setCommentStatus(req.params.articleId, req.params.commentId, status);
  await logActivity({ user: req.user, action: `comment.${status}`, target: req.params.commentId, ip: req.ip });
  res.json({ ok: true });
});

moderationRouter.delete('/comments/:articleId/:commentId', requirePermission('comments:moderate'), async (req, res) => {
  await deleteComment(req.params.articleId, req.params.commentId);
  await logActivity({ user: req.user, action: 'comment.delete', target: req.params.commentId, ip: req.ip });
  res.json({ ok: true });
});

moderationRouter.get('/newsletter', requirePermission('newsletter:manage'), async (_req, res) => {
  const items = await listSubscribers();
  res.json({ items, total: items.length });
});

moderationRouter.get('/newsletter/export', requirePermission('newsletter:manage'), async (_req, res) => {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pelanggan-newsletter.csv"' });
  res.send('﻿' + (await exportCsv()));
});

moderationRouter.delete('/newsletter/:id', requirePermission('newsletter:manage'), async (req, res) => {
  await removeSubscriber(req.params.id);
  await logActivity({ user: req.user, action: 'newsletter.remove', target: req.params.id, ip: req.ip });
  res.json({ ok: true });
});
