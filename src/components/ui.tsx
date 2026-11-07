import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import type { ImageObj } from '../lib/types';

export function ResponsiveImage({
  image,
  sizes,
  priority = false,
  className = '',
  ratio,
}: {
  image: ImageObj;
  sizes: string;
  priority?: boolean;
  className?: string;
  ratio?: string;
}) {
  const w = image.width ?? 1600;
  const h = image.height ?? 900;
  return (
    <img
      src={image.medium}
      srcSet={`${image.thumb} 480w, ${image.medium} 960w, ${image.url} ${Math.min(w, 2000)}w`}
      sizes={sizes}
      width={w}
      height={h}
      alt={image.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      className={`block w-full bg-soft object-cover ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    />
  );
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export function CardSkeleton({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <div className={horizontal ? 'flex gap-3' : 'space-y-3'} role="status" aria-label="Memuat">
      <Skeleton className={horizontal ? 'size-24 shrink-0' : 'aspect-[16/10] w-full'} />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        {!horizontal && <Skeleton className="h-3 w-full" />}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-3 rounded border border-dashed border-line px-4 py-14 text-center">
      <Inbox className="size-9 text-muted" aria-hidden="true" />
      <h2 className="font-serif text-xl font-bold">{title}</h2>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="grid place-items-center gap-3 rounded border border-line bg-soft px-4 py-14 text-center">
      <AlertTriangle className="size-9 text-accent" aria-hidden="true" />
      <h2 className="font-serif text-xl font-bold">Terjadi masalah</h2>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

export const Spinner = ({ label = 'Memuat' }: { label?: string }) => (
  <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
    {label}
  </span>
);

export function SectionTitle({ children, to, action }: { children: ReactNode; to?: string; action?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="section-title mb-0 flex-1">{children}</h2>
      {to && (
        <Link to={to} className="shrink-0 py-2 text-xs font-bold uppercase tracking-wider text-accent hover:underline">
          {action ?? 'Lihat semua'}
        </Link>
      )}
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  const numbers = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...numbers].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) items.push('gap');
    items.push(n);
  });
  return (
    <nav aria-label="Halaman" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      <button type="button" className="icon-btn border border-line" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Halaman sebelumnya">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g${i}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            onClick={() => onChange(it)}
            aria-current={it === page ? 'page' : undefined}
            aria-label={`Halaman ${it}`}
            className={`grid size-11 place-items-center rounded border text-sm font-semibold ${it === page ? 'border-ink bg-ink text-bg' : 'border-line hover:bg-soft'}`}
          >
            {it}
          </button>
        ),
      )}
      <button type="button" className="icon-btn border border-line" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Halaman berikutnya">
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </nav>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, describedBy: string | undefined) => ReactNode }) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id, error || hint ? noteId : undefined)}
      {error ? (
        <p id={noteId} className="error-text">
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return src ? (
    <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full bg-soft object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full bg-soft text-xs font-bold text-muted" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}
