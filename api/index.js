import { createApp } from '../server/index.js';

/**
 * Entry point khusus Vercel. Berbeda dari `server/index.js` yang menjalankan server Express
 * biasa dengan `app.listen()`, di Vercel setiap request dijalankan sebagai fungsi serverless
 * terpisah — tidak ada proses yang terus menyala. Jadi di sini kita HANYA membangun instance
 * Express (`createApp()`) lalu menyerahkan request/response langsung ke Express, tanpa listen().
 *
 * `appPromise` dibuat sekali di luar handler supaya pada "warm start" (fungsi dipakai lagi
 * sebelum container-nya didaur ulang Vercel), bootServices() dan koneksi Supabase tidak
 * diulang setiap request — hanya pada cold start pertama.
 */
let appPromise;

export default async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  try {
    const app = await appPromise;
    app(req, res);
  } catch (err) {
    appPromise = undefined; // supaya percobaan berikutnya mencoba boot ulang, bukan memakai promise yang gagal
    console.error('Gagal memulai aplikasi:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Server gagal memulai. Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Environment Variables Vercel.' }));
  }
}
