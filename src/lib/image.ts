/**
 * Batas isi request di Vercel adalah 4,5 MB, jadi foto dari kamera (sering 3-10 MB) harus diperkecil di
 * peramban sebelum dikirim. Server tetap memprosesnya lagi (EXIF dibuang, varian responsif dibuat).
 */
export const MAX_UPLOAD_BYTES = 4_000_000;
const SHRINK_ABOVE_BYTES = 1_200_000;
const MAX_SIDE = 2000;

export async function prepareImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  } catch {
    return file;
  }
}
