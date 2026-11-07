import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Satu-satunya titik koneksi ke Supabase. Memakai SERVICE ROLE KEY (bukan anon key) karena
 * server ini adalah satu-satunya yang boleh membaca/menulis data — pengunjung situs dan
 * peramban admin tidak pernah bicara langsung ke Supabase, selalu lewat API server ini.
 *
 * Sengaja dibuat "malas" (lazy): modul ini boleh di-import kapan saja, tapi koneksi baru
 * benar-benar dicoba saat dipakai pertama kali, sehingga pesan error (kalau env belum diisi)
 * jelas dan muncul di tempat yang tepat, bukan saat aplikasi baru mulai dimuat.
 */
let client = null;

export function supabase() {
  if (client) return client;
  const { url, serviceRoleKey } = config.supabase;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di file .env ' +
        '(lihat .env.example dan README.md bagian "Menyiapkan Supabase").',
    );
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return client;
}

/** Melempar Error biasa (bukan HttpError) dengan pesan Supabase yang jelas. Dipakai di semua query. */
export function assertNoError(error, context) {
  if (error) throw new Error(`Supabase (${context}): ${error.message}`);
}
