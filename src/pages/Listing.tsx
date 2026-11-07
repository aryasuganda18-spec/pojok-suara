import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ArticleCard } from '../components/ArticleCard';
import { Avatar, EmptyState, ErrorState, GridSkeleton, Pagination } from '../components/ui';
import { useSite } from '../hooks/contexts';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { qs } from '../lib/api';
import { formatDate } from '../lib/format';
import type { ArticleCard as Card, Paged, PublicAuthor } from '../lib/types';
import NotFound from './NotFound';

export type ListingMode = 'type' | 'category' | 'tag' | 'author' | 'search';

const TYPE_INFO: Record<string, { title: string; text: string }> = {
  berita: { title: 'Berita', text: 'Kabar terbaru yang kami verifikasi dan sajikan apa adanya.' },
  opini: { title: 'Opini', text: 'Pandangan penulis atas isu yang sedang dibicarakan.' },
  kritik: { title: 'Kritik Sosial', text: 'Kritik terhadap kebijakan, praktik, dan ketimpangan.' },
  artikel: { title: 'Artikel', text: 'Tulisan editorial dan analisis mendalam.' },
};

export default function Listing({ mode, type }: { mode: ListingMode; type?: string }) {
  const params = useParams();
  const { site } = useSite();
  const [sp, setSp] = useSearchParams();

  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  const q = sp.get('q') ?? '';
  const sort = sp.get('sort') ?? (mode === 'search' && q ? 'relevance' : 'latest');
  const categoryFilter = sp.get('kategori') ?? '';
  const from = sp.get('dari') ?? '';
  const to = sp.get('sampai') ?? '';

  const category = mode === 'category' ? site?.categories.find((c) => c.slug === params.slug) : null;
  const authorPath = mode === 'author' ? `/authors/${params.username}` : null;
  const author = useApi<PublicAuthor>(authorPath);

  const query = useMemo(
    () =>
      qs({
        type: mode === 'type' ? type : undefined,
        category: mode === 'category' ? params.slug : mode === 'search' ? categoryFilter : undefined,
        tag: mode === 'tag' ? params.tag : undefined,
        author: mode === 'author' ? params.username : undefined,
        q: mode === 'search' ? q : undefined,
        from: mode === 'search' ? from : undefined,
        to: mode === 'search' ? to : undefined,
        sort,
        page,
        limit: site?.per_page ?? 12,
      }),
    [mode, type, params.slug, params.tag, params.username, q, categoryFilter, from, to, sort, page, site?.per_page],
  );

  const ready = Boolean(site) && (mode !== 'category' || category !== undefined);
  const list = useApi<Paged<Card>>(ready ? `/articles${query}` : null);

  const title =
    mode === 'type' ? TYPE_INFO[type ?? 'artikel']?.title
    : mode === 'category' ? category?.name
    : mode === 'tag' ? `#${params.tag}`
    : mode === 'author' ? author.data?.name
    : q ? `Hasil untuk “${q}”` : 'Pencarian';
  useDocumentTitle(title);

  if (mode === 'category' && site && !category) return <NotFound />;
  if (mode === 'author' && author.status === 404) return <NotFound />;

  const update = (next: Record<string, string>) => {
    const copy = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(next)) {
      if (v) copy.set(k, v);
      else copy.delete(k);
    }
    if (!('page' in next)) copy.delete('page');
    setSp(copy);
  };

  const description =
    mode === 'type' ? TYPE_INFO[type ?? 'artikel']?.text
    : mode === 'category' ? category?.description
    : mode === 'tag' ? 'Tulisan dengan tag ini.'
    : mode === 'search' && list.data ? `${list.data.total} tulisan ditemukan` : '';

  return (
    <div className="container-page py-6 md:py-10">
      {mode === 'author' ? (
        <header className="mb-8 flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-center">
          {author.data ? (
            <>
              <Avatar src={author.data.avatar?.medium} name={author.data.name} size={96} />
              <div>
                <p className="kicker">Penulis</p>
                <h1 className="font-serif text-3xl font-extrabold">{author.data.name}</h1>
                {author.data.bio && <p className="mt-2 max-w-2xl text-muted">{author.data.bio}</p>}
                <p className="meta mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{author.data.article_count} tulisan</span>
                  <span>Bergabung {formatDate(author.data.joined_at)}</span>
                  {author.data.fields.length > 0 && <span>{author.data.fields.join(' · ')}</span>}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
                  {author.data.email && (
                    <a className="inline-flex min-h-9 items-center gap-1 text-accent hover:underline" href={`mailto:${author.data.email}`}>
                      <Mail className="size-4" aria-hidden="true" /> {author.data.email}
                    </a>
                  )}
                  {author.data.social.website && (
                    <a className="inline-flex min-h-9 items-center text-accent hover:underline" href={author.data.social.website} rel="noopener noreferrer nofollow" target="_blank">
                      Situs web
                    </a>
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="meta">Memuat profil…</p>
          )}
        </header>
      ) : (
        <header className="mb-6 border-b border-line pb-6">
          <p className="kicker">{mode === 'search' ? 'Pencarian' : mode === 'tag' ? 'Tag' : mode === 'category' ? 'Kategori' : 'Rubrik'}</p>
          <h1 className="font-serif text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
        </header>
      )}

      {mode === 'search' && (
        <form
          role="search"
          className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update({ q: String(f.get('q') ?? '').trim(), kategori: String(f.get('kategori') ?? ''), dari: String(f.get('dari') ?? ''), sampai: String(f.get('sampai') ?? ''), sort: String(f.get('sort') ?? '') });
          }}
        >
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="label" htmlFor="f-q">Kata kunci</label>
            <input id="f-q" name="q" type="search" defaultValue={q} className="field" placeholder="Judul, isi, penulis, tag" />
          </div>
          <div>
            <label className="label" htmlFor="f-kat">Kategori</label>
            <select id="f-kat" name="kategori" defaultValue={categoryFilter} className="field">
              <option value="">Semua</option>
              {site?.categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-dari">Dari tanggal</label>
            <input id="f-dari" name="dari" type="date" defaultValue={from} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="f-sampai">Sampai tanggal</label>
            <input id="f-sampai" name="sampai" type="date" defaultValue={to} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="f-sort">Urutkan</label>
            <select id="f-sort" name="sort" defaultValue={sort} className="field">
              <option value="relevance">Paling relevan</option>
              <option value="latest">Terbaru</option>
              <option value="popular">Terpopuler</option>
            </select>
          </div>
          <button type="submit" className="btn sm:col-span-2 lg:col-span-5 lg:justify-self-start">Terapkan</button>
        </form>
      )}

      {mode !== 'search' && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="meta">{list.data ? `${list.data.total} tulisan` : ''}</p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="meta">Urutkan</label>
            <select id="sort" className="field !min-h-10 !w-auto !py-1 text-sm" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="latest">Terbaru</option>
              <option value="popular">Terpopuler</option>
            </select>
          </div>
        </div>
      )}

      {list.loading && !list.data ? (
        <GridSkeleton count={6} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title={mode === 'search' ? 'Tidak ada hasil' : 'Belum ada tulisan di sini'}
          text={mode === 'search' ? 'Coba kata kunci lain, kurangi filter, atau periksa ejaan.' : 'Tulisan akan muncul setelah diterbitkan oleh redaksi.'}
          action={<Link to="/" className="btn btn-ghost">Kembali ke beranda</Link>}
        />
      ) : (
        list.data && (
          <>
            <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {list.data.items.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
            <Pagination
              page={list.data.page}
              pages={list.data.pages}
              onChange={(p) => {
                update({ page: String(p) });
                window.scrollTo({ top: 0 });
              }}
            />
          </>
        )
      )}
    </div>
  );
}
