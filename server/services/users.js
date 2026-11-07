import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Collection } from './store.js';
import { createAuthor, detachUser, getAuthor, updateAuthor } from './authors.js';
import { ROLES } from './roles.js';
import { HttpError, parse } from '../utils/http.js';
import { cleanText, isoNow } from '../utils/text.js';

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const schema = z.looseObject({
  id: z.string(),
  username: z.string().min(3).max(30),
  email: z.string().max(200),
  name: z.string().min(1).max(80),
  role: z.enum(ROLES),
  password_hash: z.string().min(20),
  author_id: z.string().nullable(),
  active: z.boolean(),
  failed_attempts: z.number().int(),
  locked_until: z.string().nullable(),
  must_change_password: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const collection = new Collection('users', { schema });
const DUMMY_HASH = bcrypt.hashSync('kata-sandi-palsu-untuk-menyamakan-waktu', BCRYPT_COST);

export const passwordSchema = z
  .string()
  .min(10, 'minimal 10 karakter')
  .max(128, 'maksimal 128 karakter')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'harus mengandung huruf dan angka');

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9._-]+$/, 'hanya huruf kecil, angka, titik, garis bawah, dan tanda hubung');

const createInput = z.object({
  username: usernameSchema,
  email: z.email().max(200),
  name: z.string().trim().min(2).max(80),
  role: z.enum(ROLES),
  password: passwordSchema,
});

const updateInput = z.object({
  email: z.email().max(200),
  name: z.string().trim().min(2).max(80),
  role: z.enum(ROLES),
  active: z.boolean(),
  password: passwordSchema,
}).partial();

export const initUsers = () => collection.ensure();
export const listUsers = () => collection.list();
export const getUser = (id) => collection.get(id);

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, failed_attempts, locked_until, ...safe } = user;
  return safe;
}

async function assertUnique({ username, email }, exceptId) {
  const all = await collection.list();
  if (username && all.some((u) => u.username === username && u.id !== exceptId)) {
    throw new HttpError(409, 'Username sudah dipakai');
  }
  if (email && all.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== exceptId)) {
    throw new HttpError(409, 'Email sudah dipakai');
  }
}

export async function createUser(body, { mustChangePassword = true } = {}) {
  const data = parse(createInput, body);
  await assertUnique(data);
  const password_hash = await bcrypt.hash(data.password, BCRYPT_COST);
  const user = await collection.create({
    username: data.username,
    email: data.email.toLowerCase(),
    name: cleanText(data.name, 80),
    role: data.role,
    password_hash,
    author_id: null,
    active: true,
    failed_attempts: 0,
    locked_until: null,
    must_change_password: mustChangePassword,
    last_login_at: null,
  });
  const author = await createAuthor({ userId: user.id, name: user.name, username: user.username, email: user.email });
  return collection.update(user.id, (doc) => {
    doc.author_id = author.id;
  });
}

export async function updateUser(id, body, actor) {
  const data = parse(updateInput, body);
  const current = await collection.get(id);
  if (!current) throw new HttpError(404, 'Pengguna tidak ditemukan');
  if (data.email) await assertUnique({ email: data.email }, id);

  const demotingAdmin = current.role === 'super_admin' && ((data.role && data.role !== 'super_admin') || data.active === false);
  if (demotingAdmin) await assertAnotherSuperAdmin(id);
  if (id === actor.id && (data.active === false || (data.role && data.role !== current.role))) {
    throw new HttpError(400, 'Anda tidak dapat menonaktifkan atau mengubah peran akun Anda sendiri');
  }

  const passwordHash = data.password ? await bcrypt.hash(data.password, BCRYPT_COST) : null;
  const updated = await collection.update(id, (doc) => {
    if (data.email) doc.email = data.email.toLowerCase();
    if (data.name) doc.name = cleanText(data.name, 80);
    if (data.role) doc.role = data.role;
    if (data.active !== undefined) doc.active = data.active;
    if (passwordHash) {
      doc.password_hash = passwordHash;
      doc.must_change_password = true;
      doc.failed_attempts = 0;
      doc.locked_until = null;
    }
  });
  if (updated.author_id && getAuthor(updated.author_id) && (data.name || data.email)) {
    await updateAuthor(updated.author_id, { ...(data.name && { name: updated.name }), ...(data.email && { email: updated.email }) });
  }
  return updated;
}

async function assertAnotherSuperAdmin(exceptId) {
  const all = await collection.list();
  if (!all.some((u) => u.role === 'super_admin' && u.active && u.id !== exceptId)) {
    throw new HttpError(400, 'Harus tersisa minimal satu Super Admin aktif');
  }
}

export async function deleteUser(id, actor) {
  const user = await collection.get(id);
  if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan');
  if (id === actor.id) throw new HttpError(400, 'Anda tidak dapat menghapus akun Anda sendiri');
  if (user.role === 'super_admin') await assertAnotherSuperAdmin(id);
  await collection.remove(id);
  await detachUser(id);
  return user;
}

export async function authenticate(identifier, password) {
  const needle = cleanText(identifier, 120).toLowerCase();
  const all = await collection.list();
  const user = all.find((u) => u.username === needle || u.email.toLowerCase() === needle);
  const invalid = new HttpError(401, 'Username/email atau kata sandi salah');

  if (!user) {
    await bcrypt.compare(String(password), DUMMY_HASH);
    throw invalid;
  }

  if (user.locked_until && Date.parse(user.locked_until) > Date.now()) {
    const minutes = Math.ceil((Date.parse(user.locked_until) - Date.now()) / 60000);
    throw new HttpError(429, `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`);
  }

  const matches = await bcrypt.compare(String(password), user.password_hash);
  if (!matches || !user.active) {
    if (!matches) {
      await collection.update(user.id, (doc) => {
        doc.failed_attempts += 1;
        if (doc.failed_attempts >= MAX_FAILED_ATTEMPTS) {
          doc.failed_attempts = 0;
          doc.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
        }
      });
    }
    throw invalid;
  }

  return collection.update(user.id, (doc) => {
    doc.failed_attempts = 0;
    doc.locked_until = null;
    doc.last_login_at = isoNow();
  });
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await collection.get(userId);
  if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan');
  const next = parse(passwordSchema, newPassword);
  if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
    throw new HttpError(400, 'Kata sandi saat ini salah');
  }
  const password_hash = await bcrypt.hash(next, BCRYPT_COST);
  return collection.update(userId, (doc) => {
    doc.password_hash = password_hash;
    doc.must_change_password = false;
  });
}
