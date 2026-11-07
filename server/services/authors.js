import { z } from 'zod';
import { Collection } from './store.js';
import { emitTaxonomyChange } from './events.js';
import { imageObject } from './media.js';
import { HttpError, parse } from '../utils/http.js';
import { cleanMultiline, cleanText, slugify } from '../utils/text.js';

const social = z.object({
  website: z.string().max(300),
  x: z.string().max(100),
  instagram: z.string().max(100),
  facebook: z.string().max(100),
  linkedin: z.string().max(100),
});

const schema = z.looseObject({
  id: z.string(),
  user_id: z.string().nullable(),
  name: z.string().min(1).max(80),
  username: z.string().min(2).max(40),
  avatar_id: z.string().nullable(),
  bio: z.string().max(600),
  email: z.string().max(200),
  show_email: z.boolean(),
  social,
  fields: z.array(z.string().max(40)).max(8),
  demo: z.boolean(),
  joined_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const optionalHandle = z.string().trim().max(100);
const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  avatar_id: z.string().max(64).nullable(),
  bio: z.string().trim().max(600),
  email: z.union([z.literal(''), z.email()]),
  show_email: z.boolean(),
  social: z.object({
    website: z.string().trim().max(300).refine((v) => v === '' || /^https?:\/\//i.test(v), 'harus diawali http:// atau https://'),
    x: optionalHandle,
    instagram: optionalHandle,
    facebook: optionalHandle,
    linkedin: optionalHandle,
  }).partial(),
  fields: z.array(z.string().trim().max(40)).max(8),
}).partial();

const collection = new Collection('authors', { schema });
let cache = [];

export async function initAuthors() {
  await collection.ensure();
  cache = await collection.list();
}

async function refresh() {
  cache = await collection.list();
  emitTaxonomyChange();
}

export const listAuthors = () => cache;
export const getAuthor = (id) => cache.find((a) => a.id === id) ?? null;
export const getAuthorByUsername = (username) => cache.find((a) => a.username === username) ?? null;

function uniqueUsername(base, exceptId) {
  const root = slugify(base, 30).replace(/-/g, '') || 'penulis';
  let candidate = root;
  for (let i = 2; cache.some((a) => a.username === candidate && a.id !== exceptId); i += 1) {
    candidate = `${root}${i}`;
  }
  return candidate;
}

export async function createAuthor({ userId = null, name, username, email = '', bio = '', fields = [], demo = false, avatarId = null, joinedAt }) {
  const author = await collection.create({
    user_id: userId,
    name: cleanText(name, 80),
    username: uniqueUsername(username || name),
    avatar_id: avatarId,
    bio: cleanMultiline(bio, 600),
    email,
    show_email: false,
    social: { website: '', x: '', instagram: '', facebook: '', linkedin: '' },
    fields: fields.map((f) => cleanText(f, 40)).filter(Boolean),
    demo,
    joined_at: joinedAt ?? new Date().toISOString(),
  });
  await refresh();
  return author;
}

export async function updateAuthor(id, body) {
  if (!getAuthor(id)) throw new HttpError(404, 'Penulis tidak ditemukan');
  const data = parse(profileInput, body);
  const author = await collection.update(id, (doc) => {
    if (data.name !== undefined) doc.name = cleanText(data.name, 80);
    if (data.avatar_id !== undefined) doc.avatar_id = data.avatar_id;
    if (data.bio !== undefined) doc.bio = cleanMultiline(data.bio, 600);
    if (data.email !== undefined) doc.email = data.email;
    if (data.show_email !== undefined) doc.show_email = data.show_email;
    if (data.fields !== undefined) doc.fields = data.fields.map((f) => cleanText(f, 40)).filter(Boolean);
    if (data.social) {
      for (const [key, value] of Object.entries(data.social)) doc.social[key] = cleanText(value, 300);
    }
  });
  await refresh();
  return author;
}

export async function detachUser(userId) {
  const author = cache.find((a) => a.user_id === userId);
  if (!author) return;
  await collection.update(author.id, (doc) => {
    doc.user_id = null;
  });
  await refresh();
}

export async function removeAuthor(id) {
  await collection.remove(id);
  await refresh();
}

/** Bentuk publik: email hanya tampil bila penulis mengizinkan. */
export function publicAuthor(author, articleCount = 0) {
  if (!author) return null;
  return {
    id: author.id,
    name: author.name,
    username: author.username,
    bio: author.bio,
    avatar: author.avatar_id ? imageObject(author.avatar_id, { alt: author.name }) : null,
    social: author.social,
    fields: author.fields,
    email: author.show_email ? author.email : '',
    joined_at: author.joined_at,
    article_count: articleCount,
  };
}
