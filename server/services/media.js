import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { Collection } from './store.js';
import { supabase, assertNoError } from '../db/supabase.js';
import { MEDIA_BUCKET, ensureMediaBucket } from '../db/storageBucket.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http.js';
import { EXTENSION_ALIASES, sniffFile } from '../utils/sniff.js';
import { cleanText } from '../utils/text.js';

const FOLDERS = { image: 'images', video: 'videos', document: 'documents' };
const MB = 1024 * 1024;
const VARIANT_WIDTHS = [480, 960];
const MAX_WIDTH = 2000;

const schema = z.looseObject({
  id: z.string(),
  kind: z.enum(['image', 'video', 'document']),
  name: z.string().min(1).max(120),
  original_name: z.string().max(200),
  file: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  alt: z.string().max(200),
  uploaded_by: z.string().nullable(),
  demo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const collection = new Collection('media/meta', { schema });
let cache = new Map();

/** Alamat publik Supabase Storage untuk satu file di dalam bucket "media". */
function storageUrl(kind, file) {
  const { data } = supabase().storage.from(MEDIA_BUCKET).getPublicUrl(`${FOLDERS[kind]}/${file}`);
  return data.publicUrl;
}

async function uploadToStorage(kind, file, buffer, contentType) {
  await ensureMediaBucket();
  const { error } = await supabase()
    .storage.from(MEDIA_BUCKET)
    .upload(`${FOLDERS[kind]}/${file}`, buffer, { contentType, upsert: true, cacheControl: '31536000' });
  assertNoError(error, 'storage.upload');
}

async function removeFromStorage(kind, files) {
  await ensureMediaBucket();
  const paths = files.map((f) => `${FOLDERS[kind]}/${f}`);
  const { error } = await supabase().storage.from(MEDIA_BUCKET).remove(paths);
  // File yang sudah tidak ada bukan kegagalan; abaikan, tapi lempar error lain.
  if (error && !/not.*found/i.test(error.message)) assertNoError(error, 'storage.remove');
}

export async function initMedia() {
  await ensureMediaBucket();
  await collection.ensure();
  cache = new Map((await collection.list()).map((m) => [m.id, m]));
}

export const getMedia = (id) => cache.get(id) ?? null;

const baseName = (file) => file.replace(/\.[^.]+$/, '');

/** Bentuk gambar untuk tampilan: url asli beserta varian responsif. */
export function imageObject(id, { caption = '', alt = '' } = {}) {
  const media = id ? cache.get(id) : null;
  if (!media || media.kind !== 'image') return null;
  const base = baseName(media.file);
  return {
    id: media.id,
    url: storageUrl('image', media.file),
    thumb: storageUrl('image', `${base}-480.webp`),
    medium: storageUrl('image', `${base}-960.webp`),
    width: media.width,
    height: media.height,
    alt: alt || media.alt || '',
    caption,
  };
}

export function describeMedia(media) {
  const image = media.kind === 'image' ? imageObject(media.id) : null;
  return {
    id: media.id,
    kind: media.kind,
    name: media.name,
    original_name: media.original_name,
    mime: media.mime,
    size: media.size,
    width: media.width,
    height: media.height,
    alt: media.alt,
    url: storageUrl(media.kind, media.file),
    thumb: image?.thumb ?? null,
    uploaded_by: media.uploaded_by,
    demo: media.demo,
    created_at: media.created_at,
  };
}

function displayName(originalName) {
  let name = String(originalName ?? '');
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (!decoded.includes('�')) name = decoded;
  return cleanText(path.parse(name).name, 80) || 'berkas';
}

/**
 * Menyimpan hasil upload ke Supabase Storage. Jenis file ditentukan dari isi file, nama file di
 * server selalu UUID, dan gambar diproses ulang dengan sharp (EXIF dibuang, ukuran dibatasi,
 * diubah ke WebP) sebelum diunggah.
 */
export async function saveUpload({ tmpPath, originalName, declaredMime = '', user = null, allowKinds = ['image', 'video', 'document'], demo = false, alt = '' }) {
  const sniffed = await sniffFile(tmpPath);
  if (!sniffed) throw new HttpError(400, 'Jenis file tidak diizinkan. Hanya JPG, PNG, WEBP, MP4, WEBM, dan PDF.');
  if (!allowKinds.includes(sniffed.kind)) throw new HttpError(400, `Jenis file ${sniffed.kind === 'image' ? 'gambar' : sniffed.kind === 'video' ? 'video' : 'dokumen'} tidak diizinkan di sini`);

  const extension = path.extname(String(originalName ?? '')).slice(1).toLowerCase();
  if (!EXTENSION_ALIASES[sniffed.ext].includes(extension)) {
    throw new HttpError(400, 'Ekstensi file tidak sesuai dengan isi file');
  }
  if (declaredMime && !/^(image\/|video\/|application\/(pdf|octet-stream))/.test(declaredMime)) {
    throw new HttpError(400, 'Tipe konten file tidak diizinkan');
  }

  const stat = await fs.stat(tmpPath);
  const limitMb = sniffed.kind === 'image' ? config.limits.imageMb : sniffed.kind === 'video' ? config.limits.videoMb : config.limits.docMb;
  if (stat.size > limitMb * MB) throw new HttpError(413, `Ukuran file melebihi batas ${limitMb} MB`);

  const id = randomUUID();
  const uploaded = [];
  let record;

  try {
    if (sniffed.kind === 'image') {
      const file = `${id}.webp`;
      const main = sharp(tmpPath, { limitInputPixels: 40_000_000 }).rotate();
      let info;
      let mainBuffer;
      try {
        mainBuffer = await main.clone().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }).then((r) => {
          info = r.info;
          return r.data;
        });
      } catch {
        throw new HttpError(400, 'File gambar rusak atau tidak dapat diproses');
      }
      await uploadToStorage('image', file, mainBuffer, 'image/webp');
      uploaded.push(file);
      for (const width of VARIANT_WIDTHS) {
        const variant = `${id}-${width}.webp`;
        const buffer = await main.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        await uploadToStorage('image', variant, buffer, 'image/webp');
        uploaded.push(variant);
      }
      record = { file, mime: 'image/webp', size: info.size, width: info.width, height: info.height };
    } else {
      const file = `${id}.${sniffed.ext}`;
      const buffer = await fs.readFile(tmpPath);
      await uploadToStorage(sniffed.kind, file, buffer, sniffed.mime);
      uploaded.push(file);
      record = { file, mime: sniffed.mime, size: stat.size, width: null, height: null };
    }

    const media = await collection.create(
      {
        kind: sniffed.kind,
        name: displayName(originalName),
        original_name: cleanText(path.basename(String(originalName ?? '')), 200),
        alt: cleanText(alt, 200),
        uploaded_by: user?.id ?? null,
        demo,
        ...record,
      },
      { id },
    );
    cache.set(media.id, media);
    return media;
  } catch (err) {
    await removeFromStorage(sniffed.kind, uploaded).catch(() => {});
    throw err;
  }
}

