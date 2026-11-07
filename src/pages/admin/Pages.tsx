import { Suspense, lazy, useState } from 'react';
import { Pencil } from 'lucide-react';
import { PageHeader } from '../../components/admin/kit';
import { ErrorState, Field, Spinner } from '../../components/ui';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage, put } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

const RichEditor = lazy(() => import('../../components/admin/RichEditor'));
interface Page { slug: string; title: string; content: string; updated_at: string; system?: boolean }

function PageEditor({ page, onBack, onSaved }: { page: Page; onBack: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim()) return toast.error('Judul tidak boleh kosong');
    setBusy(true);
    try { await put(`/admin/pages/${page.slug}`, { title, content }); toast.success('Halaman disimpan.'); onSaved(); onBack(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title={`Edit: ${page.title}`} description={`Alamat publik: /halaman/${page.slug}`} actions={<><button type="button" className="btn btn-ghost" onClick={onBack}>Kembali</button><button type="button" className="btn btn-accent" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></>} />
      <div className="space-y-4">
        <Field label="Judul halaman">{(id) => <input id={id} className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Suspense fallback={<Spinner label="Memuat editor" />}><RichEditor value={content} onChange={setContent} resetKey={page.slug} /></Suspense>
      </div>
    </>
  );
}

export default function Pages() {
  useDocumentTitle('Halaman');
  const { data, loading, error, reload } = useApi<{ items: Page[] }>('/admin/pages');
  const [editing, setEditing] = useState<Page | null>(null);
  if (editing) return <PageEditor page={editing} onBack={() => setEditing(null)} onSaved={reload} />;
  return (
    <>
      <PageHeader title="Halaman statis" description="Tentang Kami, Kontak, Pedoman, Privasi, dan Syarat. Tinjau isi awalnya sebelum situs dipublikasikan." />
      {loading && !data ? <Spinner label="Memuat halaman" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card">
          {data?.items.map((p) => (
            <li key={p.slug} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="font-semibold">{p.title}</p><p className="meta">/halaman/{p.slug} · diubah {formatDateTime(p.updated_at)}</p></div>
              <button type="button" className="icon-btn border border-line" onClick={() => setEditing(p)} aria-label={`Edit ${p.title}`}><Pencil className="size-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
