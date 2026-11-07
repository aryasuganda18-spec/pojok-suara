import { PageHeader } from '../../components/admin/kit';
import { EmptyState, ErrorState, Spinner } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/format';

interface Log { at: string; user: string; action: string; target: string; detail: string }

export default function Logs() {
  useDocumentTitle('Log aktivitas');
  const { data, loading, error, reload } = useApi<{ items: Log[] }>('/admin/logs?limit=200');
  return (
    <>
      <PageHeader title="Log aktivitas" description="200 aktivitas terbaru: login, penerbitan, perubahan pengaturan, backup, dan lainnya." />
      {loading && !data ? <Spinner label="Memuat log" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.items.length ? <EmptyState title="Belum ada aktivitas" /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card text-sm">
          {data.items.map((l, i) => (
            <li key={i} className="p-3">
              <p><span className="font-semibold">{l.user}</span> · <code className="rounded bg-soft px-1.5 py-0.5 text-xs">{l.action}</code></p>
              {l.detail && <p className="break-words text-muted">{l.detail}</p>}
              <p className="meta">{formatDateTime(l.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
