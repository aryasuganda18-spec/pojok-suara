import { useState, type FormEvent } from 'react';
import { Copy, FileText, Film, Pencil, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader, Tabs } from '../../components/admin/kit';
import { DropZone, useUploader, type MediaItem } from '../../components/admin/MediaPicker';
import { EmptyState, ErrorState, Field, Pagination, Spinner } from '../../components/ui';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, patch, qs } from '../../lib/api';
import { formatBytes, formatShortDate } from '../../lib/format';

type Kind = '' | 'image' | 'video' | 'document';
interface MediaList { items: MediaItem[]; total: number; page: number; pages: number }

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,.jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf';

function Preview({ m }: { m: MediaItem }) {
  if (m.kind === 'image') return <img src={m.thumb ?? m.url} alt={m.alt} loading="lazy" width={m.width ?? 480} height={m.height ?? 320} className="aspect-square w-full bg-soft object-cover" />;
  const Icon = m.kind === 'video' ? Film : FileText;
  return <div className="grid aspect-square w-full place-items-center bg-soft text-muted"><Icon className="size-10" aria-hidden="true" /></div>;
}

function EditMedia({ item, onClose, onSaved }: { item: MediaItem; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [alt, setAlt] = useState(item.alt);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Nama file tidak boleh kosong');
    setBusy(true);
    try {
      await patch(`/admin/media/${item.id}`, { name, alt });
      toast.success('File diperbarui.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Detail file" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="mx-auto max-w-48 overflow-hidden rounded border border-line"><Preview m={item} /></div>
        <Field label="Nama file">{(id) => <input id={id} className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        {item.kind === 'image' && <Field label="Teks alternatif" hint="Deskripsi gambar untuk pembaca layar dan SEO.">{(id, d) => <input id={id} aria-describedby={d} className="field" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} />}</Field>}
        <p className="meta">{item.mime} · {formatBytes(item.size)}{item.width ? ` · ${item.width}×${item.height}` : ''} · diunggah {formatShortDate(item.created_at)}</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
    </Modal>
  );
}

export default function MediaLibrary() {
  useDocumentTitle('Media');
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi<MediaList>(`/admin/media${qs({ kind, q, page, limit: 24 })}`);
  const uploader = useUploader(() => { setPage(1); list.reload(); });
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [doomed, setDoomed] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = async (m: MediaItem) => {
    try {
      await navigator.clipboard.writeText(new URL(m.url, location.origin).href);
      toast.success('Alamat file disalin.');
    } catch {
      toast.error('Tidak dapat menyalin. Salin manual: ' + m.url);
    }
  };
  const remove = async () => {
    if (!doomed) return;
    setBusy(true);
    try {
      await del(`/admin/media/${doomed.id}`);
      toast.success('File dihapus.');
      setDoomed(null);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Media" description="Gambar, video, dan dokumen. Gambar otomatis dikonversi ke WebP dan dibuat versi kecilnya." />
      <DropZone onFiles={uploader.run} busy={uploader.busy} accept={ACCEPT} />
      <div className="my-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input type="search" className="field pl-9" placeholder="Cari nama file" aria-label="Cari file" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <Tabs<Kind> value={kind} onChange={(v) => { setKind(v); setPage(1); }} tabs={[{ value: '', label: 'Semua' }, { value: 'image', label: 'Gambar' }, { value: 'video', label: 'Video' }, { value: 'document', label: 'Dokumen' }]} />
      {list.loading && !list.data ? <Spinner label="Memuat media" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <EmptyState title="Belum ada file" text="Seret file ke area unggah di atas." /> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {list.data.items.map((m) => (
            <li key={m.id} className="overflow-hidden rounded border border-line bg-card">
              <Preview m={m} />
              <div className="p-2">
                <p className="truncate text-sm font-semibold" title={m.name}>{m.name}</p>
                <p className="meta">{formatBytes(m.size)}{m.demo ? ' · contoh' : ''}</p>
                <div className="mt-1 flex gap-1">
                  <button type="button" className="icon-btn !size-9 border border-line" onClick={() => copy(m)} aria-label={`Salin alamat ${m.name}`}><Copy className="size-4" aria-hidden="true" /></button>
                  <button type="button" className="icon-btn !size-9 border border-line" onClick={() => setEditing(m)} aria-label={`Ubah ${m.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                  <button type="button" className="icon-btn !size-9 border border-line" onClick={() => setDoomed(m)} aria-label={`Hapus ${m.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.data && list.data.pages > 1 && <Pagination page={page} pages={list.data.pages} onChange={setPage} />}
      {editing && <EditMedia item={editing} onClose={() => setEditing(null)} onSaved={list.reload} />}
      {doomed && <ConfirmDialog title="Hapus file?" busy={busy} message={<>File <strong>{doomed.name}</strong> akan dihapus permanen. Tulisan yang memakainya akan menampilkan gambar kosong.</>} onConfirm={remove} onClose={() => setDoomed(null)} />}
    </>
  );
}
