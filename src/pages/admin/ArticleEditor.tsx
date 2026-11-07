import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Eye, History, ImagePlus, Save, Send, X } from 'lucide-react';
import { Card, ConfirmDialog, Modal, PageHeader, StatusBadge } from '../../components/admin/kit';
import { MediaPicker, type MediaItem } from '../../components/admin/MediaPicker';
import RichEditor from '../../components/admin/RichEditor';
import { Field, ErrorState, Skeleton } from '../../components/ui';
import { useAuth, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError, del, errorMessage, get, post, put } from '../../lib/api';
import { formatDateTime, isoToLocalInput, localInputToIso, slugify, STATUS_LABELS, TYPE_LABELS } from '../../lib/format';
import type { ArticleDetail, ArticleStatus, ArticleType, ImageObj } from '../../lib/types';

interface Loaded {
  id: string;
  type: ArticleType;
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_id: string | null;
  featured_caption: string;
  featured_alt: string;
  thumbnail_id: string | null;
  category_id: string | null;
  tags: string[];
  author_id: string | null;
  status: ArticleStatus;
  published_at: string | null;
  comments_enabled: boolean;
  seo: { title: string; description: string };
  revision: number;
  featured_image: ImageObj | null;
  thumbnail: ImageObj | null;
  updated_at: string;
  permissions: { can_edit: boolean; can_delete: boolean; can_publish: boolean };
}

interface Form {
  type: ArticleType;
  title: string;
  subtitle: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  content: string;
  featured_image_id: string | null;
  featured_image: ImageObj | null;
  featured_caption: string;
  featured_alt: string;
  thumbnail_id: string | null;
  thumbnail: ImageObj | null;
  category_id: string;
  tags: string;
  author_id: string;
  status: ArticleStatus;
  published_at: string;
  comments_enabled: boolean;
  seo_title: string;
  seo_description: string;
}

const EMPTY: Form = {
  type: 'artikel', title: '', subtitle: '', slug: '', slugTouched: false, excerpt: '', content: '', featured_image_id: null, featured_image: null,
  featured_caption: '', featured_alt: '', thumbnail_id: null, thumbnail: null, category_id: '', tags: '', author_id: '', status: 'draft',
  published_at: '', comments_enabled: true, seo_title: '', seo_description: '',
};

const fromLoaded = (a: Loaded): Form => ({
  type: a.type, title: a.title, subtitle: a.subtitle, slug: a.slug, slugTouched: true, excerpt: a.excerpt, content: a.content,
  featured_image_id: a.featured_image_id, featured_image: a.featured_image, featured_caption: a.featured_caption, featured_alt: a.featured_alt,
  thumbnail_id: a.thumbnail_id, thumbnail: a.thumbnail, category_id: a.category_id ?? '', tags: a.tags.join(', '), author_id: a.author_id ?? '',
  status: a.status, published_at: isoToLocalInput(a.published_at), comments_enabled: a.comments_enabled, seo_title: a.seo.title, seo_description: a.seo.description,
});

const payload = (f: Form, canPublish: boolean) => ({
  type: f.type, title: f.title, subtitle: f.subtitle, slug: f.slug, excerpt: f.excerpt, content: f.content,
  featured_image_id: f.featured_image_id, featured_caption: f.featured_caption, featured_alt: f.featured_alt, thumbnail_id: f.thumbnail_id,
  category_id: f.category_id || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), status: f.status,
  comments_enabled: f.comments_enabled, seo: { title: f.seo_title, description: f.seo_description },
  ...(canPublish ? { author_id: f.author_id || null, published_at: localInputToIso(f.published_at) } : {}),
});

const snapshot = (f: Form) => JSON.stringify({ ...f, featured_image: null, thumbnail: null });

interface Option { id: string; name: string }

function ImageField({ label, image, onPick, onClear }: { label: string; image: ImageObj | null; onPick: (m: MediaItem) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      {image ? (
        <div className="relative">
          <img src={image.thumb} alt="" width={image.width ?? 480} height={image.height ?? 300} className="aspect-video w-full rounded bg-soft object-cover" />
          <button type="button" className="icon-btn absolute right-1 top-1 bg-bg/90" onClick={onClear} aria-label={`Hapus ${label.toLowerCase()}`}><X className="size-4" aria-hidden="true" /></button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost w-full" onClick={() => setOpen(true)}><ImagePlus className="size-4" aria-hidden="true" /> Pilih / unggah gambar</button>
      )}
      {image && <button type="button" className="mt-2 text-xs font-bold text-accent hover:underline" onClick={() => setOpen(true)}>Ganti gambar</button>}
      {open && <MediaPicker title={label} onClose={() => setOpen(false)} onSelect={(m) => { onPick(m); setOpen(false); }} />}
    </div>
  );
}

