import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { ZipArchive } from 'archiver';
import AdmZip from 'adm-zip';
import { config } from '../config.js';
import { supabase, assertNoError } from '../db/supabase.js';
import { ensureBackupBucket, BACKUP_BUCKET } from '../db/storageBucket.js';
import { HttpError } from '../utils/http.js';

const NAME_PATTERN = /^(auto|manual|pre-restore)-\d{8}-\d{6}-[a-z0-9]{4}\.zip$/;
const MB = 1024 * 1024;

// Tabel yang ikut dibackup/dipulihkan. "sessions" sengaja tidak ikut: sesi login tidak perlu
// dan tidak boleh dipindahkan antar lingkungan (lihat catatan di restoreBackup).
const TABLES = ['kv_documents', 'kv_singles', 'activity_log'];

let maintenance = false;
export const isMaintenance = () => maintenance;

const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

export function validateBackupName(name) {
  if (!NAME_PATTERN.test(String(name))) throw new HttpError(400, 'Nama file backup tidak valid');
  return name;
}

async function fetchAllRows(table) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase().from(table).select('*').range(from, from + PAGE - 1);
    assertNoError(error, `backup.dump(${table})`);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/** Membuat backup ZIP berisi seluruh baris tabel data (bukan file media — itu sudah aman
 * tersimpan terpisah di bucket "media" Supabase Storage dan tidak perlu dibackup berulang di sini). */
export async function createBackup({ reason = 'manual', username = 'sistem' } = {}) {
  await ensureBackupBucket();
  const name = `${reason}-${stamp()}-${randomBytes(2).toString('hex')}.zip`;
  const tmpFile = path.join(os.tmpdir(), `ps-backup-${randomUUID()}.zip`);

  const counts = {};
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = createWriteStream(tmpFile);
  const finished = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);

  try {
    for (const table of TABLES) {
      const rows = await fetchAllRows(table);
      counts[table] = rows.length;
      archive.append(JSON.stringify(rows), { name: `tables/${table}.json` });
    }
    archive.append(
      JSON.stringify({ app: 'pojok-suara', format: 2, storage: 'supabase', reason, created_at: new Date().toISOString(), created_by: username, rows: counts }, null, 2),
      { name: 'backup-manifest.json' },
    );
    await archive.finalize();
    await finished;

    const buffer = await fs.readFile(tmpFile);
    const { error } = await supabase().storage.from(BACKUP_BUCKET).upload(name, buffer, { contentType: 'application/zip', upsert: false });
    assertNoError(error, 'backup.upload');
  } finally {
    await fs.rm(tmpFile, { force: true });
  }
  return describeBackup(name);
}

async function describeBackup(name) {
  await ensureBackupBucket();
  const dir = path.posix.dirname(name) === '.' ? '' : path.posix.dirname(name);
  const { data, error } = await supabase().storage.from(BACKUP_BUCKET).list(dir, { search: path.posix.basename(name) });
  assertNoError(error, 'backup.describe');
  const found = data?.find((f) => f.name === path.posix.basename(name));
  if (!found) throw new HttpError(404, 'File backup tidak ditemukan');
  return {
    name,
    reason: name.split('-')[0] === 'pre' ? 'pre-restore' : name.split('-')[0],
    size: found.metadata?.size ?? 0,
    created_at: found.created_at ?? new Date().toISOString(),
  };
}

export async function listBackups() {
  await ensureBackupBucket();
  const { data, error } = await supabase().storage.from(BACKUP_BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  assertNoError(error, 'backup.list');
  return (data ?? [])
    .filter((f) => NAME_PATTERN.test(f.name))
    .map((f) => ({
      name: f.name,
      reason: f.name.split('-')[0] === 'pre' ? 'pre-restore' : f.name.split('-')[0],
      size: f.metadata?.size ?? 0,
      created_at: f.created_at ?? f.updated_at ?? new Date().toISOString(),
    }));
}

/** Mengunduh backup dari Supabase Storage ke file sementara di disk, untuk dikirim lewat res.download(). */
export async function backupPath(name) {
  validateBackupName(name);
  await ensureBackupBucket();
  const { data, error } = await supabase().storage.from(BACKUP_BUCKET).download(name);
  if (error) throw new HttpError(404, 'File backup tidak ditemukan');
  const tmpFile = path.join(os.tmpdir(), `ps-backup-dl-${randomUUID()}.zip`);
  await fs.writeFile(tmpFile, Buffer.from(await data.arrayBuffer()));
  return tmpFile;
}

export async function deleteBackup(name) {
  validateBackupName(name);
  await ensureBackupBucket();
  const { error } = await supabase().storage.from(BACKUP_BUCKET).remove([name]);
  assertNoError(error, 'backup.delete');
}

/* ---------- Restore ---------- */

function readZipTables(zipPath) {
  let zip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    throw new HttpError(400, 'File backup bukan ZIP yang valid');
  }
  const entries = zip.getEntries();
  if (!entries.length) throw new HttpError(400, 'Isi file backup tidak wajar');

  const manifestEntry = entries.find((e) => e.entryName === 'backup-manifest.json');
  if (!manifestEntry) throw new HttpError(400, 'Backup tidak valid: backup-manifest.json tidak ditemukan');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  } catch {
    throw new HttpError(400, 'Backup tidak valid: manifest rusak');
  }
  if (manifest.storage !== 'supabase' || manifest.format !== 2) {
    throw new HttpError(400, 'Backup ini dibuat oleh versi aplikasi yang berbeda (format penyimpanan tidak cocok) dan tidak dapat dipulihkan di sini');
  }

  const declared = entries.reduce((sum, e) => sum + (e.header?.size ?? 0), 0);
  const limit = config.limits.restoreMb * MB;
  if (declared > limit) throw new HttpError(400, `Ukuran backup setelah diekstrak melebihi batas ${config.limits.restoreMb} MB`);

  const tables = {};
  for (const table of TABLES) {
    const entry = entries.find((e) => e.entryName === `tables/${table}.json`);
    if (!entry) throw new HttpError(400, `Backup tidak valid: tables/${table}.json tidak ditemukan`);
    try {
      tables[table] = JSON.parse(entry.getData().toString('utf8'));
    } catch {
      throw new HttpError(400, `Backup tidak valid: tables/${table}.json rusak`);
    }
    if (!Array.isArray(tables[table])) throw new HttpError(400, `Backup tidak valid: tables/${table}.json bukan daftar baris`);
  }
  return tables;
}

