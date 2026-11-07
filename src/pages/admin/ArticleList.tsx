import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Pencil, Search, Star, Trash2 } from 'lucide-react';
import { ConfirmDialog, PageHeader, StatusBadge, Tabs } from '../../components/admin/kit';
import { EmptyState, ErrorState, Pagination, Skeleton } from '../../components/ui';
import { useAuth, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, post, qs } from '../../lib/api';
import { formatShortDate, formatNumber, TYPE_LABELS } from '../../lib/format';

interface Row {
  id: string;
  type: string;
  title: string;
  url: string;
  status: string;
  scheduled: boolean;
  published_at: string | null;
  updated_at: string;
  category: string | null;
  author: string | null;
  source: string;
  views: number;
  thumb: string | null;
  demo: boolean;
  is_hero: boolean;
  is_pick: boolean;
  permissions: { can_edit: boolean; can_delete: boolean };
}

interface ListData {
  items: Row[];
  total: number;
  page: number;
  pages: number;
  counts: { all: number; draft: number; review: number; published: number; archived: number };
}

const TITLES: Record<string, string> = { berita: 'Berita', opini: 'Opini', kritik: 'Kritik', '': 'Semua artikel' };

export default function ArticleList({ type = '' }: { type?: string }) {
  const { can } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const [search, setSearch] = useState(q);
  const [doomed, setDoomed] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  useDocumentTitle(TITLES[type]);
  const { data, loading, error, reload } = useApi<ListData>(`/admin/articles${qs({ type, status, q, page, limit: 15 })}`);

  const update = (next: Record<string, string>) => {
    const copy = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) (v ? copy.set(k, v) : copy.delete(k));
    if (!('page' in next)) copy.delete('page');
    setSp(copy);
  };

  const remove = async () => {
    if (!doomed) return;
    setBusy(true);
    try {
      await del(`/admin/articles/${doomed.id}`);
      toast.success('Tulisan dihapus.');
      setDoomed(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const feature = async (row: Row, body: { hero?: boolean; pick?: boolean }) => {
    try {
      await post(`/admin/articles/${row.id}/feature`, body);
      toast.success(body.hero ? 'Dijadikan tulisan utama beranda.' : body.pick !== undefined ? (body.pick ? 'Ditambahkan ke Pilihan Redaksi.' : 'Dihapus dari Pilihan Redaksi.') : 'Diperbarui.');
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const canFeature = can('articles:feature');
  const c = data?.counts;

  return (
    <>
      <PageHeader title={TITLES[type]} actions={<Link to={`/admin/tulis${type ? `?jenis=${type}` : ''}`} className="btn btn-accent">Tulis baru</Link>} />

      <Tabs
        value={status}
        onChange={(v) => update({ status: v })}
        tabs={[
          { value: '', label: 'Semua', count: c?.all },
          { value: 'published', label: 'Terbit', count: c?.published },
          { value: 'review', label: 'Review', count: c?.review },
          { value: 'draft', label: 'Draft', count: c?.draft },
          { value: 'archived', label: 'Arsip', count: c?.archived },
        ]}
      />

      <form className="mb-4 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" className="field pl-9" placeholder="Cari judul, penulis, kategori, tag" aria-label="Cari tulisan" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-ghost">Cari</button>
      </form>

      {loading && !data ? (
        <div className="space-y-2" role="status" aria-label="Memuat">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <EmptyState title="Tidak ada tulisan" text={q || status ? 'Coba ubah filter atau kata kunci.' : 'Mulai dengan menulis tulisan pertama.'} action={<Link to="/admin/tulis" className="btn">Tulis baru</Link>} />
      ) : (
        data && (
          <>
            <ul className="divide-y divide-line rounded border border-line bg-card">
              {data.items.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {r.thumb ? <img src={r.thumb} alt="" width={64} height={64} loading="lazy" className="size-16 shrink-0 rounded-sm bg-soft object-cover" /> : <span className="grid size-16 shrink-0 place-items-center rounded-sm bg-soft text-xs text-muted" aria-hidden="true">{TYPE_LABELS[r.type]?.slice(0, 3)}</span>}
                    <div className="min-w-0">
                      <Link to={`/admin/tulis/${r.id}`} className="line-clamp-2 font-semibold leading-snug hover:underline">{r.title}</Link>
                      <p className="meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{TYPE_LABELS[r.type]}</span>
                        {r.category && <span>· {r.category}</span>}
                        {r.author && <span>· {r.author}</span>}
                        <span>· {formatShortDate(r.published_at ?? r.updated_at)}</span>
                        {r.status === 'published' && <span>· {formatNumber(r.views)}×</span>}
                      </p>
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge status={r.status} scheduled={r.scheduled} />
                        {r.source === 'public' && <span className="rounded-full bg-sky-600/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">Kiriman publik</span>}
                        {r.demo && <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold text-muted">Contoh</span>}
                        {r.is_hero && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">Utama</span>}
                        {r.is_pick && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">Pilihan redaksi</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                    {r.permissions.can_edit && <Link to={`/admin/tulis/${r.id}`} className="icon-btn border border-line" aria-label={`Edit ${r.title}`}><Pencil className="size-4" aria-hidden="true" /></Link>}
                    {r.status === 'published' && !r.scheduled && <Link to={r.url} target="_blank" className="icon-btn border border-line" aria-label={`Lihat ${r.title} (tab baru)`}><ExternalLink className="size-4" aria-hidden="true" /></Link>}
                    {canFeature && r.status === 'published' && !r.scheduled && (
                      <button type="button" className={`icon-btn border border-line ${r.is_pick ? 'text-accent' : ''}`} onClick={() => feature(r, { pick: !r.is_pick })} aria-pressed={r.is_pick} aria-label={r.is_pick ? 'Hapus dari Pilihan Redaksi' : 'Jadikan Pilihan Redaksi'}><Star className={`size-4 ${r.is_pick ? 'fill-current' : ''}`} aria-hidden="true" /></button>
                    )}
                    {canFeature && r.status === 'published' && !r.scheduled && !r.is_hero && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => feature(r, { hero: true })}>Jadikan utama</button>
                    )}
                    {r.permissions.can_delete && <button type="button" className="icon-btn border border-line" onClick={() => setDoomed(r)} aria-label={`Hapus ${r.title}`}><Trash2 className="size-4" aria-hidden="true" /></button>}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} onChange={(p) => update({ page: String(p) })} />
          </>
        )
      )}

      {doomed && (
        <ConfirmDialog title="Hapus tulisan?" message={<>Tulisan <strong>“{doomed.title}”</strong> beserta komentar dan riwayat revisinya akan dihapus permanen. Buat backup bila ragu.</>} busy={busy} onConfirm={remove} onClose={() => setDoomed(null)} />
      )}
    </>
  );
}
