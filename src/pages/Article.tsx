import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Clock, Copy, Eye, Heart, Minus, Plus, Printer, Share2 } from 'lucide-react';
import { Facebook, XIcon } from '../components/BrandIcons';
import { ArticleCard, ByLine, Kicker } from '../components/ArticleCard';
import { Comments } from '../components/Comments';
import { Avatar, ErrorState, ResponsiveImage, SectionTitle, Skeleton } from '../components/ui';
import { useToast } from '../hooks/contexts';
import { useApi } from '../hooks/useApi';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { post } from '../lib/api';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import type { ArticleDetail } from '../lib/types';
import NotFound from './NotFound';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/** Memberi id pada h2/h3 dan menyusun daftar isi. Isi sudah dibersihkan server, jadi aman dirender. */
function prepareContent(html: string): { html: string; toc: TocItem[] } {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const toc: TocItem[] = [];
  const used = new Set<string>();
  doc.querySelectorAll('h2, h3').forEach((h) => {
    const text = h.textContent?.trim() ?? '';
    if (!text) return;
    const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bagian';
    let id = base;
    for (let i = 2; used.has(id); i += 1) id = `${base}-${i}`;
    used.add(id);
    h.id = id;
    toc.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
  });
  doc.querySelectorAll('a[href^="http"]').forEach((a) => a.setAttribute('target', '_blank'));
  return { html: doc.getElementById('r')?.innerHTML ?? html, toc };
}

function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.getElementById('isi-artikel');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      setPct(total <= 0 ? 100 : Math.min(100, Math.max(0, (-rect.top / total) * 100)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="no-print fixed inset-x-0 top-0 z-[60] h-1" role="progressbar" aria-label="Progres membaca" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className="h-full bg-accent" style={{ width: `${pct}%`, transition: 'width 0.1s linear' }} />
    </div>
  );
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan browser tidak tersedia */
  }
};

function ArticleTools({ article, fontSize, setFontSize }: { article: ArticleDetail; fontSize: number; setFontSize: (n: number) => void }) {
  const toast = useToast();
  const [liked, setLiked] = useState(() => readJson<string[]>('ps-likes', []).includes(article.id));
  const [likes, setLikes] = useState(article.likes);
  const [saved, setSaved] = useState(() => readJson<string[]>('ps-bookmarks', []).includes(article.id));

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = encodeURIComponent(article.title);
  const share = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`, icon: <span className="text-xs font-extrabold" aria-hidden="true">WA</span> },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: <Facebook className="size-5" aria-hidden="true" /> },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, icon: <XIcon className="size-5" aria-hidden="true" /> },
  ];

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
    const list = readJson<string[]>('ps-likes', []).filter((id) => id !== article.id);
    writeJson('ps-likes', next ? [...list, article.id] : list);
    try {
      const res = await post<{ likes: number }>(`/articles/${article.id}/like`, { liked: next });
      setLikes(res.likes);
    } catch {
      setLiked(!next);
      setLikes(article.likes);
      toast.error('Gagal menyimpan suka. Coba lagi.');
    }
  };

  const toggleSave = () => {
    const list = readJson<string[]>('ps-bookmarks', []).filter((id) => id !== article.id);
    const next = !saved;
    writeJson('ps-bookmarks', next ? [...list, article.id] : list);
    setSaved(next);
    toast.info(next ? 'Disimpan di perangkat ini.' : 'Bookmark dihapus.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Tautan disalin.');
    } catch {
      toast.error('Tidak dapat menyalin otomatis. Salin dari bilah alamat.');
    }
  };

  const nativeShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const btn = 'icon-btn border border-line';

  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-y border-line py-3" role="toolbar" aria-label="Alat artikel">
      <button type="button" className={`${btn} !w-auto gap-1.5 px-3 text-sm font-semibold ${liked ? 'text-accent' : ''}`} onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Batalkan suka' : 'Sukai tulisan ini'}>
        <Heart className={`size-5 ${liked ? 'fill-current' : ''}`} aria-hidden="true" /> {formatNumber(likes)}
      </button>
      <button type="button" className={`${btn} ${saved ? 'text-accent' : ''}`} onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Hapus bookmark' : 'Simpan bookmark'}>
        {saved ? <BookmarkCheck className="size-5" aria-hidden="true" /> : <Bookmark className="size-5" aria-hidden="true" />}
      </button>
      <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
      {share.map((s) => (
        <a key={s.label} className={btn} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Bagikan ke ${s.label} (tab baru)`}>
          {s.icon}
        </a>
      ))}
      <button type="button" className={btn} onClick={copy} aria-label="Salin tautan"><Copy className="size-5" aria-hidden="true" /></button>
      {nativeShare && (
        <button type="button" className={btn} aria-label="Bagikan lewat aplikasi lain" onClick={() => navigator.share({ title: article.title, url }).catch(() => undefined)}>
          <Share2 className="size-5" aria-hidden="true" />
        </button>
      )}
      <button type="button" className={`${btn} hidden sm:grid`} onClick={() => window.print()} aria-label="Cetak artikel"><Printer className="size-5" aria-hidden="true" /></button>

      <div className="ml-auto flex items-center gap-1" role="group" aria-label="Ukuran huruf">
        <button type="button" className={btn} onClick={() => setFontSize(Math.max(15, fontSize - 1))} disabled={fontSize <= 15} aria-label="Perkecil huruf"><Minus className="size-4" aria-hidden="true" /></button>
        <span className="w-9 text-center text-xs font-bold" aria-live="polite">{fontSize}px</span>
        <button type="button" className={btn} onClick={() => setFontSize(Math.min(24, fontSize + 1))} disabled={fontSize >= 24} aria-label="Perbesar huruf"><Plus className="size-4" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className="container-page max-w-3xl py-8" role="status" aria-label="Memuat tulisan">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-10 w-full" />
      <Skeleton className="mb-6 h-10 w-3/4" />
      <Skeleton className="mb-6 aspect-[16/10] w-full" />
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="mb-3 h-4 w-full" />)}
    </div>
  );
}

