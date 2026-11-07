import { z } from 'zod';

z.config(z.locales.id());

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (message = 'Data tidak ditemukan') => new HttpError(404, message);
export const forbidden = (message = 'Anda tidak memiliki izin untuk tindakan ini') => new HttpError(403, message);

/** Validasi dengan Zod; gagal -> HttpError 400 berisi daftar kolom yang bermasalah. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  const first = issues[0];
  const label = first?.field ? `${first.field}: ` : '';
  throw new HttpError(400, `Data tidak valid. ${label}${first?.message ?? ''}`.trim(), issues);
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Data yang dikirim terlalu besar' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Format JSON tidak valid' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran file melebihi batas yang diizinkan' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'Upload gagal: ' + err.message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).type('text/plain').send(err.status === 404 ? 'Tidak ditemukan' : 'Permintaan tidak valid');
  }
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
}
