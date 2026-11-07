import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Membaca JSON. File tidak ada -> fallback. JSON rusak -> error jelas, tidak diam-diam diabaikan. */
export async function readJson(file, fallback = null) {
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`File JSON rusak: ${file}`);
  }
}

/** Menulis JSON secara atomik: tulis ke file sementara, fsync, lalu rename. */
export async function writeJsonAtomic(file, data) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(JSON.stringify(data, null, 2), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

const tails = new Map();

/** Antrean per kunci: dua penyimpanan ke file yang sama dijalankan berurutan, bukan bersamaan. */
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

/** Menggabungkan path dan memastikan hasilnya tetap berada di dalam folder dasar (anti path traversal). */
export function safeJoin(base, ...parts) {
  const root = path.resolve(base);
  const target = path.resolve(root, ...parts);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Path di luar folder yang diizinkan');
  }
  return target;
}

export const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{5,63}$/;

export function isSafeId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export async function listJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((name) => name.endsWith('.json') && !name.startsWith('.'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
