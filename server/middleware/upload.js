import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { ensureDir } from '../utils/fs-safe.js';

const MB = 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDir(config.uploadTmpDir).then(() => cb(null, config.uploadTmpDir), cb);
  },
  filename: (_req, _file, cb) => cb(null, randomUUID()),
});

export const adminUpload = multer({
  storage,
  limits: { fileSize: config.limits.videoMb * MB, files: 10, fields: 10, parts: 30 },
});

export const restoreUpload = multer({
  storage,
  limits: { fileSize: config.limits.restoreMb * MB, files: 1, fields: 5 },
});

export const publicImageUpload = multer({
  storage,
  limits: { fileSize: 5 * MB, files: 1, fields: 20, parts: 25 },
});

export async function removeTempFiles(files = []) {
  await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
}

/** Menghapus sisa upload sementara yang tertinggal (misalnya karena server mati saat upload). */
export async function sweepUploadTmp(maxAgeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const name of await fs.readdir(config.uploadTmpDir)) {
      const file = path.join(config.uploadTmpDir, name);
      const stat = await fs.stat(file);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) await fs.rm(file, { force: true });
    }
  } catch {
    // folder belum ada: tidak ada yang perlu dibersihkan
  }
}
