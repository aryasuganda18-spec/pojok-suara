import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { formatShortDate, TYPE_LABELS } from '../lib/format';
import type { ArticleCard as Card } from '../lib/types';
import { ResponsiveImage } from './ui';

export function Kicker({ article }: { article: Card }) {
  const label = article.category?.name ?? TYPE_LABELS[article.type];
  const to = article.category ? `/kategori/${article.category.slug}` : `/${article.type}`;
  return (
    <Link to={to} className="kicker inline-block py-1 hover:underline">
      {label}
    </Link>
  );
}

export function ByLine({ article, showRead = true }: { article: Card; showRead?: boolean }) {
  return (
    <p className="meta flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {article.author &&
        (article.author.username ? (
          <Link to={`/penulis/${article.author.username}`} className="font-semibold text-ink hover:underline">
            {article.author.name}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{article.author.name}</span>
        ))}
      <time dateTime={article.published_at}>{formatShortDate(article.published_at)}</time>
      {showRead && (
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden="true" />
          {article.reading_time} mnt
        </span>
      )}
    </p>
  );
}

/** Kartu standar: gambar di atas, dipakai pada grid. */
export function ArticleCard({ article }: { article: Card }) {
  return (
    <article className="group flex flex-col">
      {article.image && (
        <Link to={article.url} tabIndex={-1} aria-hidden="true" className="mb-3 block overflow-hidden">
          <ResponsiveImage image={article.image} ratio="16 / 10" sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 45vw, 92vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
        </Link>
      )}
      <Kicker article={article} />
      <h3 className="font-serif text-xl font-bold leading-snug">
        <Link to={article.url} className="hover:underline decoration-2 underline-offset-4">
          {article.title}
        </Link>
      </h3>
      {article.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{article.excerpt}</p>}
      <div className="mt-3">
        <ByLine article={article} />
      </div>
    </article>
  );
}

/** Kartu mendatar: thumbnail kecil di kiri, hemat ruang di ponsel. */
export function ArticleRow({ article, numbered }: { article: Card; numbered?: number }) {
  return (
    <article className="flex gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
      {numbered !== undefined && <span className="w-7 shrink-0 font-serif text-3xl font-extrabold leading-none text-line" aria-hidden="true">{numbered}</span>}
      <div className="min-w-0 flex-1">
        <Kicker article={article} />
        <h3 className="font-serif text-base font-bold leading-snug sm:text-lg">
          <Link to={article.url} className="hover:underline decoration-2 underline-offset-4">
            {article.title}
          </Link>
        </h3>
        <div className="mt-1.5">
          <ByLine article={article} showRead={false} />
        </div>
      </div>
      {article.image && numbered === undefined && (
        <Link to={article.url} tabIndex={-1} aria-hidden="true" className="shrink-0">
          <ResponsiveImage image={article.image} ratio="1 / 1" sizes="6rem" className="size-24 rounded-sm" />
        </Link>
      )}
    </article>
  );
}

/** Kartu unggulan: judul besar, dipakai di hero. */
export function HeroCard({ article }: { article: Card }) {
  return (
    <article className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:gap-8">
      {article.image && (
        <Link to={article.url} tabIndex={-1} aria-hidden="true" className="block overflow-hidden">
          <ResponsiveImage image={article.image} ratio="16 / 10" priority sizes="(min-width: 64rem) 46rem, 100vw" />
        </Link>
      )}
      <div>
        <Kicker article={article} />
        <h1 className="font-serif text-[1.85rem] font-extrabold leading-tight sm:text-4xl lg:text-[2.6rem]">
          <Link to={article.url} className="hover:underline decoration-2 underline-offset-4">
            {article.title}
          </Link>
        </h1>
        <hr className="rule" />
        {(article.subtitle || article.excerpt) && <p className="text-base text-muted sm:text-lg">{article.subtitle || article.excerpt}</p>}
        <div className="mt-4">
          <ByLine article={article} />
        </div>
      </div>
    </article>
  );
}
