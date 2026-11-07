import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // file .env bersifat opsional
}

const positive = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Di Vercel, satu-satunya folder yang boleh ditulis fungsi serverless adalah direktori sementara OS (/tmp).
const onVercel = Boolean(process.env.VERCEL);

const resolveDir = (value, fallback) => path.resolve(ROOT, value || fallback);

function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

export const config = {
  root: ROOT,
  env: process.env.NODE_ENV || 'development',
  port: positive(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  timezone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  // Semua data tulisan, pengguna, media, dsb. disimpan di Supabase (lihat server/db/supabase.js).
  // uploadTmpDir HANYA dipakai sebagai tempat singgah sementara sebelum file diunggah ke
  // Supabase Storage (lihat server/middleware/upload.js) — bukan penyimpanan permanen.
  onVercel,
  uploadTmpDir: onVercel && !process.env.UPLOAD_TMP_DIR
    ? path.join(os.tmpdir(), 'pojok-suara-uploads')
    : resolveDir(process.env.UPLOAD_TMP_DIR, 'uploads/tmp'),
  distDir: path.join(ROOT, 'dist'),
  // Di belakang proxy Vercel, IP pengunjung ada di X-Forwarded-For; tanpa ini pembatas laju melihat
  // semua pengunjung sebagai satu IP dan mencatat ValidationError di setiap request.
  trustProxy: process.env.TRUST_PROXY === undefined && onVercel ? 1 : parseTrustProxy(process.env.TRUST_PROXY),
  cookieSecure: ['true', 'false'].includes(process.env.COOKIE_SECURE) ? process.env.COOKIE_SECURE === 'true' : 'auto',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  limits: {
    imageMb: positive(process.env.MAX_IMAGE_MB, 10),
    videoMb: positive(process.env.MAX_VIDEO_MB, 100),
    docMb: positive(process.env.MAX_DOC_MB, 20),
    restoreMb: positive(process.env.MAX_RESTORE_MB, 2048),
  },
  backup: {
    enabled: process.env.BACKUP_AUTO !== 'false',
    intervalHours: positive(process.env.BACKUP_INTERVAL_HOURS, 24),
    keepAuto: positive(process.env.BACKUP_KEEP, 14),
  },
};

config.isProd = config.env === 'production';

/**
 * Rahasia sesi: dari env bila diisi, atau dibuat sekali secara otomatis dan disimpan di tabel
 * `kv_singles` milik Supabase (kunci "app/session-secret") supaya tetap sama walau server
 * dimulai ulang atau berpindah mesin, tanpa perlu disk lokal yang persisten.
 */
let cachedSecret = null;

export async function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (cachedSecret) return cachedSecret;

  const { SingleFile } = await import('./services/store.js');
  const store = new SingleFile('app/session-secret', null);
  const existing = await store.read();
  if (existing?.secret) {
    cachedSecret = existing.secret;
    return cachedSecret;
  }
  const secret = crypto.randomBytes(48).toString('base64url');
  await store.write({ secret });
  cachedSecret = secret;
  return secret;
}
