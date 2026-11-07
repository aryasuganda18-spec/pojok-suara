import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { ConfirmDialog, PageHeader } from '../../components/admin/kit';
import { EmptyState, ErrorState, Spinner } from '../../components/ui';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

interface Sub { id: string; email: string; created_at: string }

export default function Newsletter() {
  useDocumentTitle('Newsletter');
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: Sub[]; total: number }>('/admin/newsletter');
  const [doomed, setDoomed] = useState<Sub | null>(null);

  const remove = async () => {
    if (!doomed) return;
    try { await del(`/admin/newsletter/${doomed.id}`); toast.success('Pelanggan dihapus.'); reload(); } catch (err) { toast.error(errorMessage(err)); }
    setDoomed(null);
  };

  return (
    <>
      <PageHeader title="Newsletter" description={data ? `${data.total} pelanggan.` : undefined} actions={<a className="btn btn-ghost" href="/api/admin/newsletter/export" download><Download className="size-4" aria-hidden="true" /> Ekspor CSV</a>} />
      {loading && !data ? <Spinner label="Memuat pelanggan" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.items.length ? <EmptyState title="Belum ada pelanggan" /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card">
          {data.items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.email}</p><p className="meta">{formatDateTime(s.created_at)}</p></div>
              <button type="button" className="icon-btn border border-line" onClick={() => setDoomed(s)} aria-label={`Hapus ${s.email}`}><Trash2 className="size-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      {doomed && <ConfirmDialog title="Hapus pelanggan?" message={<><strong>{doomed.email}</strong> akan dihapus dari daftar.</>} onConfirm={remove} onClose={() => setDoomed(null)} />}
    </>
  );
}
