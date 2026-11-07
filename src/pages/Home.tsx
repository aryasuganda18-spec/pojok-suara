import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ArticleCard, ArticleRow, HeroCard } from '../components/ArticleCard';
import { NewsletterForm } from '../components/Newsletter';
import { Avatar, EmptyState, ErrorState, GridSkeleton, SectionTitle, Skeleton } from '../components/ui';
import { useSite } from '../hooks/contexts';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { HomeData } from '../lib/types';

function HomeSkeleton() {
  return (
    <div className="container-page py-6" role="status" aria-label="Memuat beranda">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="aspect-[16/10] w-full" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
      <div className="mt-12">
        <GridSkeleton />
      </div>
    </div>
  );
}

export default function Home() {
  const { site } = useSite();
  const { data, loading, error, reload } = useApi<HomeData>('/home');
  useDocumentTitle(site ? `${site.site_name} — ${site.tagline}` : null, '');

  if (loading && !data) return <HomeSkeleton />;
  if (error || !data) return <div className="container-page py-10"><ErrorState message={error ?? 'Data tidak tersedia'} onRetry={reload} /></div>;

  if (!data.hero) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Belum ada tulisan yang terbit"
          text="Masuk ke dashboard admin untuk menulis dan menerbitkan tulisan pertama, atau jalankan 'npm run init:demo' untuk mengisi data contoh."
          action={<Link to="/admin" className="btn">Buka dashboard</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-page">
      <section aria-label="Tulisan utama" className="pt-5 pb-8 md:pt-8 md:pb-10">
        <HeroCard article={data.hero} />
      </section>

      <div className="grid gap-10 border-t border-line pt-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <section aria-labelledby="terbaru">
          <SectionTitle to="/berita">
            <span id="terbaru">Terbaru</span>
          </SectionTitle>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {data.latest.slice(0, 6).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>

        <aside aria-labelledby="populer" className="lg:border-l lg:border-line lg:pl-8">
          <h2 id="populer" className="section-title">Terpopuler</h2>
          <ol>
            {data.popular.map((a, i) => (
              <li key={a.id}>
                <ArticleRow article={a} numbered={i + 1} />
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {(data.opinions.length > 0 || data.criticisms.length > 0) && (
        <section aria-labelledby="opini-kritik" className="mt-12 rounded bg-soft px-4 py-8 sm:px-8">
          <h2 id="opini-kritik" className="sr-only">Opini dan Kritik</h2>
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            {data.opinions.length > 0 && (
              <div>
                <SectionTitle to="/opini">Opini</SectionTitle>
                {data.opinions.map((a) => (
                  <ArticleRow key={a.id} article={a} />
                ))}
              </div>
            )}
            {data.criticisms.length > 0 && (
              <div>
                <SectionTitle to="/kritik">Kritik Sosial</SectionTitle>
                {data.criticisms.map((a) => (
                  <ArticleRow key={a.id} article={a} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {data.picks.length > 0 && (
        <section aria-labelledby="pilihan" className="mt-12">
          <SectionTitle>
            <span id="pilihan">Pilihan Redaksi</span>
          </SectionTitle>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {data.picks.slice(0, 4).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {data.editorial.length > 0 && (
        <section aria-labelledby="analisis" className="mt-12">
          <SectionTitle to="/kategori/analisis" action="Analisis & esai">
            <span id="analisis">Analisis, Esai, dan Tulisan Editorial</span>
          </SectionTitle>
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {data.editorial.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {data.authors.length > 0 && (
        <section aria-labelledby="penulis" className="mt-12">
          <SectionTitle>
            <span id="penulis">Penulis</span>
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.authors.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link to={`/penulis/${a.username}`} className="flex h-full gap-3 rounded border border-line p-4 hover:bg-soft">
                  <Avatar src={a.avatar?.thumb} name={a.name} size={56} />
                  <span className="min-w-0">
                    <span className="block font-serif text-base font-bold">{a.name}</span>
                    <span className="meta block">{a.article_count} tulisan</span>
                    {a.bio && <span className="mt-1 line-clamp-2 block text-xs text-muted">{a.bio}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {site?.newsletter_enabled && (
        <section aria-labelledby="newsletter" className="mt-12 rounded bg-ink px-5 py-10 text-bg sm:px-10">
          <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <h2 id="newsletter" className="font-serif text-2xl font-extrabold">Jangan ketinggalan suara baru</h2>
              <p className="mt-2 text-sm opacity-80">Ringkasan tulisan pilihan redaksi, langsung ke kotak masuk Anda. Gratis, tanpa spam.</p>
            </div>
            <div className="[&_.field]:border-transparent [&_.field]:bg-bg [&_.field]:text-ink">
              <NewsletterForm />
            </div>
          </div>
        </section>
      )}

      {site?.submissions_enabled && (
        <p className="mt-8 text-center text-sm text-muted">
          Punya tulisan?{' '}
          <Link to="/kirim-tulisan" className="inline-flex items-center gap-1 font-bold text-accent hover:underline">
            Kirim ke redaksi <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      )}
    </div>
  );
}
