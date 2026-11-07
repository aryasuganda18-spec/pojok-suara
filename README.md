# POJOK SUARA

> Suara yang Berani, Pikiran yang Merdeka.

Publikasi digital independen lengkap dengan CMS. Seluruh data (artikel, penulis, komentar, pengguna, pengaturan) dan file media (gambar, video, dokumen) disimpan di **Supabase** milik Anda sendiri — bukan di server aplikasi ini — lalu langsung tampil di situs publik. Server ini sendiri tidak menyimpan data apa pun secara permanen; ia hanya jembatan antara pengunjung/admin dan Supabase Anda.

Dirancang **mobile-first**: tampilan dibuat untuk layar ponsel lebih dulu, kemudian diperluas untuk tablet dan desktop.

## Teknologi

| Bagian | Yang dipakai |
|---|---|
| Server | Node.js 20+ dan Express |
| Tampilan | React, TypeScript, Vite, Tailwind CSS, Lucide |
| Editor tulisan | TipTap |
| Grafik dashboard | Recharts |
| Validasi | Zod |
| Gambar | Sharp (dikonversi ke WebP + versi kecil) |
| Backup | Archiver (ZIP), disimpan di Supabase Storage |
| Penyimpanan data & file | **Supabase** (Postgres + Storage) |

## Menyiapkan Supabase

Aplikasi ini **tidak berfungsi tanpa Supabase** — di sinilah semua data benar-benar tersimpan.

