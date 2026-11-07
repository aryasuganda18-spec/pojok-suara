import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader } from '../../components/admin/kit';
import { EmptyState, ErrorState, Field, Skeleton } from '../../components/ui';
import { useAuth, useSite, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError, del, errorMessage, post, put } from '../../lib/api';
import { slugify } from '../../lib/format';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  article_count: number;
}

function CategoryForm({ initial, onClose, onSaved }: { initial?: Category; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [touched, setTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Nama minimal 2 karakter');
    setBusy(true);
    try {
      const body = { name, slug: slug || slugify(name), description };
      if (initial) await put(`/admin/categories/${initial.id}`, body);
      else await post('/admin/categories', body);
      toast.success(initial ? 'Kategori diperbarui.' : 'Kategori ditambahkan.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? 'Edit kategori' : 'Tambah kategori'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Nama" error={error}>{(id, d) => <input id={id} aria-describedby={d} className="field" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />}</Field>
        <Field label="Slug" hint={`Alamat: /kategori/${slug || '…'}. Mengubah slug mengubah alamat kategori.`}>{(id, d) => <input id={id} aria-describedby={d} className="field" value={slug} onChange={(e) => { setTouched(true); setSlug(slugify(e.target.value)); }} />}</Field>
        <Field label="Deskripsi">{(id) => <textarea id={id} className="field !min-h-20" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  useDocumentTitle('Kategori');
  const { can } = useAuth();
  const { reload: reloadSite } = useSite();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: Category[] }>('/admin/categories');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [doomed, setDoomed] = useState<Category | null>(null);
  const [reassign, setReassign] = useState('');
  const [busy, setBusy] = useState(false);
  const manage = can('categories:manage');

  const refresh = () => { reload(); reloadSite(); };

  const move = async (index: number, dir: -1 | 1) => {
    if (!data) return;
    const ids = data.items.map((c) => c.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await put('/admin/categories/order', { ids });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!doomed) return;
    setBusy(true);
    try {
      await del(`/admin/categories/${doomed.id}${reassign ? `?reassign=${reassign}` : ''}`);
      toast.success('Kategori dihapus.');
      setDoomed(null);
      setReassign('');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Kategori" description="Atur kategori, slug, deskripsi, dan urutan tampil." actions={manage && <button type="button" className="btn btn-accent" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden="true" /> Tambah</button>} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.items.length ? <EmptyState title="Belum ada kategori" /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card">
          {data.items.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 p-3">
              {manage && (
                <div className="flex flex-col">
                  <button type="button" className="icon-btn !size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Naikkan ${c.name}`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                  <button type="button" className="icon-btn !size-8" onClick={() => move(i, 1)} disabled={i === data.items.length - 1} aria-label={`Turunkan ${c.name}`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name} <span className="meta font-normal">/{c.slug}</span></p>
                {c.description && <p className="truncate text-sm text-muted">{c.description}</p>}
              </div>
              <span className="meta shrink-0">{c.article_count} tulisan</span>
              {manage && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="icon-btn border border-line" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
                  <button type="button" className="icon-btn border border-line" onClick={() => { setDoomed(c); setReassign(''); }} aria-label={`Hapus ${c.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <CategoryForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {doomed && (
        <ConfirmDialog title={`Hapus kategori “${doomed.name}”?`} busy={busy || (doomed.article_count > 0 && !reassign)} onConfirm={remove} onClose={() => setDoomed(null)}
          message={doomed.article_count > 0 ? <>Kategori ini dipakai <strong>{doomed.article_count} tulisan</strong>. Pilih kategori pengganti agar tulisan tidak kehilangan kategori.</> : 'Kategori ini tidak dipakai tulisan mana pun.'}>
          {doomed.article_count > 0 && (
            <Field label="Pindahkan tulisan ke">{(id) => (
              <select id={id} className="field" value={reassign} onChange={(e) => setReassign(e.target.value)}>
                <option value="">— Pilih kategori pengganti —</option>
                {data?.items.filter((c) => c.id !== doomed.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}</Field>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
