import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, StatusBadge, Toggle } from '../../components/admin/kit';
import type { DayPoint } from '../../components/admin/VisitsChart';
import { ErrorState, Skeleton } from '../../components/ui';
import { useAuth, useSite, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage, put } from '../../lib/api';
import { formatNumber, timeAgo } from '../../lib/format';

const VisitsChart = lazy(() => import('../../components/admin/VisitsChart'));

interface DashboardData {
  totals: { articles: number; berita: number; opini: number; kritik: number; artikel: number; draft: number; review: number; published: number; archived: number };
  authors: number;
  pending_comments: number;
  total_views: number | null;
  series: DayPoint[];
  recent: { id: string; title: string; type: string; status: string; updated_at: string; scheduled: boolean }[];
  top: { id: string; title: string; url: string; views: number }[];
  activity: { at: string; user: string; action: string; detail: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  'article.create': 'membuat tulisan', 'article.update': 'memperbarui tulisan', 'article.delete': 'menghapus tulisan', 'article.feature': 'mengatur tulisan unggulan',
  'article.status.published': 'menerbitkan tulisan', 'article.status.review': 'mengirim tulisan untuk review', 'article.status.draft': 'mengembalikan tulisan ke draft', 'article.status.archived': 'mengarsipkan tulisan',
  'auth.login': 'masuk', 'auth.logout': 'keluar', 'auth.login_failed': 'gagal masuk', 'media.upload': 'mengunggah media', 'media.delete': 'menghapus media',
  'category.create': 'menambah kategori', 'category.update': 'mengubah kategori', 'category.delete': 'menghapus kategori', 'settings.update': 'mengubah pengaturan', 'settings.editorial': 'mengubah banner/unggulan',
  'backup.create': 'membuat backup', 'backup.restore': 'memulihkan backup', 'user.create': 'membuat pengguna', 'user.update': 'mengubah pengguna', 'user.delete': 'menghapus pengguna',
  'comment.approved': 'menyetujui komentar', 'comment.spam': 'menandai spam', 'comment.delete': 'menghapus komentar', 'submission.received': 'menerima kiriman tulisan',
};

function Stat({ label, value, to, hint }: { label: string; value: number | string; to?: string; hint?: string }) {
  const body = (
    <>
      <p className="meta uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-serif text-3xl font-extrabold">{typeof value === 'number' ? formatNumber(value) : value}</p>
      {hint && <p className="meta mt-0.5">{hint}</p>}
    </>
  );
  return to ? <Link to={to} className="block rounded border border-line bg-card p-4 hover:border-ink">{body}</Link> : <div className="rounded border border-line bg-card p-4">{body}</div>;
}

function BreakingEditor() {
  const { site, reload } = useSite();
  const toast = useToast();
  const [state, setState] = useState({ enabled: Boolean(site?.breaking), text: site?.breaking?.text ?? '', url: site?.breaking?.url ?? '' });
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await put('/admin/settings/editorial', { breaking: state });
      reload();
      toast.success(state.enabled ? 'Banner berita terkini aktif.' : 'Banner dinonaktifkan.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-1 font-serif text-xl font-bold">Banner berita terkini</h2>
      <p className="mb-4 text-sm text-muted">Tampil di bagian paling atas situs. Kosongkan atau nonaktifkan untuk menyembunyikan.</p>
      <form onSubmit={save} className="space-y-3">
        <Toggle checked={state.enabled} onChange={(v) => setState({ ...state, enabled: v })} label="Tampilkan banner" />
        <div>
          <label className="label" htmlFor="b-text">Teks</label>
          <input id="b-text" className="field" maxLength={200} value={state.text} onChange={(e) => setState({ ...state, text: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="b-url">Tautan (opsional)</label>
          <input id="b-url" className="field" placeholder="/berita/judul-berita atau https://…" value={state.url} onChange={(e) => setState({ ...state, url: e.target.value })} />
        </div>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan banner'}</button>
      </form>
    </Card>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user, can } = useAuth();
  const { data, loading, error, reload } = useApi<DashboardData>('/admin/dashboard');

  if (loading && !data) return <div className="space-y-4" role="status" aria-label="Memuat dashboard"><Skeleton className="h-10 w-1/3" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div></div>;
  if (error || !data) return <ErrorState message={error ?? 'Data tidak tersedia'} onRetry={reload} />;

  const t = data.totals;
  const staff = can('stats:view_all');

  return (
    <>
      <PageHeader
        title={`Halo, ${user?.name.split(' ')[0]}`}
        description={staff ? 'Ringkasan aktivitas redaksi.' : 'Ringkasan tulisan Anda.'}
        actions={<Link to="/admin/tulis" className="btn btn-accent">Tulis baru</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total artikel" value={t.articles} to="/admin/artikel" />
        <Stat label="Terbit" value={t.published} to="/admin/artikel?status=published" />
        <Stat label="Menunggu review" value={t.review} to="/admin/artikel?status=review" hint={t.review > 0 && staff ? 'Perlu ditinjau' : undefined} />
        <Stat label="Draft" value={t.draft} to="/admin/artikel?status=draft" />
        <Stat label="Berita" value={t.berita} to="/admin/berita" />
        <Stat label="Opini" value={t.opini} to="/admin/opini" />
        <Stat label="Penulis" value={data.authors} to="/admin/penulis" />
        {staff ? <Stat label="Komentar menunggu" value={data.pending_comments} to="/admin/komentar" /> : <Stat label="Kritik" value={t.kritik} to="/admin/kritik" />}
      </div>

      {staff && (
        <Card className="mt-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-bold">Statistik kunjungan</h2>
            <p className="meta">Total pembacaan artikel: <strong>{formatNumber(data.total_views ?? 0)}</strong></p>
          </div>
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <VisitsChart data={data.series} />
          </Suspense>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <h2 className="mb-3 font-serif text-xl font-bold">Artikel terbaru</h2>
          {data.recent.length === 0 ? <p className="text-sm text-muted">Belum ada tulisan.</p> : (
            <ul className="divide-y divide-line">
              {data.recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/admin/tulis/${a.id}`} className="block truncate font-semibold hover:underline">{a.title}</Link>
                    <p className="meta">{a.type} · {timeAgo(a.updated_at)}</p>
                  </div>
                  <StatusBadge status={a.status} scheduled={a.scheduled} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-xl font-bold">Paling banyak dibaca</h2>
          {data.top.length === 0 ? <p className="text-sm text-muted">Belum ada data pembacaan.</p> : (
            <ol className="divide-y divide-line">
              {data.top.map((a, i) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 font-serif text-xl font-extrabold text-line" aria-hidden="true">{i + 1}</span>
                  <Link to={a.url} target="_blank" className="min-w-0 flex-1 truncate hover:underline">{a.title}</Link>
                  <span className="meta shrink-0">{formatNumber(a.views)}×</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {staff && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <h2 className="mb-3 font-serif text-xl font-bold">Aktivitas terbaru</h2>
            {data.activity.length === 0 ? <p className="text-sm text-muted">Belum ada aktivitas.</p> : (
              <ul className="space-y-2.5 text-sm">
                {data.activity.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    <strong>{a.user}</strong> {ACTION_LABELS[a.action] ?? a.action}
                    {a.detail && <span className="text-muted"> — {a.detail.length > 60 ? `${a.detail.slice(0, 60)}…` : a.detail}</span>}
                    <span className="meta ml-1.5">{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {can('articles:feature') && <BreakingEditor />}
        </div>
      )}
    </>
  );
}
