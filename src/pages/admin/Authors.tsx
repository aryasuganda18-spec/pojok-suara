import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { Modal, PageHeader, Toggle } from '../../components/admin/kit';
import { MediaPicker } from '../../components/admin/MediaPicker';
import { Avatar, EmptyState, ErrorState, Field, Skeleton } from '../../components/ui';
import { useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage, put } from '../../lib/api';
import { formatDate } from '../../lib/format';

interface Author {
  id: string;
  name: string;
  username: string;
  avatar_id: string | null;
  bio: string;
  email: string;
  show_email: boolean;
  social: { website: string; x: string; instagram: string; facebook: string; linkedin: string };
  fields: string[];
  joined_at: string;
  article_count: number;
  demo: boolean;
}

function AuthorForm({ author, avatarUrl, onClose, onSaved }: { author: Author; avatarUrl: string | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: author.name, bio: author.bio, email: author.email, show_email: author.show_email, fields: author.fields.join(', '), avatar_id: author.avatar_id, ...author.social });
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return setError('Nama minimal 2 karakter');
    setBusy(true);
    try {
      await put(`/admin/authors/${author.id}`, {
        name: f.name, bio: f.bio, email: f.email, show_email: f.show_email, avatar_id: f.avatar_id,
        fields: f.fields.split(',').map((s) => s.trim()).filter(Boolean),
        social: { website: f.website, x: f.x, instagram: f.instagram, facebook: f.facebook, linkedin: f.linkedin },
      });
      toast.success('Profil penulis disimpan.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const text = (key: 'website' | 'x' | 'instagram' | 'facebook' | 'linkedin', label: string, ph = '') => (
    <Field label={label}>{(id) => <input id={id} className="field" placeholder={ph} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />}</Field>
  );

  return (
    <Modal title={`Profil: ${author.name}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar src={avatar} name={f.name} size={72} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>Ganti foto</button>
            {f.avatar_id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setF({ ...f, avatar_id: null }); setAvatar(null); }}>Hapus foto</button>}
          </div>
        </div>
        <Field label="Nama lengkap" error={error}>{(id, d) => <input id={id} aria-describedby={d} className="field" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Username" hint="Dipakai pada alamat profil dan tidak dapat diubah.">{(id, d) => <input id={id} aria-describedby={d} className="field" value={author.username} readOnly />}</Field>
        <Field label="Bio singkat" hint={`${f.bio.length}/600`}>{(id, d) => <textarea id={id} aria-describedby={d} className="field !min-h-24" maxLength={600} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <input id={id} type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Toggle checked={f.show_email} onChange={(v) => setF({ ...f, show_email: v })} label="Tampilkan email di profil publik" />
        <Field label="Bidang tulisan" hint="Pisahkan dengan koma, contoh: Pendidikan, Ekonomi.">{(id, d) => <input id={id} aria-describedby={d} className="field" value={f.fields} onChange={(e) => setF({ ...f, fields: e.target.value })} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('website', 'Situs web', 'https://')}{text('x', 'X (Twitter)', '@nama')}{text('instagram', 'Instagram', '@nama')}{text('facebook', 'Facebook')}{text('linkedin', 'LinkedIn')}
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
      {picking && <MediaPicker title="Foto profil" onClose={() => setPicking(false)} onSelect={(m) => { setF({ ...f, avatar_id: m.id }); setAvatar(m.thumb ?? m.url); setPicking(false); }} />}
    </Modal>
  );
}

export default function Authors() {
  useDocumentTitle('Penulis');
  const { data, loading, error, reload } = useApi<{ items: Author[] }>('/admin/authors');
  const media = useApi<{ items: { id: string; thumb: string | null; url: string }[] }>('/admin/media?kind=image&limit=60');
  const [editing, setEditing] = useState<Author | null>(null);
  const avatarOf = (a: Author) => { const m = media.data?.items.find((x) => x.id === a.avatar_id); return m ? m.thumb ?? m.url : null; };

  return (
    <>
      <PageHeader title="Penulis" description="Profil penulis tampil di halaman artikel dan halaman penulis." />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.items.length ? <EmptyState title="Belum ada penulis" /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((a) => (
            <li key={a.id} className="flex gap-3 rounded border border-line bg-card p-4">
              <Avatar src={avatarOf(a)} name={a.name} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-bold">{a.name}{a.demo && <span className="meta ml-2 font-sans font-normal">contoh</span>}</p>
                <p className="meta">@{a.username} · {a.article_count} tulisan · bergabung {formatDate(a.joined_at)}</p>
                {a.bio && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.bio}</p>}
              </div>
              <button type="button" className="icon-btn self-start border border-line" onClick={() => setEditing(a)} aria-label={`Edit profil ${a.name}`}><Pencil className="size-4" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      {editing && <AuthorForm author={editing} avatarUrl={avatarOf(editing)} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
