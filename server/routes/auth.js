import { Router } from 'express';
import { z } from 'zod';
import { csrfToken, requireAuth, verifyCsrf } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/security.js';
import { logActivity } from '../services/logger.js';
import { ROLE_LABELS, permissionsFor } from '../services/roles.js';
import { authenticate, changePassword, publicUser } from '../services/users.js';
import { parse } from '../utils/http.js';

export const authRouter = Router();

const SESSION_USER_FIELDS = (user) => ({
  ...publicUser(user),
  role_label: ROLE_LABELS[user.role],
  permissions: permissionsFor(user),
});

const regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const destroy = (req) => new Promise((resolve) => req.session.destroy(resolve));

authRouter.get('/session', (req, res) => {
  res.json({ user: req.user ? SESSION_USER_FIELDS(req.user) : null, csrf: csrfToken(req) });
});

authRouter.post('/login', loginLimiter, verifyCsrf, async (req, res) => {
  const { identifier, password } = parse(z.object({ identifier: z.string().min(1).max(120), password: z.string().min(1).max(200) }), req.body);
  try {
    const user = await authenticate(identifier, password);
    await regenerate(req);
    req.session.userId = user.id;
    const token = csrfToken(req);
    await logActivity({ user, action: 'auth.login', ip: req.ip });
    res.json({ user: SESSION_USER_FIELDS(user), csrf: token });
  } catch (err) {
    await logActivity({ action: 'auth.login_failed', detail: String(identifier).slice(0, 60), ip: req.ip });
    throw err;
  }
});

authRouter.post('/logout', verifyCsrf, async (req, res) => {
  if (req.user) await logActivity({ user: req.user, action: 'auth.logout', ip: req.ip });
  await destroy(req);
  res.clearCookie('ps.sid');
  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, verifyCsrf, async (req, res) => {
  const { current, next } = parse(z.object({ current: z.string().min(1).max(200), next: z.string().max(200) }), req.body);
  const user = await changePassword(req.user.id, current, next);
  await logActivity({ user, action: 'auth.change_password', ip: req.ip });
  res.json({ user: SESSION_USER_FIELDS(user) });
});
