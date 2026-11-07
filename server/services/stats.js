import { SingleFile } from './store.js';
import { config } from '../config.js';

const file = new SingleFile('stats/counters.json', { articles: {}, daily: {} });
const DEDUPE_MS = 30 * 60 * 1000;
const FLUSH_MS = 15_000;
const FLUSH_DUE_MS = 5_000;
const REFRESH_MS = 30_000;

/** `data` = salinan terakhir dari database; `pending` = tambahan yang belum disimpan. Penyimpanan
 * menggabungkan tambahan ke dokumen di database (bukan menimpanya), jadi beberapa instance serverless
 * tidak saling menghapus hitungan. */
let data = { articles: {}, daily: {} };
const emptyPending = () => ({ articles: {}, daily: {}, removed: new Set() });
let pending = emptyPending();
let hasPending = false;
let lastFlush = 0;
let lastRefresh = 0;
let timer = null;
const recent = new Map();

const dateFormatter = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

function today() {
  return dateFormatter().format(new Date());
}

const pendingArticle = (id) => (pending.articles[id] ??= { views: 0, likes: 0 });
const pendingDay = (day = today()) => (pending.daily[day] ??= { hits: 0, views: 0 });

export async function initStats() {
  data = await file.read();
  data.articles ??= {};
  data.daily ??= {};
  lastRefresh = Date.now();
  if (!timer) {
    timer = setInterval(() => flush().catch((err) => console.error('[stats] gagal menyimpan:', err.message)), FLUSH_MS);
    timer.unref();
  }
}

function mergePendingBack(batch) {
  for (const id of batch.removed) pending.removed.add(id);
  for (const [id, d] of Object.entries(batch.articles)) {
    const e = pendingArticle(id);
    e.views += d.views;
    e.likes += d.likes;
  }
  for (const [day, d] of Object.entries(batch.daily)) {
    const e = pendingDay(day);
    e.hits += d.hits;
    e.views += d.views;
  }
  hasPending = true;
}

export async function flush() {
  if (!hasPending) return;
  const batch = pending;
  pending = emptyPending();
  hasPending = false;
  try {
    data = await file.mutate((doc) => {
      doc.articles ??= {};
      doc.daily ??= {};
      for (const id of batch.removed) delete doc.articles[id];
      for (const [id, d] of Object.entries(batch.articles)) {
        const e = (doc.articles[id] ??= { views: 0, likes: 0 });
        e.views = Math.max(0, (e.views ?? 0) + d.views);
        e.likes = Math.max(0, (e.likes ?? 0) + d.likes);
      }
      for (const [day, d] of Object.entries(batch.daily)) {
        const e = (doc.daily[day] ??= { hits: 0, views: 0 });
        e.hits = (e.hits ?? 0) + d.hits;
        e.views = (e.views ?? 0) + d.views;
      }
      const days = Object.keys(doc.daily).sort();
      for (const key of days.slice(0, Math.max(0, days.length - 400))) delete doc.daily[key];
      return doc;
    });
    lastFlush = lastRefresh = Date.now();
  } catch (err) {
    mergePendingBack(batch);
    throw err;
  }
}

/** Dipanggil di awal request: simpan tambahan yang tertunda dan sesekali segarkan angka dari database. */
export async function flushDue() {
  const now = Date.now();
  if (hasPending && now - lastFlush > FLUSH_DUE_MS) {
    await flush();
  } else if (!hasPending && now - lastRefresh > REFRESH_MS) {
    lastRefresh = now;
    const fresh = await file.read();
    fresh.articles ??= {};
    fresh.daily ??= {};
    data = fresh;
  }
}

function prune() {
  const now = Date.now();
  if (recent.size > 5000) {
    for (const [key, at] of recent) if (now - at > DEDUPE_MS) recent.delete(key);
  }
}

export function getCounts(id) {
  const base = data.articles[id];
  const extra = pending.articles[id];
  return {
    views: Math.max(0, (base?.views ?? 0) + (extra?.views ?? 0)),
    likes: Math.max(0, (base?.likes ?? 0) + (extra?.likes ?? 0)),
  };
}

/** Menghitung tampilan artikel sekali per pengunjung (fingerprint) dalam 30 menit. */
export function recordView(articleId, fingerprint) {
  const key = `${articleId}:${fingerprint}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return false;
  recent.set(key, now);
  pendingArticle(articleId).views += 1;
  pendingDay().views += 1;
  hasPending = true;
  prune();
  return true;
}

export function recordHit() {
  pendingDay().hits += 1;
  hasPending = true;
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
  if (liked !== wasLiked) {
    const delta = liked ? 1 : -1;
    if (getCounts(articleId).likes + delta >= 0) {
      pendingArticle(articleId).likes += delta;
      hasPending = true;
    }
  }
  likeState.set(key, { liked, at: now });
  if (likeState.size > 5000) {
    for (const [k, v] of likeState) if (now - v.at > LIKE_TTL_MS) likeState.delete(k);
  }
  return getCounts(articleId).likes;
}

export function removeArticleStats(articleId) {
  if (data.articles[articleId] || pending.articles[articleId]) {
    delete data.articles[articleId];
    delete pending.articles[articleId];
    pending.removed.add(articleId);
    hasPending = true;
  }
}

export function totalViews() {
  const ids = new Set([...Object.keys(data.articles), ...Object.keys(pending.articles)]);
  let sum = 0;
  for (const id of ids) sum += getCounts(id).views;
  return sum;
}

export function dailySeries(days = 14) {
  const formatter = dateFormatter();
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = formatter.format(new Date(Date.now() - i * 86_400_000));
    const base = data.daily[date];
    const extra = pending.daily[date];
    series.push({ date, hits: (base?.hits ?? 0) + (extra?.hits ?? 0), views: (base?.views ?? 0) + (extra?.views ?? 0) });
  }
  return series;
}