export function listMedia({ user, canManageAll, q = '', kind = '', page = 1, limit = 24 }) {
  const needle = q.trim().toLowerCase();
  let items = [...cache.values()].filter((m) => canManageAll || m.uploaded_by === user.id);
  if (kind) items = items.filter((m) => m.kind === kind);
  if (needle) items = items.filter((m) => m.name.toLowerCase().includes(needle) || m.original_name.toLowerCase().includes(needle));
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = items.length;
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit).map(describeMedia), total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function renameMedia(id, { name, alt }) {
  if (!cache.has(id)) throw new HttpError(404, 'File tidak ditemukan');
  const media = await collection.update(id, (doc) => {
    if (name !== undefined) doc.name = cleanText(name, 120) || doc.name;
    if (alt !== undefined) doc.alt = cleanText(alt, 200);
  });
  cache.set(id, media);
  return media;
}

export async function removeMedia(id) {
  const media = cache.get(id);
  if (!media) throw new HttpError(404, 'File tidak ditemukan');
  const files = [media.file];
  if (media.kind === 'image') files.push(...VARIANT_WIDTHS.map((w) => `${baseName(media.file)}-${w}.webp`));
  await removeFromStorage(media.kind, files);
  await collection.remove(id);
  cache.delete(id);
  return media;
}

export const mediaCanBeUsedAsImage = (id) => cache.get(id)?.kind === 'image';
