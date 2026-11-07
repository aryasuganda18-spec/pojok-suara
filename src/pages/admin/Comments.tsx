import { useState } from 'react';
import { Check, ShieldAlert, Trash2 } from 'lucide-react';
import { ConfirmDialog, PageHeader, Tabs } from '../../components/admin/kit';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, patch, qs } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

type Status = '' | 'pending' | 'approved' | 'spam';
interface Row { id: string; article_id: string; name: string; email: string; body: string; status: Exclude<Status, ''>; created_at: string; article_title: string; article_url: string | null }
interface List { items: Row[]; total: number; page: number; pages: number }
const LABEL = { pending: 'Menunggu', approved: 'Disetujui', spam: 'Spam' } as const;

export default function Comments() {
  useDocumentTitle('Komentar');
  const toast = useToast();
  const [status, setStatus] = useState<Status>('pending');
  const [page, setPage] = useState(1);
  const list = useApi<List>(`/admin/comments${qs({ status, page, limit: 20 })}`);
  const [doomed, setDoomed] = useState<Row | null>(null);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); list.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const setTo = (c: Row, s: Exclude<Status, ''>) => act(() => patch(`/admin/comments/${c.article_id}/${c.id}`, { status: s }), `Komentar ditandai ${LABEL[s].toLowerCase()}.`);

  return (
    <>
      <PageHeader title="Komentar" description="Komentar baru menunggu persetujuan sebelum tampil di situs." />
      <Tabs<Status> value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: 'pending', label: 'Menunggu' }, { value: 'approved', label: 'Disetujui' }, { value: 'spam', label: 'Spam' }, { value: '', label: 'Semua' }]} />
      {list.loading && !list.data ? <Spinner label="Memuat komentar" /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.items.length ? <EmptyState title="Tidak ada komentar" /> : (
        <ul className="space-y-3">
          {list.data.items.map((c) => (
            <li key={c.id} className="rounded border border-line bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{c.name} <span className="meta font-normal">{c.email}</span></p>
                <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold">{LABEL[c.status]}</span>
              </div>
              <p className="meta">pada {c.article_url ? <a className="underline" href={c.article_url} target="_blank" rel="noreferrer">{c.article_title}</a> : c.article_title} · {formatDateTime(c.created_at)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status !== 'approved' && <button type="button" className="btn btn-sm" onClick={() => setTo(c, 'approved')}><Check className="size-4" aria-hidden="true" /> Setujui</button>}
                {c.status !== 'spam' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTo(c, 'spam')}><ShieldAlert className="size-4" aria-hidden="true" /> Spam</button>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDoomed(c)}><Trash2 className="size-4" aria-hidden="true" /> Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.data && list.data.pages > 1 && <Pagination page={page} pages={list.data.pages} onChange={setPage} />}
      {doomed && <ConfirmDialog title="Hapus komentar?" message="Komentar akan dihapus permanen." onClose={() => setDoomed(null)} onConfirm={() => { const c = doomed; setDoomed(null); void act(() => del(`/admin/comments/${c.article_id}/${c.id}`), 'Komentar dihapus.'); }} />}
    </>
  );
}
