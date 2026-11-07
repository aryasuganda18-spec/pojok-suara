import http from 'node:http';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Client, hasSupabaseConfig, pngBuffer, setupEnv, startApp, uploadForm } from './helpers.js';

const ADMIN_PASSWORD = 'RahasiaUji2026x';
let server;
let base;
let admin;
const ids = {};

async function bootstrapAdmin() {
  const { bootServices } = await import('../server/services/boot.js');
  const { createUser } = await import('../server/services/users.js');
  await bootServices();
  await createUser({ username: 'admin', email: 'admin@example.test', name: 'Admin Uji', role: 'super_admin', password: ADMIN_PASSWORD }, { mustChangePassword: false });
}

if (!hasSupabaseConfig()) {
  console.warn(
    '\n[dilewati] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env, jadi tes ini tidak dijalankan.\n' +
      '           Tes ini membutuhkan project Supabase NYATA (gunakan project KHUSUS untuk tes, bukan project data asli,\n' +
      '           karena isi tabelnya akan dikosongkan). Isi .env lalu jalankan ulang "npm test".\n',
  );
  test('dilewati: Supabase belum dikonfigurasi', { skip: true }, () => {});
} else {
  before(async () => {
    await setupEnv();
    await bootstrapAdmin();
    ({ server, base } = await startApp());
    admin = new Client(base);
    const res = await admin.login('admin', ADMIN_PASSWORD);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  after(async () => {
    server?.close();
    const { flushServices } = await import('../server/services/boot.js');
    await flushServices();
  });

  runTests();
}

function runTests() {

async function createUserAs(role, username) {
  const res = await admin.post('/api/admin/users', { username, email: `${username}@example.test`, name: `Pengguna ${username}`, role, password: 'KataSandi2026abc' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const client = new Client(base);
  assert.equal((await client.login(username, 'KataSandi2026abc')).status, 200);
  return { client, user: res.body };
}

describe('keamanan akses', () => {
  test('endpoint admin menolak pengunjung anonim', async () => {
    const anon = new Client(base);
    assert.equal((await anon.get('/api/admin/articles')).status, 401);
    assert.equal((await anon.get('/api/admin/settings')).status, 401);
    assert.equal((await anon.get('/api/admin/backups')).status, 401);
  });

  test('permintaan tulis tanpa token CSRF ditolak', async () => {
    const noToken = new Client(base);
    noToken.cookie = admin.cookie;
    const res = await noToken.post('/api/admin/categories', { name: 'Tanpa Token' });
    assert.equal(res.status, 403);
  });

  test('permintaan lintas situs (Origin asing) ditolak', async () => {
    const res = await admin.request('POST', '/api/admin/categories', { json: { name: 'Asing' }, headers: { origin: 'https://situs-jahat.example' } });
    assert.equal(res.status, 403);
  });

  test('login salah memberi pesan umum dan tidak membocorkan keberadaan akun', async () => {
    const c = new Client(base);
    await c.refreshSession();
    const wrongPass = await c.post('/api/auth/login', { identifier: 'admin', password: 'salah-salah-salah' });
    const unknown = await c.post('/api/auth/login', { identifier: 'tidak-ada', password: 'salah-salah-salah' });
    assert.equal(wrongPass.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrongPass.body.error, unknown.body.error);
  });

  test('akun terkunci setelah 5 kali gagal berturut-turut', async () => {
    await createUserAs('penulis', 'korbanlogin');
    const c = new Client(base);
    await c.refreshSession();
    for (let i = 0; i < 5; i += 1) await c.post('/api/auth/login', { identifier: 'korbanlogin', password: 'salah-salah-salah' });
    const locked = await c.post('/api/auth/login', { identifier: 'korbanlogin', password: 'KataSandi2026abc' });
    assert.equal(locked.status, 429);
  });

  test('respons sesi tidak membocorkan hash password', async () => {
    const { body } = await admin.get('/api/auth/session');
    assert.ok(body.user);
    assert.equal(body.user.password_hash, undefined);
    const users = await admin.get('/api/admin/users');
    assert.ok(users.body.items.every((u) => u.password_hash === undefined && u.failed_attempts === undefined));
  });

  test('cookie sesi HttpOnly dan SameSite', async () => {
    const c = new Client(base);
    const res = await c.request('GET', '/api/auth/session');
    const raw = res.headers.getSetCookie().join(';');
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Lax/i);
  });
});

describe('hak akses per peran (diverifikasi backend)', () => {
  test('kontributor tidak dapat menerbitkan, mengelola kategori, atau membuka pengaturan', async () => {
    const { client } = await createUserAs('kontributor', 'kontrib1');
    const created = await client.post('/api/admin/articles', { type: 'opini', title: 'Tulisan kontributor', content: '<p>Isi tulisan kontributor yang cukup.</p>', status: 'draft' });
    assert.equal(created.status, 201);
    const publish = await client.put(`/api/admin/articles/${created.body.id}`, { status: 'published' });
    assert.equal(publish.status, 403);
    assert.equal((await client.post('/api/admin/categories', { name: 'Bajakan' })).status, 403);
    assert.equal((await client.put('/api/admin/settings', { site_name: 'Dibajak' })).status, 403);
    assert.equal((await client.get('/api/admin/users')).status, 403);
    assert.equal((await client.get('/api/admin/backups')).status, 403);
    assert.equal((await client.get('/api/admin/comments')).status, 403);
  });

  test('penulis tidak dapat melihat atau mengubah tulisan penulis lain', async () => {
    const a = await createUserAs('penulis', 'penulis-a');
    const b = await createUserAs('penulis', 'penulis-b');
    const mine = await a.client.post('/api/admin/articles', { type: 'artikel', title: 'Milik penulis A', content: '<p>Isi milik A.</p>' });
    assert.equal(mine.status, 201);
    assert.equal((await b.client.get(`/api/admin/articles/${mine.body.id}`)).status, 404);
    assert.equal((await b.client.put(`/api/admin/articles/${mine.body.id}`, { title: 'Dibajak B' })).status, 404);
    assert.equal((await b.client.delete(`/api/admin/articles/${mine.body.id}`)).status, 404);
    const listB = await b.client.get('/api/admin/articles');
    assert.ok(listB.body.items.every((x) => x.id !== mine.body.id));
  });

  test('penulis tidak dapat menetapkan penulis lain atau menerbitkan sendiri', async () => {
    const { client, user } = await createUserAs('penulis', 'penulis-c');
    const created = await client.post('/api/admin/articles', { type: 'artikel', title: 'Tulisan penulis C', content: '<p>Isi tulisan.</p>', author_id: 'bukan-dia-123456' });
    assert.equal(created.status, 201);
    assert.equal(created.body.author_id, user.author_id);
    assert.equal((await client.put(`/api/admin/articles/${created.body.id}`, { status: 'published' })).status, 403);
    assert.equal((await client.put(`/api/admin/articles/${created.body.id}`, { published_at: '2020-01-01T00:00:00.000Z' })).status, 200);
    const after = await client.get(`/api/admin/articles/${created.body.id}`);
    assert.equal(after.body.published_at, null);
  });

  test('editor dapat menerbitkan tetapi tidak dapat mengelola pengguna', async () => {
    const { client } = await createUserAs('editor', 'editor1');
    assert.equal((await client.get('/api/admin/users')).status, 403);
    assert.equal((await client.get('/api/admin/comments')).status, 200);
  });

  test('Super Admin tidak dapat menghapus atau menurunkan dirinya sendiri', async () => {
    const me = (await admin.get('/api/auth/session')).body.user;
    assert.equal((await admin.delete(`/api/admin/users/${me.id}`)).status, 400);
    assert.equal((await admin.put(`/api/admin/users/${me.id}`, { role: 'editor' })).status, 400);
  });
});

describe('alur artikel: simpan, terbit, tampil publik', () => {
  test('draft tidak tampil publik; setelah terbit tampil; tersimpan di file JSON', async () => {
    const cats = await admin.get('/api/admin/categories');
    const berita = cats.body.items.find((c) => c.slug === 'berita');
    const created = await admin.post('/api/admin/articles', {
      type: 'berita',
      title: 'Judul Uji Coba Pertama',
      subtitle: 'Subjudul uji',
      content: '<h2>Bagian satu</h2><p>Paragraf pertama dengan <strong>penekanan</strong>.</p><script>alert(1)</script><p onclick="x()">klik</p>',
      category_id: berita.id,
      tags: ['Uji', '#coba', 'uji'],
    });
    assert.equal(created.status, 201);
    ids.article = created.body.id;
    assert.equal(created.body.slug, 'judul-uji-coba-pertama');
    assert.deepEqual(created.body.tags, ['uji', 'coba']);
    assert.ok(!created.body.content.includes('<script'));
    assert.ok(!created.body.content.includes('onclick'));

    assert.equal((await new Client(base).get('/api/articles/judul-uji-coba-pertama')).status, 404);

    const published = await admin.put(`/api/admin/articles/${ids.article}`, { status: 'published', expected_revision: created.body.revision });
    assert.equal(published.status, 200);
    assert.ok(published.body.published_at);

    const pub = await new Client(base).get('/api/articles/judul-uji-coba-pertama');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.title, 'Judul Uji Coba Pertama');
    assert.equal(pub.body.category.slug, 'berita');

    const { supabase } = await import('../server/db/supabase.js');
    const { data: onDiskRow } = await supabase().from('kv_documents').select('data').eq('collection', 'news').eq('id', ids.article).single();
    assert.equal(onDiskRow.data.title, 'Judul Uji Coba Pertama');
    assert.ok(onDiskRow.data.created_at && onDiskRow.data.updated_at && onDiskRow.data.id);
  });

  test('menerbitkan tanpa kategori atau tanpa isi ditolak', async () => {
    const noCat = await admin.post('/api/admin/articles', { type: 'opini', title: 'Tanpa kategori', content: '<p>Ada isi.</p>', status: 'published' });
    assert.equal(noCat.status, 400);
    const noBody = await admin.post('/api/admin/articles', { type: 'opini', title: 'Tanpa isi', content: '', status: 'published' });
    assert.equal(noBody.status, 400);
  });

  test('tulisan terjadwal belum tampil publik', async () => {
    const cats = (await admin.get('/api/admin/categories')).body.items;
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await admin.post('/api/admin/articles', { type: 'opini', title: 'Tulisan terjadwal', content: '<p>Isi terjadwal.</p>', category_id: cats[0].id, status: 'published', published_at: future });
    assert.equal(res.status, 201);
    assert.equal((await new Client(base).get('/api/articles/tulisan-terjadwal')).status, 404);
    const list = await new Client(base).get('/api/articles?limit=48');
    assert.ok(list.body.items.every((a) => a.slug !== 'tulisan-terjadwal'));
  });

  test('slug unik dan slug lama dialihkan ke slug baru', async () => {
    const cats = (await admin.get('/api/admin/categories')).body.items;
    const mk = (title) => admin.post('/api/admin/articles', { type: 'artikel', title, content: '<p>Isi.</p>', category_id: cats[0].id, status: 'published' });
    const one = await mk('Judul Kembar');
    const two = await mk('Judul Kembar');
    assert.equal(one.body.slug, 'judul-kembar');
    assert.equal(two.body.slug, 'judul-kembar-2');
    const renamed = await admin.put(`/api/admin/articles/${one.body.id}`, { slug: 'nama-baru' });
    assert.equal(renamed.body.slug, 'nama-baru');
    assert.ok(renamed.body.slug_history.includes('judul-kembar'));
    assert.equal((await new Client(base).get('/api/articles/nama-baru')).status, 200);
  });

  test('perubahan bersamaan terdeteksi lewat revisi (409)', async () => {
    const a = await admin.get(`/api/admin/articles/${ids.article}`);
    const ok = await admin.put(`/api/admin/articles/${ids.article}`, { title: 'Judul Diubah Pertama', expected_revision: a.body.revision });
    assert.equal(ok.status, 200);
    const stale = await admin.put(`/api/admin/articles/${ids.article}`, { title: 'Judul Basi', expected_revision: a.body.revision });
    assert.equal(stale.status, 409);
    const revisions = await admin.get(`/api/admin/articles/${ids.article}/revisions`);
    assert.ok(revisions.body.items.length >= 1);
  });

  test('50 penyimpanan bersamaan tidak merusak data dan tidak kehilangan data', async () => {
    const cats = (await admin.get('/api/admin/categories')).body.items;
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => admin.post('/api/admin/articles', { type: 'artikel', title: `Serentak ${i}`, content: `<p>Isi serentak ${i}.</p>`, category_id: cats[0].id, status: 'published' })),
    );
    assert.ok(results.every((r) => r.status === 201), results.map((r) => r.status).join());
    const slugs = new Set(results.map((r) => r.body.slug));
    assert.equal(slugs.size, 50);
    const { supabase } = await import('../server/db/supabase.js');
    const { data: rows, error } = await supabase().from('kv_documents').select('data').eq('collection', 'articles');
    assert.equal(error, null);
    for (const row of rows) assert.ok(row.data.id && row.data.title);
    assert.ok(rows.length >= 50);
  });

  test('penulisan bersamaan ke satu file memakai antrean (counter tidak hilang)', async () => {
    const { SingleFile } = await import('../server/services/store.js');
    const file = new SingleFile('stats/counter-test.json', { n: 0 });
    await Promise.all(Array.from({ length: 100 }, () => file.mutate((d) => { d.n += 1; })));
    assert.equal((await file.read()).n, 100);
  });
});

describe('pencarian', () => {
  test('mencari judul, isi, tag dan mengabaikan aksen/huruf besar', async () => {
    const c = new Client(base);
    const byTitle = await c.get('/api/articles?q=JUDUL%20uji');
    assert.ok(byTitle.body.items.some((a) => a.slug === 'judul-uji-coba-pertama' || a.title.includes('Judul')));
    const byTag = await c.get('/api/articles?tag=coba');
    assert.ok(byTag.body.total >= 1);
    const none = await c.get('/api/articles?q=zzzxxyyqq');
    assert.equal(none.body.total, 0);
    const suggest = await c.get('/api/search/suggest?q=serentak');
    assert.ok(suggest.body.items.length > 0);
  });
});

describe('media dan upload', () => {
  test('upload PNG valid: tersimpan di folder, dinamai UUID, dikonversi WebP, ada thumbnail', async () => {
    const res = await admin.request('POST', '/api/admin/media', { form: uploadForm(await pngBuffer(), 'Foto Saya.png', 'image/png') });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const item = res.body.items[0];
    ids.media = item.id;
    assert.match(item.url, /\/storage\/v1\/object\/public\/media\/images\/[0-9a-f-]{36}\.webp$/);
    assert.equal(item.mime, 'image/webp');
    // File sudah ada di Supabase Storage (bukan di disk server), jadi URL-nya diakses langsung.
    assert.equal((await fetch(item.url)).status, 200);
    assert.equal((await fetch(item.thumb)).status, 200);
  });

  test('menolak file executable yang menyamar sebagai gambar', async () => {
    const fake = Buffer.from('#!/bin/sh\necho pwned\n');
    const res = await admin.request('POST', '/api/admin/media', { form: uploadForm(fake, 'shell.png', 'image/png') });
    assert.equal(res.status, 400);
    assert.equal(res.body.items.length, 0);
  });

  test('menolak ekstensi yang tidak cocok dengan isi file dan ekstensi berbahaya', async () => {
    const png = await pngBuffer();
    assert.equal((await admin.request('POST', '/api/admin/media', { form: uploadForm(png, 'gambar.exe', 'image/png') })).status, 400);
    assert.equal((await admin.request('POST', '/api/admin/media', { form: uploadForm(png, 'gambar.php', 'image/png') })).status, 400);
    assert.equal((await admin.request('POST', '/api/admin/media', { form: uploadForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml') })).status, 400);
    assert.equal((await admin.request('POST', '/api/admin/media', { form: uploadForm(Buffer.from('<html></html>'), 'x.html', 'text/html') })).status, 400);
  });

  test('nama file berbahaya tidak memengaruhi lokasi penyimpanan (path traversal)', async () => {
    const res = await admin.request('POST', '/api/admin/media', { form: uploadForm(await pngBuffer('#222222'), '../../../../etc/passwd.png', 'image/png') });
    assert.equal(res.status, 201);
    assert.match(res.body.items[0].url, /\/storage\/v1\/object\/public\/media\/images\/[0-9a-f-]{36}\.webp$/);
    const fs = await import('node:fs/promises');
    const stray = await fs.readdir(process.env.UPLOAD_TMP_DIR).catch(() => []);
    assert.equal(stray.length, 0, 'file sementara harus dibersihkan');
  });

  test('server tidak lagi melayani file di bawah /media/ (file ada di Supabase Storage, bukan di server ini)', async () => {
    const c = new Client(base);
    const res = await c.get('/media/images/..%2f..%2fusers%2fx.json');
    assert.notEqual(res.status, 200);
    // fetch menormalkan "/media/../x" menjadi "/x"; kirim path mentah lewat http agar benar-benar diuji di server.
    const raw = await new Promise((resolve, reject) => {
      const u = new URL(base);
      http.get({ host: u.hostname, port: u.port, path: '/media/../settings/site.json' }, (r) => {
        r.resume();
        resolve(r.statusCode);
      }).on('error', reject);
    });
    assert.notEqual(raw, 200, `rute /media/* seharusnya tidak pernah ada di server ini, dapat status ${raw}`);
  });

  test('rename dan hapus media', async () => {
    const renamed = await admin.request('PATCH', `/api/admin/media/${ids.media}`, { json: { name: 'Nama Baru' } });
    assert.equal(renamed.body.name, 'Nama Baru');
    const url = renamed.body.url;
    assert.equal((await admin.delete(`/api/admin/media/${ids.media}`)).status, 200);
    assert.equal((await new Client(base).get(url)).status, 404);
  });

  test('kontributor tidak dapat mengunggah video/dokumen dan tidak dapat menghapus media orang lain', async () => {
    const { client } = await createUserAs('kontributor', 'kontrib2');
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const res = await client.request('POST', '/api/admin/media', { form: uploadForm(pdf, 'a.pdf', 'application/pdf') });
    assert.equal(res.status, 400);
    const own = await admin.request('POST', '/api/admin/media', { form: uploadForm(await pngBuffer('#00aa00'), 'milik-admin.png', 'image/png') });
    assert.equal((await client.delete(`/api/admin/media/${own.body.items[0].id}`)).status, 403);
  });
});

describe('komentar, newsletter, dan kiriman tulisan publik', () => {
  test('komentar masuk moderasi, tidak tampil sebelum disetujui, XSS dibersihkan', async () => {
    const c = new Client(base);
    const art = (await c.get('/api/articles/nama-baru')).body;
    const post = await c.post(`/api/articles/${art.id}/comments`, { name: 'Pembaca <b>Kritis</b>', body: 'Komentar <script>alert(1)</script> yang cukup panjang.', elapsed: 9000 });
    assert.equal(post.status, 201);
    assert.equal(post.body.status, 'pending');
    assert.equal((await c.get(`/api/articles/${art.id}/comments`)).body.items.length, 0);

    const all = await admin.get('/api/admin/comments?status=pending');
    const mine = all.body.items.find((x) => x.article_id === art.id);
    assert.ok(mine);
    assert.ok(!mine.body.includes('<script'));
    assert.ok(!mine.name.includes('<b>'));
    assert.equal(mine.ip_hash, undefined);

    await admin.request('PATCH', `/api/admin/comments/${art.id}/${mine.id}`, { json: { status: 'approved' } });
    const visible = await c.get(`/api/articles/${art.id}/comments`);
    assert.equal(visible.body.items.length, 1);
    assert.equal(visible.body.items[0].email, undefined);
  });

  test('komentar berisi banyak tautan ditandai spam; honeypot diabaikan diam-diam', async () => {
    const c = new Client(base);
    const art = (await c.get('/api/articles/nama-baru')).body;
    await c.post(`/api/articles/${art.id}/comments`, { name: 'Spammer', body: 'http://a.example http://b.example http://c.example beli sekarang', elapsed: 9000 });
    const bot = await c.post(`/api/articles/${art.id}/comments`, { name: 'Bot', body: 'Halo dunia ini bot', website: 'http://bot.example', elapsed: 9000 });
    assert.equal(bot.status, 201);
    const spam = await admin.get('/api/admin/comments?status=spam');
    assert.ok(spam.body.items.some((x) => x.name === 'Spammer'));
    assert.ok(!spam.body.items.some((x) => x.name === 'Bot'));
  });

  test('newsletter: validasi email, tanpa duplikat, tersimpan di JSON', async () => {
    const c = new Client(base);
    assert.equal((await c.post('/api/newsletter', { email: 'bukan-email' })).status, 400);
    assert.equal((await c.post('/api/newsletter', { email: 'Warga@Example.test' })).status, 201);
    const again = await c.post('/api/newsletter', { email: 'warga@example.test' });
    assert.match(again.body.message, /sudah terdaftar/);
    const list = await admin.get('/api/admin/newsletter');
    assert.equal(list.body.items.filter((s) => s.email === 'warga@example.test').length, 1);
    const { supabase } = await import('../server/db/supabase.js');
    const { data: storedRow } = await supabase().from('kv_singles').select('data').eq('key', 'newsletter/subscribers.json').single();
    assert.ok(storedRow.data.items.length >= 1);
  });

  test('kirim tulisan masuk antrean review, bukan langsung terbit', async () => {
    const c = new Client(base);
    const form = new FormData();
    form.append('name', 'Penulis Tamu');
    form.append('email', 'tamu@example.test');
    form.append('title', 'Kiriman dari warga biasa');
    form.append('type', 'opini');
    form.append('content', 'Ini isi tulisan yang dikirim warga. '.repeat(10) + '<script>alert(1)</script>');
    form.append('agree', 'true');
    form.append('elapsed', '20000');
    const res = await c.request('POST', '/api/submissions', { form });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal((await c.get('/api/articles/kiriman-dari-warga-biasa')).status, 404);
    const queue = await admin.get('/api/admin/articles?status=review');
    const item = queue.body.items.find((a) => a.slug === 'kiriman-dari-warga-biasa');
    assert.ok(item);
    assert.equal(item.source, 'public');
    const full = await admin.get(`/api/admin/articles/${item.id}`);
    assert.ok(!full.body.content.includes('<script'));
  });

  test('kirim tulisan tanpa persetujuan kebijakan ditolak', async () => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ name: 'Tamu', email: 'tamu@example.test', title: 'Judul cukup panjang', type: 'opini', content: 'x'.repeat(250) })) form.append(k, v);
    assert.equal((await new Client(base).request('POST', '/api/submissions', { form })).status, 400);
  });
});

describe('SEO', () => {
  test('sitemap, robots, dan RSS tersedia dan hanya memuat tulisan terbit', async () => {
    const c = new Client(base);
    const sitemap = await c.get('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.body, /nama-baru/);
    assert.ok(!sitemap.body.includes('tulisan-terjadwal'));
    assert.match((await c.get('/robots.txt')).body, /Disallow: \/admin/);
    const rss = await c.get('/rss.xml');
    assert.match(rss.body, /<rss version="2.0"/);
    assert.ok(!rss.body.includes('tulisan-terjadwal'));
  });
});

describe('backup dan restore', () => {
  test('backup berisi data, restore mengembalikan keadaan semula, backup rusak ditolak tanpa mengubah data', async () => {
    const created = await admin.post('/api/admin/backups', {});
    assert.equal(created.status, 201);
    const name = created.body.name;

    const before = (await admin.get('/api/admin/articles?limit=100')).body.total;
    const extra = await admin.post('/api/admin/articles', { type: 'artikel', title: 'Dibuat setelah backup', content: '<p>Isi.</p>' });
    assert.equal(extra.status, 201);
    assert.equal((await admin.get('/api/admin/articles?limit=100')).body.total, before + 1);

    const bad = new FormData();
    bad.append('file', new Blob([Buffer.from('bukan zip sama sekali')], { type: 'application/zip' }), 'rusak.zip');
    const rejected = await admin.request('POST', '/api/admin/backups/restore-upload', { form: bad });
    assert.equal(rejected.status, 400);
    assert.equal((await admin.get('/api/admin/articles?limit=100')).body.total, before + 1, 'data tidak boleh berubah saat backup ditolak');

    const restored = await admin.post(`/api/admin/backups/${name}/restore`, {});
    assert.equal(restored.status, 200, JSON.stringify(restored.body));
    assert.match(restored.body.safety_backup, /^pre-restore-/);
    assert.equal((await admin.get('/api/admin/articles?limit=100')).body.total, before);
    assert.equal((await new Client(base).get('/api/articles/nama-baru')).status, 200);

    const list = await admin.get('/api/admin/backups');
    assert.ok(list.body.items.some((b) => b.name === name));
    assert.equal((await admin.get('/api/admin/backups/..%2f..%2fetc%2fpasswd/download')).status, 400);
  });

  test('sesi login tidak ikut di dalam backup', async () => {
    const { default: AdmZip } = await import('adm-zip');
    const { backupPath } = await import('../server/services/backup.js');
    const list = await admin.get('/api/admin/backups');
    const zipPath = await backupPath(list.body.items[0].name);
    const zip = new AdmZip(zipPath);
    const names = zip.getEntries().map((e) => e.entryName);
    assert.ok(names.every((n) => !n.includes('session')));
    assert.ok(names.includes('backup-manifest.json'));
    assert.ok(names.includes('tables/kv_documents.json'));
    const fs = await import('node:fs/promises');
    await fs.rm(zipPath, { force: true });
  });
});

describe('persistensi setelah restart server', () => {
  test('data, login, dan indeks tetap ada setelah server dimulai ulang', async () => {
    const cookie = admin.cookie;
    const csrf = admin.csrf;
    const { flushServices } = await import('../server/services/boot.js');
    await flushServices();
    server.close();
    ({ server, base } = await startApp());
    admin.base = base;

    const pub = await new Client(base).get('/api/articles/nama-baru');
    assert.equal(pub.status, 200);

    const same = new Client(base);
    same.cookie = cookie;
    same.csrf = csrf;
    const me = await same.get('/api/auth/session');
    assert.equal(me.body.user?.username, 'admin', 'sesi harus bertahan setelah restart');
    assert.equal((await same.get('/api/admin/articles')).status, 200);
    assert.ok((await new Client(base).get('/api/articles?q=serentak')).body.total >= 50);
  });
});

describe('data contoh', () => {
  test('data contoh dapat dihapus tanpa menyentuh data asli', async () => {
    const { importArticle } = await import('../server/services/articles.js');
    const cats = (await admin.get('/api/admin/categories')).body.items;
    await importArticle({ type: 'opini', title: 'Tulisan contoh sementara', content: '<p>Contoh.</p>', category_id: cats[0].id, status: 'published', demo: true });
    assert.ok((await admin.get('/api/admin/demo')).body.articles >= 1);
    const realBefore = (await admin.get('/api/admin/articles?limit=100')).body.total;
    const cleared = await admin.delete('/api/admin/demo');
    assert.equal(cleared.status, 200);
    assert.equal((await admin.get('/api/admin/demo')).body.articles, 0);
    assert.equal((await admin.get('/api/admin/articles?limit=100')).body.total, realBefore - cleared.body.removed.articles);
    assert.equal((await new Client(base).get('/api/articles/nama-baru')).status, 200);
  });
});
}
