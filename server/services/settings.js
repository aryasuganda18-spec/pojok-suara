import { z } from 'zod';
import { supabase, assertNoError } from '../db/supabase.js';
import { SingleFile } from './store.js';
import { DEFAULT_PAGES, DEFAULT_SETTINGS } from './defaults.js';
import { parse } from '../utils/http.js';
import { sanitizeArticleHtml } from '../utils/sanitize.js';
import { cleanText, isoNow } from '../utils/text.js';

const optionalUrl = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^(https?:\/\/|\/)/i.test(v), 'harus diawali http://, https://, atau /');
const linkSchema = z.object({ label: z.string().trim().min(1).max(40), href: optionalUrl.min(1) });
const nullableId = z.string().max(64).nullable();

const settingsSchema = z.object({
  site_name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
  description: z.string().trim().max(400),
  logo_id: nullableId,
  favicon_id: nullableId,
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'harus berupa warna heksadesimal, contoh #D94A35'),
    default_mode: z.enum(['light', 'dark', 'system']),
  }),
  nav: z.array(linkSchema).max(12),
  footer: z.object({
    about: z.string().trim().max(600),
    copyright: z.string().trim().max(200),
    links: z.array(linkSchema).max(12),
  }),
  social: z.object({ facebook: optionalUrl, instagram: optionalUrl, x: optionalUrl, youtube: optionalUrl, tiktok: optionalUrl }),
  email_redaksi: z.union([z.literal(''), z.email()]),
  seo: z.object({
    title_suffix: z.string().trim().max(80),
    description: z.string().trim().max(300),
    og_image_id: nullableId,
  }),
  home: z.object({
    hero_article_id: nullableId,
    editors_pick_ids: z.array(z.string().max(64)).max(8),
    per_page: z.number().int().min(4).max(48),
  }),
  breaking: z.object({ enabled: z.boolean(), text: z.string().trim().max(200), url: optionalUrl }),
  comments: z.object({ enabled: z.boolean(), moderation: z.enum(['manual', 'auto']) }),
  newsletter_enabled: z.boolean(),
  submissions_enabled: z.boolean(),
});

const settingsFile = new SingleFile('settings/site.json', DEFAULT_SETTINGS);
const pagesFile = new SingleFile('settings/pages.json', { pages: {} });

let cache = structuredClone(DEFAULT_SETTINGS);

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    out[key] = isPlain(value) && isPlain(base?.[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

export async function initSettings() {
  const { data: existingRow, error } = await supabase().from('kv_singles').select('key').eq('key', settingsFile.key).maybeSingle();
  assertNoError(error, 'settings.initSettings');
  const stored = await settingsFile.read();
  cache = parse(settingsSchema, deepMerge(DEFAULT_SETTINGS, stored));
  if (!existingRow) await settingsFile.write(cache);

  const pages = await pagesFile.read();
  const missing = Object.keys(DEFAULT_PAGES).filter((slug) => !pages.pages?.[slug]);
  if (missing.length) {
    await pagesFile.mutate((data) => {
      data.pages ??= {};
      for (const slug of missing) {
        data.pages[slug] = { slug, ...DEFAULT_PAGES[slug], system: true, updated_at: isoNow() };
      }
    });
  }
}

export const getSettings = () => cache;

export async function updateSettings(patch) {
  const next = parse(settingsSchema, deepMerge(cache, patch));
  next.site_name = cleanText(next.site_name, 80);
  await settingsFile.write(next);
  cache = next;
  return cache;
}

/** Dipakai saat artikel dihapus agar tidak ada rujukan yatim di pengaturan. */
export async function dropArticleReferences(articleId) {
  const { hero_article_id, editors_pick_ids } = cache.home;
  if (hero_article_id !== articleId && !editors_pick_ids.includes(articleId)) return;
  await updateSettings({
    home: {
      hero_article_id: hero_article_id === articleId ? null : hero_article_id,
      editors_pick_ids: editors_pick_ids.filter((id) => id !== articleId),
    },
  });
}

export async function setFeatured(articleId, { hero, pick }) {
  const home = { ...cache.home };
  if (hero === true) home.hero_article_id = articleId;
  if (hero === false && home.hero_article_id === articleId) home.hero_article_id = null;
  if (pick === true && !home.editors_pick_ids.includes(articleId)) {
    home.editors_pick_ids = [...home.editors_pick_ids, articleId].slice(-8);
  }
  if (pick === false) home.editors_pick_ids = home.editors_pick_ids.filter((id) => id !== articleId);
  return updateSettings({ home });
}

const pageInput = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().max(200_000),
});

export async function listPages() {
  const data = await pagesFile.read();
  return Object.values(data.pages ?? {}).sort((a, b) => a.title.localeCompare(b.title, 'id'));
}

export async function getPage(slug) {
  const data = await pagesFile.read();
  return data.pages?.[slug] ?? null;
}

export async function updatePage(slug, input) {
  const { title, content } = parse(pageInput, input);
  let saved = null;
  await pagesFile.mutate((data) => {
    const current = data.pages?.[slug];
    if (!current) return null;
    saved = { ...current, title: cleanText(title, 120), content: sanitizeArticleHtml(content), updated_at: isoNow() };
    data.pages[slug] = saved;
  });
  return saved;
}
