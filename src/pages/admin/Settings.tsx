import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, PageHeader, Tabs, Toggle } from '../../components/admin/kit';
import { MediaPicker, type MediaItem } from '../../components/admin/MediaPicker';
import { ErrorState, Field, Spinner } from '../../components/ui';
import { useSite, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, get, put } from '../../lib/api';

interface Link { label: string; href: string }
interface S {
  site_name: string; tagline: string; description: string;
  logo_id: string | null; favicon_id: string | null;
  theme: { accent: string; default_mode: 'light' | 'dark' | 'system' };
  nav: Link[];
  footer: { about: string; copyright: string; links: Link[] };
  social: Record<'facebook' | 'instagram' | 'x' | 'youtube' | 'tiktok', string>;
  email_redaksi: string;
  seo: { title_suffix: string; description: string; og_image_id: string | null };
  home: { hero_article_id: string | null; editors_pick_ids: string[]; per_page: number };
  comments: { enabled: boolean; moderation: 'manual' | 'auto' };
  newsletter_enabled: boolean; submissions_enabled: boolean;
}
type Tab = 'umum' | 'tampilan' | 'menu' | 'sosial' | 'fitur' | 'contoh';
type PickKey = 'logo_id' | 'favicon_id' | 'og';

function LinkList({ label, items, onChange }: { label: string; items: Link[]; onChange: (v: Link[]) => void }) {
  const set = (i: number, patch: Partial<Link>) => onChange(items.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-semibold">{label}</legend>
      {items.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-line p-2">
          <input className="field !w-auto min-w-0 flex-1 basis-32" aria-label={`Teks tautan ${i + 1}`} placeholder="Teks" maxLength={40} value={l.label} onChange={(e) => set(i, { label: e.target.value })} />
          <input className="field !w-auto min-w-0 flex-1 basis-40" aria-label={`Alamat tautan ${i + 1}`} placeholder="/berita atau https://…" value={l.href} onChange={(e) => set(i, { href: e.target.value })} />
          <button type="button" className="icon-btn !size-9" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naikkan"><ArrowUp className="size-4" aria-hidden="true" /></button>
          <button type="button" className="icon-btn !size-9" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Turunkan"><ArrowDown className="size-4" aria-hidden="true" /></button>
          <button type="button" className="icon-btn !size-9" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label="Hapus tautan"><Trash2 className="size-4" aria-hidden="true" /></button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...items, { label: '', href: '' }])}><Plus className="size-4" aria-hidden="true" /> Tambah tautan</button>
    </fieldset>
  );
}

function ImageField({ label, id, media, onPick, onClear }: { label: string; id: string | null; media?: MediaItem[]; onPick: () => void; onClear: () => void }) {
  const m = media?.find((x) => x.id === id);
  return (
    <div>
      <p className="mb-1 font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        {m ? <img src={m.thumb ?? m.url} alt="" className="size-16 rounded border border-line bg-soft object-contain" /> : <div className="grid size-16 place-items-center rounded border border-dashed border-line text-xs text-muted">{id ? 'ada' : 'kosong'}</div>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onPick}>Pilih gambar</button>
        {id && <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Hapus</button>}
      </div>
    </div>
  );
}

