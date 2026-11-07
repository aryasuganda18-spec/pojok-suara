import { useRef, useState } from 'react';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { ConfirmDialog, PageHeader } from '../../components/admin/kit';
import { ErrorState, Spinner } from '../../components/ui';
import { useAuth, useToast } from '../../hooks/contexts';
import { useApi } from '../../hooks/useApi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { del, errorMessage, post, upload } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/format';

interface Backup { name: string; reason: string; size: number; created_at: string }
const REASONS: Record<string, string> = { manual: 'Manual', auto: 'Otomatis', 'pre-restore': 'Pengaman sebelum restore' };

export default function BackupPage() {
  useDocumentTitle('Backup & restore');
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, loading, error, reload } = useApi<{ items: Backup[] }>('/admin/backups');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<{ type: 'restore' | 'delete'; name: string } | { type: 'upload'; file: File } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(label);
    try { await fn(); toast.success(ok); reload(); await refresh().catch(() => undefined); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(''); }
  };

  const onConfirm = () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.type === 'upload') { const form = new FormData(); form.append('file', c.file); void run('restore', () => upload('/admin/backups/restore-upload', form), 'Data berhasil dipulihkan.'); }
    else if (c.type === 'delete') void run('delete', () => del(`/admin/backups/${c.name}`), 'Backup dihapus.');
    else if (c.type === 'restore') void run('restore', () => post(`/admin/backups/${c.name}/restore`), 'Data berhasil dipulihkan.');
  };

  return (
    <>
      <PageHeader title="Backup & restore" description="Backup berisi seluruh data (artikel, media, pengguna, pengaturan). Simpan salinannya di luar server." actions={<button type="button" className="btn btn-accent" disabled={!!busy} onClick={() => run('create', () => post('/admin/backups'), 'Backup dibuat.')}>{busy === 'create' ? 'Membuat…' : 'Buat backup sekarang'}</button>} />
      <div className="mb-6 rounded border border-line bg-card p-4">
        <h2 className="font-serif text-lg font-bold">Pulihkan dari file</h2>
        <p className="mb-3 text-sm text-muted">Pilih file .zip hasil backup. Data lama tidak dihapus sebelum backup divalidasi, dan salinan pengaman dibuat otomatis.</p>
        <input ref={fileRef} type="file" accept=".zip,application/zip" className="sr-only" aria-label="File backup" onChange={(e) => { const f = e.target.files?.[0]; if (f) setConfirm({ type: 'upload', file: f }); e.target.value = ''; }} />
        <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" /> Pilih file backup</button>
      </div>
      {busy === 'restore' && <Spinner label="Memulihkan data, jangan tutup halaman" />}
      {loading && !data ? <Spinner label="Memuat daftar backup" /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <ul className="divide-y divide-line rounded border border-line bg-card">
          {!data?.items.length && <li className="p-4 text-sm text-muted">Belum ada backup.</li>}
          {data?.items.map((b) => (
            <li key={b.name} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{b.name}</p><p className="meta">{REASONS[b.reason] ?? b.reason} · {formatBytes(b.size)} · {formatDateTime(b.created_at)}</p></div>
              <div className="flex gap-1">
                <a className="icon-btn border border-line" href={`/api/admin/backups/${encodeURIComponent(b.name)}/download`} download aria-label={`Unduh ${b.name}`}><Download className="size-4" aria-hidden="true" /></a>
                <button type="button" className="icon-btn border border-line" disabled={!!busy} onClick={() => setConfirm({ type: 'restore', name: b.name })} aria-label={`Pulihkan ${b.name}`}><RotateCcw className="size-4" aria-hidden="true" /></button>
                <button type="button" className="icon-btn border border-line" disabled={!!busy} onClick={() => setConfirm({ type: 'delete', name: b.name })} aria-label={`Hapus ${b.name}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.type === 'delete' ? 'Hapus backup?' : 'Pulihkan data?'}
          confirmLabel={confirm.type === 'delete' ? 'Hapus' : 'Pulihkan'}
          danger={confirm.type === 'delete'}
          message={confirm.type === 'delete' ? <>File <strong>{confirm.name}</strong> akan dihapus permanen.</> : <>Seluruh data saat ini akan diganti dengan isi <strong>{confirm.type === 'upload' ? confirm.file.name : confirm.name}</strong>. Backup pengaman dibuat lebih dulu.</>}
          onConfirm={onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
