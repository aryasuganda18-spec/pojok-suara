const TZ = 'Asia/Jakarta';

const longDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const dateTime = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });

export const formatDate = (iso?: string | null) => (iso ? longDate.format(new Date(iso)) : '');
export const formatShortDate = (iso?: string | null) => (iso ? shortDate.format(new Date(iso)) : '');
export const formatDateTime = (iso?: string | null) => (iso ? dateTime.format(new Date(iso)) : '');

export function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatShortDate(iso);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);

export const TYPE_LABELS: Record<string, string> = { berita: 'Berita', opini: 'Opini', kritik: 'Kritik', artikel: 'Artikel' };
export const STATUS_LABELS: Record<string, string> = { draft: 'Draft', review: 'Menunggu review', published: 'Terbit', archived: 'Arsip' };

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Konversi ISO UTC <-> nilai input datetime-local (waktu lokal browser). */
export function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const localInputToIso = (value: string): string | null => (value ? new Date(value).toISOString() : null);
