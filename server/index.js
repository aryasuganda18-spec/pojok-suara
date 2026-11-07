import fs from 'node:fs/promises';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import session from 'express-session';
import { config, getSessionSecret } from './config.js';
import { loadUser } from './middleware/auth.js';
import { apiLimiter, cspNonce, maintenanceGuard, sameOrigin, securityHeaders } from './middleware/security.js';
import { sweepUploadTmp } from './middleware/upload.js';
import { adminRouter } from './routes/admin/index.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { startBackupScheduler } from './services/backup.js';
import { bootServices, flushServices } from './services/boot.js';
import { buildRobots, buildRss, buildSitemap, renderHead } from './services/seo.js';
import { SupabaseSessionStore } from './services/sessionStore.js';
import { listUsers } from './services/users.js';
import { errorHandler } from './utils/http.js';

export async function createApp() {
  await bootServices();

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.use(cspNonce);
  app.use(securityHeaders);
  app.use(compression());

  // Catatan: file media (gambar/video/dokumen) TIDAK lagi dilayani oleh server ini.
  // Semua URL media (lihat server/services/media.js) menunjuk langsung ke Supabase Storage.
  const dist = config.distDir;
  app.use(
    '/assets',
    express.static(path.join(dist, 'assets'), { index: false, immutable: true, maxAge: '1y', fallthrough: false }),
  );
  for (const folder of ['images', 'icons']) {
    app.use(`/${folder}`, express.static(path.join(config.root, 'public', folder), { index: false, maxAge: '7d' }));
    app.use(`/${folder}`, express.static(path.join(dist, folder), { index: false, maxAge: '7d' }));
  }

  app.use('/api', express.json({ limit: '2mb' }), sameOrigin, apiLimiter);
  app.use(
    '/api',
    session({
      name: 'ps.sid',
      secret: await getSessionSecret(),
      store: new SupabaseSessionStore(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 7 * 24 * 60 * 60 * 1000 },
    }),
    loadUser,
    maintenanceGuard,
  );

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

  app.get('/manifest.webmanifest', (_req, res) => {
    res.type('application/manifest+json').sendFile(path.join(config.root, 'public', 'manifest.webmanifest'));
  });
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(buildRobots(req)));
  app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(buildSitemap(req)));
  app.get('/rss.xml', (req, res) => res.type('application/rss+xml').send(buildRss(req)));

  let shell = null;
  const loadShell = async () => {
    if (shell && config.isProd) return shell;
    try {
      shell = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
    } catch {
      shell = null;
    }
    return shell;
  };

  app.get(/^\/(?!api\/|media\/|assets\/).*/, async (req, res, next) => {
    try {
      const html = await loadShell();
      if (!html) {
        return res
          .status(503)
          .type('text/plain')
          .send('Frontend belum dibangun. Jalankan "npm run build" lalu mulai ulang server, atau gunakan "npm run dev".');
      }
      const { head, status } = await renderHead(req.path, req);
      const page = html
        .replace('<!--app-head-->', head)
        .replace(/<script(?![^>]*type="application\/ld\+json")/g, `<script nonce="${res.locals.cspNonce}"`);
      res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).send(page);
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);
  return app;
}

async function start() {
  const app = await createApp();
  const users = await listUsers();
  if (users.length === 0) {
    console.warn('\n[peringatan] Belum ada akun. Jalankan "npm run init" untuk membuat Super Admin dan data awal.\n');
  }
  await sweepUploadTmp();
  startBackupScheduler();

  const server = app.listen(config.port, config.host, () => {
    console.log(`POJOK SUARA berjalan di http://localhost:${config.port}  (${config.env})`);
    console.log(`Penyimpanan data: Supabase (${config.supabase.url || 'SUPABASE_URL belum diisi!'})`);
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`\n${signal} diterima, menyimpan data dan berhenti...`);
    server.close();
    await flushServices();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    console.error('Gagal memulai server:', err);
    process.exit(1);
  });
}
