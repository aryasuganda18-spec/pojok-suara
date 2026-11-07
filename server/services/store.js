import { randomUUID } from 'node:crypto';
import { supabase, assertNoError } from '../db/supabase.js';
import { HttpError } from '../utils/http.js';
import { isoNow } from '../utils/text.js';
import { markChanged } from './sync.js';

export const newId = () => randomUUID();

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/;
const isSafeId = (id) => typeof id === 'string' && ID_PATTERN.test(id);

/** Antrean per kunci: dipertahankan agar beberapa penyimpanan ke dokumen yang sama di dalam
 * satu proses Node berjalan berurutan, bukan tumpang tindih — sama seperti versi file lama.
 * Antrean ini hanya berlaku di dalam satu proses. Antar-instance (Vercel menjalankan banyak instance),
 * keamanan penulisan dijaga oleh update bersyarat + percobaan ulang di Collection.update dan SingleFile.mutate. */
const UPDATE_RETRIES = 6;
const VOLATILE_SINGLES = /^(stats\/|drafts\/|app\/)/;
const comments = (key) => key.startsWith('comments/');
const scopeOfSingle = (key) => (VOLATILE_SINGLES.test(key) ? null : comments(key) ? 'comments' : 'core');
// 'revisions' dan 'users' tidak di-cache di memori, jadi perubahannya tak perlu memicu muat ulang.
const scopeOfCollection = (folder) => (folder === 'revisions' || folder === 'users' ? null : 'core');
const changed = (scope) => (scope ? markChanged(scope) : undefined);

const tails = new Map();
export function withLock(key, fn) {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  tails.set(key, tail);
  tail.finally(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

/**
 * Koleksi dokumen: pengganti "satu folder berisi banyak file `<id>.json`" dari versi file-based,
 * sekarang disimpan sebagai baris-baris di tabel `kv_documents` dengan `collection = folder`.
 * API-nya sengaja dibuat identik dengan versi lama (get/list/create/update/replace/remove) supaya
 * seluruh server/services/articles.js, authors.js, categories.js, users.js, media.js tidak perlu
 * ditulis ulang.
 */
export class Collection {
  constructor(folder, { schema } = {}) {
    this.folder = folder;
    this.schema = schema;
  }

  async ensure() {
    // Tidak ada folder yang perlu dibuat di Postgres; dipertahankan agar pemanggil lama tetap jalan.
  }

  validate(doc) {
    return this.schema ? this.schema.parse(doc) : doc;
  }

  async get(id) {
    if (!isSafeId(id)) return null;
    const { data, error } = await supabase()
      .from('kv_documents')
      .select('data')
      .eq('collection', this.folder)
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, `${this.folder}.get`);
    return data?.data ?? null;
  }

  async list() {
    const out = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase()
        .from('kv_documents')
        .select('data')
        .eq('collection', this.folder)
        .range(from, from + PAGE - 1);
      assertNoError(error, `${this.folder}.list`);
      if (!data?.length) break;
      out.push(...data.map((row) => row.data));
      if (data.length < PAGE) break;
    }
    return out;
  }

  async create(data, { id = newId() } = {}) {
    const now = isoNow();
    const doc = this.validate({ ...data, id, created_at: data.created_at ?? now, updated_at: now });
    return withLock(`${this.folder}:${id}`, async () => {
      const { error } = await supabase()
        .from('kv_documents')
        .insert({ collection: this.folder, id, data: doc });
      assertNoError(error, `${this.folder}.create`);
      await changed(scopeOfCollection(this.folder));
      return doc;
    });
  }

  /** Membaca, mengubah lewat `mutate(doc)`, lalu menulis ulang di dalam kunci dokumen. */
  async update(id, mutate) {
    const key = `${this.folder}:${id}`;
    return withLock(key, async () => {
      for (let attempt = 0; attempt < UPDATE_RETRIES; attempt += 1) {
        const current = await this.get(id);
        if (!current) throw new HttpError(404, 'Data tidak ditemukan');
        const draft = structuredClone(current);
        const result = (await mutate(draft)) ?? draft;
        let stamp = isoNow();
        if (stamp === current.updated_at) stamp = new Date(Date.parse(stamp) + 1).toISOString();
        const next = this.validate({ ...result, id: current.id, created_at: current.created_at, updated_at: stamp });
        // Hanya menimpa bila dokumen belum diubah instance lain sejak dibaca; kalau sudah, baca ulang dan coba lagi.
        const { data: rows, error } = await supabase()
          .from('kv_documents')
          .update({ data: next })
          .eq('collection', this.folder)
          .eq('id', id)
          .eq('data->>updated_at', current.updated_at)
          .select('id');
        assertNoError(error, `${this.folder}.update`);
        if (rows?.length) {
          await changed(scopeOfCollection(this.folder));
          return next;
        }
      }
      throw new HttpError(409, 'Data sedang diubah dari tempat lain. Muat ulang halaman lalu coba lagi.');
    });
  }

  async replace(id, doc) {
    const key = `${this.folder}:${id}`;
    return withLock(key, async () => {
      const next = this.validate({ ...doc, id, updated_at: isoNow() });
      const { error } = await supabase()
        .from('kv_documents')
        .upsert({ collection: this.folder, id, data: next }, { onConflict: 'collection,id' });
      assertNoError(error, `${this.folder}.replace`);
      await changed(scopeOfCollection(this.folder));
      return next;
    });
  }

  async remove(id) {
    const key = `${this.folder}:${id}`;
    await withLock(key, async () => {
      const { error } = await supabase().from('kv_documents').delete().eq('collection', this.folder).eq('id', id);
      assertNoError(error, `${this.folder}.remove`);
      await changed(scopeOfCollection(this.folder));
    });
  }
}

