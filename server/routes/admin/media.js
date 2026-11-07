import { Router } from 'express';
import { z } from 'zod';
import { adminUpload, removeTempFiles } from '../../middleware/upload.js';
import { logActivity } from '../../services/logger.js';
import { describeMedia, getMedia, listMedia, removeMedia, renameMedia, saveUpload } from '../../services/media.js';
import { can } from '../../services/roles.js';
import { clampInt, forbidden, notFound, parse } from '../../utils/http.js';

export const mediaRouter = Router();

function assertOwnerOrManager(user, media) {
  if (!media) throw notFound('File tidak ditemukan');
  if (!can(user, 'media:manage_all') && media.uploaded_by !== user.id) throw forbidden('Anda hanya dapat mengelola file yang Anda unggah');
}

mediaRouter.get('/media', (req, res) => {
  res.json(
    listMedia({
      user: req.user,
      canManageAll: can(req.user, 'media:manage_all'),
      q: typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '',
      kind: ['image', 'video', 'document'].includes(req.query.kind) ? req.query.kind : '',
      page: clampInt(req.query.page, 1, 1000, 1),
      limit: clampInt(req.query.limit, 1, 60, 24),
    }),
  );
});

mediaRouter.post('/media', adminUpload.array('files', 10), async (req, res) => {
  const files = req.files ?? [];
  const items = [];
  const errors = [];
  try {
    if (files.length === 0) return res.status(400).json({ error: 'Pilih minimal satu file untuk diunggah' });
    // Pengguna dengan peran Kontributor hanya boleh mengunggah gambar.
    const allowKinds = req.user.role === 'kontributor' ? ['image'] : ['image', 'video', 'document'];
    for (const file of files) {
      try {
        const media = await saveUpload({ tmpPath: file.path, originalName: file.originalname, declaredMime: file.mimetype, user: req.user, allowKinds });
        items.push(describeMedia(media));
      } catch (err) {
        errors.push({ name: file.originalname, error: err.message });
      }
    }
  } finally {
    await removeTempFiles(files);
  }
  if (items.length) await logActivity({ user: req.user, action: 'media.upload', detail: `${items.length} file`, ip: req.ip });
  res.status(items.length ? 201 : 400).json({ items, errors, ...(items.length ? {} : { error: errors[0]?.error ?? 'Upload gagal' }) });
});

mediaRouter.patch('/media/:id', async (req, res) => {
  assertOwnerOrManager(req.user, getMedia(req.params.id));
  const body = parse(z.object({ name: z.string().trim().min(1).max(120), alt: z.string().trim().max(200) }).partial(), req.body);
  res.json(describeMedia(await renameMedia(req.params.id, body)));
});

mediaRouter.delete('/media/:id', async (req, res) => {
  assertOwnerOrManager(req.user, getMedia(req.params.id));
  const media = await removeMedia(req.params.id);
  await logActivity({ user: req.user, action: 'media.delete', target: media.id, detail: media.name, ip: req.ip });
  res.json({ ok: true });
});
