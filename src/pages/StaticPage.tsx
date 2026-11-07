import { useParams } from 'react-router-dom';
import { ErrorState, Skeleton } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatDate } from '../lib/format';
import NotFound from './NotFound';

interface PageData {
  slug: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function StaticPage({ slug: fixed }: { slug?: string }) {
  const params = useParams();
  const slug = fixed ?? params.slug;
  const { data, loading, error, status, reload } = useApi<PageData>(slug ? `/pages/${slug}` : null);
  useDocumentTitle(data?.title);

  if (status === 404) return <NotFound />;
  return (
    <div className="container-page max-w-3xl py-8 md:py-12">
      {loading && !data ? (
        <div role="status" aria-label="Memuat halaman" className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      ) : error || !data ? (
        <ErrorState message={error ?? 'Halaman tidak tersedia'} onRetry={reload} />
      ) : (
        <>
          <h1 className="font-serif text-3xl font-extrabold sm:text-4xl">{data.title}</h1>
          <hr className="rule" />
          <div className="prose-article mt-6" dangerouslySetInnerHTML={{ __html: data.content }} />
          <p className="meta mt-10">Terakhir diperbarui {formatDate(data.updated_at)}</p>
        </>
      )}
    </div>
  );
}
