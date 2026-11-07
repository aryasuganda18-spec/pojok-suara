-- POJOK SUARA — skema penyimpanan Supabase (Postgres)
--
-- Proyek ini tidak memakai tabel relasional terpisah per jenis data (artikel, pengguna, dst).
-- Sebaliknya, lapisan `server/services/*.js` sudah ditulis di atas dua abstraksi umum yang lama
-- dipakai di atas file JSON: `Collection` (banyak dokumen, satu folder) dan `SingleFile`
-- (satu dokumen besar). Supaya seluruh logika bisnis (validasi, revisi, antrean penulisan)
-- tidak perlu ditulis ulang, kedua abstraksi itu sekarang disimpan sebagai baris di Postgres:
--
--   kv_documents  -> pengganti Collection  (articles, news, opinions, criticisms,
--                                           authors, categories, users, media_meta)
--   kv_singles    -> pengganti SingleFile  (settings, pages, stats, newsletter,
--                                           comments per-artikel, draft otomatis)
--
-- Data biner (gambar/video/dokumen) TIDAK disimpan di tabel ini, tetapi di Supabase Storage
-- (lihat bagian bawah file ini untuk pembuatan bucket). Sesi login disimpan di tabel `sessions`
-- tersendiri karena library express-session butuh TTL per baris.
--
-- Jalankan seluruh file ini sekali di SQL Editor Supabase (atau `supabase db push`).

create extension if not exists pgcrypto;

-- ====================================================================
-- 1. Dokumen majemuk (pengganti folder-folder Collection)
-- ====================================================================
create table if not exists kv_documents (
  collection  text not null,
  id          text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

-- Dipakai untuk listing per koleksi dan pencarian ringan di dalam JSON.
create index if not exists kv_documents_collection_idx on kv_documents (collection);
create index if not exists kv_documents_updated_idx on kv_documents (collection, updated_at desc);
create index if not exists kv_documents_data_gin on kv_documents using gin (data jsonb_path_ops);

-- ====================================================================
-- 2. Dokumen tunggal (pengganti SingleFile: settings, pages, stats, newsletter)
-- ====================================================================
create table if not exists kv_singles (
  key         text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ====================================================================
-- 3. Sesi login (express-session store)
-- ====================================================================
create table if not exists sessions (
  sid         text primary key,
  data        jsonb not null,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- ====================================================================
-- 4. Log aktivitas (dulu file JSON Lines per bulan, sekarang baris tabel biasa)
-- ====================================================================
create table if not exists activity_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  user_id   text,
  username  text not null default 'anonim',
  action    text not null,
  target    text not null default '',
  detail    text not null default '',
  ip_hash   text not null default ''
);
create index if not exists activity_log_at_idx on activity_log (at desc);
create index if not exists activity_log_action_idx on activity_log (action);

-- ====================================================================
-- 5. Metadata file media (isi biner ada di Supabase Storage, bukan di sini)
-- ====================================================================
-- Catatan: baris media sebenarnya juga tersimpan lewat kv_documents (collection = 'media/meta')
-- supaya kode Collection yang sudah ada tetap jalan tanpa perubahan. Tabel ini sengaja TIDAK
-- dibuat terpisah agar tidak ada dua sumber kebenaran untuk metadata yang sama.

-- ====================================================================
-- 6. Fungsi bantu: increment revisi secara atomik (dipakai untuk konkurensi artikel)
-- ====================================================================
create or replace function kv_documents_touch() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists kv_documents_touch_trigger on kv_documents;
create trigger kv_documents_touch_trigger
  before update on kv_documents
  for each row execute function kv_documents_touch();

drop trigger if exists kv_singles_touch_trigger on kv_singles;
create trigger kv_singles_touch_trigger
  before update on kv_singles
  for each row execute function kv_documents_touch();

-- Dipakai oleh server/services/backup.js saat memulihkan dari ZIP backup: mengosongkan satu
-- tabel lalu mengisinya kembali dari JSON, sebagai SATU transaksi SQL (bukan dua panggilan
-- HTTP terpisah seperti delete-lalu-insert), supaya tidak ada jeda di mana tabel kosong kalau
-- prosesnya terganggu di tengah jalan.
create or replace function restore_table_json(target_table text, rows_json jsonb)
returns void as $$
begin
  if target_table not in ('kv_documents', 'kv_singles', 'activity_log') then
    raise exception 'Tabel % tidak diizinkan untuk dipulihkan', target_table;
  end if;

  execute format('delete from %I', target_table);

  if target_table = 'kv_documents' then
    insert into kv_documents (collection, id, data, created_at, updated_at)
    select x.collection, x.id, x.data, x.created_at, x.updated_at
    from jsonb_to_recordset(rows_json) as x(collection text, id text, data jsonb, created_at timestamptz, updated_at timestamptz);
  elsif target_table = 'kv_singles' then
    insert into kv_singles (key, data, updated_at)
    select x.key, x.data, x.updated_at
    from jsonb_to_recordset(rows_json) as x(key text, data jsonb, updated_at timestamptz);
  elsif target_table = 'activity_log' then
    insert into activity_log (at, user_id, username, action, target, detail, ip_hash)
    select x.at, x.user_id, x.username, x.action, x.target, x.detail, x.ip_hash
    from jsonb_to_recordset(rows_json) as x(at timestamptz, user_id text, username text, action text, target text, detail text, ip_hash text);
  end if;
end;
$$ language plpgsql;

-- ====================================================================
-- 7. Row Level Security
-- ====================================================================
-- Server POJOK SUARA selalu mengakses Supabase memakai SERVICE ROLE KEY (lihat .env.example),
-- yang melewati RLS sepenuhnya. RLS di sini hanya jaring pengaman: kalau ANON KEY atau PUBLIC
-- KEY ini bocor ke mana pun (mis. salah tempel di kode frontend), tidak ada data yang terbaca
-- atau tertulis langsung dari luar server. Semua aturan akses (peran, kepemilikan tulisan, dsb.)
-- tetap diperiksa di server/services/roles.js seperti sebelumnya.
alter table kv_documents  enable row level security;
alter table kv_singles    enable row level security;
alter table sessions      enable row level security;
alter table activity_log  enable row level security;

drop policy if exists "no public access" on kv_documents;
create policy "no public access" on kv_documents for all using (false) with check (false);

drop policy if exists "no public access" on kv_singles;
create policy "no public access" on kv_singles for all using (false) with check (false);

drop policy if exists "no public access" on sessions;
create policy "no public access" on sessions for all using (false) with check (false);

drop policy if exists "no public access" on activity_log;
create policy "no public access" on activity_log for all using (false) with check (false);

-- ====================================================================
-- 8. Supabase Storage — bucket media (dibuat lewat kode, bukan SQL)
-- ====================================================================
-- Bucket "media" dibuat otomatis oleh server saat pertama kali jalan (lihat
-- server/db/storageBucket.js). Jika Anda ingin membuatnya manual lewat SQL Editor,
-- jalankan baris berikut (aman dijalankan berulang):
--
-- insert into storage.buckets (id, name, public) values ('media', 'media', true)
--   on conflict (id) do nothing;
--
-- Bucket diset PUBLIC agar gambar/video/dokumen bisa diakses langsung lewat URL publik
-- Supabase Storage (persis seperti folder /media/ statis sebelumnya). Upload/hapus file
-- tetap hanya bisa lewat server (service role key), bukan dari peramban pengunjung.