export default function Settings() {
  useDocumentTitle('Pengaturan');
  const toast = useToast();
  const { reload: reloadSite } = useSite();
  const { data, loading, error, reload } = useApi<S>('/admin/settings');
  const media = useApi<{ items: MediaItem[] }>('/admin/media?kind=image&limit=60');
  const [s, setS] = useState<S | null>(null);
  const [tab, setTab] = useState<Tab>('umum');
  const [pick, setPick] = useState<PickKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState<MediaItem[]>([]);
  const [demo, setDemo] = useState<{ articles: number; authors: number; media: number } | null>(null);
  const [askClear, setAskClear] = useState(false);

  useEffect(() => { if (data) setS(data); }, [data]);
  useEffect(() => { get<{ articles: number; authors: number; media: number }>('/admin/demo').then(setDemo).catch(() => setDemo(null)); }, []);

  if (loading && !s) return <Spinner label="Memuat pengaturan" />;
  if (error || !s) return <ErrorState message={error ?? 'Gagal memuat'} onRetry={reload} />;
  const up = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const imgs = [...(media.data?.items ?? []), ...extra];

  const save = async () => {
    setBusy(true);
    try {
      await put('/admin/settings', { ...s, nav: s.nav.filter((l) => l.label && l.href), footer: { ...s.footer, links: s.footer.links.filter((l) => l.label && l.href) } });
      toast.success('Pengaturan disimpan.');
      reloadSite();
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const clearDemo = async () => {
    setAskClear(false);
    try { await del('/admin/demo'); toast.success('Data contoh dihapus.'); setDemo({ articles: 0, authors: 0, media: 0 }); reloadSite(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const onPicked = (m: MediaItem) => {
    setExtra((x) => [...x, m]);
    if (pick === 'og') setS({ ...s, seo: { ...s.seo, og_image_id: m.id } });
    else if (pick) setS({ ...s, [pick]: m.id });
    setPick(null);
  };
  const social = (k: keyof S['social'], label: string) => (
    <Field label={label}>{(id) => <input id={id} type="url" className="field" placeholder="https://" value={s.social[k]} onChange={(e) => up('social', { ...s.social, [k]: e.target.value })} />}</Field>
  );

  return (
    <>
      <PageHeader title="Pengaturan" description="Identitas, tampilan, menu, SEO, dan fitur situs." actions={<button type="button" className="btn btn-accent" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'umum', label: 'Umum' }, { value: 'tampilan', label: 'Tampilan' }, { value: 'menu', label: 'Menu & footer' }, { value: 'sosial', label: 'Sosial & SEO' }, { value: 'fitur', label: 'Fitur' }, { value: 'contoh', label: 'Data contoh' }]} />
      <div className="max-w-2xl space-y-4">
        {tab === 'umum' && (<>
          <Field label="Nama situs">{(id) => <input id={id} className="field" maxLength={80} value={s.site_name} onChange={(e) => up('site_name', e.target.value)} />}</Field>
          <Field label="Tagline">{(id) => <input id={id} className="field" maxLength={160} value={s.tagline} onChange={(e) => up('tagline', e.target.value)} />}</Field>
          <Field label="Deskripsi situs" hint="Dipakai pada mesin pencari bila deskripsi SEO kosong.">{(id, d) => <textarea id={id} aria-describedby={d} className="field !min-h-24" maxLength={400} value={s.description} onChange={(e) => up('description', e.target.value)} />}</Field>
          <Field label="Email redaksi">{(id) => <input id={id} type="email" className="field" value={s.email_redaksi} onChange={(e) => up('email_redaksi', e.target.value)} />}</Field>
          <ImageField label="Logo" id={s.logo_id} media={imgs} onPick={() => setPick('logo_id')} onClear={() => up('logo_id', null)} />
          <ImageField label="Favicon" id={s.favicon_id} media={imgs} onPick={() => setPick('favicon_id')} onClear={() => up('favicon_id', null)} />
          <p className="hint">Bila logo atau favicon dikosongkan, logo bawaan POJOK SUARA dipakai.</p>
        </>)}
        {tab === 'tampilan' && (<>
          <Field label="Warna aksen" hint="Format #RRGGBB. Pastikan kontras cukup terhadap latar putih dan gelap.">{(id, d) => (
            <div className="flex items-center gap-2"><input type="color" aria-label="Pilih warna" className="size-11 rounded border border-line" value={s.theme.accent} onChange={(e) => up('theme', { ...s.theme, accent: e.target.value })} /><input id={id} aria-describedby={d} className="field max-w-40" value={s.theme.accent} onChange={(e) => up('theme', { ...s.theme, accent: e.target.value })} /></div>
          )}</Field>
          <Field label="Mode tampilan awal">{(id) => <select id={id} className="field" value={s.theme.default_mode} onChange={(e) => up('theme', { ...s.theme, default_mode: e.target.value as S['theme']['default_mode'] })}><option value="light">Terang</option><option value="dark">Gelap</option><option value="system">Ikuti perangkat</option></select>}</Field>
          <Field label="Jumlah tulisan per halaman" hint="4–48.">{(id) => <input id={id} type="number" min={4} max={48} className="field max-w-32" value={s.home.per_page} onChange={(e) => up('home', { ...s.home, per_page: Number(e.target.value) || 12 })} />}</Field>
        </>)}
        {tab === 'menu' && (<>
          <LinkList label="Menu utama" items={s.nav} onChange={(v) => up('nav', v)} />
          <Field label="Teks tentang di footer">{(id) => <textarea id={id} className="field !min-h-24" maxLength={600} value={s.footer.about} onChange={(e) => up('footer', { ...s.footer, about: e.target.value })} />}</Field>
          <Field label="Hak cipta">{(id) => <input id={id} className="field" maxLength={200} value={s.footer.copyright} onChange={(e) => up('footer', { ...s.footer, copyright: e.target.value })} />}</Field>
          <LinkList label="Tautan footer" items={s.footer.links} onChange={(v) => up('footer', { ...s.footer, links: v })} />
        </>)}
        {tab === 'sosial' && (<>
          {social('facebook', 'Facebook')}{social('instagram', 'Instagram')}{social('x', 'X (Twitter)')}{social('youtube', 'YouTube')}{social('tiktok', 'TikTok')}
          <Field label="Akhiran judul halaman">{(id) => <input id={id} className="field" maxLength={80} value={s.seo.title_suffix} onChange={(e) => up('seo', { ...s.seo, title_suffix: e.target.value })} />}</Field>
          <Field label="Deskripsi SEO" hint={`${s.seo.description.length}/300`}>{(id, d) => <textarea id={id} aria-describedby={d} className="field !min-h-20" maxLength={300} value={s.seo.description} onChange={(e) => up('seo', { ...s.seo, description: e.target.value })} />}</Field>
          <ImageField label="Gambar bawaan untuk berbagi (OG)" id={s.seo.og_image_id} media={imgs} onPick={() => setPick('og')} onClear={() => up('seo', { ...s.seo, og_image_id: null })} />
        </>)}
        {tab === 'fitur' && (<>
          <Toggle checked={s.comments.enabled} onChange={(v) => up('comments', { ...s.comments, enabled: v })} label="Aktifkan komentar" />
          <Field label="Moderasi komentar">{(id) => <select id={id} className="field" value={s.comments.moderation} onChange={(e) => up('comments', { ...s.comments, moderation: e.target.value as 'manual' | 'auto' })}><option value="manual">Manual: tunggu persetujuan redaksi</option><option value="auto">Otomatis tampil (spam tetap disaring)</option></select>}</Field>
          <Toggle checked={s.newsletter_enabled} onChange={(v) => up('newsletter_enabled', v)} label="Aktifkan newsletter" />
          <Toggle checked={s.submissions_enabled} onChange={(v) => up('submissions_enabled', v)} label="Terima kiriman tulisan" hint="Formulir Kirim Tulisan di situs publik." />
        </>)}
        {tab === 'contoh' && (
          <div className="rounded border border-line bg-card p-4">
            <h2 className="font-serif text-lg font-bold">Data contoh</h2>
            {demo && (demo.articles || demo.authors || demo.media) ? (<>
              <p className="my-2 text-sm">Terdapat {demo.articles} tulisan, {demo.authors} penulis, dan {demo.media} gambar contoh. Hapus sebelum situs diumumkan; data buatan Anda tidak ikut terhapus.</p>
              <button type="button" className="btn btn-danger" onClick={() => setAskClear(true)}>Hapus semua data contoh</button>
            </>) : <p className="mt-2 text-sm text-muted">Tidak ada data contoh.</p>}
          </div>
        )}
      </div>
      {pick && <MediaPicker onClose={() => setPick(null)} onSelect={onPicked} />}
      {askClear && <ConfirmDialog title="Hapus data contoh?" confirmLabel="Hapus semua" message="Seluruh tulisan, penulis, dan gambar contoh akan dihapus permanen. Disarankan membuat backup lebih dulu." onConfirm={clearDemo} onClose={() => setAskClear(false)} />}
    </>
  );
}
