import sharp from 'sharp';

/**
 * Catatan penting: sejak penyimpanan dipindah ke Supabase, tes ini TIDAK LAGI bisa berjalan
 * dengan storage sementara di disk. Tes akan benar-benar membaca dan menulis ke project
 * Supabase yang diisi lewat SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY di file .env — dan akan
 * MENGOSONGKAN tabel kv_documents, kv_singles, activity_log, dan sessions sebelum dan sesudah
 * berjalan. JANGAN jalankan `npm test` terhadap project Supabase yang sudah berisi data nyata;
 * gunakan project Supabase terpisah khusus untuk pengujian.
 */
export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function setupEnv() {
  Object.assign(process.env, {
    UPLOAD_TMP_DIR: process.env.UPLOAD_TMP_DIR || './uploads/tmp',
    RATE_LIMIT_DISABLED: 'true',
    BACKUP_AUTO: 'false',
    NODE_ENV: 'test',
  });
  if (!hasSupabaseConfig()) return;
  const { supabase } = await import('../server/db/supabase.js');
  const client = supabase();
  for (const table of ['kv_documents', 'kv_singles', 'activity_log']) {
    const { error } = await client.rpc('restore_table_json', { target_table: table, rows_json: [] });
    if (error) throw new Error(`Gagal mengosongkan tabel ${table} sebelum tes: ${error.message}`);
  }
  await client.from('sessions').delete().neq('sid', '__never_matches__');
}

export async function startApp() {
  const { createApp } = await import('../server/index.js');
  const app = await createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
    this.csrf = '';
  }

  async request(method, url, { json, form, headers = {} } = {}) {
    const init = { method, headers: { ...headers }, redirect: 'manual' };
    if (this.cookie) init.headers.cookie = this.cookie;
    if (this.csrf && method !== 'GET') init.headers['x-csrf-token'] = this.csrf;
    if (json !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(json);
    }
    if (form) init.body = form;
    const res = await fetch(this.base + url, init);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) this.cookie = c.split(';')[0];
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body, headers: res.headers };
  }

  get(url) {
    return this.request('GET', url);
  }
  post(url, json) {
    return this.request('POST', url, { json });
  }
  put(url, json) {
    return this.request('PUT', url, { json });
  }
  delete(url) {
    return this.request('DELETE', url);
  }

  async refreshSession() {
    const { body } = await this.get('/api/auth/session');
    this.csrf = body.csrf;
    return body;
  }

  async login(identifier, password) {
    await this.refreshSession();
    const res = await this.post('/api/auth/login', { identifier, password });
    if (res.status === 200) this.csrf = res.body.csrf;
    return res;
  }
}

export async function pngBuffer(color = '#d94a35') {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: color } }).png().toBuffer();
}

export function uploadForm(buffer, filename, type) {
  const form = new FormData();
  form.append('files', new Blob([buffer], { type }), filename);
  return form;
}