/** Mendaftar semua kunci `kv_singles` yang diawali `prefix` (pengganti "daftar file dalam folder").
 * Dipakai mis. untuk mendaftar semua komentar per artikel (`comments/`) atau draft per pengguna. */
export async function listSingleKeys(prefix) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from('kv_singles')
      .select('key')
      .like('key', `${prefix}%`)
      .range(from, from + PAGE - 1);
    assertNoError(error, `singles.listKeys(${prefix})`);
    if (!data?.length) break;
    out.push(...data.map((row) => row.key));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function deleteSingle(key) {
  await withLock(key, async () => {
    const { error } = await supabase().from('kv_singles').delete().eq('key', key);
    assertNoError(error, `single(${key}).delete`);
    await changed(scopeOfSingle(key));
  });
}

/** Satu dokumen tunggal (pengaturan, daftar langganan, dst.), pengganti SingleFile berbasis file. */
export class SingleFile {
  constructor(key, defaults) {
    this.key = key;
    this.defaults = defaults;
  }

  async read() {
    const { data, error } = await supabase().from('kv_singles').select('data').eq('key', this.key).maybeSingle();
    assertNoError(error, `single(${this.key}).read`);
    return data?.data ?? structuredClone(this.defaults);
  }

  async write(data) {
    return withLock(this.key, async () => {
      const { error } = await supabase()
        .from('kv_singles')
        .upsert({ key: this.key, data }, { onConflict: 'key' });
      assertNoError(error, `single(${this.key}).write`);
      await changed(scopeOfSingle(this.key));
      return data;
    });
  }

  async mutate(fn) {
    return withLock(this.key, async () => {
      for (let attempt = 0; attempt < UPDATE_RETRIES; attempt += 1) {
        const { data: row, error: readError } = await supabase()
          .from('kv_singles')
          .select('data, updated_at')
          .eq('key', this.key)
          .maybeSingle();
        assertNoError(readError, `single(${this.key}).read`);
        const draft = structuredClone(row?.data ?? this.defaults);
        const next = (await fn(draft)) ?? draft;

        // Bersyarat: hanya menulis bila baris belum diubah instance lain sejak dibaca (atau belum ada).
        const query = row
          ? supabase().from('kv_singles').update({ data: next }).eq('key', this.key).eq('updated_at', row.updated_at).select('key')
          : supabase().from('kv_singles').upsert({ key: this.key, data: next }, { onConflict: 'key', ignoreDuplicates: true }).select('key');
        const { data: rows, error } = await query;
        assertNoError(error, `single(${this.key}).mutate`);
        if (rows?.length) {
          await changed(scopeOfSingle(this.key));
          return next;
        }
      }
      throw new HttpError(409, 'Data sedang diubah dari tempat lain. Muat ulang halaman lalu coba lagi.');
    });
  }
}