function Preview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error } = useApi<ArticleDetail>(`/admin/articles/${id}/preview`);
  return (
    <Modal title="Pratinjau tulisan" onClose={onClose} wide>
      {loading ? <Skeleton className="h-64 w-full" /> : error || !data ? <ErrorState message={error ?? 'Gagal memuat'} /> : (
        <article>
          <p className="kicker">{data.category?.name ?? TYPE_LABELS[data.type]}</p>
          <h1 className="font-serif text-3xl font-extrabold leading-tight">{data.title}</h1>
          {data.subtitle && <p className="mt-2 text-lg text-muted">{data.subtitle}</p>}
          {data.featured_image && <figure className="my-4"><img src={data.featured_image.medium} alt={data.featured_image.alt} className="w-full rounded" />{data.featured_image.caption && <figcaption className="meta mt-1">{data.featured_image.caption}</figcaption>}</figure>}
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: data.content_html }} />
        </article>
      )}
    </Modal>
  );
}

interface Revision { id: string; revision: number; saved_at: string; saved_by: string; title: string }

function Revisions({ id, onRestore, onClose }: { id: string; onRestore: (r: { title: string; subtitle: string; excerpt: string; content: string }) => void; onClose: () => void }) {
  const toast = useToast();
  const { data, loading, error } = useApi<{ items: Revision[] }>(`/admin/articles/${id}/revisions`);
  const restore = async (r: Revision) => {
    try {
      onRestore(await get(`/admin/articles/${id}/revisions/${r.id}`));
      toast.info('Revisi dimuat ke editor. Klik Simpan untuk menerapkannya.');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Modal title="Riwayat revisi" onClose={onClose}>
      {loading ? <Skeleton className="h-24 w-full" /> : error ? <ErrorState message={error} /> : !data?.items.length ? <p className="text-sm text-muted">Belum ada revisi. Revisi dibuat setiap kali judul atau isi diubah dan disimpan.</p> : (
        <ul className="divide-y divide-line">
          {data.items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0"><p className="truncate font-semibold">{r.title}</p><p className="meta">Revisi {r.revision} · {formatDateTime(r.saved_at)} · {r.saved_by}</p></div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => restore(r)}>Muat</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function ArticleEditor() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, can } = useAuth();
  const canPublish = can('articles:publish');

  const categories = useApi<{ items: Option[] }>('/admin/categories');
  const authors = useApi<{ items: Option[] }>(canPublish ? '/admin/authors' : null);
  const loaded = useApi<Loaded>(id ? `/admin/articles/${id}` : null);

  const draftKey = id ?? 'baru';
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, type: (['berita', 'opini', 'kritik', 'artikel'].includes(sp.get('jenis') ?? '') ? sp.get('jenis') : 'artikel') as ArticleType }));
  const [revision, setRevision] = useState(1);
  const [permissions, setPermissions] = useState({ can_edit: true, can_delete: true });
  const [savedSnap, setSavedSnap] = useState(() => snapshot(form));
  const [resetKey, setResetKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [autosaved, setAutosaved] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'preview' | 'revisions' | 'delete'>(null);
  const [restoreOffer, setRestoreOffer] = useState<null | { savedAt: string; fields: Partial<Form> & { content?: string; tags?: string[] } }>(null);
  const [conflict, setConflict] = useState(false);

  const dirty = snapshot(form) !== savedSnap;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const formRef = useRef(form);
  formRef.current = form;

  useDocumentTitle(form.title ? `Edit: ${form.title}` : id ? 'Edit tulisan' : 'Tulisan baru');

  const apply = useCallback((a: Loaded) => {
    const next = fromLoaded(a);
    setForm(next);
    setSavedSnap(snapshot(next));
    setRevision(a.revision);
    setPermissions(a.permissions);
    setResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (loaded.data) apply(loaded.data);
  }, [loaded.data, apply]);

  // Tawarkan pemulihan draft otomatis bila lebih baru dari versi tersimpan.
  useEffect(() => {
    if (id && !loaded.data) return;
    get<{ draft: null | { saved_at: string; fields: Record<string, unknown> } }>(`/admin/drafts/${draftKey}`)
      .then(({ draft }) => {
        if (!draft) return;
        const baseUpdated = loaded.data?.updated_at;
        const fields = draft.fields as { title?: string; content?: string };
        if ((baseUpdated && draft.saved_at <= baseUpdated) || (!fields.title && !fields.content)) return;
        setRestoreOffer({ savedAt: draft.saved_at, fields: draft.fields as never });
      })
      .catch(() => undefined);
  }, [id, loaded.data, draftKey]);

  // Draft otomatis ke server: 4 detik setelah berhenti mengetik.
  useEffect(() => {
    if (!dirty || !permissions.can_edit) return;
    const timer = window.setTimeout(() => {
      const f = formRef.current;
      put(`/admin/drafts/${draftKey}`, { type: f.type, title: f.title, subtitle: f.subtitle, excerpt: f.excerpt, content: f.content, category_id: f.category_id || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), base_revision: revision })
        .then(() => setAutosaved(new Date().toISOString()))
        .catch(() => undefined);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [form, dirty, draftKey, revision, permissions.can_edit]);

  // Peringatan sebelum menutup tab atau berpindah halaman dengan perubahan belum disimpan.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onTitle = (title: string) =>
    setForm((f) => ({ ...f, title, slug: f.slugTouched ? f.slug : slugify(title) }));

  const validate = (status: ArticleStatus) => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = 'Judul minimal 3 karakter';
    if (status === 'published') {
      if (!form.category_id) e.category_id = 'Pilih kategori sebelum menerbitkan';
      if (!form.content.trim()) e.content = 'Isi tulisan masih kosong';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (status: ArticleStatus = form.status) => {
    if (!validate(status)) {
      toast.error('Periksa kembali isian yang ditandai.');
      requestAnimationFrame(() => document.querySelector('.error-text')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    setSaving(true);
    try {
      const body = { ...payload({ ...form, status }, canPublish), ...(id ? { expected_revision: revision } : {}) };
      const saved = id ? await put<Loaded>(`/admin/articles/${id}`, body) : await post<Loaded>('/admin/articles', body);
      await del(`/admin/drafts/${draftKey}`).catch(() => undefined);
      setAutosaved(null);
      if (!id) {
        const next = fromLoaded(saved);
        setSavedSnap(snapshot(next));
        setForm(next);
        toast.success('Tulisan dibuat.');
        dirtyRef.current = false;
        navigate(`/admin/tulis/${saved.id}`, { replace: true });
        return;
      }
      apply(saved);
      toast.success(status === 'published' && form.status !== 'published' ? 'Tulisan diterbitkan.' : status === 'review' ? 'Dikirim untuk review.' : 'Perubahan disimpan.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else if (err instanceof ApiError && err.details?.length) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await del(`/admin/articles/${id}`);
      await del(`/admin/drafts/${draftKey}`).catch(() => undefined);
      dirtyRef.current = false;
      toast.success('Tulisan dihapus.');
      navigate('/admin/artikel');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const readOnly = !permissions.can_edit;
  const slugPreview = useMemo(() => `/${form.type}/${form.slug || '…'}`, [form.type, form.slug]);

  if (id && loaded.loading && !loaded.data) return <div role="status" aria-label="Memuat tulisan" className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  if (id && loaded.error) return <ErrorState message={loaded.error} onRetry={loaded.reload} />;

  const typeOptions: ArticleType[] = ['berita', 'opini', 'kritik', 'artikel'];

  return (
    <>
      <PageHeader
        title={id ? 'Edit tulisan' : 'Tulisan baru'}
        description={id ? `Revisi ${revision} · diperbarui ${formatDateTime(loaded.data?.updated_at)}` : 'Draft tersimpan otomatis ke server saat Anda mengetik.'}
        actions={
          <>
            {id && <button type="button" className="btn btn-ghost" onClick={() => setDialog('preview')} disabled={dirty}><Eye className="size-4" aria-hidden="true" /> Pratinjau</button>}
            {id && <button type="button" className="btn btn-ghost" onClick={() => setDialog('revisions')}><History className="size-4" aria-hidden="true" /> Revisi</button>}
          </>
        }
      />

      {readOnly && <p role="status" className="mb-4 rounded border border-line bg-soft p-3 text-sm">Anda tidak dapat mengubah tulisan ini pada statusnya saat ini ({STATUS_LABELS[form.status]}).</p>}
      {conflict && (
        <div role="alert" className="mb-4 rounded border border-accent bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Tulisan ini sudah diubah oleh pengguna lain.</p>
          <p className="mt-1">Salin pekerjaan Anda bila perlu, lalu muat ulang untuk melihat versi terbaru.</p>
          <button type="button" className="btn btn-sm mt-2" onClick={() => window.location.reload()}>Muat ulang</button>
        </div>
      )}
      {restoreOffer && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded border border-line bg-soft p-3 text-sm">
          <p className="flex-1">Ada draft otomatis dari {formatDateTime(restoreOffer.savedAt)} yang belum disimpan.</p>
          <button type="button" className="btn btn-sm" onClick={() => {
            const f = restoreOffer.fields;
            setForm((cur) => ({ ...cur, title: f.title ?? cur.title, subtitle: f.subtitle ?? cur.subtitle, excerpt: f.excerpt ?? cur.excerpt, content: f.content ?? cur.content, type: (f.type as ArticleType) ?? cur.type, category_id: (f.category_id as string) ?? cur.category_id, tags: Array.isArray(f.tags) ? f.tags.join(', ') : cur.tags }));
            setResetKey((k) => k + 1);
            setRestoreOffer(null);
          }}>Pulihkan</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { del(`/admin/drafts/${draftKey}`).catch(() => undefined); setRestoreOffer(null); }}>Buang</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Field label="Judul" error={errors.title}>{(fid, d) => <input id={fid} aria-describedby={d} aria-invalid={Boolean(errors.title)} className="field !text-xl font-serif font-bold" maxLength={200} value={form.title} onChange={(e) => onTitle(e.target.value)} disabled={readOnly} />}</Field>
          <Field label="Subjudul" hint="Opsional, tampil di bawah judul.">{(fid, d) => <input id={fid} aria-describedby={d} className="field" maxLength={300} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} disabled={readOnly} />}</Field>
          <div>
            <span className="label">Isi tulisan</span>
            <div className={readOnly ? 'pointer-events-none opacity-70' : ''}>
              <RichEditor value={form.content} onChange={(html) => set('content', html)} resetKey={resetKey} placeholder="Tulis di sini. Gunakan toolbar untuk judul, kutipan, gambar, tabel, dan video." />
            </div>
            {errors.content && <p className="error-text" role="alert">{errors.content}</p>}
          </div>
          <Field label="Ringkasan" hint="Tampil di kartu artikel dan hasil pencarian. Kosongkan untuk dibuat otomatis dari isi.">{(fid, d) => <textarea id={fid} aria-describedby={d} className="field !min-h-24" maxLength={400} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} disabled={readOnly} />}</Field>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-serif text-lg font-bold">Penerbitan</h2><StatusBadge status={form.status} /></div>
            <div className="space-y-3">
              <Field label="Status">{(fid) => (
                <select id={fid} className="field" value={form.status} onChange={(e) => set('status', e.target.value as ArticleStatus)} disabled={readOnly}>
                  {(canPublish ? (['draft', 'review', 'published', 'archived'] as const) : form.status === 'published' ? (['published'] as const) : (['draft', 'review'] as const)).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              )}</Field>
              {canPublish && (
                <Field label="Tanggal terbit" hint="Isi tanggal di masa depan untuk menjadwalkan. Kosongkan untuk terbit saat disimpan.">{(fid, d) => <input id={fid} aria-describedby={d} type="datetime-local" className="field" value={form.published_at} onChange={(e) => set('published_at', e.target.value)} />}</Field>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className="btn flex-1" onClick={() => save()} disabled={saving || readOnly}>
                  <Save className="size-4" aria-hidden="true" /> {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
                {(form.status !== 'published' || canPublish) && (
                  <button type="button" className="btn btn-accent flex-1" onClick={() => save(canPublish ? 'published' : 'review')} disabled={saving || readOnly || (form.status === 'published')}>
                    <Send className="size-4" aria-hidden="true" /> {canPublish ? 'Terbitkan' : 'Kirim review'}
                  </button>
                )}
              </div>
              <p className="meta" role="status" aria-live="polite">{saving ? 'Menyimpan…' : dirty ? (autosaved ? `Draft otomatis ${formatDateTime(autosaved)} · belum disimpan` : 'Ada perubahan belum disimpan') : 'Semua perubahan tersimpan'}</p>
              {id && permissions.can_delete && <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('delete')}>Hapus tulisan</button>}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-lg font-bold">Pengaturan</h2>
            <div className="space-y-3">
              <Field label="Jenis">{(fid) => <select id={fid} className="field" value={form.type} onChange={(e) => set('type', e.target.value as ArticleType)} disabled={readOnly || (Boolean(id) && !canPublish)}>{typeOptions.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>}</Field>
              <Field label="Kategori" error={errors.category_id}>{(fid, d) => (
                <select id={fid} aria-describedby={d} aria-invalid={Boolean(errors.category_id)} className="field" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} disabled={readOnly}>
                  <option value="">— Pilih kategori —</option>
                  {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}</Field>
              {canPublish && (
                <Field label="Penulis">{(fid) => (
                  <select id={fid} className="field" value={form.author_id} onChange={(e) => set('author_id', e.target.value)}>
                    <option value="">{user?.name} (default)</option>
                    {authors.data?.items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}</Field>
              )}
              <Field label="Tag" hint="Pisahkan dengan koma.">{(fid, d) => <input id={fid} aria-describedby={d} className="field" value={form.tags} onChange={(e) => set('tags', e.target.value)} disabled={readOnly} />}</Field>
              <Field label="Slug (alamat tulisan)" hint={slugPreview}>{(fid, d) => <input id={fid} aria-describedby={d} className="field" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), slugTouched: true }))} disabled={readOnly} />}</Field>
              <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={form.comments_enabled} onChange={(e) => set('comments_enabled', e.target.checked)} disabled={readOnly} />Izinkan komentar</label>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-lg font-bold">Gambar</h2>
            <div className="space-y-4">
              <ImageField label="Gambar utama" image={form.featured_image} onClear={() => setForm((f) => ({ ...f, featured_image: null, featured_image_id: null }))}
                onPick={(m) => setForm((f) => ({ ...f, featured_image_id: m.id, featured_image: { id: m.id, url: m.url, thumb: m.thumb ?? m.url, medium: m.url, width: m.width, height: m.height, alt: m.alt, caption: '' }, featured_alt: f.featured_alt || m.alt || '' }))} />
              {form.featured_image && (
                <>
                  <Field label="Keterangan gambar">{(fid) => <input id={fid} className="field" maxLength={300} value={form.featured_caption} onChange={(e) => set('featured_caption', e.target.value)} />}</Field>
                  <Field label="Teks alternatif" hint="Deskripsi gambar untuk pembaca layar.">{(fid, d) => <input id={fid} aria-describedby={d} className="field" maxLength={200} value={form.featured_alt} onChange={(e) => set('featured_alt', e.target.value)} />}</Field>
                </>
              )}
              <ImageField label="Thumbnail (opsional)" image={form.thumbnail} onClear={() => setForm((f) => ({ ...f, thumbnail: null, thumbnail_id: null }))}
                onPick={(m) => setForm((f) => ({ ...f, thumbnail_id: m.id, thumbnail: { id: m.id, url: m.url, thumb: m.thumb ?? m.url, medium: m.url, width: m.width, height: m.height, alt: m.alt, caption: '' } }))} />
              <p className="hint">Tanpa thumbnail khusus, gambar utama dipakai untuk kartu artikel.</p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-lg font-bold">SEO</h2>
            <div className="space-y-3">
              <Field label="Judul SEO" hint={`${form.seo_title.length}/120 · kosong = pakai judul tulisan`}>{(fid, d) => <input id={fid} aria-describedby={d} className="field" maxLength={120} value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} disabled={readOnly} />}</Field>
              <Field label="Deskripsi meta" hint={`${form.seo_description.length}/300 · kosong = pakai ringkasan`}>{(fid, d) => <textarea id={fid} aria-describedby={d} className="field !min-h-20" maxLength={300} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} disabled={readOnly} />}</Field>
            </div>
          </Card>
        </aside>
      </div>

      {dialog === 'preview' && id && <Preview id={id} onClose={() => setDialog(null)} />}
      {dialog === 'revisions' && id && (
        <Revisions id={id} onClose={() => setDialog(null)} onRestore={(r) => { setForm((f) => ({ ...f, title: r.title, subtitle: r.subtitle, excerpt: r.excerpt, content: r.content })); setResetKey((k) => k + 1); }} />
      )}
      {dialog === 'delete' && <ConfirmDialog title="Hapus tulisan?" message="Tulisan beserta komentar dan riwayat revisinya akan dihapus permanen." onConfirm={remove} onClose={() => setDialog(null)} />}
      {blocker.state === 'blocked' && (
        <ConfirmDialog title="Tinggalkan halaman?" danger={false} confirmLabel="Tinggalkan" message="Ada perubahan yang belum disimpan. Draft otomatis tetap tersimpan di server dan bisa dipulihkan nanti." onConfirm={() => blocker.proceed()} onClose={() => blocker.reset()} />
      )}
      <p className="mt-8 text-sm text-muted"><Link to="/admin/artikel" className="underline hover:text-ink">← Kembali ke daftar tulisan</Link></p>
    </>
  );
}
