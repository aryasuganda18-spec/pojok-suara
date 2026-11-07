import { SingleFile } from './store.js';
import { config } from '../config.js';

const file = new SingleFile('stats/counters.json', { articles: {}, daily: {} });
const DEDUPE_MS = 30 * 60 * 1000;
const FLUSH_MS = 15_000;

let data = { articles: {}, daily: {} };
let dirty = false;
let timer = null;
const recent = new Map();

const dateFormatter = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

function today() {
  return dateFormatter().format(new Date());
}

export async function initStats() {
  data = await file.read();
  data.articles ??= {};
  data.daily ??= {};
  if (!timer) {
    timer = setInterval(() => flush().catch((err) => console.error('[stats] gagal menyimpan:', err.message)), FLUSH_MS);
    timer.unref();
  }
}

export async function flush() {
  if (!dirty) return;
  dirty = false;
  try {
    await file.write(data);
  } catch (err) {
    dirty = true;
    throw err;
  }
}

function daily(day = today()) {
  data.daily[day] ??= { hits: 0, views: 0 };
  return data.daily[day];
}

function prune() {
  const keys = Object.keys(data.daily).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - 400))) delete data.daily[key];
  const now = Date.now();
  if (recent.size > 5000) {
    for (const [key, at] of recent) if (now - at > DEDUPE_MS) recent.delete(key);
  }
}

export function getCounts(id) {
  const entry = data.articles[id];
  return { views: entry?.views ?? 0, likes: entry?.likes ?? 0 };
}

/** Menghitung tampilan artikel sekali per pengunjung (fingerprint) dalam 30 menit. */
export function recordView(articleId, fingerprint) {
  const key = `${articleId}:${fingerprint}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return false;
  recent.set(key, now);
  data.articles[articleId] ??= { views: 0, likes: 0 };
  data.articles[articleId].views += 1;
  daily().views += 1;
  dirty = true;
  prune();
  return true;
}

export function recordHit() {
  daily().hits += 1;
  dirty = true;
}

const likeState = new Map();
const LIKE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Mengatur status "suka" satu pengunjung. Jumlah hanya berubah jika status pengunjung berubah,
 * sehingga menekan tombol berulang kali tidak menggelembungkan angka.
 */
export function setLike(articleId, fingerprint, liked) {
  const key = `${articleId}:${fingerprint}`;
  const now = Date.now();
  const previous = likeState.get(key);
  const wasLiked = previous && now - previous.at < LIKE_TTL_MS ? previous.liked : false;
  data.articles[articleId] ??= { views: 0, likes: 0 };
  const entry = data.articles[articleId];
  if (liked !== wasLiked) {
    entry.likes = Math.max(0, entry.likes + (liked ? 1 : -1));
    dirty = true;
  }
  likeState.set(key, { liked, at: now });
  if (likeState.size > 5000) {
    for (const [k, v] of likeState) if (now - v.at > LIKE_TTL_MS) likeState.delete(k);
  }
  return entry.likes;
}

export function removeArticleStats(articleId) {
  if (data.articles[articleId]) {
    delete data.articles[articleId];
    dirty = true;
  }
}

export function totalViews() {
  return Object.values(data.articles).reduce((sum, a) => sum + (a.views ?? 0), 0);
}

export function dailySeries(days = 14) {
  const formatter = dateFormatter();
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = formatter.format(new Date(Date.now() - i * 86_400_000));
    const entry = data.daily[date] ?? { hits: 0, views: 0 };
    series.push({ date, hits: entry.hits, views: entry.views });
  }
  return series;
}
