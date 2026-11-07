import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader, Toggle } from '../../components/admin/kit';
import { ErrorState, Field, Skeleton } from '../../components/ui';
import { useAuth, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, post, put } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { Role } from '../../lib/types';

interface UserRow {
  id: string;
  username: string;
  email: string;
  name: string;
  role: Role;
  role_label: string;
  active: boolean;
  locked: boolean;
  last_login_at: string | null;
}

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'super_admin', label: 'Super Admin', hint: 'Semua fitur, akun, dan pengaturan.' },
  { value: 'editor', label: 'Editor', hint: 'Meninjau, menerbitkan, kategori, komentar.' },
  { value: 'penulis', label: 'Penulis', hint: 'Membuat dan mengedit tulisan miliknya, kirim untuk review.' },
  { value: 'kontributor', label: 'Kontributor', hint: 'Mengirim tulisan dan mengedit sebelum terbit.' },
];

function UserForm({ initial, onClose, onSaved }: { initial?: UserRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ username: initial?.username ?? '', name: initial?.name ?? '', email: initial?.email ?? '', role: (initial?.role ?? 'penulis') as Role, active: initial?.active ?? true, password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!initial && !/^[a-z0-9._-]{3,30}$/.test(f.username)) er.username = '3–30 karakter: huruf kecil, angka, titik, garis bawah, tanda hubung';
    if (f.name.trim().length < 2) er.name = 'Nama minimal 2 karakter';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) er.email = 'Email tidak valid';
    if ((!initial || f.password) && (f.password.length < 10 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password))) er.password = 'Minimal 10 karakter, mengandung huruf dan angka';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      if (initial) await put(`/admin/users/${initial.id}`, { name: f.name, email: f.email, role: f.role, active: f.active, ...(f.password ? { password: f.password } : {}) });
      else await post('/admin/users', { username: f.username, name: f.name, email: f.email, role: f.role, password: f.password });
      toast.success(initial ? 'Pengguna diperbarui.' : 'Pengguna dibuat. Mereka wajib mengganti kata sandi saat login pertama.');
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial ? `Edit ${initial.username}` : 'Tambah pengguna'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {!initial && <Field label="Username" error={errors.username}>{(id, d) => <input id={id} aria-describedby={d} className="field" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} />}</Field>}
        <Field label="Nama lengkap" error={errors.name}>{(id, d) => <input id={id} aria-describedby={d} className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Email" error={errors.email}>{(id, d) => <input id={id} aria-describedby={d} type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Peran" hint={ROLES.find((r) => r.value === f.role)?.hint}>{(id, d) => <select id={id} aria-describedby={d} className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>}</Field>
        <Field label={initial ? 'Kata sandi baru (kosongkan bila tidak diganti)' : 'Kata sandi sementara'} hint="Pengguna wajib menggantinya saat login pertama." error={errors.password}>{(id, d) => <input id={id} aria-describedby={d} type="text" autoComplete="off" className="field" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>
        {initial && <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Akun aktif" hint="Akun nonaktif tidak dapat login." />}
        {errors.form && <p role="alert" className="error-text">{errors.form}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
    </Modal>
  );
}

export default function Users() {
  useDocumentTitle('Pengguna');
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: UserRow[] }>('/admin/users');
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [doomed, setDoomed] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!doomed) return;
    setBusy(true);
    try {
      await del(`/admin/users/${doomed.id}`);
      toast.success('Pengguna dihapus.');
      setDoomed(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Pengguna" description="Kelola akun redaksi dan peran akses. Hak akses selalu diperiksa di server." actions={<button type="button" className="btn btn-accent" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden="true" /> Tambah</button>} />
      {loading && !data ? <Skeleton className="h-48 w-full" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card">
          {data?.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{u.name} <span className="meta font-normal">@{u.username}</span>{u.id === me?.id && <span className="meta ml-2">(Anda)</span>}</p>
                <p className="meta">{u.email} · login terakhir {u.last_login_at ? formatDateTime(u.last_login_at) : 'belum pernah'}</p>
              </div>
              <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold">{u.role_label}</span>
              {!u.active && <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-semibold text-muted">Nonaktif</span>}
              {u.locked && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">Terkunci</span>}
              <div className="flex gap-1">
                <button type="button" className="icon-btn border border-line" onClick={() => setEditing(u)} aria-label={`Edit ${u.username}`}><Pencil className="size-4" aria-hidden="true" /></button>
                {u.id !== me?.id && <button type="button" className="icon-btn border border-line" onClick={() => setDoomed(u)} aria-label={`Hapus ${u.username}`}><Trash2 className="size-4" aria-hidden="true" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <UserForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {doomed && <ConfirmDialog title="Hapus pengguna?" busy={busy} message={<>Akun <strong>{doomed.username}</strong> akan dihapus dan tidak dapat login lagi. Tulisan miliknya tetap ada.</>} onConfirm={remove} onClose={() => setDoomed(null)} />}
    </>
  );
}
