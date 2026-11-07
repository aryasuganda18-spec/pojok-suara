import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Field } from '../components/ui';
import { useSite, useToast } from '../hooks/contexts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, errorMessage } from '../lib/api';
import { prepareImage } from '../lib/image';

const MAX_IMAGE = 5 * 1024 * 1024;

export default function Submit() {
  useDocumentTitle('Kirim Tulisan');
  const { site } = useSite();
  const toast = useToast();
  const opened = useRef(Date.now());
  const [values, setValues] = useState({ name: '', email: '', title: '', type: 'opini', category_id: '', content: '', agree: false, website: '' });
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (values.name.trim().length < 2) e.name = 'Nama minimal 2 karakter';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) e.email = 'Masukkan email yang valid';
    if (values.title.trim().length < 5) e.title = 'Judul minimal 5 karakter';
    if (values.content.trim().length < 200) e.content = `Isi tulisan minimal 200 karakter (sekarang ${values.content.trim().length})`;
    if (image && !/^image\/(jpeg|png|webp)$/.test(image.type)) e.image = 'Gambar harus berformat JPG, PNG, atau WEBP';
    if (image && image.size > MAX_IMAGE) e.image = 'Ukuran gambar maksimal 5 MB';
    if (!values.agree) e.agree = 'Anda harus menyetujui kebijakan publikasi';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Periksa kembali isian yang ditandai.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries(values)) form.append(k, String(v));
      form.append('elapsed', String(Date.now() - opened.current));
      if (image) form.append('image', await prepareImage(image));
      const res = await api<{ message: string }>('/submissions', { method: 'POST', form });
      setDone(res.message);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (site && !site.submissions_enabled) {
    return <div className="container-page max-w-2xl py-16 text-center"><h1 className="font-serif text-3xl font-extrabold">Pengiriman tulisan ditutup</h1><p className="mt-2 text-muted">Redaksi sedang tidak menerima kiriman. Silakan kembali lagi nanti.</p></div>;
  }

  if (done) {
    return (
      <div className="container-page max-w-2xl py-16 text-center">
        <CheckCircle2 className="mx-auto size-12 text-accent" aria-hidden="true" />
        <h1 className="mt-3 font-serif text-3xl font-extrabold">Terima kasih!</h1>
        <p className="mt-2 text-muted" role="status">{done}</p>
        <Link to="/" className="btn mt-6">Kembali ke beranda</Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-8 md:py-12">
      <p className="kicker">Redaksi</p>
      <h1 className="font-serif text-3xl font-extrabold sm:text-4xl">Kirim Tulisan</h1>
      <p className="mt-2 text-muted">Tulisan Anda akan masuk antrean peninjauan dan tidak langsung terbit. Baca <Link to="/halaman/pedoman-penulisan" className="text-accent underline">pedoman penulisan</Link> lebih dulu.</p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama" error={errors.name}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={Boolean(errors.name)} className="field" autoComplete="name" maxLength={80} value={values.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Email" hint="Tidak ditampilkan, hanya untuk konfirmasi redaksi." error={errors.email}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={Boolean(errors.email)} type="email" className="field" autoComplete="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        </div>
        <Field label="Judul tulisan" error={errors.title}>{(id, d) => <input id={id} aria-describedby={d} aria-invalid={Boolean(errors.title)} className="field" maxLength={200} value={values.title} onChange={(e) => set('title', e.target.value)} />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Jenis tulisan">{(id) => (
            <select id={id} className="field" value={values.type} onChange={(e) => set('type', e.target.value)}>
              <option value="opini">Opini</option><option value="kritik">Kritik sosial</option><option value="artikel">Artikel / esai / analisis</option><option value="berita">Berita</option>
            </select>
          )}</Field>
          <Field label="Kategori">{(id) => (
            <select id={id} className="field" value={values.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">Biarkan redaksi menentukan</option>
              {site?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}</Field>
        </div>
        <Field label="Isi tulisan" hint={`${values.content.trim().length} karakter. Pisahkan paragraf dengan baris kosong.`} error={errors.content}>{(id, d) => <textarea id={id} aria-describedby={d} aria-invalid={Boolean(errors.content)} className="field !min-h-64" maxLength={30000} value={values.content} onChange={(e) => set('content', e.target.value)} />}</Field>
        <Field label="Gambar (opsional)" hint="JPG, PNG, atau WEBP, maksimal 5 MB. Pastikan Anda berhak memakainya." error={errors.image}>{(id, d) => <input id={id} aria-describedby={d} type="file" accept="image/jpeg,image/png,image/webp" className="field !py-2" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />}</Field>

        <div className="absolute -left-[9999px]" aria-hidden="true"><label>Situs web<input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set('website', e.target.value)} /></label></div>

        <div>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" checked={values.agree} onChange={(e) => set('agree', e.target.checked)} aria-invalid={Boolean(errors.agree)} />
            <span>Saya menyatakan tulisan ini karya saya sendiri, dan menyetujui <Link to="/halaman/syarat-dan-ketentuan" className="text-accent underline">kebijakan publikasi</Link> serta penyuntingan oleh redaksi.</span>
          </label>
          {errors.agree && <p className="error-text" role="alert">{errors.agree}</p>}
        </div>

        <button type="submit" className="btn btn-accent w-full sm:w-auto" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim ke redaksi'}</button>
      </form>
    </div>
  );
}
