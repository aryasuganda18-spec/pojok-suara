import { randomBytes, timingSafeEqual } from 'node:crypto';
import { can } from '../services/roles.js';
import { getUser } from '../services/users.js';

/** Memuat pengguna dari sesi. Akun yang dihapus atau dinonaktifkan langsung kehilangan akses. */
export async function loadUser(req, _res, next) {
  try {
    const userId = req.session?.userId;
    if (userId) {
      const user = await getUser(userId);
      if (user?.active) req.user = user;
      else await new Promise((resolve) => req.session.destroy(resolve));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
  next();
}

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu' });
  if (!can(req.user, permission)) return res.status(403).json({ error: 'Anda tidak memiliki izin untuk tindakan ini' });
  next();
};

export function csrfToken(req) {
  req.session.csrf ??= randomBytes(24).toString('base64url');
  return req.session.csrf;
}

/** Perlindungan CSRF: setiap permintaan tulis wajib membawa token yang sama dengan token di sesi. */
export function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = Buffer.from(String(req.get('x-csrf-token') ?? ''));
  const expected = Buffer.from(String(req.session?.csrf ?? ''));
  if (expected.length === 0 || sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
    return res.status(403).json({ error: 'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.' });
  }
  next();
}
