import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { countByAuthor, countByCategory, reassignCategory } from '../../services/articles.js';
import { getAuthor, listAuthors, updateAuthor } from '../../services/authors.js';
import { createCategory, deleteCategory, getCategory, listCategories, reorderCategories, updateCategory } from '../../services/categories.js';
import { logActivity } from '../../services/logger.js';
import { ROLE_LABELS, can } from '../../services/roles.js';
import { createUser, deleteUser, listUsers, publicUser, updateUser } from '../../services/users.js';
import { HttpError, forbidden, notFound, parse } from '../../utils/http.js';

export const peopleRouter = Router();

/* ---------- Kategori ---------- */

peopleRouter.get('/categories', (_req, res) => {
  res.json({ items: listCategories().map((c) => ({ ...c, article_count: countByCategory(c.id) })) });
});

peopleRouter.post('/categories', requirePermission('categories:manage'), async (req, res) => {
  const category = await createCategory(req.body);
  await logActivity({ user: req.user, action: 'category.create', target: category.id, detail: category.name, ip: req.ip });
  res.status(201).json(category);
});

peopleRouter.put('/categories/order', requirePermission('categories:manage'), async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.string().max(64)).max(100) }), req.body);
  res.json({ items: await reorderCategories(ids) });
});

peopleRouter.put('/categories/:id', requirePermission('categories:manage'), async (req, res) => {
  const category = await updateCategory(req.params.id, req.body);
  await logActivity({ user: req.user, action: 'category.update', target: category.id, detail: category.name, ip: req.ip });
  res.json(category);
});

peopleRouter.delete('/categories/:id', requirePermission('categories:manage'), async (req, res) => {
  const category = getCategory(req.params.id);
  if (!category) throw notFound('Kategori tidak ditemukan');
  const used = countByCategory(category.id);
  const reassignTo = typeof req.query.reassign === 'string' ? req.query.reassign : '';
  if (used > 0 && !reassignTo) {
    throw new HttpError(409, `Kategori ini dipakai ${used} tulisan. Pilih kategori pengganti sebelum menghapus.`, { used });
  }
  if (reassignTo === category.id) throw new HttpError(400, 'Kategori pengganti harus berbeda');
  if (used > 0) await reassignCategory(category.id, reassignTo);
  await deleteCategory(category.id);
  await logActivity({ user: req.user, action: 'category.delete', target: category.id, detail: category.name, ip: req.ip });
  res.json({ ok: true, moved: used });
});

/* ---------- Penulis ---------- */

const authorForAdmin = (author) => ({ ...author, article_count: countByAuthor(author.id, { publicOnly: false }) });

peopleRouter.get('/authors', (req, res) => {
  const all = listAuthors();
  const visible = can(req.user, 'authors:manage_all') ? all : all.filter((a) => a.id === req.user.author_id);
  res.json({ items: visible.map(authorForAdmin) });
});

peopleRouter.put('/authors/:id', async (req, res) => {
  const author = getAuthor(req.params.id);
  if (!author) throw notFound('Penulis tidak ditemukan');
  if (!can(req.user, 'authors:manage_all') && author.id !== req.user.author_id) throw forbidden('Anda hanya dapat mengubah profil Anda sendiri');
  const updated = await updateAuthor(author.id, req.body);
  await logActivity({ user: req.user, action: 'author.update', target: author.id, detail: updated.name, ip: req.ip });
  res.json(authorForAdmin(updated));
});

/* ---------- Pengguna (khusus Super Admin) ---------- */

const userForAdmin = (user) => ({ ...publicUser(user), role_label: ROLE_LABELS[user.role], locked: Boolean(user.locked_until && Date.parse(user.locked_until) > Date.now()) });

peopleRouter.get('/users', requirePermission('users:manage'), async (_req, res) => {
  const users = await listUsers();
  res.json({ items: users.sort((a, b) => a.name.localeCompare(b.name, 'id')).map(userForAdmin) });
});

peopleRouter.post('/users', requirePermission('users:manage'), async (req, res) => {
  const user = await createUser(req.body);
  await logActivity({ user: req.user, action: 'user.create', target: user.id, detail: `${user.username} (${user.role})`, ip: req.ip });
  res.status(201).json(userForAdmin(user));
});

peopleRouter.put('/users/:id', requirePermission('users:manage'), async (req, res) => {
  const user = await updateUser(req.params.id, req.body, req.user);
  await logActivity({ user: req.user, action: 'user.update', target: user.id, detail: `${user.username} (${user.role})`, ip: req.ip });
  res.json(userForAdmin(user));
});

peopleRouter.delete('/users/:id', requirePermission('users:manage'), async (req, res) => {
  const user = await deleteUser(req.params.id, req.user);
  await logActivity({ user: req.user, action: 'user.delete', target: user.id, detail: user.username, ip: req.ip });
  res.json({ ok: true });
});