1. Buat akun dan project baru di [supabase.com/dashboard](https://supabase.com/dashboard) (paket gratis cukup untuk mulai).
2. Di dashboard project, buka **SQL Editor** → **New query**, tempel seluruh isi file [`supabase/schema.sql`](supabase/schema.sql) dari proyek ini, lalu klik **Run**. Ini membuat semua tabel, fungsi, dan aturan keamanan (RLS) yang dibutuhkan. Aman dijalankan ulang bila perlu.
3. Buka **Project Settings → API**. Salin:
   - **Project URL** → isi ke `SUPABASE_URL` di file `.env`
   - **service_role secret** (bukan `anon` / `public`!) → isi ke `SUPABASE_SERVICE_ROLE_KEY`

   Kunci `service_role` bisa membaca/menulis semua data tanpa batasan RLS — **jangan pernah** menaruhnya di kode frontend atau membagikannya. Hanya server (file `.env` Anda) yang boleh menyimpannya.
4. Bucket penyimpanan file (`media` untuk gambar/video/dokumen, `backups` untuk file ZIP backup) dibuat otomatis oleh server saat pertama kali jalan — tidak perlu langkah tambahan.

Setelah tiga langkah di atas selesai, lanjutkan ke bagian berikut.

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env   # lalu isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY (lihat di atas)
npm run init:demo      # membuat akun Super Admin dan 14 tulisan contoh di Supabase Anda
npm run build           # membangun tampilan
npm start               # buka http://localhost:3000
```

- `npm run init` (tanpa `:demo`) membuat data kosong tanpa tulisan contoh.
- Kata sandi Super Admin dicetak **sekali** di layar bila `INIT_ADMIN_PASSWORD` tidak diisi. Anda wajib menggantinya saat login pertama.
- Panel redaksi: `/admin`.
- Mode pengembangan: `npm run dev` (server di port 3000, tampilan di port 5173).
- Tes otomatis: `npm test`.

## Menghapus data contoh

Masuk sebagai Super Admin, buka **Pengaturan → Data contoh → Hapus semua data contoh**. Hanya data bertanda contoh yang dihapus; tulisan buatan Anda aman. Buat backup dulu bila ragu.

## Struktur penyimpanan di Supabase

| Tabel / bucket | Isi |
|---|---|
| `kv_documents` | Artikel (berita/opini/kritik/artikel umum), penulis, kategori, pengguna, metadata media, riwayat revisi — satu baris per dokumen, mengikuti bentuk yang sama seperti sebelumnya (lihat `collection` di setiap baris) |
| `kv_singles` | Pengaturan situs, halaman statis, komentar per-artikel, draft otomatis editor — dokumen tunggal yang sering diubah sebagian |
| `activity_log` | Log aktivitas redaksi (login, terbit, ubah pengaturan, backup, dll.) |
| `sessions` | Sesi login yang sedang aktif |
| Storage bucket `media` | File gambar (otomatis dikonversi ke WebP + 2 ukuran kecil), video, dan dokumen — publik lewat URL Supabase Storage |
| Storage bucket `backups` | File ZIP hasil backup (privat, hanya bisa diunduh lewat server) |

Setiap penulisan dibungkus kunci per-dokumen (antrean, bukan transaksi lintas tabel) sehingga dua penyimpanan ke dokumen yang sama tidak saling timpa. Pembaruan artikel memakai pemeriksaan versi (`expected_revision`): bila dua editor mengubah tulisan yang sama, yang kedua diberi tahu ada konflik, bukan menimpa diam-diam. Skema lengkap beserta komentar penjelasannya ada di [`supabase/schema.sql`](supabase/schema.sql).

## Peran pengguna

| Peran | Bisa |
|---|---|
| Super Admin | Semuanya: pengguna, pengaturan, backup, log, data contoh |
| Editor | Meninjau dan menerbitkan, kategori, komentar, newsletter, halaman, unggulan |
| Penulis | Menulis dan mengedit tulisannya sendiri, mengirim ke review |
| Kontributor | Mengirim tulisan (masuk antrean review), hanya mengunggah gambar |

Semua hak akses diperiksa **di server**, bukan hanya disembunyikan di tampilan.

## Backup dan restore

- Menu **Backup**: buat, unduh, hapus, dan pulihkan (dari daftar atau unggah file ZIP).
- Isi backup: seluruh baris tabel `kv_documents`, `kv_singles`, dan `activity_log` (artikel, pengguna, pengaturan, komentar, log, dst.) dalam satu file ZIP. File media (gambar/video/dokumen) **tidak** ikut di dalam ZIP karena sudah tersimpan terpisah dan aman di bucket Storage `media` milik Supabase Anda sendiri.
- Backup disimpan di bucket Storage `backups` pada proyek Supabase Anda — bukan di disk server. Backup otomatis berjalan tiap 24 jam (`BACKUP_AUTO`, `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`).
- Restore **tidak menghapus data lama sebelum backup divalidasi**: ZIP diperiksa dulu (format benar, ada Super Admin aktif), backup pengaman dari data saat ini dibuat lebih dulu, baru tabel diganti isinya (lewat satu fungsi SQL yang berjalan sebagai satu transaksi per tabel). Bila penggantian gagal di tengah jalan, data otomatis dikembalikan dari backup pengaman tadi.
- Lewat terminal: `npm run backup`.
- Karena backup tersimpan di Supabase yang sama dengan data asalnya, sesekali **unduh juga salinannya ke komputer Anda** (tombol unduh di menu Backup) sebagai cadangan di luar Supabase.

## Hosting

Karena data dan file media kini sepenuhnya di Supabase, server Node.js ini sendiri **tidak perlu disk yang persisten** — satu-satunya syarat adalah variabel lingkungan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` terisi benar. Ini membuka lebih banyak pilihan hosting dibanding sebelumnya:

- **VPS atau hosting Node.js** (DigitalOcean, Niagahoster, dsb.): salin `.env.example` ke `.env`, isi `SITE_URL` dan kredensial Supabase, jalankan `npm run init`, `npm run build`, `npm start` (gunakan PM2 atau systemd agar hidup terus), pasang HTTPS lewat Nginx atau Caddy dan isi `TRUST_PROXY=1`.
- **Railway, Render, Fly.io, atau platform Node.js serverless/container lain**: cocok, selama platform tetap menjalankan proses Node.js (bukan hanya situs statis) dan variabel lingkungan Supabase diisi lewat pengaturan platform tersebut.
- **Netlify / Vercel**: bisa dipakai **khusus** jika proyek ini dijalankan sebagai fungsi serverless Node.js (bukan sekadar hosting statis) dan dikonfigurasi untuk menjalankan `server/index.js`. Karena tidak ada lagi data yang disimpan ke disk lokal, batasan lama (disk sementara menghapus data CMS) **sudah tidak berlaku** — satu-satunya penyesuaian adalah bagaimana platform tersebut menjalankan server Express ini sebagai fungsi.

## Keamanan

- Kata sandi di-hash dengan bcrypt (biaya 12); akun terkunci 15 menit setelah 5 kali gagal.
- Sesi lewat cookie HttpOnly + SameSite, token CSRF, dan pemeriksaan Origin.
- Helmet dengan CSP berbasis nonce, pembatasan laju (rate limiting), dan sanitasi HTML tulisan.
- Unggahan diperiksa isi file (bukan hanya ekstensi), diberi nama UUID, dan gambar dikodekan ulang sebelum diunggah ke Supabase Storage.
- Kunci `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server (file `.env`), tidak pernah dikirim ke peramban. RLS (Row Level Security) di `supabase/schema.sql` menolak semua akses langsung dari luar server sebagai jaring pengaman tambahan.
- Ganti kata sandi bawaan dan pasang HTTPS sebelum situs dibuka ke publik.

## Catatan untuk yang baru belajar React

Kalau selama ini terbiasa dengan HTML biasa, ini padanannya:

| Di HTML biasa | Di proyek ini (React) |
|---|---|
| Satu file `.html` per halaman | Satu **komponen** (fungsi) per bagian halaman di `src/pages/` dan `src/components/` |
| Menyalin header dan footer ke setiap halaman | `Header.tsx` dan `Footer.tsx` ditulis sekali, dipakai semua halaman lewat `PublicLayout.tsx` |
| Pindah halaman = memuat file baru | Pindah halaman diatur `react-router`; tanpa muat ulang penuh, jadi terasa cepat |
| `document.getElementById(...).innerText = ...` | Cukup mengubah **state**; tampilan menyesuaikan sendiri |
| `fetch()` lalu menyusun elemen manual | Hook `useApi` mengambil data, komponen tinggal menampilkannya |
| CSS terpisah dengan nama class buatan sendiri | Tailwind: class pendek langsung di elemen, warna lewat variabel di `src/styles/index.css` |
| File `.js` biasa | `.tsx` = JavaScript + tipe data, supaya salah ketik ketahuan sebelum situs dijalankan |

Folder `dist/` adalah hasil `npm run build` (HTML/JS/CSS biasa) yang dibaca peramban; folder `src/` adalah "bahan mentah"-nya.

## Variabel lingkungan

Lihat `.env.example` untuk daftar lengkap beserta penjelasannya.

## Catatan teknis

- Kata sandi memakai **bcryptjs**, bukan Argon2id, agar tidak membutuhkan kompilasi native di hosting murah.
- Penanda "simpan untuk dibaca nanti" disimpan di `localStorage` peramban pembaca (per perangkat), bukan di server.
- `npm audit` melaporkan 3 temuan tingkat sedang pada `minimatch` di dalam `archiver`; jalur itu tidak menerima input pengguna (daftar file backup dibuat sendiri oleh server).
- Rahasia sesi (`SESSION_SECRET`) dan ID beberapa dokumen internal disimpan di tabel `kv_singles`/`kv_documents` yang sama dengan data lain — ini sudah tercakup dalam backup ZIP biasa.
- `UPLOAD_TMP_DIR` di server **bukan** penyimpanan data: isinya hanya file sementara di antara saat pengguna mengunggah dan saat file selesai dikirim ke Supabase Storage, dan aman dikosongkan kapan saja.
- Batas ukuran restore (`MAX_RESTORE_MB`) dibatasi juga oleh batas ukuran payload RPC Supabase untuk project dengan sangat banyak data; untuk situs dengan puluhan ribu tulisan, pertimbangkan menaikkan paket Supabase atau menghubungi dukungan Supabase bila restore gagal karena ukuran.
