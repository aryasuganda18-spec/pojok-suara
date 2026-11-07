import { supabase } from './supabase.js';

const MEDIA_BUCKET = 'media';
const BACKUP_BUCKET = 'backups';
const ensured = new Map();

function ensureBucket(name, { public: isPublic }) {
  if (!ensured.has(name)) {
    ensured.set(
      name,
      (async () => {
        const client = supabase();
        const { data, error } = await client.storage.getBucket(name);
        if (!error && data) return;
        const { error: createError } = await client.storage.createBucket(name, { public: isPublic });
        if (createError && !/already exists/i.test(createError.message)) {
          throw new Error(`Supabase Storage: gagal membuat bucket "${name}": ${createError.message}`);
        }
      })(),
    );
  }
  return ensured.get(name);
}

/** Memastikan bucket "media" (publik, untuk gambar/video/dokumen) ada. Aman dipanggil berkali-kali. */
export const ensureMediaBucket = () => ensureBucket(MEDIA_BUCKET, { public: true });

/** Memastikan bucket "backups" (privat, untuk file ZIP backup) ada. Aman dipanggil berkali-kali. */
export const ensureBackupBucket = () => ensureBucket(BACKUP_BUCKET, { public: false });

export { MEDIA_BUCKET, BACKUP_BUCKET };
