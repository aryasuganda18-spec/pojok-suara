import { useRef, useState, type FormEvent } from 'react';
import { MessageSquare } from 'lucide-react';
import { useToast } from '../hooks/contexts';
import { useApi } from '../hooks/useApi';
import { errorMessage, post } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { CommentNode } from '../lib/types';
import { Avatar, ErrorState, Skeleton } from './ui';

interface CommentsResponse {
  items: CommentNode[];
  count: number;
  enabled: boolean;
}

function CommentForm({ articleId, parentId, onDone, onCancel }: { articleId: string; parentId?: string; onDone: () => void; onCancel?: () => void }) {
  const toast = useToast();
  const opened = useRef(Date.now());
  const [form, setForm] = useState({ name: '', email: '', body: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Nama minimal 2 karakter';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Format email tidak valid';
    if (form.body.trim().length < 2) next.body = 'Komentar terlalu pendek';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await post<{ message: string }>(`/articles/${articleId}/comments`, {
        name: form.name,
        email: form.email,
        body: form.body,
        parent_id: parentId ?? null,
        website: form.website,
        elapsed: Date.now() - opened.current,
      });
      toast.success(res.message);
      setForm((f) => ({ ...f, body: '' }));
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const id = parentId ?? 'baru';
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`c-name-${id}`}>Nama</label>
          <input id={`c-name-${id}`} className="field" autoComplete="name" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={Boolean(errors.name)} />
          {errors.name && <p className="error-text" role="alert">{errors.name}</p>}
        </div>
        <div>
          <label className="label" htmlFor={`c-email-${id}`}>Email <span className="font-normal text-muted">(opsional, tidak ditampilkan)</span></label>
          <input id={`c-email-${id}`} type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="error-text" role="alert">{errors.email}</p>}
        </div>
      </div>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Situs web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
      </div>
      <div>
        <label className="label" htmlFor={`c-body-${id}`}>{parentId ? 'Balasan' : 'Komentar'}</label>
        <textarea id={`c-body-${id}`} className="field" maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-invalid={Boolean(errors.body)} />
        <div className="flex justify-between">
          {errors.body ? <p className="error-text" role="alert">{errors.body}</p> : <span className="hint">Komentar ditinjau redaksi sebelum tampil.</span>}
          <span className="hint">{form.body.length}/2000</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Batal</button>}
      </div>
    </form>
  );
}

function CommentItem({ node, articleId, depth = 0 }: { node: CommentNode; articleId: string; depth?: number }) {
  const [replying, setReplying] = useState(false);
  return (
    <li className="py-4">
      <div className="flex gap-3">
        <Avatar name={node.name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm"><span className="font-bold">{node.name}</span> <time className="meta ml-1" dateTime={node.created_at}>{timeAgo(node.created_at)}</time></p>
          <p className="mt-1 whitespace-pre-line break-words text-[0.95rem]">{node.body}</p>
          <button type="button" className="mt-1 inline-flex min-h-9 items-center text-xs font-bold text-accent hover:underline" onClick={() => setReplying((v) => !v)} aria-expanded={replying}>
            Balas
          </button>
          {replying && (
            <div className="mt-2 rounded border border-line p-3">
              <CommentForm articleId={articleId} parentId={node.id} onDone={() => setReplying(false)} onCancel={() => setReplying(false)} />
            </div>
          )}
        </div>
      </div>
      {node.replies.length > 0 && (
        <ul className={`mt-2 border-l border-line pl-3 ${depth === 0 ? 'ml-4 sm:ml-9' : ''}`}>
          {node.replies.map((r) => (
            <CommentItem key={r.id} node={r} articleId={articleId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Comments({ articleId }: { articleId: string }) {
  const { data, loading, error, reload } = useApi<CommentsResponse>(`/articles/${articleId}/comments`);

  return (
    <section aria-labelledby="komentar" className="comments-section mt-12 border-t border-line pt-8">
      <h2 id="komentar" className="mb-4 flex items-center gap-2 font-serif text-2xl font-extrabold">
        <MessageSquare className="size-6" aria-hidden="true" />
        Komentar {data ? `(${data.count})` : ''}
      </h2>
      {loading && !data ? (
        <div className="space-y-3" role="status" aria-label="Memuat komentar"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data && !data.enabled ? (
        <p className="rounded bg-soft p-4 text-sm text-muted">Komentar untuk tulisan ini dinonaktifkan.</p>
      ) : (
        data && (
          <>
            <div className="mb-6 rounded border border-line p-4">
              <CommentForm articleId={articleId} onDone={reload} />
            </div>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted">Belum ada komentar. Jadilah yang pertama berpendapat dengan santun.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.items.map((c) => (
                  <CommentItem key={c.id} node={c} articleId={articleId} />
                ))}
              </ul>
            )}
          </>
        )
      )}
    </section>
  );
}
