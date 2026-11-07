import { randomUUID } from 'node:crypto';
import { supabase, assertNoError } from '../db/supabase.js';
import { HttpError } from '../utils/http.js';
import { isoNow } from '../utils/text.js';

export const newId = () => randomUUID();

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/;
const isSafeId = (id) => typeof id === 'string' && ID_PATTERN.test(id);

/** Antrean per kunci: dipertahankan agar beberapa penyimpanan ke dokumen yang sama di dalam
 * satu proses Node berjalan berurutan, bukan tumpang tindih — sama seperti versi file lama.
 * Ini bukan pengganti transaksi Postgres, hanya mencegah dua permintaan dari proses ini sendiri
 * saling menimpa; antar-proses (kalau nanti dijalankan lebih dari satu instance) tetap aman
 * karena setiap update artikel memakai expected_revision di level aplikasi. */
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
      return doc;
    });
  }

  /** Membaca, mengubah lewat `mutate(doc)`, lalu menulis ulang di dalam kunci dokumen. */
  async update(id, mutate) {
    const key = `${this.folder}:${id}`;
    return withLock(key, async () => {
      const current = await this.get(id);
      if (!current) throw new HttpError(404, 'Data tidak ditemukan');
      const draft = structuredClone(current);
      const result = (await mutate(draft)) ?? draft;
      const next = this.validate({ ...result, id: current.id, created_at: current.created_at, updated_at: isoNow() });
      const { error } = await supabase()
        .from('kv_documents')
        .update({ data: next })
        .eq('collection', this.folder)
        .eq('id', id);
      assertNoError(error, `${this.folder}.update`);
      return next;
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
      return next;
    });
  }

  async remove(id) {
    const key = `${this.folder}:${id}`;
    await withLock(key, async () => {
      const { error } = await supabase().from('kv_documents').delete().eq('collection', this.folder).eq('id', id);
      assertNoError(error, `${this.folder}.remove`);
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
      return data;
    });
  }

  async mutate(fn) {
    return withLock(this.key, async () => {
      const current = (await this.read());
      const next = (await fn(current)) ?? current;
      const { error } = await supabase()
        .from('kv_singles')
        .upsert({ key: this.key, data: next }, { onConflict: 'key' });
      assertNoError(error, `single(${this.key}).mutate`);
      return next;
    });
  }
}
