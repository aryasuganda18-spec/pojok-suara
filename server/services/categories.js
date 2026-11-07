import { z } from 'zod';
import { Collection } from './store.js';
import { DEFAULT_CATEGORIES } from './defaults.js';
import { emitTaxonomyChange } from './events.js';
import { HttpError, parse } from '../utils/http.js';
import { cleanText, slugify } from '../utils/text.js';

const schema = z.looseObject({
  id: z.string(),
  name: z.string().min(1).max(60),
  slug: z.string().min(1).max(80),
  description: z.string().max(300),
  order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

const input = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300).optional(),
  order: z.number().int().min(0).max(9999).optional(),
});

const collection = new Collection('categories', { schema });
let cache = [];

const sorted = (list) => [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'id'));

export async function initCategories() {
  await collection.ensure();
  let list = await collection.list();
  if (list.length === 0) {
    for (const [index, [name, description]] of DEFAULT_CATEGORIES.entries()) {
      await collection.create({ name, slug: slugify(name), description, order: index });
    }
    list = await collection.list();
  }
  cache = sorted(list);
}

export const listCategories = () => cache;
export const getCategory = (id) => cache.find((c) => c.id === id) ?? null;
export const getCategoryBySlug = (slug) => cache.find((c) => c.slug === slug) ?? null;

async function refresh() {
  cache = sorted(await collection.list());
  emitTaxonomyChange();
}

function ensureUniqueSlug(slug, exceptId) {
  if (cache.some((c) => c.slug === slug && c.id !== exceptId)) {
    throw new HttpError(409, `Slug "${slug}" sudah dipakai kategori lain`);
  }
}

export async function createCategory(body) {
  const data = parse(input, body);
  const slug = slugify(data.slug || data.name);
  ensureUniqueSlug(slug);
  const category = await collection.create({
    name: cleanText(data.name, 60),
    slug,
    description: cleanText(data.description ?? '', 300),
    order: data.order ?? cache.length,
  });
  await refresh();
  return category;
}

export async function updateCategory(id, body) {
  const data = parse(input.partial(), body);
  if (!getCategory(id)) throw new HttpError(404, 'Kategori tidak ditemukan');
  const slug = data.slug !== undefined ? slugify(data.slug || data.name || '') : undefined;
  if (slug) ensureUniqueSlug(slug, id);
  const category = await collection.update(id, (doc) => {
    if (data.name !== undefined) doc.name = cleanText(data.name, 60);
    if (slug) doc.slug = slug;
    if (data.description !== undefined) doc.description = cleanText(data.description, 300);
    if (data.order !== undefined) doc.order = data.order;
  });
  await refresh();
  return category;
}

export async function reorderCategories(ids) {
  const known = new Set(cache.map((c) => c.id));
  const valid = ids.filter((id) => known.has(id));
  for (const [index, id] of valid.entries()) {
    await collection.update(id, (doc) => {
      doc.order = index;
    });
  }
  await refresh();
  return cache;
}

export async function deleteCategory(id) {
  if (!getCategory(id)) throw new HttpError(404, 'Kategori tidak ditemukan');
  await collection.remove(id);
  await refresh();
}
