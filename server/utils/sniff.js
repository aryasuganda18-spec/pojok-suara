import fs from 'node:fs/promises';

const MP4_BRANDS = new Set([
  'isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'mmp4', 'dash', 'MSNV', 'f4v ',
]);

/**
 * Mengenali jenis file dari isi (magic bytes), bukan dari nama atau Content-Type kiriman pengguna.
 * Mengembalikan null bila bukan jenis yang diizinkan (jpg, png, webp, mp4, webm, pdf).
 */
export async function sniffFile(file) {
  const handle = await fs.open(file, 'r');
  try {
    const buf = Buffer.alloc(64);
    const { bytesRead } = await handle.read(buf, 0, 64, 0);
    const head = buf.subarray(0, bytesRead);

    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
      return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
    }
    if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { kind: 'image', ext: 'png', mime: 'image/png' };
    }
    if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      return { kind: 'image', ext: 'webp', mime: 'image/webp' };
    }
    if (head.length >= 12 && head.toString('ascii', 4, 8) === 'ftyp' && MP4_BRANDS.has(head.toString('ascii', 8, 12))) {
      return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
    }
    if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 && head.includes(Buffer.from('webm'))) {
      return { kind: 'video', ext: 'webm', mime: 'video/webm' };
    }
    if (head.length >= 5 && head.toString('ascii', 0, 5) === '%PDF-') {
      return { kind: 'document', ext: 'pdf', mime: 'application/pdf' };
    }
    return null;
  } finally {
    await handle.close();
  }
}

export const EXTENSION_ALIASES = {
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
  webp: ['webp'],
  mp4: ['mp4', 'm4v'],
  webm: ['webm'],
  pdf: ['pdf'],
};
