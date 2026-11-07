import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import { removeTempFiles, restoreUpload } from '../../middleware/upload.js';
import { dashboardStats, deleteArticle, demoIds, flushIndex } from '../../services/articles.js';
import { backupPath, createBackup, deleteBackup, listBackups, restoreBackup } from '../../services/backup.js';
import { bootServices } from '../../services/boot.js';
import { logActivity, readLogs, recentActivity } from '../../services/logger.js';
import { listMedia, removeMedia } from '../../services/media.js';
import { listAuthors, removeAuthor } from '../../services/authors.js';
import { can } from '../../services/roles.js';
import { dailySeries, flush as flushStats, totalViews } from '../../services/stats.js';
import { HttpError, clampInt } from '../../utils/http.js';

export const systemRouter = Router();

systemRouter.get('/dashboard', async (req, res) => {
  const stats = dashboardStats(req.user);
  const staff = can(req.user, 'stats:view_all');
  res.json({
    ...stats,
    total_views: staff ? totalViews() : null,
    series: staff ? dailySeries(14) : [],
    activity: staff ? await recentActivity(8) : [],
  });
});

systemRouter.get('/logs', requirePermission('logs:view'), async (req, res) => {
  res.json({ items: await readLogs({ limit: clampInt(req.query.limit, 1, 500, 100), action: typeof req.query.action === 'string' ? req.query.action.slice(0, 30) : '' }) });
});

/* ---------- Backup & restore ---------- */

systemRouter.get('/backups', requirePermission('backup:manage'), async (_req, res) => {
  res.json({ items: await listBackups() });
});

systemRouter.post('/backups', requirePermission('backup:manage'), async (req, res) => {
  await flushStats();
  await flushIndex();
  const backup = await createBackup({ reason: 'manual', username: req.user.username });
  await logActivity({ user: req.user, action: 'backup.create', detail: backup.name, ip: req.ip });
  res.status(201).json(backup);
});

systemRouter.get('/backups/:name/download', requirePermission('backup:manage'), async (req, res) => {
  const file = await backupPath(req.params.name);
  await logActivity({ user: req.user, action: 'backup.download', detail: req.params.name, ip: req.ip });
  res.download(file, req.params.name);
});

systemRouter.delete('/backups/:name', requirePermission('backup:manage'), async (req, res) => {
  await deleteBackup(req.params.name);
  await logActivity({ user: req.user, action: 'backup.delete', detail: req.params.name, ip: req.ip });
  res.json({ ok: true });
});

async function runRestore(req, res, zipPath) {
  await flushStats();
  await flushIndex();
  const result = await restoreBackup(zipPath, {
    username: req.user.username,
    beforeSwap: async () => {
      await flushStats();
      await flushIndex();
    },
    onSwapped: bootServices,
  });
  await logActivity({ user: req.user, action: 'backup.restore', detail: `pengaman: ${result.safety_backup}`, ip: req.ip });
  res.json({ ok: true, ...result, message: 'Data berhasil dipulihkan. Silakan masuk kembali bila sesi Anda berakhir.' });
}

systemRouter.post('/backups/:name/restore', requirePermission('backup:manage'), async (req, res) => {
  await runRestore(req, res, await backupPath(req.params.name));
});

systemRouter.post('/backups/restore-upload', requirePermission('backup:manage'), restoreUpload.single('file'), async (req, res) => {
  const files = req.file ? [req.file] : [];
  try {
    if (!req.file) throw new HttpError(400, 'Pilih file backup (.zip)');
    await runRestore(req, res, req.file.path);
  } finally {
    await removeTempFiles(files);
  }
});

/* ---------- Data contoh ---------- */

systemRouter.get('/demo', requirePermission('demo:clear'), (_req, res) => {
  const mediaItems = listMedia({ user: null, canManageAll: true, limit: 1000 }).items.filter((m) => m.demo);
  res.json({ articles: demoIds().length, authors: listAuthors().filter((a) => a.demo).length, media: mediaItems.length });
});

systemRouter.delete('/demo', requirePermission('demo:clear'), async (req, res) => {
  const ids = demoIds();
  for (const id of ids) await deleteArticle(id, null);
  const mediaItems = listMedia({ user: null, canManageAll: true, limit: 1000 }).items.filter((m) => m.demo);
  for (const m of mediaItems) await removeMedia(m.id);
  for (const a of listAuthors().filter((x) => x.demo)) await removeAuthor(a.id);
  await flushIndex();
  await logActivity({ user: req.user, action: 'demo.clear', detail: `${ids.length} tulisan`, ip: req.ip });
  res.json({ ok: true, removed: { articles: ids.length, media: mediaItems.length } });
});
