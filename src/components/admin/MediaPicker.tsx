import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Check, Search, UploadCloud } from 'lucide-react';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { errorMessage, qs, upload } from '../../lib/api';
import { Modal } from './kit';
import { EmptyState, ErrorState, Spinner } from '../ui';

export interface MediaItem {
  id: string;
  kind: 'image' | 'video' | 'document';
  name: string;
  original_name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  url: string;
  thumb: string | null;
  uploaded_by: string | null;
  demo: boolean;
  created_at: string;
}

interface MediaList {
  items: MediaItem[];
  total: number;
  page: number;
  pages: number;
}

export const mediumUrl = (item: Pick<MediaItem, 'url'>) => item.url.replace(/\.webp$/, '-960.webp');

/** Mengunggah satu atau banyak file ke Media Library; mengembalikan item yang berhasil. */
export function useUploader(onDone?: (items: MediaItem[]) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      const uploaded: MediaItem[] = [];
      try {
        for (let i = 0; i < files.length; i += 5) {
          const form = new FormData();
          files.slice(i, i + 5).forEach((f) => form.append('files', f));
          try {
            const res = await upload<{ items: MediaItem[]; errors: { name: string; error: string }[] }>('/admin/media', form);
            uploaded.push(...res.items);
            res.errors.forEach((e) => toast.error(`${e.name}: ${e.error}`));
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }
        if (uploaded.length) toast.success(`${uploaded.length} file berhasil diunggah.`);
        onDone?.(uploaded);
      } finally {
        setBusy(false);
      }
    },
    [toast, onDone],
  );
  return { run, busy };
}

export function DropZone({ onFiles, busy, accept }: { onFiles: (files: File[]) => void; busy: boolean; accept: string }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFiles(Array.from(e.dataTransfer.files));
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={`rounded border-2 border-dashed p-5 text-center transition-colors ${over ? 'border-accent bg-soft' : 'border-line'}`}
    >
      <UploadCloud className="mx-auto size-7 text-muted" aria-hidden="true" />
      <p className="mt-1 text-sm">Seret file ke sini, atau</p>
      <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Mengunggah…' : 'Pilih file'}
      </button>
      <input ref={input} type="file" multiple accept={accept} className="sr-only" tabIndex={-1} aria-label="Pilih file untuk diunggah" onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    </div>
  );
}

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export function MediaPicker({ onSelect, onClose, title = 'Pilih gambar' }: { onSelect: (item: MediaItem) => void; onClose: () => void; title?: string }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi<MediaList>(`/admin/media${qs({ kind: 'image', q, page, limit: 18 })}`);
  const uploader = useUploader(() => {
    setPage(1);
    list.reload();
  });

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" className="field pl-9" placeholder="Cari nama file" aria-label="Cari gambar" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <DropZone onFiles={uploader.run} busy={uploader.busy} accept={IMAGE_ACCEPT} />
        {list.loading && !list.data ? (
          <Spinner label="Memuat gambar" />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.data && list.data.items.length === 0 ? (
          <EmptyState title="Belum ada gambar" text="Unggah gambar melalui area di atas." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {list.data?.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelect(m)} className="group relative block w-full overflow-hidden rounded border border-line text-left hover:border-accent" aria-label={`Pilih ${m.name}`}>
                  <img src={m.thumb ?? m.url} alt="" loading="lazy" width={m.width ?? 480} height={m.height ?? 320} className="aspect-square w-full bg-soft object-cover" />
                  <span className="block truncate px-2 py-1 text-xs">{m.name}</span>
                  <span className="absolute right-1 top-1 hidden size-6 place-items-center rounded-full bg-accent text-accent-ink group-hover:grid"><Check className="size-4" aria-hidden="true" /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.data && list.data.pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <span className="text-sm">{page} / {list.data.pages}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