export default function Article({ type }: { type: string }) {
  const { slug } = useParams();
  const { data, loading, error, status, reload } = useApi<ArticleDetail>(slug ? `/articles/${slug}` : null);
  const [fontSize, setFontSizeState] = useState(() => {
    const n = Number.parseInt(localStorage.getItem('ps-font') ?? '', 10);
    return n >= 15 && n <= 24 ? n : 18;
  });
  const [reading, setReading] = useState(false);

  const setFontSize = (n: number) => {
    setFontSizeState(n);
    document.documentElement.style.setProperty('--read-size', `${n}px`);
    try {
      localStorage.setItem('ps-font', String(n));
    } catch {
      /* abaikan */
    }
  };

  useDocumentTitle(data?.title);

  const prepared = useMemo(() => (data ? prepareContent(data.content_html) : null), [data]);

  useEffect(() => {
    if (!data) return;
    post(`/articles/${data.id}/view`).catch(() => undefined);
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 404) return <NotFound />;
  if (loading && !data) return <ArticleSkeleton />;
  if (error || !data || !prepared) return <div className="container-page py-10"><ErrorState message={error ?? 'Tulisan tidak tersedia'} onRetry={reload} /></div>;

  if (data.type !== type || data.slug !== slug) return <Navigate to={`/${data.type}/${data.slug}`} replace />;

  const author = data.author_profile;

  return (
    <>
      <ReadingProgress />
      <article className={`container-page py-6 md:py-10 ${reading ? 'reading-mode' : ''}`}>
        <header className="mx-auto max-w-3xl">
          <nav aria-label="Jejak halaman" className="meta mb-3 flex flex-wrap items-center gap-1.5">
            <Link to="/" className="hover:underline">Beranda</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/${data.type}`} className="hover:underline">{data.type[0].toUpperCase() + data.type.slice(1)}</Link>
            {data.category && (<><span aria-hidden="true">/</span><Link to={`/kategori/${data.category.slug}`} className="hover:underline">{data.category.name}</Link></>)}
          </nav>
          <Kicker article={data} />
          <h1 className="font-serif text-[1.9rem] font-extrabold leading-tight sm:text-4xl md:text-[2.7rem]">{data.title}</h1>
          {data.subtitle && <p className="mt-3 text-lg text-muted sm:text-xl">{data.subtitle}</p>}

          <div className="mt-5 flex items-center gap-3">
            {data.author && <Avatar src={data.author.avatar} name={data.author.name} size={44} />}
            <div className="min-w-0">
              <ByLine article={data} showRead={false} />
              <p className="meta mt-0.5 flex flex-wrap gap-x-3">
                <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />{data.reading_time} menit baca</span>
                <span className="inline-flex items-center gap-1"><Eye className="size-3" aria-hidden="true" />{formatNumber(data.views)}</span>
                {data.updated_at.slice(0, 10) !== data.published_at.slice(0, 10) && <span>Diperbarui {formatDateTime(data.updated_at)}</span>}
              </p>
            </div>
          </div>
        </header>

        {data.featured_image && (
          <figure className="mx-auto mt-6 max-w-5xl">
            <ResponsiveImage image={data.featured_image} ratio="16 / 9" priority sizes="(min-width: 64rem) 64rem, 100vw" />
            {data.featured_image.caption && <figcaption className="meta mx-auto mt-2 max-w-3xl px-1">{data.featured_image.caption}</figcaption>}
          </figure>
        )}

        <div className="mx-auto mt-6 max-w-3xl">
          <ArticleTools article={data} fontSize={fontSize} setFontSize={setFontSize} />
          <button type="button" className="no-print mt-3 inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wider text-accent hover:underline" aria-pressed={reading} onClick={() => setReading((v) => !v)}>
            {reading ? 'Keluar mode baca nyaman' : 'Mode baca nyaman'}
          </button>

          {prepared.toc.length >= 3 && (
            <nav aria-label="Daftar isi" className="no-print my-6 rounded border border-line bg-soft p-4">
              <details open={prepared.toc.length <= 6}>
                <summary className="flex min-h-11 items-center text-sm font-bold uppercase tracking-widest">Daftar isi</summary>
                <ol className="mt-1 space-y-0.5 text-sm">
                  {prepared.toc.map((t) => (
                    <li key={t.id} className={t.level === 3 ? 'pl-4' : ''}>
                      <a href={`#${t.id}`} className="flex min-h-9 items-center text-muted hover:text-accent hover:underline">{t.text}</a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>
          )}

          <div id="isi-artikel" className="prose-article mt-6" dangerouslySetInnerHTML={{ __html: prepared.html }} />

          {data.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tag">
              {data.tags.map((t) => (
                <li key={t}>
                  <Link to={`/tag/${encodeURIComponent(t)}`} className="inline-flex min-h-9 items-center rounded-full border border-line px-3 text-xs font-semibold hover:bg-soft">#{t}</Link>
                </li>
              ))}
            </ul>
          )}

          {author && (
            <aside aria-label="Tentang penulis" className="mt-10 flex gap-4 rounded border border-line bg-soft p-4 sm:p-5">
              <Avatar src={author.avatar?.thumb} name={author.name} size={64} />
              <div className="min-w-0">
                <p className="kicker">Penulis</p>
                <Link to={`/penulis/${author.username}`} className="font-serif text-xl font-bold hover:underline">{author.name}</Link>
                {author.bio && <p className="mt-1 text-sm text-muted">{author.bio}</p>}
                <Link to={`/penulis/${author.username}`} className="mt-2 inline-flex min-h-9 items-center text-xs font-bold uppercase tracking-wider text-accent hover:underline">{author.article_count} tulisan →</Link>
              </div>
            </aside>
          )}

          <nav aria-label="Tulisan sebelumnya dan berikutnya" className="no-print mt-8 grid gap-3 sm:grid-cols-2">
            {data.previous ? (
              <Link to={data.previous.url} className="flex gap-2 rounded border border-line p-3 hover:bg-soft">
                <ArrowLeft className="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span><span className="meta block">Sebelumnya</span><span className="font-serif font-bold leading-snug">{data.previous.title}</span></span>
              </Link>
            ) : <span />}
            {data.next && (
              <Link to={data.next.url} className="flex justify-end gap-2 rounded border border-line p-3 text-right hover:bg-soft">
                <span><span className="meta block">Berikutnya</span><span className="font-serif font-bold leading-snug">{data.next.title}</span></span>
                <ArrowRight className="mt-1 size-4 shrink-0" aria-hidden="true" />
              </Link>
            )}
          </nav>

          <Comments articleId={data.id} />
        </div>

        {data.related.length > 0 && (
          <section aria-labelledby="terkait" className="no-print mt-14 border-t border-line pt-8">
            <SectionTitle><span id="terkait">Artikel terkait</span></SectionTitle>
            <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {data.related.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          </section>
        )}
      </article>
      <p className="sr-only">Diterbitkan {formatDate(data.published_at)}</p>
    </>
  );
}
