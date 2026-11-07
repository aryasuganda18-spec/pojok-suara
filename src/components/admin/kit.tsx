import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { STATUS_LABELS } from '../../lib/format';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  published: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300',
  draft: 'bg-soft text-muted',
  review: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
  archived: 'bg-soft text-muted line-through',
  scheduled: 'bg-sky-600/15 text-sky-700 dark:text-sky-300',
};

export function StatusBadge({ status, scheduled }: { status: string; scheduled?: boolean }) {
  const key = scheduled ? 'scheduled' : status;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[key] ?? STATUS_STYLE.draft}`}>{scheduled ? 'Terjadwal' : STATUS_LABELS[status] ?? status}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</section>;
}

/** Dialog modal dengan perangkap fokus, tutup dengan Escape, dan pengembalian fokus. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[1] ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/50 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`animate-slide-in flex max-h-[92dvh] w-full flex-col rounded-t-lg bg-bg shadow-xl sm:rounded-lg ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Tutup dialog"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Hapus', danger = true, busy, onConfirm, onClose, children }: { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm">{message}</div>
      {children && <div className="mt-3">{children}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : ''}`} onClick={onConfirm} disabled={busy}>{busy ? 'Memproses…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm"><span className="font-semibold">{label}</span>{hint && <span className="hint block">{hint}</span>}</span>
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1">
      {tabs.map((t) => (
        <button key={t.value} role="tab" type="button" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${value === t.value ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}{t.count !== undefined && <span className="rounded-full bg-soft px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
