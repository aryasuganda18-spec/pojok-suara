import { randomUUID } from 'node:crypto';
import { supabase, assertNoError } from '../db/supabase.js';

/**
 * Sinkronisasi cache antar-instance. Di Vercel beberapa instance fungsi berjalan bersamaan dan masing-masing
 * menyimpan salinan artikel/kategori/media/dst. di memori. Setiap penulisan ke database menaikkan "versi"
 * (satu baris kecil di kv_singles); setiap request membandingkan versi itu dengan versi yang terakhir
 * dimuat instance ini dan memuat ulang cache bila berbeda.
 */
const KEYS = { core: 'app/version/core', comments: 'app/version/comments' };
const local = {};
const reloaders = {};
let inflight = null;

async function readRemote() {
  const { data, error } = await supabase().from('kv_singles').select('key, data').in('key', Object.values(KEYS));
  assertNoError(error, 'sync.read');
  const out = {};
  for (const scope of Object.keys(KEYS)) out[scope] = data?.find((row) => row.key === KEYS[scope])?.data?.v ?? null;
  return out;
}

export function registerReloader(scope, fn) {
  reloaders[scope] = fn;
}

/** Dipanggil SEBELUM cache dimuat, supaya perubahan yang terjadi saat memuat tidak terlewat. */
export async function initVersions() {
  Object.assign(local, await readRemote());
}

export async function markChanged(scope = 'core') {
  try {
    const before = (await readRemote())[scope];
    const v = randomUUID();
    const { error } = await supabase().from('kv_singles').upsert({ key: KEYS[scope], data: { v } }, { onConflict: 'key' });
    assertNoError(error, 'sync.mark');
    // Bila tak ada orang lain yang menulis sejak instance ini terakhir sinkron, cache lokal sudah terbaru.
    if (before === local[scope]) local[scope] = v;
  } catch (err) {
    console.error('[sync] gagal menandai perubahan:', err.message);
  }
}

export function ensureFresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    const remote = await readRemote();
    for (const scope of Object.keys(KEYS)) {
      if (remote[scope] !== local[scope] && reloaders[scope]) {
        await reloaders[scope]();
        local[scope] = remote[scope];
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
