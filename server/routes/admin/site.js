import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { getEntry, isPublic } from '../../services/articles.js';
import { logActivity } from '../../services/logger.js';
import { getSettings, listPages, updatePage, updateSettings } from '../../services/settings.js';
import { HttpError, notFound, parse } from '../../utils/http.js';

export const siteRouter = Router();

siteRouter.get('/pages', requirePermission('pages:manage'), async (_req, res) => {
  res.json({ items: await listPages() });
});

siteRouter.put('/pages/:slug', requirePermission('pages:manage'), async (req, res) => {
  const page = await updatePage(req.params.slug, req.body);
  if (!page) throw notFound('Halaman tidak ditemukan');
  await logActivity({ user: req.user, action: 'page.update', target: page.slug, detail: page.title, ip: req.ip });
  res.json(page);
});

siteRouter.get('/settings', (req, res) => {
  // Semua pengguna login perlu membaca pengaturan dasar untuk editor; hanya Super Admin yang dapat mengubahnya.
  res.json(getSettings());
});

siteRouter.put('/settings', requirePermission('settings:manage'), async (req, res) => {
  const settings = await updateSettings(req.body);
  await logActivity({ user: req.user, action: 'settings.update', ip: req.ip });
  res.json(settings);
});

/** Editor dapat mengatur breaking news dan artikel unggulan tanpa akses ke pengaturan situs lainnya. */
siteRouter.put('/settings/editorial', requirePermission('articles:feature'), async (req, res) => {
  const body = parse(
    z.object({
      breaking: z.object({ enabled: z.boolean(), text: z.string().trim().max(200), url: z.string().max(500) }).partial(),
      home: z.object({ hero_article_id: z.string().max(64).nullable(), editors_pick_ids: z.array(z.string().max(64)).max(8) }).partial(),
    }).partial(),
    req.body,
  );
  const ids = [body.home?.hero_article_id, ...(body.home?.editors_pick_ids ?? [])].filter(Boolean);
  for (const id of ids) {
    const entry = getEntry(id);
    if (!entry || !isPublic(entry)) throw new HttpError(400, 'Hanya tulisan yang sudah terbit yang dapat dijadikan unggulan');
  }
  const settings = await updateSettings(body);
  await logActivity({ user: req.user, action: 'settings.editorial', ip: req.ip });
  res.json({ breaking: settings.breaking, home: settings.home });
});