function validateTables(tables) {
  const hasSuperAdmin = tables.kv_documents.some(
    (row) => row.collection === 'users' && row.data?.role === 'super_admin' && row.data?.active && typeof row.data?.password_hash === 'string',
  );
  if (!hasSuperAdmin) throw new HttpError(400, 'Backup tidak berisi akun Super Admin aktif. Pemulihan dibatalkan, data saat ini tidak diubah.');
}

/** Mengosongkan satu tabel lalu mengisinya kembali dari `rows`, sebagai SATU transaksi SQL
 * (fungsi `restore_table_json` di supabase/schema.sql), bukan "hapus" lalu "tulis" sebagai dua
 * panggilan HTTP terpisah — supaya tidak pernah ada jeda tabel kosong bila prosesnya terganggu. */
async function replaceTable(table, rows) {
  const { error } = await supabase().rpc('restore_table_json', { target_table: table, rows_json: rows });
  assertNoError(error, `restore.replace(${table})`);
}

/**
 * Memulihkan dari backup. Urutan: baca & validasi ZIP -> backup pengaman data saat ini ->
 * ganti isi tabel. Data saat ini TIDAK disentuh sebelum backup tervalidasi. Bila penggantian
 * tabel gagal di tengah jalan, data dipulihkan kembali dari backup pengaman yang baru dibuat.
 */
export async function restoreBackup(zipPath, { username, beforeSwap, onSwapped }) {
  if (maintenance) throw new HttpError(409, 'Proses backup/restore lain sedang berjalan');

  const tables = readZipTables(zipPath);
  validateTables(tables);

  maintenance = true;
  try {
    await beforeSwap?.();
    const safety = await createBackup({ reason: 'pre-restore', username });
    try {
      for (const table of TABLES) await replaceTable(table, tables[table]);
    } catch (err) {
      // Pemulihan gagal di tengah jalan: kembalikan dari backup pengaman yang baru dibuat.
      try {
        const safetyTables = readZipTables(await backupPath(safety.name));
        for (const table of TABLES) await replaceTable(table, safetyTables[table]);
      } catch (rollbackErr) {
        throw new HttpError(
          500,
          `Pemulihan gagal (${err.message}) dan pengembalian otomatis juga gagal (${rollbackErr.message}). ` +
            `Data mungkin dalam keadaan tidak konsisten — pulihkan manual dari backup "${safety.name}".`,
        );
      }
      throw err instanceof HttpError ? err : new HttpError(500, `Pemulihan gagal dan data semula dikembalikan: ${err.message}`);
    }
    await onSwapped?.();
    return { safety_backup: safety.name };
  } finally {
    maintenance = false;
  }
}

/* ---------- Backup otomatis terjadwal ---------- */

export async function runScheduledBackup() {
  const all = await listBackups();
  const autos = all.filter((b) => b.reason === 'auto');
  const latest = autos[0] ? Date.parse(autos[0].created_at) : 0;
  if (Date.now() - latest >= config.backup.intervalHours * 3_600_000 && !maintenance) {
    await createBackup({ reason: 'auto' });
    console.log('[backup] backup otomatis dibuat');
  }
  const refreshed = (await listBackups()).filter((b) => b.reason === 'auto');
  for (const old of refreshed.slice(config.backup.keepAuto)) await deleteBackup(old.name);
}

export function startBackupScheduler() {
  if (!config.backup.enabled) return;
  const tick = () => runScheduledBackup().catch((err) => console.error('[backup] gagal:', err.message));
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 30 * 60_000).unref();
}
