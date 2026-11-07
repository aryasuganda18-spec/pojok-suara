import { runScheduledBackup } from '../../server/services/backup.js';

/**
 * Dipanggil oleh Vercel Cron (lihat "crons" di vercel.json), menggantikan setInterval() di
 * server/services/backup.js yang hanya bekerja pada server yang terus menyala. Di Vercel tidak
 * ada proses yang terus menyala, jadi penjadwalan dipindah ke Vercel Cron yang memanggil endpoint
 * HTTP ini sesuai jadwal.
 *
 * Diamankan dengan CRON_SECRET: Vercel selalu mengirim header
 * "Authorization: Bearer <CRON_SECRET>" saat memanggil cron (lihat README cara mengisinya di
 * Environment Variables Vercel). Tanpa header yang cocok, permintaan ditolak — supaya orang lain
 * tidak bisa memicu backup dengan menebak URL endpoint ini.
 */
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    res.statusCode = 401;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'Tidak sah' }));
  }

  try {
    await runScheduledBackup();
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('[cron/backup] gagal:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
