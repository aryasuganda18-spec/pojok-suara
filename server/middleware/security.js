import { randomBytes } from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { isMaintenance } from '../services/backup.js';

export function cspNonce(_req, res, next) {
  res.locals.cspNonce = randomBytes(16).toString('base64');
  next();
}

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

const disabledForTests = () => process.env.RATE_LIMIT_DISABLED === 'true' && !config.isProd;

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: disabledForTests,
    message: { error: message },
  });
}

export const apiLimiter = limiter(60_000, 400, 'Terlalu banyak permintaan. Coba lagi sebentar lagi.');
export const loginLimiter = limiter(15 * 60_000, 10, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
export const commentLimiter = limiter(10 * 60_000, 5, 'Terlalu banyak komentar. Coba lagi beberapa menit lagi.');
export const newsletterLimiter = limiter(60 * 60_000, 5, 'Terlalu banyak percobaan berlangganan. Coba lagi nanti.');
export const submissionLimiter = limiter(60 * 60_000, 3, 'Batas kiriman tulisan per jam tercapai. Coba lagi nanti.');
export const interactionLimiter = limiter(60_000, 90, 'Terlalu banyak permintaan.');

/** Menolak permintaan tulis dari situs lain. Browser selalu menyertakan Origin pada POST/PUT/PATCH/DELETE lintas situs. */
export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let allowed = false;
    try {
      const host = new URL(origin).host;
      allowed = host === req.get('host') || (config.siteUrl && host === new URL(config.siteUrl).host);
    } catch {
      allowed = false;
    }
    if (!allowed) return res.status(403).json({ error: 'Permintaan ditolak (asal tidak dikenal)' });
  } else if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Permintaan ditolak (lintas situs)' });
  }
  next();
}

export function maintenanceGuard(req, res, next) {
  if (isMaintenance() && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(503).json({ error: 'Situs sedang dalam pemeliharaan (backup/restore). Coba lagi sebentar lagi.' });
  }
  next();
}
